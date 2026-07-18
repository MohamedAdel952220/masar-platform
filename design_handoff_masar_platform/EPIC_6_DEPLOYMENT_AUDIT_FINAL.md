# Epic 6 Deployment Audit — Final

Re-audit of Epic 6 (`Billing & Payments`) against the live, linked Supabase project (`oqvgkvyapjauepgozgjd`, staging), performed after the user confirmed Epic 6's four Edge Functions have now been deployed. Per this task's explicit scope, **no source code was re-reviewed** — this is a live-deployment-only re-verification, superseding the runtime-layer verdict of `EPIC_6_DEPLOYMENT_AUDIT.md` while treating that report's database-layer findings (§1-§6 there) as already established and unchanged. Checks performed: `supabase functions list`, `supabase migration list --linked`, `supabase db query --linked` (row counts, extension state), and direct HTTP requests against each Edge Function's live endpoint to confirm actual runtime reachability, not just registration status. No code was modified during this audit.

**Verdict up front: the runtime-layer gap that blocked the prior audit is now closed.** All four Epic 6 Edge Functions (`initiate-payment`, `payment-webhook`, `generate-invoice-pdf`, `resend-invoice`) are deployed, `ACTIVE`, and confirmed live-reachable via direct HTTP request — not merely listed. `payment-webhook`'s `verify_jwt = false` override is correctly applied at the gateway level, confirmed by its distinct HTTP response signature versus the other three. Combined with the previously-verified, unchanged database layer, Epic 6 is now fully deployed end to end. Full verdict in §4.

---

## 1. Missing items

**None.** All four previously-missing Edge Functions are now present:

| Function | Status | `verify_jwt` | Confirmed live via |
|---|---|---|---|
| `initiate-payment` | `ACTIVE` (v1) | `true` (correct — Supabase-authenticated guardian caller) | `supabase functions list`; `OPTIONS` → `200`; unauthenticated `POST` → `401` |
| `payment-webhook` | `ACTIVE` (v1) | `false` (correct — PSP caller carries no Supabase JWT, per `config.toml`'s documented exception) | `supabase functions list`; `OPTIONS` → `200`; unauthenticated `POST` → `422` (reaches function code, rejected by its own payload/signature validation, not by the auth gateway) |
| `generate-invoice-pdf` | `ACTIVE` (v1) | `true` (correct — service-role/manager-triggered) | `supabase functions list`; `OPTIONS` → `200` |
| `resend-invoice` | `ACTIVE` (v1) | `true` (correct — manager caller) | `supabase functions list`; `OPTIONS` → `200` |

The project's function count is now 9 (5 Epic 1 + 4 Epic 6), all `ACTIVE`. No other Edge Function, table, enum, constraint, foreign key, index, trigger, RLS policy, helper function, RPC, storage bucket/policy, or scheduled-job function is missing — the full database-layer inventory from `EPIC_6_DEPLOYMENT_AUDIT.md` §1 was independently re-spot-checked (migration list, row counts) and shows zero drift since that audit.

`add-bus`, `add-staff`, `enroll-child`, `notification-dispatch` remain undeployed — this is the pre-existing, Epic 2-4-scoped gap already carried forward through every prior audit and explicitly not counted against Epic 6.

---

## 2. Deployment issues

- **The Critical issue from the prior audit — "the payment pipeline cannot function in production" — is resolved.** All four Edge Functions are live and reachable. The guardian-initiated payment flow, PSP webhook ingestion, and invoice PDF generation are no longer structurally inert.
- **Live reachability was verified by direct request, not assumed from `status: ACTIVE`.** `curl -X OPTIONS` against all four function URLs returned `200` (CORS preflight correctly handled by each deployed function, confirming the Deno runtime actually booted and executed code, not just that a deployment record exists). An unauthenticated `POST` to `initiate-payment` returned `401` (JWT required, rejected before reaching handler logic — correct for a guardian-only function) while the same unauthenticated `POST` to `payment-webhook` returned `422` (request reached the handler and was rejected by its own body/signature validation — correct, since this function's whole purpose is to accept unauthenticated PSP calls and verify them itself). This distinct pair of response codes is itself live proof that the `verify_jwt = false` override for `payment-webhook` is actually in effect in production, not just present in `config.toml`.
- **No drift, no partial deployment, no unexpected function found.** All 44 Epic 1-6 migrations remain in exact `local`/`remote` agreement per `supabase migration list --linked`. `billing.invoices` and `billing.payment_transactions` both still hold 0 rows and `jobs.background_job_queue` is still empty — expected, since no real traffic has been sent through the now-live functions yet; this audit did not attempt to generate any (would require valid PSP/gateway sandbox credentials and a real guardian session, both outside this audit's scope).
- **`pg_cron` remains uninstalled** (`pg_extension` still shows no `pg_cron` row) — this is the same pre-existing, already-documented limitation from every prior audit (`EPIC_4_DEPLOYMENT_AUDIT.md` §1 onward). Edge Function deployment does not affect this; it is unrelated infrastructure. Recorded for completeness only — not a new issue, and not what blocked the prior verdict.

---

## 3. Security issues

No new security issues found, and no change to the security posture already fully verified in `EPIC_6_DEPLOYMENT_AUDIT.md` §3 (which remains valid and is not re-litigated here per this task's "no source review" scope). One additional live-only confirmation specific to this re-audit:

- **`payment-webhook`'s public, unauthenticated exposure is confirmed intentional and correctly scoped, not an accidental gap.** Its `verify_jwt: false` setting is live (confirmed via `functions list` and the `422` response behavior above), matching `BACKEND_ARCHITECTURE.md` §20's explicit design ("public endpoint with signature verification") and `config.toml`'s own documented, single, deliberate exception. No other Epic 6 function has this override — `initiate-payment`, `generate-invoice-pdf`, and `resend-invoice` all show `verify_jwt: true`, correctly requiring a Supabase session for every other Epic 6 entry point.

---

## 4. Financial correctness verification

Unchanged from `EPIC_6_DEPLOYMENT_AUDIT.md` §4 at the database/logic layer (not re-verified here, per scope — no source review performed). The one item that report flagged as "currently only half-live" is now upgraded:

- **Duplicate payment initiation prevention is now fully live**, not just DB-backstopped. Previously, only the `payment_transactions_one_inflight_per_invoice` unique index was reachable in production; the friendlier Edge-Function-level pre-check (returning the existing in-flight payment instead of a raw constraint error) existed only in undeployed source. `initiate-payment` is now deployed, so both layers of this defense-in-depth pair are live.
- **Receipt upload traceability is now fully live**, for the same reason — the storage-existence check and `receipt_file_path` persistence, previously DB/storage-ready but application-flow-pending, are now reachable through the deployed `initiate-payment` function.
- **Invoice PDF generation's delivery path is now structurally complete** — `trg_invoices_enqueue_pdf_job` (already confirmed live) queues a job, and `generate-invoice-pdf` (now deployed) is capable of consuming it, though no pg_cron/webhook trigger yet invokes it automatically (§2) — it remains invokable on-demand, matching `EPIC_6_COMPLETION_REPORT.md`'s own documented manual-invocation expectation for this environment.

---

## 5. Architecture deviations / Documentation inconsistencies

None new. All items recorded in `EPIC_6_DEPLOYMENT_AUDIT.md` §5-§6 (the stale §3.40 enum listing, the three fix-report-driven additive fields not yet retrofitted into §3, `mark_ledger_item_paid_manual` missing from §14.2's list, the split "Billing status roll-up" responsibilities, the still-FK-less `event_trip_registrations.payment_transaction_id`) remain as previously documented and are not re-derived here, per this task's live-deployment-only scope. None of them relate to Edge Function deployment.

---

## 6. Final verdict

**Runtime layer: now complete.** All four Edge Functions Epic 6's own contract requires (`BACKEND_EXECUTION_PLAN.md` §7) are deployed, `ACTIVE`, and independently confirmed reachable and correctly configured via direct live HTTP requests — not merely inferred from a listing. The specific defect that blocked the prior audit's verdict (`initiate-payment`, `payment-webhook`, `generate-invoice-pdf`, `resend-invoice` all absent from production) no longer exists.

**Database layer: unchanged and still correct**, per the unchanged migration list and spot-checked live state — no re-verification needed since nothing in the database layer was touched by this deployment action.

Combining the now-complete runtime layer with the already-verified database layer, Epic 6 is deployed to production correctly and completely, matching `EPIC_6_FIX_REPORT.md`'s described end-state end to end, with only the pre-existing, already-documented, non-blocking `pg_cron`-not-installed limitation (carried since Epic 4, affecting all Epics equally, not Epic-6-specific) remaining open.

**READY FOR EPIC 7**

(carrying forward, unchanged, the standing recommendation that the RLS adversarial suite — `tests/rls/epic6_rls_adversarial.sql` — be executed against this live database by an authorized human operator at the next opportunity, and that a `pg_cron` schedule or equivalent webhook be provisioned for the four scheduled-job functions before relying on recurring billing/reminders/escalation running automatically.)
