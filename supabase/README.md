# Película Supabase setup

This project keeps the static frontend, but moves the shared app data to a Supabase PostgreSQL database.

## 1) Create a Supabase project

1. Open the Supabase project at https://pxrhmuxwewipclztyaby.supabase.co.
2. Go to SQL Editor.
3. Open a new query and run the contents of `supabase/schema.sql`.

## 2) Configure the frontend

Use the browser publishable key only. Do not add a service role or secret key to the frontend.

Copy `.env.example` to `.env` for local use if your hosting environment supports it, or set the same values in Vercel environment variables.

Required values:

- `SUPABASE_URL=https://pxrhmuxwewipclztyaby.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=sb_publishable_kYMQ1Mp2zKiirSeKbP-Nvw_ARYcla0l`

For a static site, the simplest setup is to keep the URL and key in the browser client bootstrap script or environment variables at build time. The public key is intentionally safe for browser use; the protection comes from Supabase RLS and database rule checks.

## 3) Enable Realtime

The schema includes the SQL command to add `participants` and `matches` to the `supabase_realtime` publication. If you create the tables manually, ensure those tables are included in the publication so that the Director Room can react to registration and match changes without a page refresh.

## 4) Vercel deployment

In the Vercel project settings:

- Add `SUPABASE_URL`
- Add `SUPABASE_PUBLISHABLE_KEY`

Do not add any secret or service role value.

## 5) Local testing

Serve the site from the project root with any static HTTP server:

```bash
python -m http.server 8000
```

Then open:

- http://localhost:8000

## 6) Director verification

The app preserves the custom Director check and verifies against the record stored in `participants`.

The identity is:

- Name: Akhila
- Branch: CSE
- Semester: S7
- Instagram: RYUK
- Favorite Movie: Bangalore Days
- Favorite Genre: Romance
- Favorite Music: Malare
- Gender: Female

The first successful registration is reserved for the Director.
