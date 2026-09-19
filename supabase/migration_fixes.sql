-- ============================================================
-- PELÍCULA · PROM NIGHT
-- POST-AUDIT FIXES
-- ============================================================
--
-- Run this AFTER supabase/schema.sql has already been applied.
-- Safe to re-run (uses create-or-replace / drop-if-exists).
--
-- Fixes:
--   1. Adds the missing recover_student_access_code() RPC
--      (Critical Issue 3 — frontend called a function that
--      did not exist).
--   2. Adds a database-level trigger that enforces the
--      Male/Female-only rule on public.matches, so the rule
--      no longer depends solely on the frontend
--      (Critical Issue 1).
--   3. Adds publish_match_atomic(), a single-transaction RPC
--      that publishes a match AND marks both students as
--      matched together, replacing the old two-step update
--      that could leave inconsistent state on partial
--      failure (High Issue 4).
--
-- ============================================================


-- ============================================================
-- 1. RECOVER STUDENT ACCESS CODE
-- ============================================================
--
-- Returns the access code for the student whose Instagram ID
-- and Favourite Movie match (case-insensitive, leading "@"
-- ignored). Returns zero rows if there is no match.
--
-- NOTE (see audit report, High Issue 6): recovering a
-- credential from Instagram ID + Favourite Movie alone is a
-- weak recovery mechanism, since both can be semi-public
-- information about a student. Consider rate-limiting calls
-- to this function (e.g. via an Edge Function in front of it)
-- before relying on it at event scale.
-- ============================================================

create or replace function public.recover_student_access_code(
    p_instagram_id text,
    p_favourite_movie text
)
returns table (
    access_code text
)

language sql

security definer

set search_path = public

as $$

    select s.access_code

    from public.students s

    where
        lower(trim(leading '@' from trim(s.instagram_id)))
            = lower(trim(leading '@' from trim(p_instagram_id)))

        and lower(trim(s.favourite_movie))
            = lower(trim(p_favourite_movie))

    limit 1;

$$;

grant execute
on function public.recover_student_access_code(text, text)
to anon, authenticated;


-- ============================================================
-- 2. ENFORCE MALE/FEMALE MATCH RULE AT THE DATABASE LEVEL
-- ============================================================
--
-- Postgres CHECK constraints cannot reference another table,
-- so this rule is enforced with a BEFORE INSERT/UPDATE
-- trigger instead. This is a backstop underneath the
-- application-level check added in createMatch.js — even if
-- a future code change (or a direct API call) skips the
-- frontend check, the database will refuse the row.
-- ============================================================

create or replace function public.enforce_match_gender_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_gender_a text;
    v_gender_b text;
begin

    select lower(trim(gender)) into v_gender_a
    from public.students
    where id = new.student_a_id;

    select lower(trim(gender)) into v_gender_b
    from public.students
    where id = new.student_b_id;

    if v_gender_a is distinct from 'male' or v_gender_b is distinct from 'female' then
        raise exception
            'Invalid match: student_a_id must be male and student_b_id must be female (got % / %).',
            v_gender_a, v_gender_b;
    end if;

    return new;

end;
$$;

drop trigger if exists matches_enforce_gender_rule on public.matches;

create trigger matches_enforce_gender_rule
before insert or update
on public.matches
for each row
execute function public.enforce_match_gender_rule();


-- ============================================================
-- 3. ATOMIC MATCH PUBLISH
-- ============================================================
--
-- Publishes a draft match AND marks both students as
-- "matched" in a single transaction. If any check fails
-- (match not found, not a draft, or either student is no
-- longer waiting) the whole call raises an exception and
-- NOTHING is changed — there is no window where the match is
-- published but a student is left at "waiting".
-- ============================================================

create or replace function public.publish_match_atomic(
    p_match_id uuid
)
returns table (
    match_id uuid,
    student_a_id uuid,
    student_b_id uuid,
    student_a_name text,
    student_b_name text,
    published_at timestamptz
)

language plpgsql

security definer

set search_path = public

as $$
declare
    v_match public.matches%rowtype;
    v_student_a public.students%rowtype;
    v_student_b public.students%rowtype;
    v_published_at timestamptz := now();
begin

    if not public.is_director() then
        raise exception 'Only an authenticated Director can publish a match.';
    end if;

    select * into v_match
    from public.matches
    where id = p_match_id
    for update;

    if not found then
        raise exception 'Match not found.';
    end if;

    if v_match.status <> 'draft' then
        raise exception 'Match is not a draft.';
    end if;

    select * into v_student_a
    from public.students
    where id = v_match.student_a_id
    for update;

    select * into v_student_b
    from public.students
    where id = v_match.student_b_id
    for update;

    if v_student_a.status <> 'waiting' or v_student_b.status <> 'waiting' then
        raise exception 'One or both students are no longer waiting.';
    end if;

    update public.matches
    set status = 'published',
        published_at = v_published_at
    where id = p_match_id;

    update public.students
    set status = 'matched'
    where id in (v_match.student_a_id, v_match.student_b_id);

    return query
    select
        v_match.id,
        v_match.student_a_id,
        v_match.student_b_id,
        v_student_a.name,
        v_student_b.name,
        v_published_at;

end;
$$;

grant execute
on function public.publish_match_atomic(uuid)
to authenticated;
