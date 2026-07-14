-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 1: schemas, extensions, shared trigger function
-- Ref: BACKEND_ARCHITECTURE.md §2.1, §7 (UUID Strategy)
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_net;     -- reserved for later epics' webhook dispatch (safe to enable now)

-- Schemas owned by Epic 1. `platform` and `jobs` are introduced here with only
-- the single table each that Epic 1 itself needs (audit_log, idempotency_keys) —
-- the rest of those schemas (activity_log, support_tickets, service_health_status,
-- tenant_billing_transactions, background_job_queue, scheduled_job_runs) belong to
-- later Epics per BACKEND_EXECUTION_PLAN.md and are NOT created by this migration.
create schema if not exists tenancy;
create schema if not exists identity;
create schema if not exists platform;
create schema if not exists jobs;

comment on schema tenancy is 'Epic 1 — tenants, plans, provisioning workflow, phone registry.';
comment on schema identity is 'Epic 1 — staff/guardian/driver/platform_admin profiles, machine identities.';
comment on schema platform is 'Cross-cutting platform-operations tables. Epic 1 introduces audit_log only.';
comment on schema jobs is 'Cross-cutting job/queue tables. Epic 1 introduces idempotency_keys only.';

-- ----------------------------------------------------------------------------
-- Shared `updated_at` trigger (§2.2: every table has created_at/updated_at)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared BEFORE UPDATE trigger that stamps updated_at = now() on every table that has the column.';
