-- ============================================================================
-- Epic 9 — Platform Operations & Admin Console
-- Migration 1: enums
-- Ref: BACKEND_ARCHITECTURE.md §3.50-3.53.1, §12.1, §27
--
-- Fully additive. The `platform` and `jobs` schemas themselves already exist
-- (Epic 1, frozen) — this migration only adds new types inside them, exactly
-- as Epic 8 added new types inside the pre-existing `tenancy` schema without
-- touching Epic 1's own migration file. `platform.audit_log` and
-- `identity.platform_admins`/`platform_admin_tier` (Epic 1), and
-- `jobs.background_job_queue`/`background_job_status` (Epic 4) are also
-- frozen and unmodified — this Epic reuses them as-is.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- platform.activity_log (§3.50) — tenant-scoped operational feed.
-- ---------------------------------------------------------------------------
create type platform.activity_actor_type as enum ('staff', 'guardian', 'driver', 'system');

-- ---------------------------------------------------------------------------
-- platform.support_tickets (§3.52).
-- ---------------------------------------------------------------------------
create type platform.support_ticket_category as enum ('technical', 'how_to', 'request', 'billing');
create type platform.support_ticket_severity as enum ('high', 'med', 'low');
create type platform.support_ticket_status as enum ('open', 'in_progress', 'resolved');

-- ---------------------------------------------------------------------------
-- platform.service_health_status (§3.53).
-- ---------------------------------------------------------------------------
create type platform.service_status as enum ('up', 'degraded', 'down');

-- ---------------------------------------------------------------------------
-- platform.tenant_billing_transactions (§3.53.1) — deliberately its own
-- enums, not reused from billing.payment_transactions, matching §20's own
-- "structurally separate flow" framing (tenant-pays-Masar, not
-- parent-pays-tenant).
-- ---------------------------------------------------------------------------
create type platform.billing_transaction_kind as enum ('subscription_charge', 'setup_fee', 'refund');
create type platform.billing_transaction_status as enum ('initiated', 'succeeded', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- jobs.scheduled_job_runs (§3.53.2) — the run-history table every scheduled
-- job (across every Epic, not just Epic 9) registers with (§27). Introduced
-- here because Epic 9's own System Health Platform Admin screen is the
-- first concrete consumer, but the table itself is cross-cutting
-- infrastructure, not an Epic-9-owned business table — hence its home in
-- the pre-existing `jobs` schema (Epic 4, frozen) rather than `platform`.
-- ---------------------------------------------------------------------------
create type jobs.scheduled_job_run_status as enum ('running', 'succeeded', 'failed');
