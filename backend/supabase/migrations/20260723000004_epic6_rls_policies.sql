-- ============================================================================
-- Epic 6 — Billing & Payments
-- Migration 4: RLS policies for every Epic 6 table
-- Ref: BACKEND_ARCHITECTURE.md §12, §13
--
-- Convention (unchanged from Epic 1-5): FORCE ROW LEVEL SECURITY everywhere;
-- separate named policy per role/action; direct equality checks, never a
-- raw subquery, for every table that can carry its own scoping column.
--
-- No DELETE policy is granted anywhere in this migration, for anyone —
-- generalizing EPIC_5_REVIEW.md H1's lesson ("Manager has no D anywhere in
-- this system... only soft-delete") to its strongest form for financial
-- records specifically: every Epic 6 table is a reconciliation-relevant
-- record (even fee_items/installment_plans are config history other rows
-- FK-reference), so none of them get a hard-delete path at all. `active`
-- booleans (fee_items) and status transitions (invoices -> void) are the
-- correct way to "remove" something here, matching real accounting
-- practice (nothing is ever actually deleted from a ledger).
--
-- No direct INSERT/UPDATE policy is granted on billing.invoices,
-- billing.invoice_lines, or billing.payment_transactions — each has a
-- correctness-critical RPC (generate_invoice; settle_payment_transaction
-- via verify_payment/refund_payment/the payment webhook) that a bare
-- RLS-gated write would bypass: invoice_number's gapless-per-tenant
-- numbering (generate_invoice locks a counter row no direct INSERT could
-- replicate), and payment_transactions' entire raison d'être (a guardian
-- must never be able to simply INSERT a row claiming status='succeeded'
-- with a fabricated provider_reference). This is EPIC_5_REVIEW.md H2's
-- lesson ("no direct RLS write path alongside an RPC unless it truly
-- cannot bypass anything the RPC guarantees") applied from the first
-- draft, not discovered after the fact.
--
-- Every guardian-facing SELECT policy below states tenant_id explicitly in
-- its USING clause (in addition to the child-ownership check) — caught and
-- fixed during this Epic's own project-wide recurrence check for
-- EPIC_5_REVIEW.md L3 (six guardian SELECT policies were initially drafted
-- without it, relying only on transitive tenant-scoping via
-- current_guardian_child_ids()). Not independently exploitable, but
-- correctly brought in line with this codebase's stated convention before
-- being considered complete, rather than left to recur a second time.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- billing.fee_items — Guardian: R (own tenant). Manager: CRU (no D, see
-- header). §12: "Fee items | R | – | – | CRUD".
-- ---------------------------------------------------------------------------
alter table billing.fee_items enable row level security;
alter table billing.fee_items force row level security;

create policy fee_items_select_guardian on billing.fee_items
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian');

create policy fee_items_select_manager on billing.fee_items
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy fee_items_insert_manager on billing.fee_items
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy fee_items_update_manager on billing.fee_items
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- billing.fee_item_applicability — internal config link table, not directly
-- guardian-relevant (their eligibility is reflected in which ledger items
-- get generated for them, not by reading this table). Manager: CRU only.
-- ---------------------------------------------------------------------------
alter table billing.fee_item_applicability enable row level security;
alter table billing.fee_item_applicability force row level security;

create policy fee_item_applicability_select_manager on billing.fee_item_applicability
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy fee_item_applicability_insert_manager on billing.fee_item_applicability
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy fee_item_applicability_update_manager on billing.fee_item_applicability
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- billing.billing_ledger_items — Guardian: R (own child). Manager: CRU (no
-- D). §12: "Billing ledger/Invoices | R (own child) | – | – | CRUD".
-- ---------------------------------------------------------------------------
alter table billing.billing_ledger_items enable row level security;
alter table billing.billing_ledger_items force row level security;

create policy billing_ledger_items_select_guardian on billing.billing_ledger_items
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy billing_ledger_items_select_manager on billing.billing_ledger_items
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy billing_ledger_items_insert_manager on billing.billing_ledger_items
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Fix for EPIC_6_REVIEW.md M2: previously unrestricted beyond tenant/role,
-- letting a manager silently flip status='paid' (and amount_paid) via
-- direct REST with no payment_transactions row, no write_audit_log call,
-- and no guardian notification — a financial state change §23 explicitly
-- names as audit-worthy, happening with zero trace of who did it or why.
-- Narrowed to status<>'paid' in both clauses, the same shape
-- installment_schedule_entries_update_manager already used — the paid
-- transition is now reachable only via mark_ledger_item_paid_manual
-- (migration 5), which writes the notification + audit_log entry a bare
-- UPDATE would silently skip.
create policy billing_ledger_items_update_manager on billing.billing_ledger_items
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status <> 'paid')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status <> 'paid');

-- ---------------------------------------------------------------------------
-- billing.installment_plans / installment_schedule_entries — same shape as
-- billing_ledger_items (Guardian R own child, Manager CRU, no D).
-- ---------------------------------------------------------------------------
alter table billing.installment_plans enable row level security;
alter table billing.installment_plans force row level security;

create policy installment_plans_select_guardian on billing.installment_plans
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy installment_plans_select_manager on billing.installment_plans
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy installment_plans_insert_manager on billing.installment_plans
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy installment_plans_update_manager on billing.installment_plans
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

alter table billing.installment_schedule_entries enable row level security;
alter table billing.installment_schedule_entries force row level security;

-- Guardian visibility is via the parent plan's own child_id — a direct
-- equality check against a uuid[] helper would need
-- current_guardian_installment_plan_ids(); instead this uses the same
-- "join-through-parent" shape §13.1 explicitly carves out as the one
-- allowed exception for pure link/detail tables (mirrors
-- approvals.event_trip_registrations were it not for the fact that table
-- carries its own child_id — installment_schedule_entries does not, by
-- §3.40's own field list, so the join is unavoidable here without adding
-- an undocumented denormalized column).
create policy installment_schedule_entries_select_guardian on billing.installment_schedule_entries
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'guardian'
    and exists (
      select 1 from billing.installment_plans ip
      where ip.id = plan_id and ip.child_id = any (public.current_guardian_child_ids())
    )
  );

create policy installment_schedule_entries_select_manager on billing.installment_schedule_entries
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy installment_schedule_entries_insert_manager on billing.installment_schedule_entries
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Fix-forward application of EPIC_5_REVIEW.md H2's lesson at the design
-- stage: a manager's direct UPDATE must not be able to reach status='paid'
-- (that transition is reserved for mark_installment_paid_manual, migration
-- 5, which also writes the notification/activity-log side effects a bare
-- UPDATE would silently skip) — mirrors
-- approvals.event_trip_registrations_update_guardian's "RLS encodes only
-- the safe transition" shape (Epic 5).
create policy installment_schedule_entries_update_manager on billing.installment_schedule_entries
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status <> 'paid')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status <> 'paid');

-- ---------------------------------------------------------------------------
-- billing.invoices / invoice_lines — Guardian: R (own child). Manager: R
-- (tenant-wide) + a narrow void transition only — see header for why no
-- INSERT policy exists (generate_invoice, migration 5, is the sole creation
-- path).
-- ---------------------------------------------------------------------------
alter table billing.invoices enable row level security;
alter table billing.invoices force row level security;

create policy invoices_select_guardian on billing.invoices
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy invoices_select_manager on billing.invoices
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Manager may void an unpaid invoice directly (no RPC needed for this
-- single, narrow, non-cascading transition); paid invoices are immutable
-- once settle_payment_transaction (migration 5) has marked them paid.
create policy invoices_update_manager_void on billing.invoices
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status = 'unpaid')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status = 'void');

alter table billing.invoice_lines enable row level security;
alter table billing.invoice_lines force row level security;

create policy invoice_lines_select_guardian on billing.invoice_lines
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'guardian'
    and exists (
      select 1 from billing.invoices i
      where i.id = invoice_id and i.child_id = any (public.current_guardian_child_ids())
    )
  );

create policy invoice_lines_select_manager on billing.invoice_lines
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- billing.payment_transactions — Guardian: R (own child) only — creation is
-- exclusively via the initiate-payment Edge Function (service_role), never
-- a direct client INSERT (see header). Manager: R (tenant-wide) only —
-- status transitions are exclusively via verify_payment/refund_payment
-- (migration 5, SECURITY DEFINER). Platform Admin: no RLS policy at all —
-- support/reconciliation access goes through a dedicated SECURITY DEFINER
-- function instead (below), never a blanket bypass policy on tenant
-- operational data (§13.6, EPIC_4_REVIEW.md C1's lesson).
-- ---------------------------------------------------------------------------
alter table billing.payment_transactions enable row level security;
alter table billing.payment_transactions force row level security;

create policy payment_transactions_select_guardian on billing.payment_transactions
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy payment_transactions_select_manager on billing.payment_transactions
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- billing.invoice_number_counters — purely internal (generate_invoice,
-- migration 5, is the only reader/writer, via SECURITY DEFINER). Zero
-- policies, matching jobs.background_job_queue/comms.notification_deliveries'
-- established "FORCE RLS + no policy = hard deny for every client role"
-- precedent (Epic 4).
-- ---------------------------------------------------------------------------
alter table billing.invoice_number_counters enable row level security;
alter table billing.invoice_number_counters force row level security;

-- ---------------------------------------------------------------------------
-- Platform Admin support/reconciliation view (§12: "Payments | ... | R
-- (support/reconciliation view)"). Implemented as a narrow, purpose-built
-- SECURITY DEFINER function — NOT a raw RLS bypass policy on
-- payment_transactions — mirroring academic.children_reception_safe()/
-- children_driver_safe()'s established "column/row-narrowed read surface,
-- no base-table SELECT policy for that role" pattern (Epic 2/3), and
-- directly applying EPIC_4_REVIEW.md C1's lesson: Platform Admin never gets
-- a blanket bypass on tenant-operational data, even when the permission
-- matrix names a real, legitimate read need (§13.6's own "dedicated
-- cross-tenant support views" language is exactly this construct).
-- ---------------------------------------------------------------------------
create or replace function public.payment_transactions_support_view()
returns setof billing.payment_transactions
language sql
stable
security definer
set search_path = ''
as $$
  select * from billing.payment_transactions
  where public.is_platform_admin();
$$;

comment on function public.payment_transactions_support_view() is
  'Platform Admin (any tier) support/reconciliation read surface for billing.payment_transactions (§12, §13.6) — returns zero rows for any non-platform_admin caller (defense-in-depth inside the function body, same convention as children_reception_safe()). No base-table RLS policy grants Platform Admin any bypass on this table.';

revoke all on function public.payment_transactions_support_view from public;
grant execute on function public.payment_transactions_support_view to authenticated;
