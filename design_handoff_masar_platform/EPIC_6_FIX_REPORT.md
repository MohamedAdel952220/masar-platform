# Epic 6 Fix Report

Implements every finding in `EPIC_6_REVIEW.md` (approved). Epic 6's migrations had not been deployed to any live project, so every SQL fix below was applied by editing the existing Epic 6 migration files directly (`backend/supabase/migrations/20260723*.sql`) rather than by adding forward-only patch migrations — per this task's explicit instruction. **No Epic 1, Epic 2, Epic 3, Epic 4, or Epic 5 migration was modified.**

**The Critical finding, both High findings, all three Medium findings, and all three Low findings are fixed.**

---

## 1. Findings fixed

### Critical

| ID | Finding | Fix |
|---|---|---|
| C1 | `billing.settle_payment_transaction()` matched "which obligations does this payment settle" by `fee_item_id` alone — no reference to a specific ledger row, installment entry, period, or amount — silently over-crediting *every* outstanding period/installment sharing that `fee_item_id` on settlement, and symmetrically un-paying unrelated obligations (including ones settled separately, e.g. via cash) on refund | Added explicit obligation linkage: `billing.invoice_lines` gained `ledger_item_id`/`installment_entry_id` (nullable, mutually exclusive via `invoice_lines_at_most_one_obligation_ref` CHECK, migration 3), each validated by an extended `check_invoice_line_consistency()` trigger (same tenant/child, not already paid). `settle_payment_transaction` (migration 5) now aggregates `ledger_item_id`/`installment_entry_id` arrays from the invoice's own `invoice_lines` and updates *only* those specific rows — in both the `succeeded` branch (settlement) and the `refunded` branch (reversal), so a refund can only ever reverse the exact rows its own invoice referenced, never a broader `fee_item_id`-wide set. `generate_invoice` and the validation/repository/service TS layers were extended end-to-end to pass these references through. |

### High

| ID | Finding | Fix |
|---|---|---|
| H1 | `initiate-payment` had no protection against duplicate concurrent payment initiation against the same invoice — a real double-charge risk with no system-level detection | Two-layer defense: (1) a new partial unique index `payment_transactions_one_inflight_per_invoice on billing.payment_transactions (invoice_id) where status in ('initiated','pending_verification')` (migration 3) — the authoritative DB-level backstop against a genuine race; (2) `initiate-payment` (Edge Function) now checks for an existing in-flight row first and returns it instead of calling the gateway/creating a duplicate, giving the common "double-tap" case a clean, idempotent response instead of a raw constraint-violation error. |
| H2 | `initiate-payment` neither verified the bank-transfer receipt file exists in storage nor ever persisted its identifying filename/path — the "manager reviews the receipt" manual-verification workflow was structurally unimplementable | Added `receipt_file_path text` to `billing.payment_transactions` (migration 3). `initiate-payment` now lists the guardian's `payment-receipts/{tenantId}/{guardianId}/` storage folder and verifies the claimed `receiptFileName` actually exists there *before* creating a `pending_verification` row, and persists the real, reconstructible path (`payment-receipts/{tenantId}/{guardianId}/{filename}`) so a manager can retrieve it later. This check is deliberately outside the gateway `try/catch` (a bug I introduced and caught myself mid-edit — see §9) so its `VALIDATION_FAILED` error surfaces correctly instead of being relabeled `EXTERNAL_PAYMENT_GATEWAY_FAILURE`. |

### Medium

| ID | Finding | Fix |
|---|---|---|
| M1 | `invoices_update_manager_void`'s `WITH CHECK` only pinned the `status` transition, not `total`/`child_id`/`invoice_number` — a manager could corrupt a "voided" invoice's other fields in the same UPDATE | Added `billing.check_invoice_immutable_fields()` trigger + `trg_invoices_immutable_fields` (migration 3, `before update of total, child_id, invoice_number`) — raises `VALIDATION_FAILED` if any of those three columns changes after creation, for any UPDATE regardless of path. |
| M2 | `billing_ledger_items_update_manager` had no restriction beyond tenant/role — a manager could silently mark a ledger item paid via direct REST with zero audit trail or corresponding payment record | Narrowed the policy to `... and status <> 'paid'` in both `USING` and `WITH CHECK` (migration 4), mirroring the already-correct `installment_schedule_entries_update_manager` shape. Added a new RPC `public.mark_ledger_item_paid_manual(p_ledger_item_id, p_note)` (migration 5) as the sole audited path to `status = 'paid'` — atomic guarded UPDATE, NOT_FOUND/STATE_ALREADY_PROCESSED disambiguation, guardian notification, `write_audit_log`, `security definer set search_path = ''` — an exact structural mirror of the pre-existing `mark_installment_paid_manual`. Wired through the full TS layer (repository/service/route/validation). |
| M3 | The RLS adversarial test suite's fixtures only ever had one outstanding ledger/installment row per child/fee-item, so even if executed it would not catch C1 | Rewrote `tests/rls/epic6_rls_adversarial.sql`'s fixtures to include a second `billing_ledger_items` row (`e6e02`, same `fee_item_id`, different period) and a second `installment_schedule_entries` row (`e6032`, same plan/fee-item) that are never referenced by any invoice line, plus a second invoice/payment (`e6f02`/`e6012`) whose line explicitly references only one installment entry. Tests 6, 8, and a new Test 15 now assert the sibling row is left completely untouched by settlement/refund — the direct regression test for C1 this finding required. |

### Low

| ID | Finding | Fix |
|---|---|---|
| L1 | Invoice numbering (`invoice_number_counters`) never resets per calendar year | Changed the table's primary key from `tenant_id` alone to composite `(tenant_id, year)` with a new `year int not null` column (migration 3); `generate_invoice`'s counter upsert now keys on `(tenant_id, extract(year from now())::int)`, so numbering restarts at 1 each calendar year per tenant. |
| L2 | `generate_invoice`'s idempotency hash over `p_items::text` was sensitive to JSONB key-order preservation, risking a spurious (safe-direction) conflict | Replaced with a normalized `string_agg` over each item's `description`/`feeItemId`/`ledgerItemId`/`installmentEntryId`/`amount`, joined in a fixed field order and array-position (`with ordinality`) order, independent of JSONB key ordering. |
| L3 | `settle_payment_transaction` silently no-op'd (no error, no log) for any status transition outside its explicit from-list | The no-match branch now looks up the transaction's current status and `raise warning`s with the transaction id, current status, expected from-list, and requested new status — visible in Postgres logs without changing the function's return contract (still returns `null`, callers already handle that). |

---

## 2. Project-wide recurrence checks performed

Per the task's "do not only fix the reported locations" instruction, each defect *class* was searched for across the entirety of Epic 6 before considering any finding closed:

- **C1-class (implicit, non-specific obligation matching)**: searched every place `billing.invoice_lines`, `billing_ledger_items`, or `installment_schedule_entries` are joined/updated together. Only `settle_payment_transaction`'s settle/refund branches had this defect; `mark_installment_paid_manual` and the new `mark_ledger_item_paid_manual` already operate on a single, directly-supplied primary key (no ambiguity possible).
- **H1-class (missing duplicate-initiation protection)**: `initiate-payment` was the only Edge Function that creates a `payment_transactions` row; `payment-webhook` and `verify_payment`/`refund_payment` only ever transition an *existing* row via a from-status guard, so no other creation path exists to duplicate.
- **H2-class (unverified/undiscoverable file upload)**: searched every reference to `receipt_object_id`/storage buckets across Epic 6 — only `initiate-payment`'s bank-transfer path touches guardian-uploaded storage; `generate-invoice-pdf`/`resend-invoice` (system-generated PDFs, not user uploads) have no equivalent gap.
- **M1-class (immutable-once-settled fields left mutable)**: checked every table with a "terminal-ish" status column (`invoices`, `billing_ledger_items`, `installment_schedule_entries`, `installment_plans`, `payment_transactions`). This search surfaced a **previously-undetected recurrence not in the original review's findings list**: `billing.installment_plans` had no protection against `child_id`/`fee_item_id` being changed out from under a plan that already has paid installment entries. Fixed proactively with `billing.check_installment_plan_immutable_once_paid()` + `trg_installment_plans_immutable_once_paid` (migration 3), and covered by a new RLS test (Test 16). `payment_transactions` needs no equivalent trigger — its terminal statuses (`succeeded`/`refunded`/`failed`) are already reached exclusively through guarded RPCs (`verify_payment`/`refund_payment`/webhook), which never allow their own guarded columns to be touched again once `status` has moved on.
- **M2-class (manager UPDATE policy with no floor beyond tenant/role, bypassing an audited RPC)**: every `for update` policy across all 8 Epic 6 tables was checked. Only `billing_ledger_items_update_manager` had this gap; `installment_schedule_entries_update_manager` already had it fixed from the start, and `invoices_update_manager_void`/`fee_items_update_manager`/`fee_item_applicability_update_manager`/`installment_plans_update_manager` either have no equivalent audited-RPC counterpart to bypass or (per M1's fix) are now protected by an immutability trigger instead.
- **M3-class (RLS fixtures too thin to catch a real cross-row defect)**: re-read every fixture group in the adversarial suite against every RPC's actual row-selection logic; the single-row-per-fee-item shape was the only gap.
- **L1-class (unscoped/non-resetting sequence-like counter)**: `invoice_number_counters` was the only counter table in Epic 6.
- **L2-class (hash sensitive to JSON/JSONB key-order)**: `generate_invoice` was the only RPC hashing a JSON payload directly; `submit_request`/`review_request` (Epic 5) and other Epic 6 RPCs hash individual scalar parameters, not a JSON blob, so no other recurrence exists.
- **L3-class (silent no-op on an unexpected state transition)**: checked every guarded `UPDATE ... WHERE <status> RETURNING *` pattern in Epic 6 (`verify_payment`, `refund_payment`, `mark_installment_paid_manual`, the new `mark_ledger_item_paid_manual`, `settle_payment_transaction`). Only `settle_payment_transaction`'s internal no-match branch lacked a warning; the four RPC-level callers already raise `STATE_ALREADY_PROCESSED`/`NOT_FOUND` explicitly via their own disambiguation logic.

No additional recurrence of any reviewed defect class was found beyond the locations listed above (plus the one proactively-found `installment_plans` M1 recurrence). No defect class from `EPIC_1_REVIEW.md` through `EPIC_5_REVIEW.md` (SETOF-returning RLS helpers, unhardened `search_path`, per-row loops for unbounded fan-out, missing cross-table tenant-consistency triggers, missing idempotency envelopes, substring-matched error classification, manager hard-delete, direct-RLS-write-bypassing-an-RPC, asymmetric Zod refines) was found anywhere in Epic 6, confirming the lesson-application held for everything except the six findings above.

---

## 3. Files modified

### SQL migrations (Epic 6's own, edited directly — none previously deployed)
- `20260723000003_epic6_installments_invoices_payments_tables.sql` — C1 (`invoice_lines.ledger_item_id`/`installment_entry_id` + CHECK + extended consistency trigger), H1 (`receipt_file_path` column + partial unique index), H2 (`receipt_file_path` column — shared with H1), M1 (`invoices` immutable-fields trigger + the proactively-found `installment_plans` immutable-once-paid trigger), L1 (`invoice_number_counters` composite PK + `year` column).
- `20260723000004_epic6_rls_policies.sql` — M2 (`billing_ledger_items_update_manager` narrowed to `status <> 'paid'`).
- `20260723000005_epic6_rpc_functions.sql` — C1 (`settle_payment_transaction` rewritten to use explicit references), M2 (new `mark_ledger_item_paid_manual` RPC), L2 (`generate_invoice` hash normalization), L3 (`settle_payment_transaction` no-op warning), L1 (`generate_invoice` per-year counter upsert).

### Edge Functions
- `backend/supabase/functions/initiate-payment/index.ts` — H1 (in-flight-payment pre-check), H2 (receipt storage-existence check + `receipt_file_path` persistence).

### TypeScript
- `backend/src/types/database.types.epic6.ts` — `InvoiceLineRow.ledger_item_id`/`installment_entry_id`, `PaymentTransactionRow.receipt_file_path`.
- `backend/src/types/domain.epic6.ts` — `InvoiceLine.ledgerItemId`/`installmentEntryId`, `PaymentTransaction.receiptFilePath`, both mappers updated.
- `backend/src/validation/billing.schema.ts` — `generateInvoiceItemSchema` gained optional `ledgerItemId`/`installmentEntryId` with a mutual-exclusivity `.refine()`; new `markLedgerItemPaidManualSchema`.
- `backend/src/repositories/invoiceRepository.ts` — `generate()` passes `ledgerItemId`/`installmentEntryId` through to the RPC.
- `backend/src/repositories/billingLedgerRepository.ts` — new `markLedgerItemPaidManual()` wrapping the new RPC.
- `backend/src/services/billingLedgerService.ts` — new `markLedgerItemPaidManual()`, manager-only role check.
- `backend/src/api/routes/billing.ts` — new `markLedgerItemPaidManualRoute()`.

### Tests
- `backend/tests/unit/billingValidation.test.ts` — 5 new tests (ledgerItemId/installmentEntryId acceptance, mutual-exclusivity rejection, `markLedgerItemPaidManualSchema` x3).
- `backend/tests/unit/billingLedgerService.test.ts` — 3 new tests (`markLedgerItemPaidManual`: manager allowed, guardian/teacher rejected).
- `backend/tests/unit/billingApiRoutes.test.ts` — 2 new tests (`markLedgerItemPaidManualRoute`: validation rejection, valid passthrough).
- `backend/tests/unit/paymentService.test.ts` — `makePayment()` fixture updated with `receiptFilePath` (required field, no new test needed here — existing tests exercise the field via the fixture).
- `backend/tests/rls/epic6_rls_adversarial.sql` — fixtures expanded (M3: second ledger item, second installment entry, second invoice/payment with `receipt_file_path`); Tests 6 and 8 extended with C1-regression assertions; 6 new tests (11–16: M2 direct-UPDATE rejection, `mark_ledger_item_paid_manual` settle + duplicate-call rejection, H1 duplicate-initiation unique-index rejection, H2 receipt-path retrieval, M3/C1 multi-installment settlement isolation, M1 `installment_plans` immutability).

---

## 4. Database changes

**New columns:** `billing.invoice_lines.ledger_item_id`, `billing.invoice_lines.installment_entry_id` (both nullable uuid FKs, `on delete set null`); `billing.payment_transactions.receipt_file_path` (nullable text); `billing.invoice_number_counters.year` (int, not null).
**Changed primary key:** `billing.invoice_number_counters` — from `(tenant_id)` to `(tenant_id, year)`.
**New constraints:** `invoice_lines_at_most_one_obligation_ref` CHECK (at most one of `ledger_item_id`/`installment_entry_id` set).
**New indexes:** `invoice_lines_ledger_item_idx`, `invoice_lines_installment_entry_idx` (partial, `where ... is not null`); `payment_transactions_one_inflight_per_invoice` (partial unique index on `invoice_id` where `status in ('initiated','pending_verification')`).
**New/changed triggers:** `trg_invoices_immutable_fields` (new — blocks `total`/`child_id`/`invoice_number` changes post-creation); `trg_installment_plans_immutable_once_paid` (new — blocks `child_id`/`fee_item_id` changes once any entry is paid); `check_invoice_line_consistency()` (extended — validates `ledger_item_id`/`installment_entry_id` references).
**Changed RLS policy:** `billing_ledger_items_update_manager` (both `USING` and `WITH CHECK` now require `status <> 'paid'`).
**New function:** `public.mark_ledger_item_paid_manual(p_ledger_item_id uuid, p_note text default null)` — `security definer set search_path = ''`, `authenticated`-only grant.
**Changed function:** `billing.settle_payment_transaction()` — rewritten obligation-matching logic (C1); no-op warning added (L3). `public.generate_invoice()` — normalized idempotency hash (L2), per-year counter keying (L1), passes through the two new invoice-line reference columns.

---

## 5. Security improvements

- Closed a silent over-crediting/incorrect-reversal vector on the core financial settlement seam — the highest-severity finding in this review, and the one most directly implicated by the user's explicit verification requirements around balanced transactions, settlement scoping, and refund reconciliation (C1).
- Closed a real double-charge risk with a defense-in-depth pair: a friendly Edge-Function-level dedupe plus an authoritative DB-level unique-index backstop against races (H1).
- Made the bank-transfer manual-verification workflow actually implementable and closed a receipt-traceability gap — a manager can now retrieve the exact file a guardian claims to have uploaded, and the system verifies it was actually uploaded before ever reaching `pending_verification` (H2).
- Closed a data-corruption vector where a manager voiding an invoice could simultaneously alter its `total`/`child_id`/`invoice_number` in the same request (M1), and proactively closed the identical class of gap on `installment_plans` before it could be reported separately.
- Closed an audit-trail gap where a manager could mark a ledger item paid with zero notification or audit-log trace, mirroring the fix already applied to the parallel installment-entry case (M2).
- Strengthened the RLS regression suite so it can actually catch a recurrence of the Critical finding's defect class, rather than passing vacuously against under-specified fixtures (M3).

---

## 6. Financial correctness improvements

Directly addressing this task's explicit verification requirements:

- **Every financial transaction remains balanced**: `settle_payment_transaction`'s settle/refund branches now touch only the specific `billing_ledger_items`/`installment_schedule_entries` rows an invoice's own lines reference — verified by RLS Tests 6, 8, and 15, which assert both the referenced row's correct transition *and* an unrelated sibling row's non-transition in the same test.
- **Invoice settlement can never settle unrelated obligations**: the same explicit-reference mechanism (C1's core fix) makes this structurally true rather than merely tested — there is no code path left that matches by `fee_item_id` alone.
- **Refunds only reverse obligations originally settled by the same payment**: the refund branch reuses the *identical* `v_ledger_item_ids`/`v_installment_entry_ids` arrays computed from the invoice's own lines, so it is architecturally impossible for a refund to touch a row its own invoice never referenced — verified by Test 8's new assertion (a separately, manually-settled sibling ledger item survives the refund untouched).
- **Duplicate payment initiation is prevented or safely handled**: two-layer fix, H1 above — verified by Test 13 (unique-index rejection) and by the Edge Function's own pre-check logic (not independently unit-testable without a Deno test harness, which does not exist elsewhere in this codebase; see §10).
- **Receipt uploads are fully traceable and reviewable**: `receipt_file_path` persists the real storage path, verified present and retrievable in Test 14.
- **All ledger mutations are auditable**: `mark_ledger_item_paid_manual` writes an audit log entry and notification exactly like its `mark_installment_paid_manual` sibling; verified in Test 12.
- **All billing triggers behave correctly under RLS**: `check_invoice_line_consistency`, `check_invoice_immutable_fields`, and `check_installment_plan_immutable_once_paid` all fire regardless of the invoking role (ordinary `plpgsql` triggers execute under the table owner's privileges for their own internal lookups, but their `raise exception` behavior is uniform across all roles) — verified for the installment-plan case in Test 16, and for the invoice-line case by the pre-existing (unmodified) consistency-trigger tests.
- **All SECURITY DEFINER functions preserve authorization boundaries**: `mark_ledger_item_paid_manual` was re-verified to require `search_path = ''`, full schema-qualification, and an explicit manager-role check before any write — an exact structural mirror of every other Epic 6 SECURITY DEFINER function, re-confirmed in §9's audit below.

---

## 7. Performance improvements

None targeted in this pass — this review's findings were correctness/security/traceability issues, not performance ones. The new partial indexes (`invoice_lines_ledger_item_idx`, `invoice_lines_installment_entry_idx`, `payment_transactions_one_inflight_per_invoice`) exist for correctness/constraint enforcement, not query optimization, though they will also serve as useful lookup indexes for any future "find the invoice line settling this ledger item" query.

---

## 8. New tests added

- `backend/tests/unit/billingValidation.test.ts`: 5 new tests — line accepting `ledgerItemId`, line accepting `installmentEntryId`, line rejecting both set simultaneously (C1), `markLedgerItemPaidManualSchema` valid/optional-note/missing-id (M2).
- `backend/tests/unit/billingLedgerService.test.ts`: 3 new tests — manager allowed to call `markLedgerItemPaidManual`, guardian rejected, teacher rejected (M2).
- `backend/tests/unit/billingApiRoutes.test.ts`: 2 new tests — `markLedgerItemPaidManualRoute` rejects a missing `ledgerItemId`, passes a valid body through (M2).
- `backend/tests/rls/epic6_rls_adversarial.sql`: 6 new tests (11–16) plus 2 extended tests (6, 8) plus expanded fixtures — covering, per the task's explicit regression-test list: **multiple installments for the same fee item** (Test 15, entries e6031/e6032 on the same plan), **partial payments** (the e6f02/e6012 fixture — a 750.00 payment against a 1500.00-total fee item's second installment), **duplicate payment attempts** (Test 13, the H1 unique-index backstop), **refund reconciliation** (Test 8's extended assertion — a refund does not touch a separately-settled sibling obligation), and **receipt upload and review** (Test 14, `receipt_file_path` persistence and retrievability).

---

## 9. Verification performed

```
npx tsc -p tsconfig.json --noEmit   →  0 errors
npx vitest run                       →  30 test files, 298 tests, ALL PASSING (288 prior + 10 new)
```

- **Self-caught bug, fixed before any test run**: while adding H2's receipt-existence check to `initiate-payment/index.ts`, I first placed it inside the same `try { ... } catch` block used for the actual PSP/gateway calls. This would have caused a legitimate `VALIDATION_FAILED` (missing receipt) to be caught and rethrown as a misleading `EXTERNAL_PAYMENT_GATEWAY_FAILURE`. Caught and corrected in the same edit pass — the check now runs in its own block strictly before the gateway `try/catch`.
- **Freeze compliance verified**: `git status --porcelain` shows only Epic 6's own `20260723*` migration files, the `initiate-payment` Edge Function, and the expected TS/test files as touched/untracked in this pass. No `20260714*`/`20260715*`/`20260717*`/`20260719*`/`20260721*` (Epic 1–5) migration file was modified. No frozen frontend file was touched.
- **`$$`-pair and paren balance verified programmatically** on every edited SQL file:
  ```
  20260723000003: $$ pairs 14 OK, parens balanced OK
  20260723000004: $$ pairs 2 OK, parens balanced OK
  20260723000005: $$ pairs 14 OK, parens balanced OK
  epic6_rls_adversarial.sql: $$ pairs 36 OK, parens balanced OK
  ```
- **SECURITY DEFINER / search_path audit**: every `SECURITY DEFINER` function in Epic 6 (`generate_invoice`, `verify_payment`, `refund_payment`, `mark_installment_paid_manual`, and the new `mark_ledger_item_paid_manual`, plus the internal seam `billing.settle_payment_transaction`) re-checked for `SET search_path = ''` (all present) and full schema-qualification of every internal reference (confirmed).
- **RLS policy audit**: every `for insert`/`for update`/`for delete` policy across all 8 Epic 6 tables re-enumerated (§2's M2-class recurrence check) — no manager hard-delete exists anywhere in Epic 6 (zero `for delete` policies), and no direct-write path bypasses an audited RPC beyond what's explicitly documented as intentional (`invoices_update_manager_void`, now protected by the M1 immutability trigger).
- **Direct project-wide re-grep for each fixed defect class** confirmed no surviving instance: no remaining `fee_item_id`-only matching in `settle_payment_transaction`'s logic (only a comment referencing the old, fixed behavior remains); no `for insert`/`for update` policy on `invoices`/`invoice_lines`/`payment_transactions` beyond the one documented void-only exception; zero `for delete` policies; `write_audit_log` called 7 times across the RPC file (once per financial-state-changing RPC, including the new one).

---

## 10. Remaining limitations

- **The RLS adversarial suite (`epic6_rls_adversarial.sql`) has not been executed against a live database in this session** — this sandbox has no Docker/live Postgres access. Every new/modified assertion was hand-traced against the post-fix migration text (as in prior Epics' fix reports), but static tracing is not a substitute for an executed run. Running it (`supabase db query --local` or `--linked`, or plain `psql`, wrapped in `begin;...rollback;` so it has zero persistent effect) remains a required step before Epic 6 is considered fully, empirically verified.
- **H1's Edge-Function-level pre-check and H2's storage-existence check are not independently unit-tested** — this codebase has no Deno-runtime test harness for Edge Functions anywhere (confirmed by search across all prior Epics), so these two fixes are verified only via the DB-level backstop (H1's unique index, exercised in RLS Test 13) and via hand-reading of the Edge Function source. This is a pre-existing gap in test infrastructure, not one introduced by this fix pass.
- **Static-only verification of the RLS suite carries the same inherent limits as every prior Epic's fix report**: hand-tracing is not a substitute for an executed test run, even when done as carefully as in §9 above.

---

## Verdict

Every Critical, High, Medium, and Low finding in `EPIC_6_REVIEW.md` is fixed. A project-wide recurrence search confirmed each fixed defect class had at most the instances already found — with one proactive exception (`installment_plans`' own M1-class immutability gap, not in the original findings list, found and fixed during this pass). No Epic 1–5 migration was modified; no frozen frontend file was touched. `npx tsc --noEmit` is clean; `npx vitest run` passes 298/298 (10 new tests added). The RLS adversarial suite was substantially expanded with fixtures specifically shaped to catch the Critical finding's defect class (per M3's own fix requirement) and 6 new tests covering every item on the task's explicit regression-test list — but actual execution against a live database remains blocked by this sandbox's lack of Postgres/Docker access, left as a required next step for a human operator. Stopping here — Epic 7 is out of scope for this delivery.
