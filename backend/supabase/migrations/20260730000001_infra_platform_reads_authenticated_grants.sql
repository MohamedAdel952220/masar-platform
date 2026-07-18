-- ============================================================================
-- Platform infrastructure — Migration: authenticated read access to
-- platform.*/jobs.scheduled_job_runs
-- Ref: EPIC_9_DEPLOYMENT_AUDIT.md (Blocker 1), EPIC_9_ARCHITECTURE_DECISION.md,
--      INFRASTRUCTURE_PLATFORM_READS.md
--
-- Not an Epic 9 change and not a modification of `20260728000001_infra_
-- schema_usage_grants.sql` (frozen, left untouched). That earlier migration
-- correctly scoped `authenticated`'s schema USAGE to only the ten schemas
-- then listed in `[api] schemas`, and explicitly reasoned that granting
-- USAGE on `platform`/`jobs` to `authenticated` "would serve no purpose"
-- at the time, since neither schema was (or was intended to be) reachable
-- by a non-service-role caller. `EPIC_9_ARCHITECTURE_DECISION.md` has since
-- resolved the open question that comment was written under: `BACKEND_
-- ARCHITECTURE.md` §12/§12.1/§13.6/§14 specify direct PostgREST + RLS reads
-- as the platform-wide read architecture (RPCs are reserved for writes/
-- transactions only, per §14.1 — no read RPC exists anywhere in the entire
-- contract catalog, §14.2), and Platform Admin's own read access is
-- explicitly described there as enforced via "RLS bypass only on
-- `platform.*` schema tables" and "an RLS policy branch" — i.e., a direct-
-- table-read design, not an RPC-wrapper design. Epic 9 already built that
-- RLS layer correctly (9 SELECT policies across 6 tables, all under FORCE
-- ROW LEVEL SECURITY) but the schema/table GRANT layer PostgREST also
-- requires was never opened, leaving those policies live but unreachable
-- by any client — confirmed as Blocker 1 in `EPIC_9_DEPLOYMENT_AUDIT.md`.
-- This migration closes exactly that gap and nothing else.
--
-- Scope — three deliberate boundaries:
--   1. `authenticated` only. Not `anon` (every one of the 6 tables below
--      requires a signed-in tenant member or Platform Admin per their own
--      RLS policies — an anonymous session can satisfy none of them, so
--      granting `anon` USAGE/SELECT here would open a reachability path
--      RLS would immediately deny anyway, adding surface for no benefit).
--      Not a broadened `service_role` grant either — `service_role`
--      already holds USAGE on both schemas from the prior infra migration
--      and bypasses RLS by Supabase's own platform design; nothing here
--      changes its access.
--   2. USAGE on `platform` and `jobs`, SELECT on exactly the 6 tables
--      named in `EPIC_9_ARCHITECTURE_DECISION.md` §3 — the 5 `platform.*`
--      tables that already carry an `authenticated`-reachable RLS policy
--      (`activity_log`, `audit_log`, `service_health_status`,
--      `support_tickets`, `tenant_billing_transactions`) plus the one
--      `jobs` table with a client-facing policy
--      (`scheduled_job_runs_select_platform_admin`).
--   3. `jobs.background_job_queue` and `jobs.idempotency_keys` are
--      deliberately excluded from any object-level grant. Both remain
--      internal-only: neither has a permission-matrix entry in `BACKEND_
--      ARCHITECTURE.md` §12, neither has an RLS policy for any human role
--      (confirmed live — `pg_policies` shows zero rows for either table),
--      and both stay under FORCE ROW LEVEL SECURITY. `authenticated` does
--      gain schema-level USAGE on `jobs` as a side effect of step 1 above
--      (USAGE is granted per-schema, not per-table), but USAGE alone
--      grants no ability to read or write any table's rows — reaching
--      either of these two tables would additionally require an
--      object-level grant this migration deliberately does not add, so
--      they remain exactly as unreachable to `authenticated` after this
--      migration as before it.
--
-- What this migration does NOT touch: no RLS policy is created, altered,
-- or dropped; no RPC/function grant changes; no Edge Function; no table,
-- column, index, or constraint; `FORCE ROW LEVEL SECURITY` is left exactly
-- as every Epic 9 migration already set it on all 6 tables (and on the two
-- excluded `jobs` tables) — this migration cannot weaken it, since nothing
-- here is a `ROW LEVEL SECURITY`/`FORCE ROW LEVEL SECURITY` statement.
-- RLS remains the sole row-level enforcement layer; this migration only
-- removes the schema/table-level gate that was previously rejecting every
-- `authenticated` request before RLS ever had a chance to evaluate it.
-- ============================================================================

grant usage on schema platform to authenticated;
grant usage on schema jobs     to authenticated;

grant select on platform.activity_log              to authenticated;
grant select on platform.audit_log                 to authenticated;
grant select on platform.service_health_status      to authenticated;
grant select on platform.support_tickets            to authenticated;
grant select on platform.tenant_billing_transactions to authenticated;

grant select on jobs.scheduled_job_runs to authenticated;

-- Deliberately no grant of any kind on jobs.background_job_queue or
-- jobs.idempotency_keys — see scope note (3) above.
