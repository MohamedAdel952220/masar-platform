# Epic 6 Review — Billing & Payments

Production-grade architecture and code review of Epic 6 as delivered in
`EPIC_6_COMPLETION_REPORT.md`: 7 migrations (`billing` schema, 9 tables, 6
enums, 14 triggers, 1 support-view function, 26 RLS policies, 5 RPCs), 4
Edge Functions + 1 shared provider-port file, 11 application-layer files, 7
test files. No code was modified during this review. Every finding below
was verified by direct reading of the shipped migration/Edge Function/TS
files (`backend/supabase/migrations/20260723*.sql`,
`backend/supabase/functions/{initiate-payment,payment-webhook,generate-invoice-pdf,resend-invoice}/index.ts`,
`backend/src/**`, `backend/tests/**`), not by re-reading the completion
report's own claims.

**Executive summary**: the transaction-safety and idempotency mechanics
this Epic set out to guarantee are, in isolation, correctly built —
`billing.settle_payment_transaction`'s atomic `UPDATE...WHERE` status guard
genuinely prevents a duplicate webhook or a repeated manual decision from
re-running, `generate_invoice`'s counter-lock genuinely serializes
concurrent invoice numbering, and every lesson from the Epic 2-5 review
cycle (SETOF-in-policy, blanket Platform Admin bypass, missing
tenant-consistency triggers, `search_path` hardening, no direct-write path
alongside a correctness-critical RPC) was correctly applied and re-verified
during this review with no recurrence found. However, one **Critical**
defect defeats the Epic's own headline financial-correctness guarantee: the
ledger-reconciliation logic inside `settle_payment_transaction` matches
"which obligations does this payment settle" by `fee_item_id` alone, with
no reference to a specific ledger item, installment entry, or amount — a
single, ordinary partial payment against a recurring fee item silently
marks *every* outstanding period/installment sharing that `fee_item_id` as
fully paid, and the same imprecision runs in reverse on refund, silently
un-paying obligations the refunded payment never touched. Two **High**
findings are real, un-mitigated risks specific to the payment-initiation and
manual-verification flows (a guardian can trivially double-initiate payment
against the same invoice, and the bank-transfer receipt-upload workflow is
structurally unable to ever be reviewed — the file is neither verified to
exist nor its identity ever persisted). The remaining findings are real but
narrower gaps in RLS column-scoping, audit-trail completeness, test
coverage, and a few low-severity edge cases.

---

## Critical

### C1 — `settle_payment_transaction`'s ledger-reconciliation heuristic matches by `fee_item_id` alone, causing both over-crediting on settlement and incorrect reversal on refund

**Location**: `backend/supabase/migrations/20260723000005_epic6_rpc_functions.sql`, `billing.settle_payment_transaction()` (lines ~89-135).

**Root cause**: When a payment settles (`p_new_status = 'succeeded'`) an
invoice, the function resolves which `billing_ledger_items`/
`installment_schedule_entries` rows to mark paid with:

```sql
select coalesce(array_agg(fee_item_id), array[]::uuid[]) into v_fee_item_ids
from billing.invoice_lines where invoice_id = v_row.invoice_id and fee_item_id is not null;

update billing.billing_ledger_items
set amount_paid = amount_due, status = 'paid'
where child_id = v_row.child_id and fee_item_id = any (v_fee_item_ids) and status <> 'paid';

update billing.installment_schedule_entries se
set paid = true, paid_at = now(), status = 'paid'
from billing.installment_plans ip
where se.plan_id = ip.id and ip.child_id = v_row.child_id and ip.fee_item_id = any (v_fee_item_ids) and se.status <> 'paid';
```

Neither `UPDATE` references `period_label`, `due_date`, `amount`, the
invoice's own `total`, or any per-obligation identifier at all — the *only*
join key is `(child_id, fee_item_id)`. Since `billing_ledger_items` is
explicitly a **per-period** table (§3.38: one row per child/fee-item/period,
generated monthly by `billing.generate_recurring_ledger_items()`) and
`installment_schedule_entries` is explicitly a **per-installment** table
(§3.40), any child with more than one outstanding period or installment for
the *same* fee item — the normal, expected steady state for any recurring
fee, and the exact scenario the recurring-billing job (migration 6) exists
to produce — has every one of those rows marked fully paid the moment
*any* invoice referencing that `fee_item_id` is settled, regardless of the
invoice's actual `total` or which specific period/installment it was
generated for.

The refund branch (`p_new_status = 'refunded'`) runs the identical
`fee_item_id`-only match in reverse, with the same consequence in the
opposite direction: it reverts *every* `status='paid'` row for that
child/fee-item back to `due`/`overdue` — including a row that was marked
paid entirely independently via `mark_installment_paid_manual` (a cash
payment with no `payment_transactions` row at all), if it happens to share
the same `fee_item_id`.

**Risk**: This is a direct violation of `BACKEND_ARCHITECTURE.md` §20's own
named correctness requirement — *"a trigger/RPC atomically updates the
related billing_ledger_items/installment_schedule_entries... This must be
one transaction — partial ledger updates on payment success are a
correctness bug class to explicitly guard against."* The bug here is the
same class in the opposite direction (over-broad, not partial), and is
trivially triggered by completely ordinary usage, not an attack:

- A child has an `installment_plans` row ("Term 1 Tuition", 3 × 500 EGP,
  `fee_item_id = Tuition`), all three entries `status='due'`. A manager
  separately generates a 100 EGP invoice for an unrelated small charge that
  happens to tag its one line with `fee_item_id = Tuition` (a very
  plausible occurrence — fee items are a shared tenant-wide catalog, and
  nothing prevents reusing the same fee item across many invoicing
  contexts). The guardian pays the 100 EGP invoice. `settle_payment_transaction`
  finds `v_fee_item_ids = [Tuition]` and marks **all three 500 EGP
  installments — 1,500 EGP total — as fully paid**, having actually
  received only 100 EGP. This is a silent 1,400 EGP accounting loss with no
  error, no log, and no way to detect it after the fact from the ledger
  alone (both the invoice and the installment rows now correctly-looking
  "paid").
- Symmetrically, refunding that same 100 EGP payment later would revert
  *all three* installments back to unpaid — including any of them a
  manager had separately, legitimately marked paid in cash via
  `mark_installment_paid_manual` in the interim.
- The failure mode runs in the *other* direction too: if an invoice's lines
  have no `fee_item_id` at all (an explicitly allowed, nullable field —
  ad-hoc invoicing, `generateInvoiceItemSchema`'s `feeItemId` is optional),
  `v_fee_item_ids` is empty and the ledger/installment `UPDATE`s touch
  **zero rows**, silently — the "atomically updates the ledger" guarantee
  simply never fires for what may be the majority of real invoices.

This finding was not caught by `tests/rls/epic6_rls_adversarial.sql`'s own
Test 6-8 (the ledger-settlement regression tests) because the fixture data
happens to have exactly one `billing_ledger_items` row for the paid
child/fee-item combination — the multi-period/multi-installment scenario
that actually exercises this bug was never constructed (see M3 below).

**Recommended fix**: Replace the `fee_item_id`-only match with an explicit
payment-to-obligation linkage. The minimal additive schema change: add a
nullable `ledger_item_id uuid references billing.billing_ledger_items(id)`
and/or `installment_entry_id uuid references billing.installment_schedule_entries(id)`
column to `billing.invoice_lines` (or a small join table), populated when
`generate_invoice` is called against a specific outstanding obligation
(the common real case — an invoice usually *is* "please pay these specific
ledger rows"). `settle_payment_transaction` then updates only the rows
whose id appears in that explicit set, never a bare `fee_item_id` match. For
the ad-hoc-invoice case (no specific obligation, e.g. a one-off registration
fee), no ledger/installment row should be touched at all — which is what
currently happens by accident for that case, but should be the *documented,
intentional* behavior once the fee-item-only fallback is removed, not
merely what falls out of an empty array.

---

## High

### H1 — `initiate-payment` does not prevent duplicate concurrent payment initiation against the same invoice, risking a real double payment

**Location**: `backend/supabase/functions/initiate-payment/index.ts`, `runInitiatePayment` (the `invoice.status !== 'unpaid'` check, ~line 111).

**Root cause**: The only guard against re-initiating payment for an invoice
already in progress is `invoice.status !== 'unpaid'`. Since
`billing.invoices.status` only ever becomes `'paid'` once
`settle_payment_transaction` actually runs (i.e., after gateway
confirmation or manual verification — never at initiation time), an invoice
stays `'unpaid'` for the entire window between "guardian taps Pay" and
"payment settles." Two calls to `initiate-payment` for the same invoice
within that window — a double-tap, a client retry that doesn't reuse the
same idempotency key, two browser tabs — both pass the `status !== 'unpaid'`
check and each creates its own `payment_transactions` row. No unique
constraint or row lock scopes "at most one in-flight payment per invoice."

**Risk**: A guardian can be genuinely charged twice at the bank/PSP for the
same invoice (this is a real external-money-movement risk, not merely a
database-consistency one — the two `payment_transactions` rows are entirely
legitimate, independently-initiated payment attempts from the system's
point of view). Internally, `settle_payment_transaction`'s own `status <>
'paid'` guards happen to prevent the *ledger* from being double-credited
(the second settlement's `invoices`/`billing_ledger_items` updates find 0
matching rows and no-op) — but that only means the system silently absorbs
the second successful payment with no record that it was ever a duplicate,
no refund trigger, and no manager alert. The guardian's money is genuinely
gone with no system-level trace connecting the two transactions as
duplicates of one intent. This is exactly the "double payment" risk this
review was explicitly asked to check for, on the platform's single
highest-stakes write path.

**Recommended fix**: Add a partial unique index —
`create unique index payment_transactions_one_inflight_per_invoice on billing.payment_transactions (invoice_id) where status in ('initiated', 'pending_verification')` —
so a second concurrent initiation for the same invoice fails cleanly at the
database layer (mirroring the same "constraint as defense in depth"
convention `bus_riders_active_child_key` established, Epic 3), and have
`initiate-payment` check for an existing in-flight transaction before
calling the gateway, returning the existing one instead of creating a
duplicate (an idempotent-by-invoice, not just idempotent-by-key, creation
path).

### H2 — `initiate-payment` neither verifies the bank-transfer receipt file exists nor persists its identity anywhere, making manual verification structurally unreviewable

**Location**: `backend/supabase/functions/initiate-payment/index.ts`, the `bank_transfer` branch (~lines 124-131) and the `payment_transactions` insert (~lines 146-165).

**Root cause**: For `method='bank_transfer'`, the function requires a
non-empty `receiptFileName` in the request body (validated only for
presence, never for existence in storage), then discards it entirely —
`receipt_object_id` is set to `crypto.randomUUID()`, a value with *no*
relationship to `receiptFileName` or any real object path. Neither the
`payment_transactions` row, the `PaymentTransaction` domain type, nor any
repository method persists the guardian's actual uploaded filename/path
anywhere. The comment at the call site claims "the real file is
discoverable via the deterministic path convention
(`payment-receipts/{tenantId}/{guardianId}/{receiptFileName}`)" — but
`receiptFileName` is a request-scoped local variable that is never written
to the database, so nothing downstream (the manager's review UI, a future
`verify_payment` caller, this codebase itself) has any way to reconstruct
it after the HTTP response is sent.

**Risk**: Two compounding gaps: (1) a guardian can call `initiate-payment`
with `method='bank_transfer'` and an entirely fictitious `receiptFileName`
— nothing checks the file was ever actually uploaded to
`payment-receipts` — creating a `pending_verification` row backed by
nothing; (2) even for a guardian who *did* upload a real receipt, the
manager reviewing that payment via `verify_payment` has no way to ever see
it — the core "Manager reviews and manually transitions to succeeded/failed"
workflow §20 describes is not just unimplemented but structurally
unimplementable with the current data model, since the one piece of
information needed to locate the file (the filename) is discarded at the
end of the request that received it. This is not a money-movement
correctness bug in the ledger sense, but it is a silently-broken core
feature of this Epic's own central manual-reconciliation flow — precisely
the flow §25's Risk section says needs "a second engineer's sign-off"
given the stakes involved, and there is currently nothing for that engineer
to review.

**Recommended fix**: Persist the actual receipt path. Minimal fix: store
the full storage path (or at least `receiptFileName`) in a column on
`payment_transactions` (a new nullable `receipt_file_name text` column, or
repurpose `receipt_object_id` to store the path string directly rather than
a placeholder UUID — bare-`uuid`-with-no-FK is the established Epic 1-5
convention for `media.storage_objects`-pending columns, but a `text` path
column alongside it, or instead of it, is equally additive and actually
usable). Additionally, verify the object exists in storage (an
`admin.storage.from('payment-receipts').list(...)` or `.info()` call)
before creating the `pending_verification` row, so a guardian cannot enqueue
a manager-review request for a file that was never uploaded.

---

## Medium

### M1 — `invoices_update_manager_void`'s `WITH CHECK` doesn't pin non-status columns, allowing silent corruption of a "voided" invoice's other fields

**Location**: `backend/supabase/migrations/20260723000004_epic6_rls_policies.sql`, `invoices_update_manager_void` policy.

**Root cause**: `USING (... and status = 'unpaid')` / `WITH CHECK (... and
status = 'void')` correctly restricts the *transition*, but neither clause
constrains `total`, `child_id`, or `invoice_number` to remain unchanged in
the same `UPDATE` statement. This migration's own header explicitly states
"paid invoices are immutable once `settle_payment_transaction` has marked
them paid" and the completion report frames invoices as immutable financial
documents once issued — but nothing in the RLS layer actually enforces
that immutability for the one column-set that matters (a manager can void
an invoice while simultaneously rewriting its `total` or reassigning it to
a different `child_id` in the same request).

**Risk**: Low likelihood (requires an already-trusted manager role, and no
attack path from an untrusted caller), but real: a buggy or malicious
manager-role client can corrupt a financial document's identity or amount
under cover of a routine void action, with no error and no audit trail
distinguishing "voided" from "voided-and-silently-altered." Given this
Epic's own stated stakes (§20: "a ledger bug directly costs the business
money or trust"), tightening this costs nothing functionally.

**Recommended fix**: Add column-stability checks to `WITH CHECK`, e.g.
`and total = (select total from billing.invoices where id = invoices.id)` —
or, more simply, since Postgres RLS `WITH CHECK` can reference `OLD`-like
values only via a subquery on the same table pre-update, use a `BEFORE
UPDATE` trigger (mirroring `check_trip_immutable_fields`, Epic 3) that
rejects any `UPDATE` on `invoices` changing `total`/`child_id`/`invoice_number`
regardless of what else changes — the same "column-scoped backstop"
pattern already established for `transport.trips`.

### M2 — `billing_ledger_items_update_manager` has no restriction beyond tenant/role, letting a manager silently mark a ledger item paid with no audit trail or corresponding payment

**Location**: `backend/supabase/migrations/20260723000004_epic6_rls_policies.sql`, `billing_ledger_items_update_manager` policy.

**Root cause**: Unlike `installment_schedule_entries_update_manager`
(explicitly narrowed to `status <> 'paid'`, forcing the `paid` transition
through `mark_installment_paid_manual`), the analogous
`billing_ledger_items` policy has no such restriction — a manager can set
`status='paid'`, `amount_paid=amount_due` (or any other value satisfying
the `amount_paid <= amount_due` CHECK) directly via REST, with no
`payment_transactions` row, no `write_audit_log` call, and no guardian
notification. `BACKEND_ARCHITECTURE.md` §23 explicitly names "financial
state changes" as audit-worthy; this write path produces exactly such a
change with zero record of who did it or why.

**Risk**: An accounting-integrity/audit-trail gap, not a tenant-isolation or
authorization bypass (still manager-only, still tenant-scoped). But it
means the ledger can diverge from the payment-transaction reconciliation
trail silently, and — combined with C1's own imprecision — makes it harder
to ever reconstruct "why does this child's ledger say paid" after the fact.

**Recommended fix**: Either narrow this policy the same way
`installment_schedule_entries_update_manager` already is (`status <> 'paid'`
in both clauses, forcing the paid transition through a
`mark_ledger_item_paid_manual`-style RPC symmetrical to
`mark_installment_paid_manual`), or, at minimum, add an `AFTER UPDATE`
audit-hook trigger mirroring `billing.audit_invoice_voided()` so a direct
status change to `'paid'` is at least logged even without a bespoke RPC.

### M3 — The RLS adversarial suite's fixtures cannot detect C1, because every test scenario has exactly one outstanding ledger/installment row per child/fee-item

**Location**: `backend/tests/rls/epic6_rls_adversarial.sql`, Tests 6-8 and their fixtures.

**Root cause**: The fixture data creates exactly one
`billing_ledger_items` row and one `installment_schedule_entries` row for
Child A1's `Tuition` fee item. Test 6 pays an invoice whose total exactly
equals that single ledger item's `amount_due`, so the `fee_item_id`-only
match happens to produce the *correct* result by coincidence — there is no
second, still-outstanding period or installment present to reveal that the
match is actually unscoped by period/amount.

**Risk**: Even if this suite is executed (per `EPIC_6_COMPLETION_REPORT.md`
§1, it has not been), it would not have caught C1. A reviewer or future
maintainer could reasonably read "Test 6/7/8 pass" as confirmation the
settlement logic is precise, when it only confirms the single-obligation
case.

**Recommended fix**: Add a fixture with at least two outstanding
`billing_ledger_items` rows (different `period_label`s) for the same
child/fee-item, pay an invoice covering only one of them, and assert the
*other* period's row is untouched (remains `due`/`overdue`, not flipped to
`paid`). This is the direct regression test C1's fix should be verified
against, the same way `EPIC_5_REVIEW.md` C1's own fix was paired with a
purpose-built regression test.

---

## Low

### L1 — Invoice numbering never resets per calendar year

**Location**: `backend/supabase/migrations/20260723000005_epic6_rpc_functions.sql`, `generate_invoice`, the `v_invoice_number` construction.

**Root cause**: `billing.invoice_number_counters.next_number` is a single,
never-reset monotonic counter per tenant; `to_char(now(), 'YYYY')` is
concatenated fresh each call. Crossing a year boundary produces e.g.
`INV-2027-00006` immediately following `INV-2026-00005` — the numeric
suffix does not restart at `00001` for the new year.

**Risk**: Cosmetic/business-expectation mismatch only — uniqueness
(`(tenant_id, invoice_number)`) holds regardless, and nothing in
`BACKEND_ARCHITECTURE.md` §3.41 mandates per-year reset, only "unique per
tenant." Likely to look wrong to an accountant expecting per-year sequences
but is not a correctness defect.

**Recommended fix**: Low priority; if per-year reset is actually desired,
key `invoice_number_counters` on `(tenant_id, year)` instead of `tenant_id`
alone.

### L2 — `generate_invoice`'s idempotency hash over `p_items::text` is sensitive to JSONB key-order preservation, risking a spurious (safe-direction) conflict

**Location**: `backend/supabase/migrations/20260723000005_epic6_rpc_functions.sql`, `generate_invoice`, `v_input_hash := md5(p_child_id::text || '|' || p_items::text)`.

**Root cause**: `jsonb`'s text serialization preserves the object-key order
from the original parse rather than canonicalizing it. Two calls carrying
logically identical line items, but constructed by a client in a different
key order between calls (e.g. `{"description":...,"amount":...}` vs.
`{"amount":...,"description":...}`), would hash differently.

**Risk**: Low — the failure direction is safe (a spurious
`CONFLICT_IDEMPOTENCY_KEY_REUSED` rather than a silently-wrong replay), and
in practice a single client's own JSON serialization is consistent call to
call. Cosmetic/UX annoyance at worst.

**Recommended fix**: Low priority; if desired, normalize `p_items` before
hashing (e.g. hash a re-serialized, key-sorted form via
`jsonb_build_object`/`jsonb_agg` over extracted, ordered fields) rather than
the raw `::text` cast.

### L3 — `settle_payment_transaction` silently no-ops for any status transition outside its explicit from-list, with no log line

**Location**: `backend/supabase/migrations/20260723000005_epic6_rpc_functions.sql`, `billing.settle_payment_transaction`, the `v_row.id is null` branch.

**Root cause**: A transition not covered by `v_from_statuses` (e.g. a
plausible real-world `failed` → `succeeded` correction, if a bank reverses
an earlier decline) silently returns `null` with no exception, no `RAISE
WARNING`, and no audit entry — indistinguishable, from the function's own
behavior, from an ordinary duplicate-webhook no-op.

**Risk**: Low — this is a deliberately safe default (never over-apply an
unexpected transition), but it means a genuinely unusual, operator-relevant
event is invisible with zero trace anywhere.

**Recommended fix**: Low priority; add a `RAISE WARNING` (or a
`platform.audit_log` entry with a distinct action name) when `v_row.id is
null` specifically because the existing status wasn't in the expected
from-list, so an operator reviewing logs can distinguish "harmless
duplicate" from "unexpected transition attempted."

---

## Findings by review category (cross-reference)

| Category (from the review brief) | Findings |
|---|---|
| Financial correctness / Double payment / Double settlement / Ledger inconsistencies / Accounting integrity | **C1**, H1 |
| Race conditions | None found beyond C1 (C1 is a matching-precision bug, not a race — the underlying locking/atomicity in `settle_payment_transaction` and `generate_invoice`'s counter are both correct) |
| Authorization issues / RLS bypasses | M1, M2 (both require an already-trusted manager role — no cross-tenant or cross-role bypass found) |
| Tenant isolation | None found — every table/trigger/policy correctly scopes by `tenant_id`, independently re-verified for every table in this Epic |
| Missing indexes | None found — every RLS-filtering column is indexed |
| Missing constraints | H1's recommended fix (a partial unique index) is a missing constraint finding in its own right |
| Missing validation | H2 (no storage-existence check on the claimed receipt) |
| Performance / Scalability | None found — the recurring-billing job and all scheduled-job functions are set-based; `generate_invoice`'s per-tenant counter lock does not contend across tenants |
| Security | H2 (workflow-integrity gap, not a direct exploit) |
| Architecture violations | **C1** (direct violation of §20's named "no partial/incorrect ledger update" requirement) |
| Test coverage | M3 |

---

## Verdict

Epic 6 is **not production-ready as delivered**. One Critical finding (C1)
defeats the Epic's own headline correctness guarantee — the atomic,
single-transaction ledger update `BACKEND_ARCHITECTURE.md` §20 explicitly
requires is atomic and single-transaction, but updates the *wrong set of
rows* under completely ordinary usage (any child with more than one
outstanding period or installment for a recurring fee item), silently
over-crediting on settlement and incorrectly reversing unrelated
obligations on refund. This must be fixed — by introducing an explicit
payment-to-obligation linkage rather than the current fee-item-only
heuristic — and verified with a purpose-built regression test (the
multi-period fixture M3 recommends) before this Epic can be considered
correct. Two High findings are real, currently-unmitigated risks on the
payment-initiation and manual-verification paths specifically (a
guardian-triggerable double payment with no system-level detection, and a
structurally unreviewable receipt-upload workflow) and should be fixed
alongside C1 given they sit on the same highest-stakes surface this Epic
covers. The Medium and Low findings are real but narrower — an RLS
column-scoping gap on two tables, and a test-coverage gap that explains why
C1 wasn't caught by the (in any case unexecuted) existing test suite. Every
lesson from the Epic 2-5 review cycle that this review checked for
recurrence (SETOF-in-policy misuse, blanket Platform Admin bypass, missing
tenant-consistency triggers, unhardened `search_path`, a direct RLS write
path bypassing a correctness-critical RPC, incomplete idempotency-hash
coverage, missing `deleted_at` filters on notification fan-outs, per-row
loops that should be set-based) was correctly applied with no recurrence
found anywhere in this Epic. No Epic 1, Epic 2, Epic 3, Epic 4, or Epic 5
migration file was modified — freeze compliance is confirmed (only
`20260723*` files were added; `backend/supabase/config.toml`,
`backend/supabase/functions/_shared/errors.ts`, `backend/src/lib/errors.ts`,
and `backend/src/lib/rpcError.ts` received only additive extensions
matching every prior Epic's identical pattern). Stopping here per this
task's instruction — no code was changed as part of this review.
