-- ============================================================================
-- Epic 6 — Billing & Payments
-- Migration 3: installment_plans, installment_schedule_entries, invoices,
--              invoice_lines, payment_transactions, invoice_number_counters
-- Ref: BACKEND_ARCHITECTURE.md §3.39-3.43, §4, §5, §6, §20
-- ============================================================================

-- ---------------------------------------------------------------------------
-- billing.installment_plans  (§3.39)
-- ---------------------------------------------------------------------------
create table billing.installment_plans (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  child_id           uuid not null references academic.children(id) on delete restrict,
  fee_item_id        uuid not null references billing.fee_items(id) on delete restrict,
  label              text not null check (btrim(label) <> ''),
  installment_count  int not null check (installment_count > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index installment_plans_tenant_idx on billing.installment_plans (tenant_id);
create index installment_plans_child_idx on billing.installment_plans (child_id);

create trigger trg_installment_plans_updated_at
  before update on billing.installment_plans
  for each row execute function public.set_updated_at();

create or replace function billing.check_installment_plan_consistency()
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

create trigger trg_installment_plans_consistency
  before insert or update on billing.installment_plans
  for each row execute function billing.check_installment_plan_consistency();

-- Fix for EPIC_6_REVIEW.md M1's recurrence check: found while searching for
-- every "immutability once financial history exists" gap the review's M1
-- finding named for invoices — installment_plans has the identical
-- exposure. billing_ledger_items_update_manager is narrowed by RLS to
-- status<>'paid' (M2's fix, below), which alone makes that table immutable
-- once paid; installment_plans carries no status of its own (status lives
-- on its child installment_schedule_entries rows), so a manager could
-- otherwise silently reassign child_id/fee_item_id on a plan that already
-- has paid entries, corrupting reconciliation history retroactively. This
-- trigger blocks that regardless of write path, mirroring
-- transport.check_trip_immutable_fields's column-scoped backstop (Epic 3).
create or replace function billing.check_installment_plan_immutable_once_paid()
returns trigger
language plpgsql
as $$
declare
  v_has_paid_entries boolean;
begin
  if new.child_id is distinct from old.child_id or new.fee_item_id is distinct from old.fee_item_id then
    select exists(select 1 from billing.installment_schedule_entries where plan_id = old.id and status = 'paid') into v_has_paid_entries;
    if v_has_paid_entries then
      raise exception 'child_id/fee_item_id cannot be changed once a plan has any paid installment entry'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This installment plan cannot be reassigned to a different child or fee item once any installment has been paid.', 'human_message_ar', 'لا يمكن إعادة تخصيص خطة التقسيط هذه لطفل أو بند رسوم مختلف بعد دفع أي قسط منها.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_installment_plans_immutable_once_paid
  before update on billing.installment_plans
  for each row execute function billing.check_installment_plan_immutable_once_paid();

-- ---------------------------------------------------------------------------
-- billing.installment_schedule_entries  (§3.40) — status shares
-- billing.billing_status with billing_ledger_items (see migration 1's
-- comment on that type for the resolved doc-ambiguity rationale).
-- ---------------------------------------------------------------------------
create table billing.installment_schedule_entries (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references billing.installment_plans(id) on delete cascade,
  tenant_id   uuid not null references tenancy.tenants(id) on delete restrict,
  sequence    int not null check (sequence >= 1),
  label       text not null check (btrim(label) <> ''),
  amount      numeric(10,2) not null check (amount >= 0),
  due_date    date not null,
  paid        boolean not null default false,
  paid_at     timestamptz null,
  status      billing.billing_status not null default 'unbilled',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index installment_schedule_entries_plan_sequence_key on billing.installment_schedule_entries (plan_id, sequence);
create index installment_schedule_entries_tenant_idx on billing.installment_schedule_entries (tenant_id);
create index installment_schedule_entries_overdue_idx on billing.installment_schedule_entries (tenant_id) where status = 'overdue';

create trigger trg_installment_schedule_entries_updated_at
  before update on billing.installment_schedule_entries
  for each row execute function public.set_updated_at();

comment on table billing.installment_schedule_entries is
  'One row per scheduled installment payment (§3.40). paid/status kept in sync by mark_installment_paid_manual (migration 5) or the ledger-settlement seam (migration 5), never independently.';

-- paid <=> status='paid', both directions — the same "enum and boolean can
-- never drift apart" convention approvals.event_trip_registrations'
-- status/payment_transaction_id trigger established (Epic 5).
create or replace function billing.check_installment_schedule_entry_consistency()
returns trigger
language plpgsql
as $$
declare
  v_plan_tenant_id uuid;
begin
  select tenant_id into v_plan_tenant_id from billing.installment_plans where id = new.plan_id;

  if v_plan_tenant_id is null then
    raise exception 'Installment plan not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Installment plan not found.', 'human_message_ar', 'لم يتم العثور على خطة التقسيط.')::text;
  end if;

  if v_plan_tenant_id <> new.tenant_id then
    raise exception 'plan_id does not belong to the same tenant as this entry'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This installment plan does not belong to your tenant.', 'human_message_ar', 'خطة التقسيط هذه لا تنتمي إلى مؤسستك.')::text;
  end if;

  if new.status = 'paid' and new.paid is distinct from true then
    raise exception 'A paid installment entry must have paid=true'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A paid installment must be marked paid.', 'human_message_ar', 'يجب وضع علامة "مدفوع" على القسط المسدد.')::text;
  end if;

  if new.status <> 'paid' and new.paid is distinct from false then
    raise exception 'Only a paid installment entry may have paid=true'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Only a paid installment may be marked paid.', 'human_message_ar', 'لا يمكن وضع علامة "مدفوع" إلا على قسط مسدد.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_installment_schedule_entries_consistency
  before insert or update on billing.installment_schedule_entries
  for each row execute function billing.check_installment_schedule_entry_consistency();

-- ---------------------------------------------------------------------------
-- billing.invoice_number_counters — one row per tenant, locked via
-- SELECT...FOR UPDATE to generate a gapless-per-tenant invoice_number
-- sequence (§14.3's "SELECT...FOR UPDATE on the relevant capacity-holding
-- row" convention, applied here to a purpose-built counter row rather than
-- overloading an unrelated table like tenancy.tenants — locking that row
-- for invoice numbering would create surprising contention with Epic 1's
-- own tenant suspend/reactivate flows, which also lock it). Not itself
-- named in §3's table list — an implementation-necessary, additive support
-- table for §3.41's "invoice_number text unique per tenant" requirement,
-- the same class of addition as Epic 3's safety.pickup_scan_rate_limits
-- (a small, purpose-built table the architecture names the need for but
-- not the exact storage shape of).
-- ---------------------------------------------------------------------------
-- Fix for EPIC_6_REVIEW.md L1: keyed on (tenant_id, year) rather than
-- tenant_id alone, so the numeric suffix restarts at 1 each calendar year
-- instead of continuing to climb across a year boundary (previously
-- "INV-2027-00006" would immediately follow "INV-2026-00005").
create table billing.invoice_number_counters (
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  year         int not null,
  next_number  int not null default 1,
  primary key (tenant_id, year)
);

comment on table billing.invoice_number_counters is
  'One row per (tenant_id, year), lazily created on the first generate_invoice call of that year. Locked via SELECT...FOR UPDATE to generate a gapless, per-tenant-per-year sequential invoice_number without contending with unrelated tenant-row locks (migration 5). Fix for EPIC_6_REVIEW.md L1 — previously keyed on tenant_id alone, so the sequence never reset across a calendar year.';

-- ---------------------------------------------------------------------------
-- billing.invoices  (§3.41)
-- ---------------------------------------------------------------------------
create table billing.invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenancy.tenants(id) on delete restrict,
  child_id        uuid not null references academic.children(id) on delete restrict,
  invoice_number  text not null,
  issued_at       timestamptz not null default now(),
  total           numeric(10,2) not null check (total >= 0),
  status          billing.invoice_status not null default 'unpaid',
  pdf_object_id   uuid null, -- FK to media.storage_objects, added when that schema exists (Epic 7); see migration 6's comment on how the PDF is discoverable in the meantime
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index invoices_tenant_number_key on billing.invoices (tenant_id, invoice_number);
create index invoices_tenant_idx on billing.invoices (tenant_id);
create index invoices_tenant_status_idx on billing.invoices (tenant_id, status);
create index invoices_child_idx on billing.invoices (child_id);

create trigger trg_invoices_updated_at
  before update on billing.invoices
  for each row execute function public.set_updated_at();

create or replace function billing.check_invoice_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id uuid;
begin
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_child_tenant_id <> new.tenant_id then
    raise exception 'child_id does not belong to the same tenant as this invoice'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This child does not belong to your tenant.', 'human_message_ar', 'هذا الطفل لا ينتمي إلى مؤسستك.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_invoices_consistency
  before insert or update on billing.invoices
  for each row execute function billing.check_invoice_consistency();

-- Fix for EPIC_6_REVIEW.md M1: invoices_update_manager_void's own
-- USING/WITH CHECK (migration 4) only restricts the status TRANSITION
-- (unpaid -> void) — nothing previously stopped total/child_id/invoice_number
-- from being silently rewritten in the very same UPDATE. This is the
-- column-scoped backstop, mirroring transport.check_trip_immutable_fields
-- (Epic 3): once created, an invoice's identity/amount can never change via
-- any write path, regardless of what else the request also does.
create or replace function billing.check_invoice_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.total is distinct from old.total
     or new.child_id is distinct from old.child_id
     or new.invoice_number is distinct from old.invoice_number then
    raise exception 'total/child_id/invoice_number cannot be changed after an invoice is created'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'An invoice''s total, child, and number cannot be changed after it is created.', 'human_message_ar', 'لا يمكن تغيير إجمالي الفاتورة أو الطفل أو الرقم بعد إنشائها.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_invoices_immutable_fields
  before update of total, child_id, invoice_number on billing.invoices
  for each row execute function billing.check_invoice_immutable_fields();

-- ---------------------------------------------------------------------------
-- billing.invoice_lines  (§3.42)
--
-- Fix for EPIC_6_REVIEW.md C1: ledger_item_id/installment_entry_id are new,
-- additive, nullable columns — the explicit payment-to-obligation linkage
-- the review's recommended fix calls for. Previously, settlement/refund
-- (billing.settle_payment_transaction, migration 5) matched "which
-- obligations does this payment cover" by fee_item_id alone, which
-- silently over-credited every outstanding period/installment sharing that
-- fee item (not just the one(s) this specific invoice/payment actually
-- covers) and, symmetrically, incorrectly reversed unrelated obligations on
-- refund. A line now optionally references the EXACT billing_ledger_items
-- or installment_schedule_entries row it pays down; settle_payment_transaction
-- settles/reverses only those specific rows. An ad-hoc line (neither
-- reference set) intentionally never touches the ledger — see migration
-- 5's own updated comment for the full reasoning.
-- ---------------------------------------------------------------------------
create table billing.invoice_lines (
  id                    uuid primary key default gen_random_uuid(),
  invoice_id            uuid not null references billing.invoices(id) on delete cascade,
  tenant_id             uuid not null references tenancy.tenants(id) on delete restrict,
  description           text not null check (btrim(description) <> ''),
  fee_item_id           uuid null references billing.fee_items(id) on delete set null,
  ledger_item_id        uuid null references billing.billing_ledger_items(id) on delete set null,
  installment_entry_id  uuid null references billing.installment_schedule_entries(id) on delete set null,
  amount                numeric(10,2) not null check (amount >= 0),
  created_at            timestamptz not null default now(),

  constraint invoice_lines_at_most_one_obligation_ref check (
    (ledger_item_id is null or installment_entry_id is null)
  )
);

create index invoice_lines_invoice_idx on billing.invoice_lines (invoice_id);
create index invoice_lines_tenant_idx on billing.invoice_lines (tenant_id);
create index invoice_lines_ledger_item_idx on billing.invoice_lines (ledger_item_id) where ledger_item_id is not null;
create index invoice_lines_installment_entry_idx on billing.invoice_lines (installment_entry_id) where installment_entry_id is not null;

create or replace function billing.check_invoice_line_consistency()
returns trigger
language plpgsql
as $$
declare
  v_invoice_tenant_id       uuid;
  v_invoice_child_id        uuid;
  v_fee_item_tenant_id      uuid;
  v_ledger_item_tenant_id   uuid;
  v_ledger_item_child_id    uuid;
  v_ledger_item_status      billing.billing_status;
  v_installment_tenant_id   uuid;
  v_installment_child_id    uuid;
  v_installment_status      billing.billing_status;
begin
  select tenant_id, child_id into v_invoice_tenant_id, v_invoice_child_id from billing.invoices where id = new.invoice_id;

  if v_invoice_tenant_id is null then
    raise exception 'Invoice not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Invoice not found.', 'human_message_ar', 'لم يتم العثور على الفاتورة.')::text;
  end if;

  if v_invoice_tenant_id <> new.tenant_id then
    raise exception 'invoice_id does not belong to the same tenant as this line'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This invoice does not belong to your tenant.', 'human_message_ar', 'هذه الفاتورة لا تنتمي إلى مؤسستك.')::text;
  end if;

  if new.fee_item_id is not null then
    select tenant_id into v_fee_item_tenant_id from billing.fee_items where id = new.fee_item_id;
    if v_fee_item_tenant_id is null or v_fee_item_tenant_id <> new.tenant_id then
      raise exception 'fee_item_id does not belong to the same tenant as this line'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This fee item does not belong to your tenant.', 'human_message_ar', 'بند الرسوم هذا لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  -- Fix for EPIC_6_REVIEW.md C1: a referenced ledger item must belong to
  -- the SAME tenant AND the SAME child as the invoice itself (an invoice
  -- can only ever settle its own child's obligations), and must not
  -- already be paid (prevents double-invoicing an obligation that's
  -- already settled, e.g. via mark_ledger_item_paid_manual, migration 5).
  if new.ledger_item_id is not null then
    select tenant_id, child_id, status into v_ledger_item_tenant_id, v_ledger_item_child_id, v_ledger_item_status
    from billing.billing_ledger_items where id = new.ledger_item_id;

    if v_ledger_item_tenant_id is null then
      raise exception 'Referenced ledger item not found'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Referenced ledger item not found.', 'human_message_ar', 'لم يتم العثور على بند السجل المرجعي.')::text;
    end if;

    if v_ledger_item_tenant_id <> new.tenant_id or v_ledger_item_child_id <> v_invoice_child_id then
      raise exception 'ledger_item_id does not belong to the same tenant/child as this invoice'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This ledger item does not belong to the same child as the invoice.', 'human_message_ar', 'بند السجل هذا لا ينتمي لنفس طفل الفاتورة.')::text;
    end if;

    if v_ledger_item_status = 'paid' then
      raise exception 'Referenced ledger item is already paid'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This ledger item has already been paid.', 'human_message_ar', 'تم دفع بند السجل هذا بالفعل.')::text;
    end if;
  end if;

  -- Same three checks for installment_entry_id (via its parent plan's
  -- child_id, installment_schedule_entries carries no child_id of its own).
  if new.installment_entry_id is not null then
    select se.tenant_id, ip.child_id, se.status into v_installment_tenant_id, v_installment_child_id, v_installment_status
    from billing.installment_schedule_entries se
    join billing.installment_plans ip on ip.id = se.plan_id
    where se.id = new.installment_entry_id;

    if v_installment_tenant_id is null then
      raise exception 'Referenced installment entry not found'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Referenced installment entry not found.', 'human_message_ar', 'لم يتم العثور على القسط المرجعي.')::text;
    end if;

    if v_installment_tenant_id <> new.tenant_id or v_installment_child_id <> v_invoice_child_id then
      raise exception 'installment_entry_id does not belong to the same tenant/child as this invoice'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This installment entry does not belong to the same child as the invoice.', 'human_message_ar', 'هذا القسط لا ينتمي لنفس طفل الفاتورة.')::text;
    end if;

    if v_installment_status = 'paid' then
      raise exception 'Referenced installment entry is already paid'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This installment has already been paid.', 'human_message_ar', 'تم دفع هذا القسط بالفعل.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_invoice_lines_consistency
  before insert or update on billing.invoice_lines
  for each row execute function billing.check_invoice_line_consistency();

-- ---------------------------------------------------------------------------
-- billing.payment_transactions  (§3.43) — see §20 for the full lifecycle.
-- provider_reference unique where non-null is the PSP-duplicate-webhook
-- idempotency mechanism §20 explicitly names.
--
-- Fix for EPIC_6_REVIEW.md H2: receipt_file_path is a new, additive,
-- nullable column storing the ACTUAL guardian-chosen filename/path for a
-- bank-transfer receipt upload (payment-receipts/{tenantId}/{guardianId}/{filename},
-- migration 7's own path convention) — previously that filename was
-- accepted by initiate-payment, validated for presence, and then
-- discarded, with only an unrelated random placeholder UUID
-- (receipt_object_id) ever persisted. The receipt was therefore never
-- reviewable again by any manager. receipt_object_id is kept, unchanged,
-- as the established Epic 1-5 bare-placeholder-uuid-pending-Epic-7
-- convention; receipt_file_path is the genuinely new, actually-queryable
-- piece of information.
-- ---------------------------------------------------------------------------
create table billing.payment_transactions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  child_id            uuid not null references academic.children(id) on delete restrict,
  invoice_id          uuid null references billing.invoices(id) on delete set null,
  method              billing.payment_method not null,
  amount              numeric(10,2) not null check (amount > 0),
  status              billing.payment_status not null default 'initiated',
  provider_reference  text null,
  receipt_object_id   uuid null, -- FK to media.storage_objects, added when that schema exists (Epic 7)
  receipt_file_path   text null, -- Fix for EPIC_6_REVIEW.md H2 — the real, reviewable storage path
  initiated_at        timestamptz not null default now(),
  settled_at          timestamptz null
);

create unique index payment_transactions_provider_reference_key on billing.payment_transactions (provider_reference) where provider_reference is not null;
create index payment_transactions_tenant_idx on billing.payment_transactions (tenant_id);
create index payment_transactions_child_idx on billing.payment_transactions (child_id);
create index payment_transactions_invoice_idx on billing.payment_transactions (invoice_id) where invoice_id is not null;
-- Stale manual-payment escalation job's own hot-path scan (§20, §27).
create index payment_transactions_pending_verification_idx on billing.payment_transactions (initiated_at) where status = 'pending_verification';

-- Fix for EPIC_6_REVIEW.md H1: previously nothing prevented two concurrent
-- initiate-payment calls for the SAME invoice from each creating their own
-- payment_transactions row — both would pass the Edge Function's own
-- "invoice.status = unpaid" check (status only ever flips once one of them
-- SETTLES, not at initiation), risking a guardian being genuinely charged
-- twice at the bank/PSP with no system-level trace connecting the two
-- attempts as duplicates of one intent. This partial unique index makes "at
-- most one in-flight (not yet settled) payment per invoice" a hard
-- database-level guarantee, the same "constraint as defense in depth"
-- convention transport.bus_riders_active_child_key established (Epic 3) —
-- initiate-payment/index.ts additionally checks for an existing in-flight
-- row first (migration 5's sibling Edge Function change) so the common case
-- gets a clean, existing-row response instead of a raw constraint error.
create unique index payment_transactions_one_inflight_per_invoice on billing.payment_transactions (invoice_id)
  where invoice_id is not null and status in ('initiated', 'pending_verification');

comment on table billing.payment_transactions is
  'Payment lifecycle: initiated -> pending_verification (manual methods) or straight to succeeded/failed (gateway methods via webhook) -> succeeded|failed -> (refunded) (§20). settle_payment_transaction (migration 5) is the sole seam that ever transitions status away from initiated/pending_verification.';

create or replace function billing.check_payment_transaction_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id   uuid;
  v_invoice_tenant_id uuid;
begin
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_child_tenant_id <> new.tenant_id then
    raise exception 'child_id does not belong to the same tenant as this payment'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This child does not belong to your tenant.', 'human_message_ar', 'هذا الطفل لا ينتمي إلى مؤسستك.')::text;
  end if;

  if new.invoice_id is not null then
    select tenant_id into v_invoice_tenant_id from billing.invoices where id = new.invoice_id;
    if v_invoice_tenant_id is null or v_invoice_tenant_id <> new.tenant_id then
      raise exception 'invoice_id does not belong to the same tenant as this payment'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This invoice does not belong to your tenant.', 'human_message_ar', 'هذه الفاتورة لا تنتمي إلى مؤسستك.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_payment_transactions_consistency
  before insert or update on billing.payment_transactions
  for each row execute function billing.check_payment_transaction_consistency();
