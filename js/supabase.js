/**
 * Same Scene — Supabase Client
 */

(function () {
  const SUPABASE_URL =
    'https://pxrhmuxwewipclztyaby.supabase.co';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_kYMQ1Mp2zKiirSeKbP-Nvw_ARYcla0l';

  if (!window.supabase) {
    console.error('Supabase library is not loaded.');
    return;
  }

  if (typeof window.supabase.createClient !== 'function') {
    console.error('Supabase createClient() is unavailable.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );

  console.log('Same Scene: Supabase connected.');
})();