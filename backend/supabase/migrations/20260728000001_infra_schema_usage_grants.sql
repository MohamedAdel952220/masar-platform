-- ============================================================================
-- Platform infrastructure — Migration: schema USAGE grants
-- Ref: EPIC_8_PERMISSION_INVESTIGATION.md, EPIC_8_DEPLOYMENT_AUDIT_FINAL.md
--
-- Not an Epic 8 change. Confirmed root cause (EPIC_8_PERMISSION_INVESTIGATION.md):
-- every custom schema created since Epic 1 (tenancy/identity/platform/jobs,
-- academic, transport/safety, comms, approvals, billing, media, reports) was
-- created with a bare `create schema if not exists <name>;` and never
-- received a schema-level privilege grant. Supabase auto-provisions `USAGE`
-- on the `public` schema for anon/authenticated/service_role at project
-- creation only — it does not do this for any schema a project creates
-- afterward, regardless of whether that schema is later added to
-- `[api] schemas`. This was invisible until now because no custom schema
-- had ever been successfully exposed via `config push` before this session
-- (every request to any custom schema was rejected earlier, and identically,
-- by PostgREST's own routing layer with PGRST106 — a request that never
-- reaches Postgres can never surface a database-level permission error).
-- Once that separate, already-fixed exposure gap was corrected, this second,
-- independent, pre-existing layer of the same "schemas were never fully
-- API-provisioned" condition became visible for the first time, live-verified
-- identically on `reports` (Epic 8) and `billing` (Epic 6) alike.
--
-- This migration grants ONLY `USAGE ON SCHEMA` — the minimum privilege a
-- role needs before any object-level grant inside that schema can be
-- exercised via a schema-qualified reference (exactly the mechanism
-- PostgREST uses for a non-public `Accept-Profile`/`Content-Profile`
-- request). It grants nothing else: no table privilege, no function
-- privilege, no RLS policy, no default-privilege rule for future objects.
-- Every existing table/function-level grant already established across
-- Epic 1-8's own migrations remains the sole, unchanged gate on actual data
-- access — `USAGE` alone does not let a role read or write a single row;
-- every table in every schema below is already `FORCE ROW LEVEL SECURITY`
-- (or has no policy granting the role in question anything at all), so this
-- migration changes zero rows' visibility for zero roles. It only removes a
-- request's ability to be rejected before RLS and the existing grants ever
-- get a chance to evaluate it correctly.
--
-- Scope (§ EPIC_8_PERMISSION_INVESTIGATION.md remediation notes):
--   - anon, authenticated: granted on exactly the ten schemas presently
--     listed in `[api] schemas` (config.toml) — the only schemas PostgREST
--     will ever route an anon/authenticated request to. Granting USAGE on
--     `platform`/`jobs` for these two roles would serve no purpose, since
--     neither is (or is intended to be) reachable by them at all — no
--     application code anywhere calls `.schema('platform')`, and the only
--     `.schema('jobs')` callers (generate-invoice-pdf, notification-dispatch,
--     both frozen Epic 4/6 Edge Functions) use the service_role client only.
--   - service_role: granted on all twelve schemas created across Epic 1-8,
--     including `platform` and `jobs` — service_role is the single,
--     fully-trusted internal actor every Edge Function's admin client
--     authenticates as (and already bypasses RLS entirely by Supabase's own
--     platform design), so extending it uniformly across every schema this
--     project owns is the correct, minimal-surface way to satisfy both "cover
--     every custom schema introduced in Epics 1-8" and "grant the minimum
--     required privilege" at once: today this is a genuine bugfix for the
--     two `jobs`-schema-querying Edge Functions above (previously blocked
--     identically to `reports`/`billing`), and a no-op everywhere else it
--     isn't yet needed, ready without a second migration once/if `jobs` is
--     ever added to `[api] schemas`.
-- ============================================================================

-- anon, authenticated: the ten schemas exposed via [api] schemas.
grant usage on schema tenancy   to anon, authenticated, service_role;
grant usage on schema identity  to anon, authenticated, service_role;
grant usage on schema academic  to anon, authenticated, service_role;
grant usage on schema transport to anon, authenticated, service_role;
grant usage on schema safety    to anon, authenticated, service_role;
grant usage on schema comms     to anon, authenticated, service_role;
grant usage on schema approvals to anon, authenticated, service_role;
grant usage on schema billing   to anon, authenticated, service_role;
grant usage on schema media     to anon, authenticated, service_role;
grant usage on schema reports   to anon, authenticated, service_role;

-- service_role only: the two cross-cutting, not-API-exposed schemas.
grant usage on schema platform to service_role;
grant usage on schema jobs     to service_role;
