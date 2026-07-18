-- ============================================================================
-- Epic 6 — Billing & Payments
-- Migration 2: fee_items, fee_item_applicability, billing_ledger_items
-- Ref: BACKEND_ARCHITECTURE.md §3.36-3.38, §4, §5, §6
-- ============================================================================

-- ---------------------------------------------------------------------------
-- billing.fee_items  (§3.36) — tenant-configured fee catalog.
-- ---------------------------------------------------------------------------
create table billing.fee_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenancy.tenants(id) on delete restrict,
  name        text not null check (btrim(name) <> ''),
  name_ar     text null,
  icon        text null,
  cycle       billing.fee_cycle not null,
  scope       billing.fee_scope not null default 'all',
  required    boolean not null default true,
  price       numeric(10,2) not null check (price >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index fee_items_tenant_idx on billing.fee_items (tenant_id);
create index fee_items_active_idx on billing.fee_items (tenant_id) where active;

create trigger trg_fee_items_updated_at
  before update on billing.fee_items
  for each row execute function public.set_updated_at();

comment on table billing.fee_items is
  'Tenant fee catalog (§3.36). scope=optional fee items are only billed to children explicitly opted in via fee_item_applicability.';

-- ---------------------------------------------------------------------------
-- billing.fee_item_applicability  (§3.37) — pure link table, only populated
-- for scope=optional fee items. Composite PK (no own id), matching the
-- established academic.child_guardian_links precedent (Epic 2) for
-- link-shaped tables. Carries tenant_id per §2.2.
-- ---------------------------------------------------------------------------
create table billing.fee_item_applicability (
  fee_item_id  uuid not null references billing.fee_items(id) on delete cascade,
  child_id     uuid not null references academic.children(id) on delete cascade,
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  created_at   timestamptz not null default now(),
  primary key (fee_item_id, child_id)
);

create index fee_item_applicability_tenant_idx on billing.fee_item_applicability (tenant_id);
create index fee_item_applicability_child_idx on billing.fee_item_applicability (child_id);

-- Tenant-consistency trigger (EPIC_2_REVIEW.md H2 lesson, applied from the
-- first migration): fee_item_id/child_id must both belong to this row's own
-- tenant, and the fee_item must actually be scope=optional (a scope=all fee
-- item has no legitimate applicability row — it already applies to
-- everyone).
create or replace function billing.check_fee_item_applicability_consistency()
returns trigger
language plpgsql
as $$
declare
  v_fee_item_tenant_id uuid;
  v_fee_item_scope     billing.fee_scope;
  v_child_tenant_id    uuid;
begin
  select tenant_id, scope into v_fee_item_tenant_id, v_fee_item_scope from billing.fee_items where id = new.fee_item_id;
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;

  if v_fee_item_tenant_id is null then
    raise exception 'Fee item not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Fee item not found.', 'human_message_ar', 'لم يتم العثور على بند الرسوم.')::text;
  end if;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_fee_item_tenant_id <> new.tenant_id or v_child_tenant_id <> new.tenant_id then
    raise exception 'fee_item_id/child_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This fee item and child do not both belong to your tenant.', 'human_message_ar', 'بند الرسوم والطفل لا ينتميان لنفس المؤسسة.')::text;
  end if;

  if v_fee_item_scope <> 'optional' then
    raise exception 'Only an optional-scope fee item can have an applicability row'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Only an optional fee item can be assigned to specific children.', 'human_message_ar', 'يمكن تخصيص بند رسوم اختياري فقط لأطفال محددين.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_fee_item_applicability_consistency
  before insert or update on billing.fee_item_applicability
  for each row execute function billing.check_fee_item_applicability_consistency();

-- ---------------------------------------------------------------------------
-- billing.billing_ledger_items  (§3.38) — per-child, per-period billing
-- obligation. status is stored and job-maintained (§3.38's own explicit
-- correction from the v0 draft), never computed at read time.
--
-- Unique (child_id, fee_item_id, period_label): the row
-- billing.generate_recurring_ledger_items() (migration 6) upserts into via
-- ON CONFLICT DO NOTHING — this is what makes the recurring billing job
-- idempotent under re-run (Acceptance Criteria: "no duplicates on job
-- re-run"), the same "unique key makes the operation naturally idempotent"
-- precedent as approvals.event_rsvps_event_child_key (Epic 5).
-- ---------------------------------------------------------------------------
create table billing.billing_ledger_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  child_id     uuid not null references academic.children(id) on delete restrict,
  fee_item_id  uuid not null references billing.fee_items(id) on delete restrict,
  period_label text not null check (btrim(period_label) <> ''),
  amount_due   numeric(10,2) not null check (amount_due >= 0),
  amount_paid  numeric(10,2) not null default 0 check (amount_paid >= 0 and amount_paid <= amount_due),
  status       billing.billing_status not null default 'unbilled',
  due_date     date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index billing_ledger_items_child_fee_period_key on billing.billing_ledger_items (child_id, fee_item_id, period_label);
create index billing_ledger_items_tenant_idx on billing.billing_ledger_items (tenant_id);
create index billing_ledger_items_child_status_idx on billing.billing_ledger_items (child_id, status);
-- Billing status roll-up job's own hot-path scan + Dashboard overdue report
-- (§6's explicit indexing strategy for this exact query shape).
create index billing_ledger_items_overdue_idx on billing.billing_ledger_items (tenant_id) where status = 'overdue';

create trigger trg_billing_ledger_items_updated_at
  before update on billing.billing_ledger_items
  for each row execute function public.set_updated_at();

comment on table billing.billing_ledger_items is
  'Per-child, per-period billing obligation (§3.38). status/amount_paid are stored and job/RPC-maintained, never computed at read time. Unique (child_id, fee_item_id, period_label) makes the recurring billing job (migration 6) naturally idempotent under re-run.';

create or replace function billing.check_billing_ledger_item_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id    uuid;
  v_fee_item_tenant_id uuid;
begin
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;
  select tenant_id into v_fee_item_tenant_id from billing.fee_items where id = new.fee_item_id;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_fee_item_tenant_id is null then
    raise exception 'Fee item not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Fee item not found.', 'human_message_ar', 'لم يتم العثور على بند الرسوم.')::text;
  end if;

  if v_child_tenant_id <> new.tenant_id or v_fee_item_tenant_id <> new.tenant_id then
    raise exception 'child_id/fee_item_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This child and fee item do not both belong to your tenant.', 'human_message_ar', 'الطفل وبند الرسوم لا ينتميان لنفس المؤسسة.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_billing_ledger_items_consistency
  before insert or update on billing.billing_ledger_items
  for each row execute function billing.check_billing_ledger_item_consistency();
