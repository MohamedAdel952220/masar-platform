-- ============================================================================
-- Epic 9 — Platform Operations & Admin Console
-- Migration 3: RLS policies
-- Ref: BACKEND_ARCHITECTURE.md §12, §12.1, §13, §13.6
--
-- Reuses the frozen Epic 1 helpers unmodified: public.current_tenant_id(),
-- public.current_role(), public.is_platform_admin(),
-- public.is_platform_admin_manager_tier(). No new helper function is needed
-- for any policy in this migration.
--
-- No INSERT/UPDATE policy exists on support_tickets, service_health_status,
-- or tenant_billing_transactions for any role — every write to these three
-- tables routes exclusively through migration 4/5's SECURITY DEFINER
-- functions, matching the "no direct RLS write path alongside a
-- correctness-critical RPC" lesson (EPIC_5_REVIEW.md H2, EPIC_6_REVIEW.md
-- H1/H2, restated for Epic 8's own reports.* tables). activity_log and
-- jobs.scheduled_job_runs follow the identical pattern.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- platform.activity_log — Manager: R (own tenant). Reception: R (own
-- tenant). No platform_admin policy at all (§12's own matrix: Platform
-- Admin column is "–" for Activity log — audit_log, not activity_log, is
-- the platform-admin-facing feed, §23/§24).
-- ---------------------------------------------------------------------------
alter table platform.activity_log enable row level security;
alter table platform.activity_log force row level security;

create policy activity_log_select_manager on platform.activity_log
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy activity_log_select_reception on platform.activity_log
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

-- ---------------------------------------------------------------------------
-- platform.support_tickets — Manager: C, R (own tenant). Platform Admin
-- (any tier): R (all tenants) — §12.1's own "no divergence" note for this
-- resource. No UPDATE policy for anyone; status/assignment changes route
-- exclusively through migration 4's update_support_ticket RPC.
-- ---------------------------------------------------------------------------
alter table platform.support_tickets enable row level security;
alter table platform.support_tickets force row level security;

create policy support_tickets_select_manager on platform.support_tickets
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy support_tickets_select_platform_admin on platform.support_tickets
  for select
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- platform.service_health_status — Platform Admin (any tier): R only
-- (§12.1: "Service health | R | R" — no owner/admin-vs-support divergence).
-- No other role has any access (§12's own explicit note: this is Masar's
-- own infrastructure telemetry, not a tenant-facing status page).
-- ---------------------------------------------------------------------------
alter table platform.service_health_status enable row level security;
alter table platform.service_health_status force row level security;

create policy service_health_status_select_platform_admin on platform.service_health_status
  for select
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- platform.tenant_billing_transactions — Platform Admin (any tier): R only
-- at the RLS layer (§12.1's own owner/admin-vs-support divergence for
-- *writes* is enforced inside migration 4's RPCs, not by a second RLS
-- policy — matching §12.1's own closing sentence: "an RLS policy branch
-- keyed on current_platform_admin_tier()," which for this table lives
-- inside the RPC bodies since there is no direct-RLS write path at all to
-- branch within). No tenant-side role (including Manager) has any access —
-- this is Masar's own internal ledger about the tenant, not the tenant's
-- own record of it; a tenant sees the *consequence* (tenants.status,
-- suspended_reason, already directly readable via the frozen
-- tenants_select_own policy, Epic 1) without seeing Masar's internal
-- transaction detail.
-- ---------------------------------------------------------------------------
alter table platform.tenant_billing_transactions enable row level security;
alter table platform.tenant_billing_transactions force row level security;

create policy tenant_billing_transactions_select_platform_admin on platform.tenant_billing_transactions
  for select
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- jobs.scheduled_job_runs — Platform Admin (any tier): R only, informational
-- alongside service_health_status on the System Health screen. No other
-- role has any access.
-- ---------------------------------------------------------------------------
alter table jobs.scheduled_job_runs enable row level security;
alter table jobs.scheduled_job_runs force row level security;

create policy scheduled_job_runs_select_platform_admin on jobs.scheduled_job_runs
  for select
  using (public.is_platform_admin());
