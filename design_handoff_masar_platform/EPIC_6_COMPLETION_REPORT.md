# Epic 6 Completion Report — Billing & Payments

Scope: the `billing` schema (`fee_items`, `fee_item_applicability`,
`billing_ledger_items`, `installment_plans`, `installment_schedule_entries`,
`invoices`, `invoice_lines`, `payment_transactions`, plus one
implementation-necessary support table, `invoice_number_counters`), the
full payment lifecycle (gateway-backed and manual reconciliation), invoice
generation/PDF/resend, and the four scheduled-job functions this Epic is
responsible for standing up. Epic 1, Epic 2, Epic 3, Epic 4, and Epic 5 are
frozen — every migration in this Epic is purely additive (new schema, new
tables, new functions, new policies, additive extensions to two shared
error-taxonomy files). **No Epic 1-5 migration file was modified.** No
frozen frontend file was touched.

This is the highest-stakes Epic delivered so far — §20's own framing
("financial correctness risk... a ledger bug directly costs the business
money or trust") was treated as the primary design constraint throughout,
alongside every lesson the Epic 2-5 review/fix/audit cycle produced (see
§8 for the full, cited list).

---

## 1. Environment reality check

Same limitation as every prior Epic: no Docker/local Postgres in this
sandbox, and deployment (hence a live deployment audit) is out of scope for
an implementation task — the user's instruction was to implement and
report, not deploy. Every SQL-layer claim below is a **static** guarantee —
balanced `$$`/parens verified programmatically on every migration file,
every RLS policy and trigger individually traced by hand against every
role/path that can invoke it (see §9's Self-Review). `npx tsc --noEmit` and
`npx vitest run` are real executions and both pass.
`tests/rls/epic6_rls_adversarial.sql` is written, including a direct
regression test for the ledger-settlement seam (Test 6-8), but **not
executed** against any database — consistent with every prior Epic's
identical, explicitly-documented limitation.

---

## 2. Files created

### 2.1 SQL migrations (7) — `backend/supabase/migrations/`

1. `20260723000001_epic6_billing_schema.sql` — `billing` schema; 6 enums.
2. `20260723000002_epic6_fee_and_ledger_tables.sql` — `fee_items`, `fee_item_applicability`, `billing_ledger_items` + 3 consistency triggers + `updated_at` triggers.
3. `20260723000003_epic6_installments_invoices_payments_tables.sql` — `installment_plans`, `installment_schedule_entries`, `invoice_number_counters`, `invoices`, `invoice_lines`, `payment_transactions` + 5 consistency triggers + `updated_at` triggers.
4. `20260723000004_epic6_rls_policies.sql` — 26 policies across 8 client-facing tables + the Platform Admin support-view function.
5. `20260723000005_epic6_rpc_functions.sql` — `billing.settle_payment_transaction` (internal seam) + 4 public RPCs + the invoice-void audit trigger.
6. `20260723000006_epic6_scheduled_jobs.sql` — 4 scheduled-job SQL functions + the invoice-PDF background-job trigger.
7. `20260723000007_epic6_storage.sql` — `payment-receipts` bucket + 3 policies.

### 2.2 Edge Functions (4 + 1 shared) — `backend/supabase/functions/`

- `initiate-payment/index.ts`, `payment-webhook/index.ts`, `generate-invoice-pdf/index.ts`, `resend-invoice/index.ts`
- `_shared/paymentGateway.ts` — stubbed PSP provider port (new file, mirrors `_shared/notificationProviders.ts`'s established pattern, not an edit to it)

### 2.3 Application layer (11 new files) — `backend/src/`

- `types/database.types.epic6.ts`, `types/domain.epic6.ts`
- `validation/billing.schema.ts`
- `repositories/feeItemRepository.ts`, `repositories/billingLedgerRepository.ts`, `repositories/invoiceRepository.ts`, `repositories/paymentRepository.ts`
- `services/feeItemService.ts`, `services/billingLedgerService.ts`, `services/invoiceService.ts`, `services/paymentService.ts`
- `api/routes/billing.ts`

### 2.4 Tests (7 new files) — `backend/tests/`

- `unit/billingValidation.test.ts` (17 tests), `unit/feeItemService.test.ts` (5), `unit/billingLedgerService.test.ts` (4), `unit/invoiceService.test.ts` (5), `unit/paymentService.test.ts` (7), `unit/billingApiRoutes.test.ts` (10)
- `rls/epic6_rls_adversarial.sql` (10 numbered tests — not executed, §1)

### 2.5 Additive changes to existing shared files (not new files, not migrations)

- `backend/supabase/config.toml` — `schemas` list gained `"billing"`; new `[functions.payment-webhook]` section with `verify_jwt = false` (the one deliberate exception to the platform default — a PSP webhook never carries a Supabase JWT, §20).
- `backend/supabase/functions/_shared/errors.ts`, `backend/src/lib/errors.ts`, `backend/src/lib/rpcError.ts` — additive extension: two new `ErrorCode` members, `EXTERNAL_PAYMENT_GATEWAY_TIMEOUT` and `EXTERNAL_PAYMENT_GATEWAY_FAILURE`, both explicitly named in `BACKEND_ARCHITECTURE.md` §25.1's own `EXTERNAL_*` taxonomy examples and needed for the first time by this Epic. No existing code was removed, renamed, or had its behavior changed — purely additive, matching the same precedent `EXTERNAL_NOTIFICATION_DISPATCH_FAILURE`/`CONFLICT_IDEMPOTENCY_KEY_REUSED` already set in earlier Epics.

---

## 3. Tables created

| Table | Purpose | Notable design points |
|---|---|---|
| `billing.fee_items` | Tenant fee catalog | `cycle`, `scope` gate the recurring-billing job's own generation logic |
| `billing.fee_item_applicability` | Optional-fee-item opt-in link table | Trigger rejects an applicability row for a `scope=all` item |
| `billing.billing_ledger_items` | Per-child, per-period billing obligation | Unique `(child_id, fee_item_id, period_label)` — the recurring job's own idempotency mechanism |
| `billing.installment_plans` / `installment_schedule_entries` | Manual installment scheduling | `status` shares the `billing.billing_status` enum with `billing_ledger_items` (§3.38/§3.40's own explicit unification — see migration 1's comment for the resolved doc-ambiguity) |
| `billing.invoice_number_counters` | Per-tenant invoice-numbering counter | Implementation-necessary support table (not itself named in §3, same class of addition as `safety.pickup_scan_rate_limits`, Epic 3) — locked via `SELECT...FOR UPDATE` for gapless sequential numbering |
| `billing.invoices` / `invoice_lines` | Formal billing documents | `pdf_object_id`/`fee_item_id` bare nullable `uuid` (no FK yet — `media.storage_objects` doesn't exist until Epic 7) |
| `billing.payment_transactions` | Payment lifecycle record | `provider_reference` unique where non-null (§20's own named idempotency mechanism) |

**Constraints:** every currency column is `numeric(10,2)` with a `>= 0` (or `> 0` for `payment_transactions.amount`, per §5) CHECK; `billing_ledger_items.amount_paid <= amount_due`; `event`-style companion-field constraints were not needed here (no type-conditional field exists in this Epic's schema, unlike Epic 5's `requests`). Every FK's `ON DELETE` behavior matches §5's not-null discipline.

---

## 4. Policies created

26 RLS policies across 8 client-facing tables (`invoice_number_counters` has
zero — purely internal, `generate_invoice` is its only reader/writer), all
`FORCE ROW LEVEL SECURITY`. Key design decisions:

- **No DELETE policy exists anywhere in this Epic, for anyone** — generalizing `EPIC_5_REVIEW.md` H1's "Manager has no D... only soft-delete" lesson to its strongest form for financial records specifically (every table here is reconciliation-relevant; `active` booleans and status transitions are the correct way to "remove" something).
- **No direct INSERT/UPDATE policy on `invoices`, `invoice_lines`, or `payment_transactions`** — each has a correctness-critical RPC (`generate_invoice`'s gapless invoice numbering; `settle_payment_transaction`'s entire reconciliation guarantee) that a bare RLS grant would bypass, directly applying `EPIC_5_REVIEW.md` H2's lesson from the first draft.
- **Platform Admin gets zero blanket-bypass policy on `payment_transactions`** — the documented "R (support/reconciliation view)" permission (§12) is served by a dedicated `public.payment_transactions_support_view()` SECURITY DEFINER function instead, mirroring `academic.children_reception_safe()`/`children_driver_safe()`'s established "narrow read-surface function, no base-table policy for that role" pattern and directly applying `EPIC_4_REVIEW.md` C1's lesson.
- **Every guardian-facing `SELECT`/`UPDATE` policy states `tenant_id` explicitly** in its `USING` clause — six were initially drafted without it (relying only on transitive tenant-scoping via `current_guardian_child_ids()`) and were caught and fixed during this Epic's own project-wide recurrence check for `EPIC_5_REVIEW.md` L3 before being considered complete (see §7).

---

## 5. RPCs

| RPC | Grant | Idempotency-key | Notes |
|---|---|---|---|
| `billing.settle_payment_transaction` | `service_role` only (internal) | N/A — atomic `UPDATE...WHERE` status guard is itself the idempotency mechanism | The single seam every ledger-settlement path (manual verify, refund, the payment webhook) calls — avoids duplicating financial-correctness-critical SQL three times, mirroring `academic.set_child_day_path_status`'s established shape (Epic 3) |
| `mark_installment_paid_manual` | authenticated (manager) | No — atomic `UPDATE...WHERE`, naturally retry-safe | For in-person/cash payments with no `payment_transactions` row (§20) |
| `generate_invoice` | authenticated (manager) | **Yes** — creates a new row + burns a sequential number | Locks/creates the tenant's `invoice_number_counters` row; set-based `invoice_lines` insert |
| `verify_payment` | authenticated (manager) | **Yes** | Manual methods only; delegates to `settle_payment_transaction` |
| `refund_payment` | authenticated (manager) | **Yes** | `succeeded` → `refunded` only; delegates to `settle_payment_transaction` |

---

## 6. Edge Functions

| Function | Auth | Purpose |
|---|---|---|
| `initiate-payment` | guardian JWT | Calls the stubbed PSP (gateway methods) or generates a Fawry code / records a bank-transfer receipt reference (manual methods); creates the `payment_transactions` row via the service-role client (no direct RLS insert path exists — §4) |
| `payment-webhook` | **public, no JWT** (`verify_jwt = false`, the one documented exception in this codebase) | PSP callback; idempotent via `provider_reference` lookup + `settle_payment_transaction`'s own atomic guard |
| `generate-invoice-pdf` | service-role only | Background-job processor for `job_type='invoice_pdf_generation'`; reuses `jobs.claim_background_jobs` directly (no duplicate claiming logic) |
| `resend-invoice` | manager JWT | Re-notifies the child's guardians via `comms.enqueue_notification` |

---

## 7. Project-wide recurrence checks performed

Every defect class from the Epic 2-5 review/fix/audit cycle was searched
for across the **entirety** of Epic 6 before considering any part of it
complete — not just the locations a naive read might flag:

- **`EPIC_5_REVIEW.md` C1-class** (a non-`SECURITY DEFINER` trigger/function doing a cross-row aggregate/lookup invoked by a role whose own RLS visibility is narrower than what the check needs): all 9 non-`SECURITY DEFINER` Epic 6 functions (7 consistency triggers + `audit_invoice_voided` + `enqueue_invoice_pdf_job`) were individually traced against every write path that can invoke them. Every one either (a) is only ever written to by `manager` (tenant-wide RLS visibility, safe) or (b) only ever fires from within an already-`SECURITY DEFINER` caller's context. No recurrence found.
- **`EPIC_5_REVIEW.md` H1-class** (manager hard-delete on a financial record): zero `DELETE` policies exist anywhere in this Epic. No recurrence.
- **`EPIC_5_REVIEW.md` H2-class** (a direct RLS write path bypassing an RPC's own correctness guarantee): every INSERT/UPDATE policy across all 8 tables was checked against whether an RPC exists for that action and whether the direct path could bypass it. `invoices`/`invoice_lines`/`payment_transactions` correctly have no such policy; `installment_schedule_entries_update_manager` is correctly narrowed to `status <> 'paid'`. No recurrence.
- **`EPIC_4_REVIEW.md` C1-class** (blanket Platform Admin bypass on tenant-operational data): the only `is_platform_admin()` reference anywhere in this Epic's RLS/function layer is inside `payment_transactions_support_view()`'s own body — no base-table policy. No recurrence.
- **`EPIC_4_REVIEW.md` H3-class** (incomplete idempotency payload-hash coverage): all 3 hash computations (`generate_invoice`, `verify_payment`, `refund_payment`) were checked field-by-field against their function's own parameter list — every one is complete. No recurrence.
- **`EPIC_4_REVIEW.md` M2-class** (missing `deleted_at` filter on a notification-recipient resolution query): all 4 notification-producing queries (the two guardian fan-outs in `settle_payment_transaction`/`mark_installment_paid_manual`, the reminder job, the escalation job) were checked — every one correctly filters `deleted_at is null` on the relevant profile table. No recurrence.
- **`EPIC_5_REVIEW.md` M3-class** (a service method missing an explicit role check its siblings have): every public method across all 4 new services was enumerated — every one has an explicit `caller.role` check. No recurrence.
- **`EPIC_5_REVIEW.md` M4-class** (an asymmetric Zod refine vs. a DB CHECK constraint): no type-conditional-field DB constraint exists anywhere in this Epic's schema (unlike Epic 5's `requests.examKind`), so this class has no applicable surface here.
- **`EPIC_5_REVIEW.md` L3-class** (RLS `USING` clause omitting an explicit `tenant_id` check): **found and fixed** — 6 guardian-facing `SELECT` policies (`billing_ledger_items_select_guardian`, `installment_plans_select_guardian`, `installment_schedule_entries_select_guardian`, `invoices_select_guardian`, `invoice_lines_select_guardian`, `payment_transactions_select_guardian`) were initially drafted relying only on transitive tenant-scoping via `current_guardian_child_ids()`. Not independently exploitable, but corrected to state `tenant_id = current_tenant_id()` explicitly before this Epic was considered complete, exactly matching every sibling policy's convention.
- **`EPIC_2_DEPLOYMENT_FIX.md`-class** (a `SETOF`-returning function used inside an RLS policy expression): the only `SETOF`-returning function in this Epic (`payment_transactions_support_view()`) is called directly by client queries, never embedded in a policy's `USING`/`WITH CHECK` — not the anti-pattern that lesson warns against.
- **`EPIC_1_REVIEW.md`/general** (`search_path` hardening on `SECURITY DEFINER` functions): all 10 `SECURITY DEFINER` functions in this Epic carry `SET search_path = ''`, verified by direct grep across every migration file.
- **`EPIC_4_REVIEW.md` H4-class** (a per-row loop for a fan-out that could be set-based): **found and fixed** — `generate_invoice`'s `invoice_lines` insertion was initially a `FOR...LOOP` over the caller-supplied items array; converted to a single set-based `INSERT...SELECT FROM jsonb_array_elements(...)` before this Epic was considered complete, per this task's own explicit "prefer set-based SQL over row-by-row operations" requirement. The one remaining loop in this Epic (`settle_payment_transaction`'s manager-notification loop) is the same accepted bounded-N pattern `EPIC_3_REVIEW.md` L1 and `EPIC_5_FIX_REPORT.md`'s `submit_request` already established (a tenant's manager count is always small).

No other recurrence of any reviewed defect class was found anywhere in Epic 6.

---

## 8. Architectural decisions

1. **Every payment targets an existing invoice — no bare `ledger_items[]` payment path.** `BACKEND_ARCHITECTURE.md` §14.2's conceptual `initiate_payment(child_id, invoice_id | ledger_items[], method)` signature allows targeting bare ledger items with no invoice at all; no junction table between `payment_transactions` and `billing_ledger_items` is named anywhere in §3's table list, and inventing one would be schema speculation the architecture doc doesn't ask for. Requiring every payment to reference an invoice gives `billing.settle_payment_transaction` exactly one, well-defined, testable reconciliation path (match `invoice_lines.fee_item_id` against the child's `billing_ledger_items`/`installment_schedule_entries` rows) instead of an ambiguous one.
2. **`billing.billing_status` is one shared enum type for both `billing_ledger_items.status` and `installment_schedule_entries.status`.** §3.38/§3.40's prose is explicit that the two are "handled identically... same enum shape... kept in sync by the same job," even though the v0-draft inline field list for the installment table names a slightly different label set (`pending` instead of `unbilled`, no `partially_paid`). The prose's explicit unification intent is treated as authoritative — the same class of resolution `EPIC_5_REVIEW.md`'s own request/event type-mapping ambiguity used.
3. **`invoice_number_counters` is a new, implementation-necessary table**, not named in §3's list, for the same reason `safety.pickup_scan_rate_limits` (Epic 3) wasn't either: §3.41 requires a "unique per tenant" invoice number, and generating one safely under concurrency requires a lockable row — reusing `tenancy.tenants` for that lock was considered and rejected (it would create surprising contention with Epic 1's own tenant suspend/reactivate flows, which also lock that row).
4. **Bare placeholder UUIDs for `pdf_object_id`/`receipt_object_id`**, with the real file discoverable via a deterministic storage path convention (`{tenantId}/invoices/{invoiceId}.pdf`, `{tenantId}/{guardianId}/{filename}`) — matches the established Epic 1-5 precedent for every `_object_id` column pointing at the not-yet-existing `media.storage_objects` table (Epic 7).
5. **PDF rendering and every PSP call are stubbed**, matching the exact, explicitly-endorsed precedent `_shared/activation.ts` (Epic 1) and `_shared/notificationProviders.ts` (Epic 4) already established for external vendor integrations this sandboxed delivery cannot contract for.
6. **Platform Admin's payment-reconciliation access is a dedicated `SECURITY DEFINER` function, not an RLS bypass policy** — the only architecturally-correct way to satisfy §12's "R (support/reconciliation view)" without contradicting §13.6's explicit "no blanket bypass on tenant operational data" principle.

---

## 9. Self-review summary

Performed before considering this Epic complete, per this task's explicit requirement:

- **Security / Authorization**: every RPC checks `current_role()` as its first action; no function trusts RLS alone for its own multi-table writes. Every service method has an explicit role check matching its RPC/policy counterpart.
- **RLS**: all 9 tables have `FORCE ROW LEVEL SECURITY`; every policy re-read against the exact transition its corresponding RPC (or intended direct-CRUD path) performs; the 6-policy `tenant_id`-omission gap (§7) was found and closed.
- **Tenant isolation**: every table carries `tenant_id`; every consistency trigger verifies cross-table `tenant_id` agreement before allowing a write; every RLS policy's `tenant_id` check uses `current_tenant_id()`, never a client-supplied value.
- **Transaction safety**: `generate_invoice`'s counter-lock + invoice + invoice_lines insert is one function body (one transaction) — no partial-invoice state is reachable; `settle_payment_transaction`'s atomic `UPDATE...WHERE` guard, combined with `provider_reference`'s uniqueness, satisfies the Acceptance Criteria's "duplicate webhook never double-credits a ledger" requirement on two independent axes (verified directly in RLS Test 6-8).
- **Trigger behavior under RLS**: all 9 non-`SECURITY DEFINER` functions individually traced against every invocation path (§7) — none has the Epic 5 C1-class defect (a trigger whose own queries are unexpectedly narrowed by the invoking role's RLS visibility, in a way that would cause either a false pass or a false rejection).
- **`SECURITY DEFINER` boundaries**: all 10 `SECURITY DEFINER` functions carry `SET search_path = ''` and fully schema-qualify every internal reference; each one's elevated context is justified by a specific, named need (reaching `comms.enqueue_notification`/`write_audit_log`, or a cross-tenant scheduled-job sweep) — never a blanket "just in case" grant.
- **Performance / Scalability**: every RLS-filtering column is indexed (verified against `BACKEND_ARCHITECTURE.md` §6's own strategy); the recurring-billing job and the three other scheduled-job functions are all set-based, no per-row loop for a tenant-wide sweep; `generate_invoice`'s line-item insert was converted from a loop to a set-based statement during this review.
- **Architecture compliance**: table/column shapes match §3.36-3.43 field-for-field (with the two documented, resolved ambiguities in §8); all 4 named RPCs (§8 of the execution plan) and all 4 named Edge Functions (§7) implemented with matching signatures; no new Realtime channel added, matching §10's explicit "none new."

---

## 10. Tests

```
npx tsc -p tsconfig.json --noEmit   →  0 errors
npx vitest run                       →  30 test files, 287 tests, ALL PASSING (239 prior + 48 new)
```

### Coverage by concern

- **Validation layer** (17 tests): fee-item shape/precision, invoice line-item array non-emptiness, installment/payment decision enums, money precision (`multipleOf(0.01)`).
- **Service layer** (21 tests): every RPC/repository method's role-authorization boundary has a positive and negative test (manager can generate/void/verify/refund/mark-paid; guardian/teacher/platform_admin-support cannot; guardian can read their own child's ledger/invoices/payments).
- **API routes** (10 tests): validation-failure-before-service-call asserted for every route, matching the established pattern.
- **RLS adversarial** (10 tests, written, not executed — §1): cross-tenant isolation on payments/invoices/fee-items (Test 1); guardian own-child scoping (Test 2); no direct-INSERT bypass on `payment_transactions` (Test 3) or `invoices` (Test 4); no direct path to `installment_schedule_entries.status='paid'` (Test 5); **the core financial-correctness test** — `verify_payment` atomically settles payment + invoice + ledger item together (Test 6); duplicate settlement is rejected, not re-applied (Test 7); `refund_payment` reverses the same settlement (Test 8); Platform Admin has zero direct-table bypass but full access via the dedicated support view (Test 9); `fee_item_applicability` rejects a `scope=all` fee item (Test 10).

---

## 11. Known limitations (explicitly scoped decisions, not oversights)

1. **No live/local execution of the SQL layer or the RLS adversarial suite** — see §1. Deployment was out of scope for this implementation task.
2. **PSP integration and PDF rendering are fully stubbed** — `BACKEND_EXECUTION_PLAN.md` §13 itself names payment-gateway contracting as a "hard external-vendor gate," and no PDF library is available in this sandbox. Both stubs are structurally correct (every real caller is already written against the final signature) — only each stub function's own body needs to change once a real vendor/library is wired in.
3. **`billing.generate_recurring_ledger_items()` handles `cycle IN (monthly, once_per_year)` only.** `cycle='per_term'` is deliberately not generated — no term-calendar table exists anywhere in Epic 1-5's schema to derive real term boundaries from, and fabricating an arbitrary fixed cadence would silently misbill real tenants. `cycle='one_time'` is never auto-generated by design (billed ad-hoc via `generate_invoice` or a direct manager insert).
4. **`billing.send_payment_reminders()` assumes at-most-once-per-day invocation** — no reminder-send-log table exists to de-duplicate an intra-day re-run; not inventing an undocumented schema table to solve a problem the architecture doc doesn't name.
5. **Every payment must reference an invoice** (§8's Architectural Decision 1) — a bare `ledger_items[]`-only payment path (mentioned only in §14.2's conceptual signature, never required by the execution plan's own Acceptance Criteria) is not implemented.
6. **No pg_cron registration for any of the four scheduled-job functions** — matches every prior Epic's identical, explicitly-documented limitation (pg_cron is not installed in the linked project, confirmed live in `EPIC_4_DEPLOYMENT_AUDIT.md`). Every function is fully correct and callable on-demand.
7. **No frontend wiring.** Same explicit scope boundary as every prior Epic.

---

## 12. Manual QA checklist

- [ ] `supabase db reset` (or a fresh linked-project migration push) replays Epic 1-6 cleanly from scratch.
- [ ] A manager creates a `monthly`, `scope=all` fee item, then runs `billing.generate_recurring_ledger_items()` — verify exactly one `billing_ledger_items` row per active child in the tenant, and running it again immediately produces zero additional rows (idempotent re-run, Acceptance Criteria).
- [ ] A manager calls `generate_invoice` for a child with two line items — verify the invoice's `invoice_number` is sequential per tenant, and that a `jobs.background_job_queue` row with `job_type='invoice_pdf_generation'` was enqueued.
- [ ] Invoke `generate-invoice-pdf` manually (service-role bearer token) — verify a placeholder PDF appears in `generated-documents/{tenantId}/invoices/{invoiceId}.pdf` and `invoices.pdf_object_id` is set.
- [ ] A guardian calls `initiate-payment` with `method=bank_transfer` — verify a `payment_transactions` row appears at `status='pending_verification'`.
- [ ] A manager calls `verify_payment` with `decision=succeeded` — verify the invoice flips to `paid`, the matching `billing_ledger_items` row flips to `paid` with `amount_paid=amount_due`, and both the guardian and the manager receive a "Payment received" notification.
- [ ] Retry the same `verify_payment` call — verify `STATE_ALREADY_PROCESSED`, not a duplicate ledger credit.
- [ ] POST to `payment-webhook` twice with the same `providerReference` and `status=succeeded` — verify the ledger is credited exactly once (Acceptance Criteria: duplicate webhook delivery).
- [ ] A manager calls `refund_payment` on that same transaction — verify the invoice and ledger item both revert.
- [ ] A manager calls `mark_installment_paid_manual` on an installment entry — verify `paid=true`, `status='paid'`, a guardian notification, and an `audit_log` entry (`installment_marked_paid_manual`).
- [ ] A platform_admin (support tier) queries `billing.payment_transactions` directly — verify zero rows; then calls `payment_transactions_support_view()` — verify full visibility.
- [ ] Run `tests/rls/epic6_rls_adversarial.sql` against a real `supabase db reset` and confirm all 10 tests print `PASS`.

---

## Verdict

Epic 6 (Billing & Payments) implementation is **complete**: 7 new
migrations (9 tables, 6 enums, 14 triggers, 26 RLS policies, 1 support-view
function, 5 RPCs), 4 new Edge Functions + 1 shared provider-port file, 11
new application-layer files, 7 new test files (48 unit tests + 10 RLS
adversarial tests, the latter unexecuted per §1), all additive to Epic 1-5.
`npx tsc --noEmit` is clean; `npx vitest run` passes 287/287 across 30 test
files. A project-wide recurrence search against every defect class from the
Epic 2-5 review/fix/audit cycle found and closed two real gaps before this
Epic was considered complete (a 6-policy `tenant_id`-omission and one
per-row loop that should have been set-based from the start) — see §7 for
the full accounting. No Epic 1-5 migration was modified; no frozen frontend
file was touched. Stopping here — Epic 7 is out of scope for this delivery.
