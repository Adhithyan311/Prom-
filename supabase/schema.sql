-- ============================================================
-- SAME SCENE
-- CLEAN DATABASE SCHEMA
-- ============================================================
--
-- Architecture:
--
-- Supabase Auth
--     └── Director email + password
--
-- PostgreSQL
--     ├── directors
--     ├── students
--     └── matches
--
-- Student registration fields:
--     name
--     department
--     semester
--     instagram_id
--     favourite_movie
--     gender
--     match_intent
--
-- No automatic matching.
-- No compatibility score.
-- No favourite genre.
-- No favourite music.
-- No costume data.
-- No Director participant.
--
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 2. REMOVE OLD SAME SCENE DATABASE OBJECTS
-- ============================================================

-- Remove old functions first because they depend on old tables.

drop function if exists public.ensure_director_record(jsonb);

drop function if exists public.create_match_if_eligible(
    uuid,
    uuid,
    numeric,
    integer
);

drop function if exists public.next_candidate_code();

-- Remove old tables.

drop table if exists public.directors cascade;
drop table if exists public.matches cascade;
drop table if exists public.participants cascade;

-- Remove old enum.

drop type if exists public.participant_role cascade;


-- ============================================================
-- 3. DIRECTORS TABLE
-- ============================================================
--
-- IMPORTANT:
-- A Director is NOT a student.
-- A Director is NOT stored inside students.
--
-- Supabase Auth stores:
--     email
--     password
--     authentication session
--
-- This table only identifies which authenticated Auth user
-- has Director privileges.
--
-- The id MUST equal auth.users.id.
--
-- ============================================================

create table public.directors (

    id uuid primary key
        references auth.users(id)
        on delete cascade,

    created_at timestamptz not null default now()

);


-- ============================================================
-- 4. STUDENTS TABLE
-- ============================================================

create table public.students (

    id uuid primary key default gen_random_uuid(),

    -- Random student access code.
    -- Example:
    -- SS-7K4P-X92M
    access_code text not null unique,

    -- Required student information
    name text not null,
    department text not null,
    semester text not null,
    instagram_id text not null,
    favourite_movie text not null,
    gender text not null,
    match_intent text not null,

    -- System status
    status text not null default 'waiting'
        check (
            status in ('waiting', 'matched')
        ),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);


-- ============================================================
-- 5. MATCHES TABLE
-- ============================================================
--
-- The Director manually selects:
--
-- Student A
--     +
-- Student B
--     ↓
-- Match
--
-- There is NO score.
-- There is NO AI.
-- There is NO automatic matching.
--
-- ============================================================

create table public.matches (

    id uuid primary key default gen_random_uuid(),

    student_a_id uuid not null
        references public.students(id)
        on delete restrict,

    student_b_id uuid not null
        references public.students(id)
        on delete restrict,

    status text not null default 'draft'
        check (
            status in ('draft', 'published')
        ),

    created_at timestamptz not null default now(),

    published_at timestamptz,

    -- A student cannot be matched with themselves.
    constraint matches_students_must_be_different
        check (student_a_id <> student_b_id)

);


-- ============================================================
-- 6. ONE MATCH PER STUDENT
-- ============================================================
--
-- This prevents:
--
-- Student A + Student B
-- Student A + Student C   ❌
--
-- Student B + Student D   ❌
--
-- Each student can participate in only ONE match.
--
-- ============================================================

create unique index matches_one_match_per_student_a
on public.matches(student_a_id);

create unique index matches_one_match_per_student_b
on public.matches(student_b_id);


-- ============================================================
-- 7. INDEXES
-- ============================================================

create index students_status_idx
on public.students(status);

create index students_created_at_idx
on public.students(created_at desc);

create index matches_created_at_idx
on public.matches(created_at desc);

create index matches_status_idx
on public.matches(status);


-- ============================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.directors enable row level security;

alter table public.students enable row level security;

alter table public.matches enable row level security;


-- ============================================================
-- 9. DIRECTOR HELPER FUNCTION
-- ============================================================
--
-- Returns TRUE when the currently authenticated Supabase
-- Auth user is registered as a Director.
--
-- This function is used by RLS policies.
--
-- ============================================================

create or replace function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$

    select exists (
        select 1
        from public.directors
        where id = auth.uid()
    );

$$;


-- ============================================================
-- 10. DIRECTOR POLICIES
-- ============================================================
--
-- Normal users cannot read or modify the directors table.
--
-- Director authorization is managed through the authenticated
-- Supabase Auth user + directors table.
--
-- ============================================================

create policy "directors_can_view_their_own_record"

on public.directors

for select

to authenticated

using (
    id = auth.uid()
);


-- ============================================================
-- 11. STUDENT INSERT POLICY
-- ============================================================
--
-- A student registration is allowed without a Supabase
-- authentication account.
--
-- The website can therefore register students using the
-- anonymous/public client.
--
-- IMPORTANT:
-- Only the required fields are accepted.
--
-- ============================================================

create policy "students_can_register"

on public.students

for insert

to anon, authenticated

with check (

    name is not null
    and length(trim(name)) > 0

    and department is not null
    and length(trim(department)) > 0

    and semester is not null
    and length(trim(semester)) > 0

    and instagram_id is not null
    and length(trim(instagram_id)) > 0

    and favourite_movie is not null
    and length(trim(favourite_movie)) > 0

    and gender is not null
    and length(trim(gender)) > 0

    and match_intent is not null
    and length(trim(match_intent)) > 0

    and status = 'waiting'

);


-- ============================================================
-- 12. DIRECTOR STUDENT ACCESS
-- ============================================================
--
-- Only an authenticated Director can directly read students.
--
-- Students do NOT receive a policy allowing them to read
-- the entire students table.
--
-- ============================================================

create policy "directors_can_view_students"

on public.students

for select

to authenticated

using (
    public.is_director()
);


-- ============================================================
-- 13. DIRECTOR CAN UPDATE STUDENTS
-- ============================================================
--
-- Required when a match is created/published and the student
-- status changes from waiting → matched.
--
-- ============================================================

create policy "directors_can_update_students"

on public.students

for update

to authenticated

using (
    public.is_director()
)

with check (
    public.is_director()
);


-- ============================================================
-- 14. NO PUBLIC STUDENT UPDATE
-- ============================================================
--
-- There is intentionally NO UPDATE policy for anon users.
--
-- A student cannot modify their own registration through
-- direct database access.
--
-- ============================================================


-- ============================================================
-- 15. NO PUBLIC STUDENT DELETE
-- ============================================================
--
-- There is intentionally NO DELETE policy.
--
-- ============================================================


-- ============================================================
-- 16. DIRECTOR CAN CREATE MATCHES
-- ============================================================

create policy "directors_can_create_matches"

on public.matches

for insert

to authenticated

with check (
    public.is_director()
);


-- ============================================================
-- 17. DIRECTOR CAN VIEW MATCHES
-- ============================================================

create policy "directors_can_view_matches"

on public.matches

for select

to authenticated

using (
    public.is_director()
);


-- ============================================================
-- 18. DIRECTOR CAN UPDATE MATCHES
-- ============================================================
--
-- Used for:
--
-- draft → published
--
-- ============================================================

create policy "directors_can_update_matches"

on public.matches

for update

to authenticated

using (
    public.is_director()
)

with check (
    public.is_director()
);


-- ============================================================
-- 19. NO PUBLIC MATCH INSERT
-- ============================================================
--
-- There is intentionally NO anonymous INSERT policy.
--
-- Students cannot create matches.
--
-- ============================================================


-- ============================================================
-- 20. NO PUBLIC MATCH UPDATE
-- ============================================================
--
-- There is intentionally NO anonymous UPDATE policy.
--
-- ============================================================


-- ============================================================
-- 21. NO PUBLIC MATCH DELETE
-- ============================================================
--
-- Matches should be controlled by the Director.
--
-- ============================================================


-- ============================================================
-- 22. STUDENT ACCESS FUNCTIONS
-- ============================================================
--
-- Students don't have Supabase Auth accounts.
--
-- Therefore they use their unique access_code.
--
-- IMPORTANT:
-- We do NOT make the students table publicly readable.
--
-- Instead, these controlled functions return only the
-- information associated with the supplied access code.
--
-- ============================================================


-- ------------------------------------------------------------
-- 22A. GET STUDENT BY ACCESS CODE
-- ------------------------------------------------------------

create or replace function public.get_student_by_access_code(
    p_access_code text
)
returns table (
    id uuid,
    access_code text,
    name text,
    department text,
    semester text,
    instagram_id text,
    favourite_movie text,
    gender text,
    match_intent text,
    status text,
    created_at timestamptz
)

language sql

security definer

set search_path = public

as $$

    select
        s.id,
        s.access_code,
        s.name,
        s.department,
        s.semester,
        s.instagram_id,
        s.favourite_movie,
        s.gender,
        s.match_intent,
        s.status,
        s.created_at

    from public.students s

    where s.access_code = p_access_code

    limit 1;

$$;


-- ------------------------------------------------------------
-- 22B. GET STUDENT MATCH BY ACCESS CODE
-- ------------------------------------------------------------
--
-- This returns ONLY the match belonging to the supplied
-- access code.
--
-- It does NOT expose all matches.
--
-- ============================================================

create or replace function public.get_student_match_by_access_code(
    p_access_code text
)
returns table (
    match_id uuid,

    student_id uuid,
    student_name text,
    student_department text,
    student_semester text,
    student_instagram_id text,
    student_favourite_movie text,
    student_gender text,
    student_match_intent text,

    matched_student_id uuid,
    matched_student_name text,
    matched_student_department text,
    matched_student_semester text,
    matched_student_instagram_id text,
    matched_student_favourite_movie text,
    matched_student_gender text,
    matched_student_match_intent text,

    match_status text,
    published_at timestamptz

)

language sql

security definer

set search_path = public

as $$

    select

        m.id,

        s1.id,
        s1.name,
        s1.department,
        s1.semester,
        s1.instagram_id,
        s1.favourite_movie,
        s1.gender,
        s1.match_intent,

        s2.id,
        s2.name,
        s2.department,
        s2.semester,
        s2.instagram_id,
        s2.favourite_movie,
        s2.gender,
        s2.match_intent,

        m.status,
        m.published_at

    from public.students s1

    join public.matches m
        on (
            m.student_a_id = s1.id
            or
            m.student_b_id = s1.id
        )

    join public.students s2
        on (
            (
                m.student_a_id = s1.id
                and m.student_b_id = s2.id
            )
            or
            (
                m.student_b_id = s1.id
                and m.student_a_id = s2.id
            )
        )

    where
        s1.access_code = p_access_code

        and m.status = 'published'

    limit 1;

$$;


-- ============================================================
-- 23. FUNCTION SECURITY
-- ============================================================
--
-- These functions run with controlled privileges.
--
-- We explicitly allow the browser client to call them.
--
-- ============================================================

grant execute
on function public.get_student_by_access_code(text)
to anon, authenticated;


grant execute
on function public.get_student_match_by_access_code(text)
to anon, authenticated;


-- ============================================================
-- 24. DIRECTOR HELPER FUNCTION SECURITY
-- ============================================================

grant execute
on function public.is_director()
to authenticated;


-- ============================================================
-- 25. REALTIME
-- ============================================================
--
-- Allows the frontend to subscribe to changes.
--
-- Useful later for:
--
-- Director publishes match
--        ↓
-- Student waiting page updates
--
-- ============================================================

alter publication supabase_realtime
add table public.students;

alter publication supabase_realtime
add table public.matches;


-- ============================================================
-- 26. COMMENTS
-- ============================================================

comment on table public.students is
'Same Scene student registrations. Contains only required student information.';

comment on table public.matches is
'Same Scene manually created Director matches.';

comment on table public.directors is
'Authenticated Supabase users who are authorized as Same Scene Directors.';

comment on column public.students.access_code is
'Unique random access code used by a student to access their Same Scene status.';

comment on column public.students.match_intent is
'Student intention for the Same Scene matching event.';

comment on column public.matches.status is
'Match lifecycle: draft or published.';