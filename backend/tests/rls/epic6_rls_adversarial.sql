-- ============================================================================
-- Epic 6 RLS adversarial test suite. Same shape as epic2-5_rls_adversarial.sql:
-- fixture rows as service_role, then switch to a simulated authenticated role
-- via a forged JWT claim and assert the expected allow/deny outcome. Every
-- fixture UUID uses only valid hexadecimal characters (0-9a-f) from the
-- start. Written per this task's requirement; execution status/instructions
-- are documented in EPIC_6_COMPLETION_REPORT.md (mirrors the precedent set
-- for tests/rls/epic5_rls_adversarial.sql and epic5_full_execution_bundle.sql).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A: manager, guardian A1 (child A1), guardian
-- A2 (child A2). Tenant B: manager B, guardian B1 (child B1). Tenant A gets
-- a monthly, scope=all fee item ("Tuition"), a billing_ledger_items row for
-- Child A1, an invoice for Child A1 with one matching invoice_line, and a
-- pending_verification payment_transaction against that invoice.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e6999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e6a01', 'Tenant E6-A', 'tenant-e6-a-test', '00000000-0000-0000-0000-0000000e6999', 'active'),
  ('00000000-0000-0000-0000-0000000e6b01', 'Tenant E6-B', 'tenant-e6-b-test', '00000000-0000-0000-0000-0000000e6999', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e6a11', '+201500000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e6a14', '+201500000004', 'authenticated', 'authenticated'), -- guardian A1
  ('00000000-0000-0000-0000-0000000e6a15', '+201500000005', 'authenticated', 'authenticated'), -- guardian A2
  ('00000000-0000-0000-0000-0000000e6b11', '+201500000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e6b14', '+201500000008', 'authenticated', 'authenticated'), -- guardian B1
  ('00000000-0000-0000-0000-0000000e6c01', '+201500000009', 'authenticated', 'authenticated')  -- platform admin (support tier)
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e6a11', '00000000-0000-0000-0000-0000000e6a01', 'manager', 'Manager A', '+201500000001'),
  ('00000000-0000-0000-0000-0000000e6b11', '00000000-0000-0000-0000-0000000e6b01', 'manager', 'Manager B', '+201500000006')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e6a14', '00000000-0000-0000-0000-0000000e6a01', 'Guardian A1', '+201500000004'),
  ('00000000-0000-0000-0000-0000000e6a15', '00000000-0000-0000-0000-0000000e6a01', 'Guardian A2', '+201500000005'),
  ('00000000-0000-0000-0000-0000000e6b14', '00000000-0000-0000-0000-0000000e6b01', 'Guardian B1', '+201500000008')
on conflict (id) do nothing;

insert into identity.platform_admins (id, name, email, role)
values ('00000000-0000-0000-0000-0000000e6c01', 'Support Admin', 'support-e6-test@masar.app', 'support')
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, capacity)
values ('00000000-0000-0000-0000-0000000e6a21', '00000000-0000-0000-0000-0000000e6a01', 'KG1-A', 'kg1', 36, 48, 10)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e6a21', 'full_day'),
  ('00000000-0000-0000-0000-0000000e6a32', '00000000-0000-0000-0000-0000000e6a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e6a21', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values
  ('00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6a14', '00000000-0000-0000-0000-0000000e6a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e6a32', '00000000-0000-0000-0000-0000000e6a15', '00000000-0000-0000-0000-0000000e6a01', 'mother', true)
on conflict do nothing;

insert into billing.fee_items (id, tenant_id, name, cycle, scope, required, price, active)
values ('00000000-0000-0000-0000-0000000e6d01', '00000000-0000-0000-0000-0000000e6a01', 'Tuition', 'monthly', 'all', true, 1500.00, true)
on conflict (id) do nothing;

-- Fix for EPIC_6_REVIEW.md M3: two outstanding billing_ledger_items rows
-- sharing the SAME fee_item_id (different periods) — this is the exact
-- shape needed to catch C1's old fee_item_id-wide matching bug. Only
-- e6e01 (September) is referenced by an invoice_line below; e6e02
-- (October) must remain untouched by any settlement/refund against that
-- invoice.
insert into billing.billing_ledger_items (id, tenant_id, child_id, fee_item_id, period_label, amount_due, amount_paid, status, due_date)
values
  ('00000000-0000-0000-0000-0000000e6e01', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6d01', '2026-09', 1500.00, 0, 'due', '2026-09-30'),
  ('00000000-0000-0000-0000-0000000e6e02', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6d01', '2026-10', 1500.00, 0, 'due', '2026-10-31')
on conflict (id) do nothing;

insert into billing.invoices (id, tenant_id, child_id, invoice_number, total, status)
values ('00000000-0000-0000-0000-0000000e6f01', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', 'INV-2026-TEST01', 1500.00, 'unpaid')
on conflict (id) do nothing;

-- Fix for EPIC_6_REVIEW.md C1: the invoice line now carries an explicit
-- ledger_item_id reference — this is what lets settle_payment_transaction
-- settle exactly this obligation and no other, even though e6e02 shares the
-- same fee_item_id.
insert into billing.invoice_lines (id, invoice_id, tenant_id, description, fee_item_id, ledger_item_id, amount)
values ('00000000-0000-0000-0000-0000000e6f11', '00000000-0000-0000-0000-0000000e6f01', '00000000-0000-0000-0000-0000000e6a01', 'Tuition — September', '00000000-0000-0000-0000-0000000e6d01', '00000000-0000-0000-0000-0000000e6e01', 1500.00)
on conflict (id) do nothing;

insert into billing.payment_transactions (id, tenant_id, child_id, invoice_id, method, amount, status, provider_reference)
values ('00000000-0000-0000-0000-0000000e6011', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6f01', 'bank_transfer', 1500.00, 'pending_verification', 'bank-transfer-e6-test-01')
on conflict (id) do nothing;

insert into billing.installment_plans (id, tenant_id, child_id, fee_item_id, label, installment_count)
values ('00000000-0000-0000-0000-0000000e6021', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6d01', 'Term 1 plan', 2)
on conflict (id) do nothing;

-- Fix for EPIC_6_REVIEW.md M3: a second installment entry on the SAME plan
-- (multi-installment fixture) — e6032 must remain untouched by any RPC
-- call that only references e6031.
insert into billing.installment_schedule_entries (id, plan_id, tenant_id, sequence, label, amount, due_date, status)
values
  ('00000000-0000-0000-0000-0000000e6031', '00000000-0000-0000-0000-0000000e6021', '00000000-0000-0000-0000-0000000e6a01', 1, 'Installment 1', 750.00, '2026-09-30', 'due'),
  ('00000000-0000-0000-0000-0000000e6032', '00000000-0000-0000-0000-0000000e6021', '00000000-0000-0000-0000-0000000e6a01', 2, 'Installment 2', 750.00, '2026-10-31', 'due')
on conflict (id) do nothing;

-- A second invoice for Child A1, its line referencing installment entry
-- e6031 explicitly (the "partial payment" / "multiple installments for the
-- same fee item" fixture) — a bank-transfer payment against this invoice
-- exercises the receipt-upload/review path (receipt_file_path).
insert into billing.invoices (id, tenant_id, child_id, invoice_number, total, status)
values ('00000000-0000-0000-0000-0000000e6f02', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', 'INV-2026-TEST02', 750.00, 'unpaid')
on conflict (id) do nothing;

insert into billing.invoice_lines (id, invoice_id, tenant_id, description, fee_item_id, installment_entry_id, amount)
values ('00000000-0000-0000-0000-0000000e6f12', '00000000-0000-0000-0000-0000000e6f02', '00000000-0000-0000-0000-0000000e6a01', 'Term 1 — Installment 1', '00000000-0000-0000-0000-0000000e6d01', '00000000-0000-0000-0000-0000000e6031', 750.00)
on conflict (id) do nothing;

insert into billing.payment_transactions (id, tenant_id, child_id, invoice_id, method, amount, status, provider_reference, receipt_file_path)
values ('00000000-0000-0000-0000-0000000e6012', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6f02', 'bank_transfer', 750.00, 'pending_verification', 'bank-transfer-e6-test-02', 'payment-receipts/00000000-0000-0000-0000-0000000e6a01/00000000-0000-0000-0000-0000000e6a14/receipt-e6-test-02.png')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's payments,
-- invoices, or fee items.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from billing.payment_transactions where id = '00000000-0000-0000-0000-0000000e6011';
  if v_count <> 0 then raise exception 'FAIL Test 1a: Manager B could see Tenant A''s payment'; end if;

  select count(*) into v_count from billing.invoices where id = '00000000-0000-0000-0000-0000000e6f01';
  if v_count <> 0 then raise exception 'FAIL Test 1b: Manager B could see Tenant A''s invoice'; end if;

  select count(*) into v_count from billing.fee_items where id = '00000000-0000-0000-0000-0000000e6d01';
  if v_count <> 0 then raise exception 'FAIL Test 1c: Manager B could see Tenant A''s fee item'; end if;

  raise notice 'PASS Test 1: cross-tenant isolation holds on payments/invoices/fee_items';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: guardian own-child scoping — Guardian A2 cannot see Guardian A1's
-- child's ledger, invoice, or payment.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from billing.billing_ledger_items where id = '00000000-0000-0000-0000-0000000e6e01';
  if v_count <> 0 then raise exception 'FAIL Test 2a: Guardian A2 could see Guardian A1''s child''s ledger item'; end if;

  select count(*) into v_count from billing.invoices where id = '00000000-0000-0000-0000-0000000e6f01';
  if v_count <> 0 then raise exception 'FAIL Test 2b: Guardian A2 could see Guardian A1''s child''s invoice'; end if;

  select count(*) into v_count from billing.payment_transactions where id = '00000000-0000-0000-0000-0000000e6011';
  if v_count <> 0 then raise exception 'FAIL Test 2c: Guardian A2 could see Guardian A1''s child''s payment'; end if;

  raise notice 'PASS Test 2: guardian own-child scoping holds on ledger/invoices/payments';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: a guardian cannot directly INSERT into billing.payment_transactions
-- — initiate-payment (service_role Edge Function) is the sole creation path
-- (EPIC_5_REVIEW.md H2's lesson, applied from the start here).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"guardian"}}';

do $$
begin
  insert into billing.payment_transactions (tenant_id, child_id, invoice_id, method, amount, status, provider_reference)
  values ('00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6f01', 'instapay', 1500.00, 'succeeded', 'forged-ref');
  raise exception 'FAIL Test 3: guardian inserted a payment_transactions row directly, claiming status=succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 3: no direct INSERT path exists on billing.payment_transactions';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: a manager cannot directly INSERT into billing.invoices —
-- generate_invoice (SECURITY DEFINER) is the sole creation path (protects
-- the gapless-per-tenant invoice_number sequence).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"manager"}}';

do $$
begin
  insert into billing.invoices (tenant_id, child_id, invoice_number, total, status)
  values ('00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', 'INV-FORGED-00001', 999.00, 'unpaid');
  raise exception 'FAIL Test 4: manager inserted an invoice directly, bypassing generate_invoice''s numbering';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 4: no direct INSERT path exists on billing.invoices';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: a manager cannot directly flip an installment_schedule_entries row
-- to status='paid' — mark_installment_paid_manual is the sole path (its own
-- notification/audit-log side effects would otherwise be silently skipped).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"manager"}}';

do $$
declare v_count int;
begin
  update billing.installment_schedule_entries set status = 'paid' where id = '00000000-0000-0000-0000-0000000e6031';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 5: manager set an installment entry to status=paid via direct REST access';
  end if;
  raise notice 'PASS Test 5: no direct path to status=paid exists on billing.installment_schedule_entries';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6 (the core financial-correctness test): public.verify_payment,
-- called as Manager A, transitions the pending_verification payment to
-- succeeded AND atomically marks the matching invoice + billing_ledger_item
-- as paid in the same transaction (§20 Acceptance Criteria). This is the
-- direct regression test for the ledger-settlement seam
-- (billing.settle_payment_transaction, migration 5).
--
-- Fix for EPIC_6_REVIEW.md C1: also asserts that e6e02 — a SECOND
-- outstanding ledger item sharing the same fee_item_id as e6e01 but NOT
-- referenced by this invoice's line — is left completely untouched. Under
-- the old fee_item_id-wide matching logic this settlement would have
-- silently over-credited e6e02 too; this is the regression test that would
-- have caught it.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"manager"}}';

do $$
declare
  v_payment_status  text;
  v_invoice_status  text;
  v_ledger_status   text;
  v_ledger_paid     numeric;
  v_other_status    text;
  v_other_paid      numeric;
begin
  perform public.verify_payment('00000000-0000-0000-0000-0000000e6011'::uuid, 'succeeded'::billing.payment_status, 'Bank receipt verified');

  select status::text into v_payment_status from billing.payment_transactions where id = '00000000-0000-0000-0000-0000000e6011';
  select status::text into v_invoice_status from billing.invoices where id = '00000000-0000-0000-0000-0000000e6f01';
  select status::text, amount_paid into v_ledger_status, v_ledger_paid from billing.billing_ledger_items where id = '00000000-0000-0000-0000-0000000e6e01';
  select status::text, amount_paid into v_other_status, v_other_paid from billing.billing_ledger_items where id = '00000000-0000-0000-0000-0000000e6e02';

  if v_payment_status <> 'succeeded' then raise exception 'FAIL Test 6a: payment status is % (expected succeeded)', v_payment_status; end if;
  if v_invoice_status <> 'paid' then raise exception 'FAIL Test 6b: invoice status is % (expected paid)', v_invoice_status; end if;
  if v_ledger_status <> 'paid' or v_ledger_paid <> 1500.00 then raise exception 'FAIL Test 6c: ledger item status=% amount_paid=% (expected paid/1500.00)', v_ledger_status, v_ledger_paid; end if;
  if v_other_status = 'paid' or v_other_paid <> 0 then raise exception 'FAIL Test 6d (C1 regression): unrelated ledger item e6e02 (same fee_item_id) was over-credited: status=% amount_paid=%', v_other_status, v_other_paid; end if;

  raise notice 'PASS Test 6: verify_payment atomically settles payment + invoice + ledger item together, and leaves the unrelated same-fee-item ledger item untouched';
end $$;

-- ---------------------------------------------------------------------------
-- Test 7: duplicate settlement — calling verify_payment again on the same
-- (now succeeded) transaction must NOT re-apply the ledger update or
-- silently succeed a second time; it must raise STATE_ALREADY_PROCESSED
-- (Acceptance Criteria: "a duplicate webhook delivery never double-credits
-- a ledger" — exercised here via the manual-verification path, since a
-- webhook re-delivery would hit the identical settle_payment_transaction
-- guard from payment-webhook/index.ts).
-- ---------------------------------------------------------------------------
do $$
begin
  perform public.verify_payment('00000000-0000-0000-0000-0000000e6011'::uuid, 'succeeded'::billing.payment_status, 'Second attempt');
  raise exception 'FAIL Test 7: a second verify_payment call on an already-settled transaction did not raise';
exception
  when others then
    if sqlerrm like '%already been settled%' or sqlerrm like '%already%processed%' then
      raise notice 'PASS Test 7: duplicate settlement is rejected, not silently re-applied';
    else
      raise exception 'FAIL Test 7: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8: refund_payment reverses the same settlement — invoice and ledger
-- item both revert to their pre-payment state, and (C1 regression) a
-- separately-settled obligation sharing the same fee_item_id is NOT
-- reversed by this refund — verifying "refunds only reverse obligations
-- originally settled by the same payment".
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"manager"}}';

-- Settle e6e02 independently via cash (mark_ledger_item_paid_manual, M2's
-- new RPC) BEFORE refunding the bank-transfer payment above, so Test 8 can
-- assert the refund does not un-pay this unrelated, separately-settled
-- obligation.
do $$
begin
  perform public.mark_ledger_item_paid_manual('00000000-0000-0000-0000-0000000e6e02'::uuid, 'Paid in cash at front desk');
end $$;

do $$
declare
  v_payment_status text;
  v_invoice_status text;
  v_ledger_status  text;
  v_ledger_paid    numeric;
  v_other_status   text;
  v_other_paid     numeric;
begin
  perform public.refund_payment('00000000-0000-0000-0000-0000000e6011'::uuid, 'Guardian requested refund');

  select status::text into v_payment_status from billing.payment_transactions where id = '00000000-0000-0000-0000-0000000e6011';
  select status::text into v_invoice_status from billing.invoices where id = '00000000-0000-0000-0000-0000000e6f01';
  select status::text, amount_paid into v_ledger_status, v_ledger_paid from billing.billing_ledger_items where id = '00000000-0000-0000-0000-0000000e6e01';
  select status::text, amount_paid into v_other_status, v_other_paid from billing.billing_ledger_items where id = '00000000-0000-0000-0000-0000000e6e02';

  if v_payment_status <> 'refunded' then raise exception 'FAIL Test 8a: payment status is % (expected refunded)', v_payment_status; end if;
  if v_invoice_status <> 'unpaid' then raise exception 'FAIL Test 8b: invoice status is % (expected unpaid)', v_invoice_status; end if;
  if v_ledger_status = 'paid' or v_ledger_paid <> 0 then raise exception 'FAIL Test 8c: ledger item status=% amount_paid=% (expected reverted, amount_paid=0)', v_ledger_status, v_ledger_paid; end if;
  if v_other_status <> 'paid' or v_other_paid <> 1500.00 then raise exception 'FAIL Test 8d (C1 regression): refund reversed an unrelated, separately-settled ledger item e6e02: status=% amount_paid=%', v_other_status, v_other_paid; end if;

  raise notice 'PASS Test 8: refund_payment reverses payment + invoice + ledger item together, without touching the separately-settled unrelated obligation';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: Platform Admin (support tier) gets zero rows via a direct SELECT
-- on billing.payment_transactions (no blanket bypass policy exists,
-- EPIC_4_REVIEW.md C1's lesson) but a non-zero result via the dedicated
-- payment_transactions_support_view() function.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6c01","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_direct_count int;
declare v_view_count int;
begin
  select count(*) into v_direct_count from billing.payment_transactions where id = '00000000-0000-0000-0000-0000000e6011';
  if v_direct_count <> 0 then
    raise exception 'FAIL Test 9a: platform_admin saw a payment_transactions row via a direct table SELECT (blanket bypass exists)';
  end if;

  select count(*) into v_view_count from public.payment_transactions_support_view() where id = '00000000-0000-0000-0000-0000000e6011';
  if v_view_count <> 1 then
    raise exception 'FAIL Test 9b: platform_admin could not see the payment via payment_transactions_support_view() (got % rows)', v_view_count;
  end if;

  raise notice 'PASS Test 9: platform_admin has zero direct-table bypass but full access via the dedicated support view';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: fee_item_applicability rejects a scope=all fee item — only an
-- optional-scope fee item may have an applicability row (§3.37).
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  insert into billing.fee_item_applicability (fee_item_id, child_id, tenant_id)
  values ('00000000-0000-0000-0000-0000000e6d01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6a01');
  raise exception 'FAIL Test 10: an applicability row was created for a scope=all fee item';
exception
  when others then
    if sqlerrm like '%optional-scope%' then
      raise notice 'PASS Test 10: trigger rejects an applicability row for a scope=all fee item';
    else
      raise exception 'FAIL Test 10: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11 (M2): a manager cannot directly UPDATE billing_ledger_items to
-- status='paid' via REST — billing_ledger_items_update_manager's WITH CHECK
-- now requires status <> 'paid' (migration 4), forcing all such transitions
-- through mark_ledger_item_paid_manual (migration 5) so the audit
-- log/notification side effects can never be silently skipped.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"manager"}}';

do $$
declare v_count int;
begin
  update billing.billing_ledger_items set status = 'paid', amount_paid = amount_due where id = '00000000-0000-0000-0000-0000000e6e01';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 11: manager set a ledger item to status=paid via direct REST access';
  end if;
  raise notice 'PASS Test 11: no direct path to status=paid exists on billing.billing_ledger_items';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12 (M2): public.mark_ledger_item_paid_manual, the sole audited path,
-- succeeds for a manager and actually flips the row — and a second call on
-- the now-paid row raises STATE_ALREADY_PROCESSED rather than silently
-- re-applying (mirrors mark_installment_paid_manual's own guard).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"manager"}}';

do $$
declare
  v_status text;
  v_paid   numeric;
begin
  perform public.mark_ledger_item_paid_manual('00000000-0000-0000-0000-0000000e6e01'::uuid, 'Paid in cash at front desk');

  select status::text, amount_paid into v_status, v_paid from billing.billing_ledger_items where id = '00000000-0000-0000-0000-0000000e6e01';
  if v_status <> 'paid' or v_paid <> 1500.00 then
    raise exception 'FAIL Test 12a: ledger item status=% amount_paid=% (expected paid/1500.00)', v_status, v_paid;
  end if;

  begin
    perform public.mark_ledger_item_paid_manual('00000000-0000-0000-0000-0000000e6e01'::uuid, 'Second attempt');
    raise exception 'FAIL Test 12b: a second mark_ledger_item_paid_manual call on an already-paid item did not raise';
  exception
    when others then
      if sqlerrm like '%already%' then
        raise notice 'PASS Test 12: mark_ledger_item_paid_manual settles the item and rejects a duplicate call';
      else
        raise exception 'FAIL Test 12b: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 13 (H1): billing.payment_transactions_one_inflight_per_invoice
-- (migration 3) is the DB-level backstop against a duplicate concurrent
-- payment initiation — a second in-flight row for invoice e6f02 (which
-- already has a pending_verification row, e6012, from the fixtures) must be
-- rejected even via a direct service_role INSERT.
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  insert into billing.payment_transactions (tenant_id, child_id, invoice_id, method, amount, status, provider_reference)
  values ('00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6a31', '00000000-0000-0000-0000-0000000e6f02', 'instapay', 750.00, 'initiated', 'duplicate-attempt-e6-test');
  raise exception 'FAIL Test 13: a second in-flight payment_transactions row was created for an invoice that already has one';
exception
  when unique_violation then
    raise notice 'PASS Test 13: payment_transactions_one_inflight_per_invoice rejects a duplicate concurrent payment initiation';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 14 (H2): the receipt_file_path persisted at initiation time
-- (migration 3) is present and reviewable via a direct SELECT by Manager A
-- — this is what makes the "manager reviews the receipt" manual-
-- verification workflow actually implementable.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e6a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e6a01","role":"manager"}}';

do $$
declare v_receipt_path text;
begin
  select receipt_file_path into v_receipt_path from billing.payment_transactions where id = '00000000-0000-0000-0000-0000000e6012';
  if v_receipt_path is null or v_receipt_path <> 'payment-receipts/00000000-0000-0000-0000-0000000e6a01/00000000-0000-0000-0000-0000000e6a14/receipt-e6-test-02.png' then
    raise exception 'FAIL Test 14: manager could not retrieve the persisted receipt_file_path (got %)', v_receipt_path;
  end if;
  raise notice 'PASS Test 14: receipt_file_path is persisted and reviewable by a manager';
end $$;

-- ---------------------------------------------------------------------------
-- Test 15 (M3/C1, multi-installment settlement): verify_payment on the
-- bank-transfer payment against invoice e6f02 (whose only line references
-- installment entry e6031) must mark e6031 paid and leave the SIBLING
-- installment entry e6032 (same plan, same fee_item) completely untouched —
-- this is the direct "multiple installments for the same fee item" and
-- "partial payment" regression test the user's task explicitly requested.
-- ---------------------------------------------------------------------------
do $$
declare
  v_entry1_status text;
  v_entry1_paid   boolean;
  v_entry2_status text;
  v_entry2_paid   boolean;
  v_invoice_status text;
begin
  perform public.verify_payment('00000000-0000-0000-0000-0000000e6012'::uuid, 'succeeded'::billing.payment_status, 'Bank receipt verified');

  select status::text, paid into v_entry1_status, v_entry1_paid from billing.installment_schedule_entries where id = '00000000-0000-0000-0000-0000000e6031';
  select status::text, paid into v_entry2_status, v_entry2_paid from billing.installment_schedule_entries where id = '00000000-0000-0000-0000-0000000e6032';
  select status::text into v_invoice_status from billing.invoices where id = '00000000-0000-0000-0000-0000000e6f02';

  if v_entry1_status <> 'paid' or v_entry1_paid <> true then
    raise exception 'FAIL Test 15a: installment entry e6031 status=% paid=% (expected paid/true)', v_entry1_status, v_entry1_paid;
  end if;
  if v_entry2_status = 'paid' or v_entry2_paid = true then
    raise exception 'FAIL Test 15b (M3/C1 regression): sibling installment entry e6032 was incorrectly marked paid: status=% paid=%', v_entry2_status, v_entry2_paid;
  end if;
  if v_invoice_status <> 'paid' then
    raise exception 'FAIL Test 15c: invoice e6f02 status=% (expected paid)', v_invoice_status;
  end if;

  raise notice 'PASS Test 15: verify_payment settles exactly the referenced installment entry, leaving the sibling installment on the same plan/fee-item untouched';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 16 (M1 recurrence, found during this fix pass's project-wide search):
-- billing.installment_plans becomes immutable on child_id/fee_item_id once
-- any of its installment_schedule_entries has been paid — trg_installment_
-- plans_immutable_once_paid (migration 3).
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  update billing.installment_plans set fee_item_id = '00000000-0000-0000-0000-0000000e6d01' where id = '00000000-0000-0000-0000-0000000e6021';
  raise notice 'PASS Test 16a: a no-op update (same value) on an immutable field does not raise';
exception
  when others then
    raise exception 'FAIL Test 16a: unexpected error on a no-op update: %', sqlerrm;
end $$;

do $$
begin
  update billing.installment_plans set child_id = '00000000-0000-0000-0000-0000000e6a32' where id = '00000000-0000-0000-0000-0000000e6021';
  raise exception 'FAIL Test 16b: installment_plans.child_id was changed after the plan had a paid installment entry';
exception
  when others then
    if sqlerrm like '%cannot be changed once a plan has any paid installment entry%' then
      raise notice 'PASS Test 16: installment_plans is immutable on child_id/fee_item_id once any entry is paid';
    else
      raise exception 'FAIL Test 16b: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

rollback;
