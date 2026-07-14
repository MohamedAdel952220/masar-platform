/* ============================================================================
   Masar — Epic 1 runtime environment config (frontend-safe values only)
   ============================================================================
   Loaded before supabaseClient.epic1.js in every portal that has been wired
   to the live backend (Platform Admin, Nursery Dashboard, and the four
   mobile-style portals' login screens — see EPIC_1_INTEGRATION_REPORT.md).

   Only PUBLIC-SAFE values belong in this file: the Supabase URL and the
   anon key are explicitly safe for client bundles (BACKEND_ARCHITECTURE.md
   §28/§34 — the anon key carries no privilege beyond what RLS already
   grants an authenticated/anonymous request). The service_role key must
   NEVER appear here or in any file under ui_kits/.
   ========================================================================= */
window.__MASAR_ENV__ = {
  SUPABASE_URL: 'https://oqvgkvyapjauepgozgjd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xdmdrdnlhcGphdWVwZ296Z2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzMzOTgsImV4cCI6MjA5OTU0OTM5OH0.4PQekAyepBrSDY5UvSKSCxAylTQEwkJW2qbUnpIJy3Y',
};
