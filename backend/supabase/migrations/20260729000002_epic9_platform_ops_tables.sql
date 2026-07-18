-- ============================================================================
-- Epic 9 — Platform Operations & Admin Console
-- Migration 2: tables
-- Ref: BACKEND_ARCHITECTURE.md §3.50, §3.52, §3.53, §3.53.1, §3.53.2, §4, §5, §6
-- ============================================================================

-- ---------------------------------------------------------------------------
-- platform.activity_log (§3.50) — curated, RPC-populated operational feed,
-- never a raw table-level trigger log (§24's own explicit distinction from
-- audit_log). No FK to a single actor table (staff/guardian/driver/system) —
-- same polymorphic precedent as identity.service_accounts.issued_by (Epic 1)
-- and comms.notifications.recipient_id (Epic 4).
-- ---------------------------------------------------------------------------
create table platform.activity_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  actor_type   platform.activity_actor_type not null,
  actor_id     uuid null,
  action       text not null check (btrim(action) <> ''),
  target_type  text not null check (btrim(target_type) <> ''),
  target_id    uuid null,
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);

-- §5: btree on (tenant_id, occurred_at desc) for feed pagination.
create index activity_log_tenant_occurred_idx on platform.activity_log (tenant_id, occurred_at desc);

comment on table platform.activity_log is
  'Curated, tenant-facing operational feed (Dashboard "recent activity", Reception "activity log"), §24. Populated only by the RPC that performs the underlying action — never a generic trigger. Mutable retention (§29), not held to audit_log''s immutability bar.';

-- ---------------------------------------------------------------------------
-- platform.support_tickets (§3.52) — reported_by is always a staff member
-- (§12's own matrix: only Manager has C/R on this resource among tenant-side
-- roles); assigned_to is a platform_admins.id, set only via migration 4's
-- update_support_ticket RPC.
-- ---------------------------------------------------------------------------
create table platform.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  subject      text not null check (btrim(subject) <> ''),
  body         text not null check (btrim(body) <> ''),
  category     platform.support_ticket_category not null,
  severity     platform.support_ticket_severity not null,
  status       platform.support_ticket_status not null default 'open',
  reported_by  uuid not null references identity.staff_profiles(id) on delete restrict,
  assigned_to  uuid null references identity.platform_admins(id) on delete restrict,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz null,
  -- Mirrors the established "the column that only makes sense for one
  -- status is only ever non-null for that status" discipline (e.g.
  -- reports.ai_report_drafts.sent_at, Epic 8).
  constraint support_tickets_resolved_at_check
    check ((status = 'resolved') = (resolved_at is not null))
);

-- §5: btree on (status, severity) for Platform Admin's triage view.
create index support_tickets_status_severity_idx on platform.support_tickets (status, severity);
create index support_tickets_tenant_idx on platform.support_tickets (tenant_id);
create index support_tickets_assigned_to_idx on platform.support_tickets (assigned_to) where assigned_to is not null;

comment on table platform.support_tickets is
  'Support ticket lifecycle (§3.52). Manager: C, R (own tenant) only — no direct UPDATE for anyone; status/assignment changes route exclusively through migration 4''s update_support_ticket RPC (§12.1: CRUD+assign, no owner/admin-vs-support divergence).';

-- ---------------------------------------------------------------------------
-- Fix-forward (project-wide recurrence review, applying EPIC_2_REVIEW.md
-- H2's "missing tenant-consistency trigger" lesson and EPIC_7_REVIEW.md
-- M4's "check deleted_at on the referenced entity too" lesson from the
-- start): reported_by must belong to the ticket's own tenant_id and must
-- not be soft-deleted. create_support_ticket (migration 4) already derives
-- both tenant_id and reported_by from the same single caller session, so a
-- mismatch is not reachable through that path today — this trigger is
-- defense-in-depth against any future write path, matching the same
-- standard already applied unconditionally to every other tenant-scoped
-- staff-referencing table in this codebase (day_path_events,
-- attendance_records, evaluations, concerns, lessons, subjects, Epic 2;
-- ai_report_batches/drafts, Epic 8).
-- ---------------------------------------------------------------------------
create or replace function platform.check_support_ticket_consistency()
returns trigger
language plpgsql
as $$
declare
  v_reporter_tenant_id uuid;
begin
  select tenant_id into v_reporter_tenant_id from identity.staff_profiles where id = new.reported_by and deleted_at is null;

  if v_reporter_tenant_id is null then
    raise exception 'Reporting staff member not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Reporting staff member not found.', 'human_message_ar', 'لم يتم العثور على الموظف المُبلّغ.')::text;
  end if;

  if v_reporter_tenant_id <> new.tenant_id then
    raise exception 'reported_by does not belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The reporting staff member does not belong to this tenant.', 'human_message_ar', 'الموظف المُبلّغ لا ينتمي إلى هذه المؤسسة.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_support_tickets_consistency
  before insert or update of tenant_id, reported_by on platform.support_tickets
  for each row execute function platform.check_support_ticket_consistency();

-- ---------------------------------------------------------------------------
-- platform.service_health_status (§3.53) — one row per tracked service,
-- upserted by the scheduled health-check function (migration 5). Platform-
-- global, no tenant_id (§12's own explicit "not a tenant-facing status
-- page" framing).
-- ---------------------------------------------------------------------------
create table platform.service_health_status (
  id           uuid primary key default gen_random_uuid(),
  service_code text not null,
  status       platform.service_status not null,
  uptime_pct   numeric(5,2) not null check (uptime_pct >= 0 and uptime_pct <= 100),
  latency_ms   int not null check (latency_ms >= 0),
  checked_at   timestamptz not null default now()
);

create unique index service_health_status_service_code_key on platform.service_health_status (service_code);

comment on table platform.service_health_status is
  'One row per tracked internal service (§3.53) — api_gateway, parent_app, teacher_app, reception_qr, driver_gps, camera_relay, notifications, payments. Written exclusively by platform.run_service_health_check() (migration 5, service_role only). Platform-Admin-only by design (§12''s own note) — operational telemetry for Masar''s own infrastructure, not a tenant-facing status page.';

-- ---------------------------------------------------------------------------
-- platform.tenant_billing_transactions (§3.53.1) — the tenant-pays-Masar
-- ledger. Deliberately a separate table from billing.payment_transactions
-- (§20) despite the structurally similar shape — different money flow,
-- different reconciliation owner. invoice_object_id is a bare nullable uuid
-- (no FK): the same placeholder pattern already used for
-- identity.staff_profiles.photo_object_id/identity.guardian_profiles.photo_object_id
-- since Epic 1 — no dedicated storage-object metadata table exists in this
-- codebase to reference (Supabase Storage's own built-in storage.objects is
-- used directly, addressed by bucket+path, not through an app-level FK).
-- ---------------------------------------------------------------------------
create table platform.tenant_billing_transactions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  amount             numeric(10,2) not null check (amount > 0),
  currency           text not null default 'EGP',
  kind               platform.billing_transaction_kind not null,
  status             platform.billing_transaction_status not null default 'initiated',
  provider_reference text null,
  invoice_object_id  uuid null,
  initiated_at       timestamptz not null default now(),
  settled_at         timestamptz null,
  constraint tenant_billing_transactions_settled_at_check
    check ((status in ('succeeded', 'refunded')) = (settled_at is not null)),
  -- Fix for EPIC_9_REVIEW.md M2: the Zod layer (issueTenantBillingTransactionSchema)
  -- already validates a 3-letter ISO-4217-shaped currency code, but that is a
  -- client-side-only check — a caller reaching the RPC directly (bypassing
  -- the Node API layer entirely, the same "Direct REST bypass" surface named
  -- throughout this codebase's own reviews) previously had no SQL-level
  -- constraint stopping an arbitrary string from being recorded. Matches the
  -- server-side-validation discipline create_support_ticket (migration 4)
  -- already applies to its own text fields in this same Epic.
  constraint tenant_billing_transactions_currency_format_check
    check (currency ~ '^[A-Z]{3}$')
);

-- provider_reference unique only where non-null (§3.53.1's own "unique where
-- non-null" spec) — a partial unique index, matching the identical pattern
-- already used for tenants_slug_key-style soft-delete-aware uniqueness
-- elsewhere in this codebase, applied here to a nullable-uniqueness case
-- instead.
create unique index tenant_billing_transactions_provider_ref_key
  on platform.tenant_billing_transactions (provider_reference) where provider_reference is not null;
create index tenant_billing_transactions_tenant_idx on platform.tenant_billing_transactions (tenant_id);
create index tenant_billing_transactions_status_idx on platform.tenant_billing_transactions (status);

comment on table platform.tenant_billing_transactions is
  'Tenant-pays-Masar ledger (§3.53.1, §20). No direct RLS write path for any role — only migration 4''s issue_tenant_billing_transaction/refund_tenant_billing_transaction RPCs (owner/admin tier only, §12.1) may write. Never hard-deleted (§5: financial/historical record).';

-- ---------------------------------------------------------------------------
-- jobs.scheduled_job_runs (§3.53.2) — run-history for every scheduled job.
-- job_name is plain text (not an FK/enum) since jobs are identified by name
-- across every Epic, not a single central registry table.
-- ---------------------------------------------------------------------------
create table jobs.scheduled_job_runs (
  id            uuid primary key default gen_random_uuid(),
  -- job_name has no inline `check` here — see the named
  -- scheduled_job_runs_job_name_check constraint below. An inline,
  -- unnamed column check on `job_name` would receive Postgres's own
  -- auto-generated name (`{table}_{column}_check`, i.e. exactly
  -- `scheduled_job_runs_job_name_check`), silently colliding with the
  -- explicit table-level constraint of the identical name a few lines
  -- down — the actual root cause of "scheduled_job_runs_job_name_check
  -- already exists" at deploy time. The closed-vocabulary check below is a
  -- strict superset of "non-empty" (none of its listed values are empty
  -- strings), so no separate non-empty check is needed at all once it's in
  -- place; the fix removes the redundant inline check entirely rather than
  -- renaming either side, so the constraint is declared exactly once.
  job_name      text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz null,
  status        jobs.scheduled_job_run_status not null default 'running',
  rows_affected int null,
  error         text null,
  constraint scheduled_job_runs_finished_at_check
    check ((status = 'running') = (finished_at is null)),
  -- Fix for EPIC_9_REVIEW.md L1: job_name was previously unconstrained free
  -- text — not reachable by any external caller today (every current writer
  -- passes a hardcoded literal via jobs.record_scheduled_job_run), but with
  -- nothing in the schema to catch a future copy-paste typo mis-attributing
  -- a run's history to the wrong job name. A CHECK against the closed set of
  -- job names this Epic actually registers is deliberately not an enum:
  -- every future Epic's own new scheduled job will need to append here via
  -- its own additive migration (ALTER TABLE ... DROP/ADD CONSTRAINT), which
  -- is a smaller, safer change than an enum ALTER TYPE ADD VALUE across
  -- migration boundaries.
  constraint scheduled_job_runs_job_name_check
    check (job_name in ('service_health_check', 'tenant_billing_check', 'trial_expiry_sweep', 'attendance_non_marking_alert'))
);

create index scheduled_job_runs_job_name_idx on jobs.scheduled_job_runs (job_name, started_at desc);
create index scheduled_job_runs_status_idx on jobs.scheduled_job_runs (status);

comment on table jobs.scheduled_job_runs is
  'Run-history for every scheduled job across every Epic (§27) — job_name, started_at, finished_at, status, rows_affected, error. Platform Admin''s System Health view surfaces this alongside service_health_status. service_role only (migration 3); written via jobs.record_scheduled_job_run (migration 5), never directly.';
