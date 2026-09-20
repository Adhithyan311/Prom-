# promNight

## Película · Prom Night

Vintage-35mm film-festival themed matchmaking site for a college prom event. Static frontend (no build step, no framework — `index.html` + vanilla ES modules), backed by a real Supabase Postgres database for registrations, matching, and Director accounts. Open `index.html` directly in a browser or serve the folder with any static HTTP server.

## Folder structure
```

## Routes

- `#/experience` — landing page (default)
- `#/register` — student registration form
- `#/status` — Status & Reveal: enter an access code to see registration status and, once published, a match
- `#/director-login` — Director sign-in (Supabase Auth email/password)
- `#/director-room` — Director Room: dashboard, Participants Directory, Manual Matching, Automatic Matching, All Matches (protected — redirects to `#/director-login` if not authenticated, and every query is additionally enforced by Supabase RLS)

## How it works

- **Registration** (`#/register`): students submit Name, Department, Semester, Instagram ID, Favourite Movie, Gender, and Match Intent. No college ID, email, phone, or photo is collected. On success, Supabase generates a unique access code (the student's only credential) and inserts the row.
- **Access codes**: format `SC-XXXX`, drawn from a 32-character alphabet. This is the student's login for `#/status` — there is no separate password. A student can recover their code from `#/status` using their Instagram ID + Favourite Movie (see the entropy/recovery notes in the audit report — this is a known soft spot, not a strong credential recovery flow).
- **Director accounts**: real Supabase Auth (email/password), cross-checked against a `directors` table after login — a valid Supabase Auth user who isn't in `directors` is signed out immediately. There is no hardcoded Director identity anywhere in the frontend.
- **Matching**: Directors can create matches manually (male ↔ female only, enforced both in the app and by a database trigger) or generate them automatically. Automatic Matching only pairs `waiting` students, is strictly male↔female, gives each student at most one pair, and leaves any surplus of one gender unmatched. Matches start as `draft` and only become visible to students once a Director **publishes** them (publish + marking both students `matched` happens as a single atomic database transaction).

## Supabase setup

1. Create a Supabase project.
2. In the SQL Editor, run `supabase/schema.sql`, then run `supabase/migration_fixes.sql` (adds the access-code recovery function, a DB-level trigger that enforces the male/female match rule, and the atomic match-publish function).
3. In `js/supabase.js`, set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to your project's values. **Only use the publishable/anon key here — never the secret or `service_role` key.** The publishable key is safe to ship to the browser because every table has Row Level Security enabled; the anon key can't read or write anything it isn't explicitly allowed to.
4. Make sure `students` and `matches` are added to the `supabase_realtime` publication (included in `schema.sql`) so the Director Room updates live without a refresh.
5. Deploy the folder as-is to any static host (e.g. Vercel) — there's no build step and nothing depends on `localhost`.

## Local testing

Serve the project root with any static server, e.g.:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Notes

- Fonts load from Google Fonts (Playfair Display + Inter) via CDN in `index.html`.
- `js/storage/` is a legacy localStorage-based layer from before the Supabase migration. It's still used internally as a compatibility bridge for the Participants Directory view, but all real data lives in Supabase — don't treat `localStorage` as a source of truth.
- `tests/` holds standalone Node scripts that exercise validation and the matching algorithm (director/registration/matching flow checks) — run individually with Node, not a test runner.
- See the pre-deployment audit report for the full security/QA writeup and the reasoning behind `migration_fixes.sql`.

