-- ============================================================================
-- Epic 8 — AI Report Architecture
-- Migration 2: reports.ai_report_batches, reports.ai_report_drafts,
--              reports.ai_usage_counters
-- Ref: BACKEND_ARCHITECTURE.md §3.19, §3.20, §3.20.1, §2.2, §6, §8, §19
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reports.ai_report_batches  (§3.19) — one row per drafting request (a
-- single-child request is still a batch of size 1, matching §19's own
-- "per-student and batch-by-classroom" framing as the same mechanism at
-- different scope sizes, not two different code paths).
-- ---------------------------------------------------------------------------
create table reports.ai_report_batches (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenancy.tenants(id) on delete restrict,
  type          reports.report_type not null,
  scope         reports.report_scope not null,
  classroom_id  uuid null references academic.classrooms(id) on delete restrict,
  topic         text null,
  created_by    uuid not null references identity.staff_profiles(id) on delete restrict,
  created_at    timestamptz not null default now(),
  -- scope='classroom' requires classroom_id; scope='children' forbids it
  -- (the actual child set for scope='children' lives only on the fanned-out
  -- ai_report_drafts rows, not denormalized here).
  constraint ai_report_batches_scope_classroom_id_check
    check ((scope = 'classroom' and classroom_id is not null) or (scope = 'children' and classroom_id is null))
);

create index ai_report_batches_tenant_idx on reports.ai_report_batches (tenant_id);
create index ai_report_batches_created_by_idx on reports.ai_report_batches (created_by);

comment on table reports.ai_report_batches is
  'One row per AI report drafting request (§3.19) — a single-child request and a whole-classroom request are the same mechanism at different scope sizes. Insert-only from the ai-draft-report Edge Function (service_role); no direct RLS INSERT policy exists (migration 4).';

-- ---------------------------------------------------------------------------
-- reports.ai_report_drafts  (§3.20) — one row per child per batch.
-- `metrics` is a point-in-time jsonb snapshot for display, not a queryable
-- fact table (§3.20's own explicit note) — the real evaluation/attendance
-- facts stay in academic.evaluations/academic.attendance_records.
-- ---------------------------------------------------------------------------
create table reports.ai_report_drafts (
  id                 uuid primary key default gen_random_uuid(),
  batch_id           uuid not null references reports.ai_report_batches(id) on delete cascade,
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  child_id           uuid not null references academic.children(id) on delete restrict,
  body               text not null check (btrim(body) <> ''),
  metrics            jsonb not null default '{}'::jsonb,
  status             reports.report_draft_status not null default 'draft',
  scheduled_for      timestamptz null,
  sent_at            timestamptz null,
  delivery_channels  reports.delivery_channel[] not null default '{}',
  edited_by          uuid null references identity.staff_profiles(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- scheduled_for is required iff status='scheduled'; sent_at is required
  -- iff status='sent' — mirrors the same "the column that only makes sense
  -- for one status is only ever non-null for that status" discipline used
  -- for billing.payment_transactions.settled_at (Epic 6).
  constraint ai_report_drafts_scheduled_for_check
    check ((status = 'scheduled') = (scheduled_for is not null)),
  constraint ai_report_drafts_sent_at_check
    check ((status = 'sent') = (sent_at is not null))
);

-- §2.2/§6: tenant_id indexed on every tenant-scoped table.
create index ai_report_drafts_tenant_idx on reports.ai_report_drafts (tenant_id);
create index ai_report_drafts_batch_idx on reports.ai_report_drafts (batch_id);
create index ai_report_drafts_child_idx on reports.ai_report_drafts (child_id);

-- Guardian's own "R (own child, sent only)" read (migration 4) and the
-- scheduled-dispatch sweep (migration 6) both filter on status — partial
-- indexes on the exact predicates each uses.
create index ai_report_drafts_sent_idx on reports.ai_report_drafts (child_id) where status = 'sent';
create index ai_report_drafts_scheduled_idx on reports.ai_report_drafts (scheduled_for) where status = 'scheduled';

comment on table reports.ai_report_drafts is
  'One row per child per AI report batch (§3.20). status only ever reaches ready/sent/scheduled via an explicit staff action through migration 5''s RPCs — the AI itself never has write access here beyond the initial draft insert (service_role, ai-draft-report Edge Function). metrics is a point-in-time display snapshot, not a fact table (§3.20).';

create trigger trg_ai_report_drafts_updated_at
  before update on reports.ai_report_drafts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reports.ai_usage_counters  (§3.20.1) — "formalized... into the single
-- committed mechanism for the per-tenant daily AI-call cap." One row per
-- tenant per calendar day, lazily created on first use — mirrors
-- billing.invoice_number_counters' own per-tenant-per-period counter
-- pattern (Epic 6).
-- ---------------------------------------------------------------------------
create table reports.ai_usage_counters (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenancy.tenants(id) on delete restrict,
  usage_date  date not null,
  calls_used  int not null default 0 check (calls_used >= 0),
  constraint ai_usage_counters_tenant_date_key unique (tenant_id, usage_date)
);

create index ai_usage_counters_tenant_idx on reports.ai_usage_counters (tenant_id);

comment on table reports.ai_usage_counters is
  'Per-tenant daily AI-call counter (§3.20.1, §19) — the single committed mechanism for the daily cap. Mutated exclusively via reports.increment_ai_usage (migration 5), an atomic INSERT...ON CONFLICT...DO UPDATE...RETURNING, never a bare RLS UPDATE.';

-- ---------------------------------------------------------------------------
-- reports.check_ai_report_batch_consistency — mirrors the established
-- consistency-trigger shape: classroom_id (when present) must belong to the
-- stated tenant, and created_by must belong to the stated tenant.
-- ---------------------------------------------------------------------------
create or replace function reports.check_ai_report_batch_consistency()
returns trigger
language plpgsql
as $$
declare
  v_classroom_tenant_id uuid;
  v_staff_tenant_id     uuid;
begin
  if new.classroom_id is not null then
    select tenant_id into v_classroom_tenant_id from academic.classrooms where id = new.classroom_id and deleted_at is null;
    if v_classroom_tenant_id is null then
      raise exception 'Classroom not found'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Classroom not found.', 'human_message_ar', 'لم يتم العثور على الفصل.')::text;
    end if;
    if v_classroom_tenant_id <> new.tenant_id then
      raise exception 'classroom_id does not belong to the stated tenant'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This classroom does not belong to your tenant.', 'human_message_ar', 'هذا الفصل لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  select tenant_id into v_staff_tenant_id from identity.staff_profiles where id = new.created_by and deleted_at is null;
  if v_staff_tenant_id is null or v_staff_tenant_id <> new.tenant_id then
    raise exception 'created_by does not belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This staff member does not belong to your tenant.', 'human_message_ar', 'هذا الموظف لا ينتمي إلى مؤسستك.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_ai_report_batches_consistency
  before insert or update on reports.ai_report_batches
  for each row execute function reports.check_ai_report_batch_consistency();

-- ---------------------------------------------------------------------------
-- reports.check_ai_report_draft_consistency — child_id and batch_id must
-- both belong to the stated tenant, and (M4-class lesson applied from the
-- start, per EPIC_7_REVIEW.md's own recurrence-check finding) the child's
-- own row must not be soft-deleted.
-- ---------------------------------------------------------------------------
create or replace function reports.check_ai_report_draft_consistency()
returns trigger
language plpgsql
as $$
declare
  v_batch_tenant_id uuid;
  v_child_tenant_id uuid;
begin
  select tenant_id into v_batch_tenant_id from reports.ai_report_batches where id = new.batch_id;
  if v_batch_tenant_id is null then
    raise exception 'Batch not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Report batch not found.', 'human_message_ar', 'لم يتم العثور على دفعة التقارير.')::text;
  end if;

  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;
  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_batch_tenant_id <> new.tenant_id or v_child_tenant_id <> new.tenant_id then
    raise exception 'batch_id/child_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This batch and child do not both belong to your tenant.', 'human_message_ar', 'الدفعة والطفل لا ينتميان لنفس المؤسسة.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_ai_report_drafts_consistency
  before insert or update on reports.ai_report_drafts
  for each row execute function reports.check_ai_report_draft_consistency();

-- ---------------------------------------------------------------------------
-- Fix for EPIC_8_REVIEW.md M1: ai_report_drafts_update_manager's own RLS
-- WITH CHECK (migration 4) constrains tenant_id/role/status but places no
-- constraint on child_id/batch_id — a manager's direct RLS UPDATE (reachable
-- via a raw PostgREST call, bypassing the Node API layer's own repository,
-- which never constructs a patch containing either field) could otherwise
-- retarget an existing draft's already-generated body/metrics onto a
-- different child within the same tenant. A trigger, not an RLS WITH CHECK
-- expression, is used here because comparing NEW against OLD row values is
-- what a trigger does naturally; expressing the same "unchanged" constraint
-- purely in a policy would require a self-referencing subquery. Fires on
-- every UPDATE regardless of caller (RPCs in migration 5/7 never touch
-- either column, so this is a no-op for them).
-- ---------------------------------------------------------------------------
create or replace function reports.check_ai_report_draft_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.child_id <> old.child_id or new.batch_id <> old.batch_id then
    raise exception 'child_id/batch_id cannot be changed once a report draft is created'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A report draft cannot be reassigned to a different child or batch.', 'human_message_ar', 'لا يمكن إعادة تخصيص مسودة التقرير لطفل أو دفعة مختلفة.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_ai_report_drafts_immutable_fields
  before update on reports.ai_report_drafts
  for each row execute function reports.check_ai_report_draft_immutable_fields();

comment on function reports.check_ai_report_draft_immutable_fields() is
  'Fix for EPIC_8_REVIEW.md M1 — child_id/batch_id are immutable after a draft row is created, closing a direct-REST retargeting gap ai_report_drafts_update_manager''s own WITH CHECK did not cover.';
