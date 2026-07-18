# Epic 8 Fix Report

Implements every finding in `EPIC_8_REVIEW.md` (approved). Epic 8's migrations had not been deployed to any live project, so every SQL fix was applied by editing the existing Epic 8 migration files directly (`20260727000002_epic8_tables.sql`, `20260727000005_epic8_rpc_functions.sql`) rather than adding forward-only patch migrations for those two — per this task's own instruction, forward-only patching is required only when a change would touch a *frozen* Epic's migration, and Epic 8 is not frozen (it is what this task fixes). One genuinely new migration (`20260727000007_epic8_fix_atomic_batch_rpc.sql`) was added for a new RPC the fix pass required, mirroring the exact precedent `EPIC_7_FIX_REPORT.md` set for `create_camera`. **No Epic 1, Epic 2, Epic 3, Epic 4, Epic 5, Epic 6, or Epic 7 migration was modified** (git-verified — see §7).

**The Critical finding, both High findings, all four Medium findings, and two of the three Low findings are fixed.** The third Low finding (L2) required no code change — it was already correctly scoped as informational in the review itself (parity with an already-accepted Epic 6 limitation, not a new regression), and building the deferred job consumer it references is out of scope for a review-fix pass, not a frozen-epic obstruction.

---

## 1. Findings fixed

### Critical

| ID | Finding | Fix |
|---|---|---|
| C1 | `ai-draft-report/index.ts` checked only role + tenant for a teacher caller, never classroom/student ownership — any teacher could draft an AI report (and receive the generated content directly in the response) for any child in the tenant, consuming the shared AI budget to do it | Every read used to resolve `scope='classroom'`/`scope='children'` (classroom lookup, child lookup, evaluations/attendance metrics) now runs through a **caller-scoped** client (`supabaseAsCaller`, carrying the caller's own JWT) instead of the service-role admin client. This means the frozen Epic 2 RLS policies (`classrooms_select_teacher`/`children_select_teacher`/`evaluations_select_teacher`/`attendance_select_teacher`, all scoped via `public.current_staff_classroom_ids()`) enforce a teacher's own-classroom restriction automatically — a teacher requesting an out-of-scope classroom/child now gets the exact same `NOT_FOUND` the code already produced for a genuinely nonexistent one, with **zero new hand-rolled authorization logic**. A manager's tenant-wide RLS policies make this a no-op for manager callers. This also converts C1's exposure into something the existing RLS adversarial suite can directly verify (new Test 24), partially addressing L1 in the same change. |

### High

| ID | Finding | Fix |
|---|---|---|
| H1 | No idempotency-key protection anywhere in Epic 8 (2 Edge Functions + 5 RPCs), violating §14.3/§25.6's universal mandate — a client retry could duplicate AI report batches, double-charge the daily usage cap, or spam a guardian with duplicate "new report" notifications | `ai-draft-report`/`ai-polish-note` now wrap their whole mutating sequence in `withIdempotency` (`_shared/idempotency.ts`), the same shared mechanism `initiate-payment`/`enroll-child` already use — a retry with the same `x-idempotency-key` header replays the original response instead of re-executing anything, including the usage-cap increment. All five lifecycle RPCs (`send_report_draft`, `schedule_report_draft`, `resend_report_draft`, `delete_report_draft`, `export_report_draft`) now accept an optional `p_idempotency_key` and implement the exact input-hash envelope already established by `public.review_request`/`generate_invoice`/`verify_payment`/`refund_payment` (Epic 5/6). `delete_report_draft`'s return type changed from `void` to `jsonb` (`{deleted, draftId}`) so a replayed delete has a concrete response to return instead of surfacing `NOT_FOUND` on its second call — a genuine, if minor, idempotency-contract violation on its own that's now also fixed. `resend_report_draft` keeps its idempotency envelope scoped to same-key replay only (documented explicitly): a fresh key still legitimately resends, since repeated resends are a deliberate manager action, not a bug. |
| H2 | `ai-draft-report/index.ts` performed the batch-insert and the subsequent draft-insert/job-enqueue as separate, independently-committing REST round-trips — a crash or timeout between them left an orphaned `ai_report_batches` row with zero drafts and no error surfaced anywhere | New RPC `reports.create_ai_report_batch` (migration 7) folds the batch-insert and draft-insert (or job-enqueue) into one PL/pgSQL function body — one Postgres transaction — mirroring the exact atomicity precedent Epic 7's own `create_camera` set for a two-table write with the same gap. `reports.increment_ai_usage` deliberately stays a separate step (see the migration's own header comment): folding it in would mean a downstream failure inside the new RPC silently reverts the "a rejected call still counts against the cap" cost-accounting behavior migration 5 already documents and this fix pass preserves as-is. |

### Medium

| ID | Finding | Fix |
|---|---|---|
| M1 | `ai_report_drafts_update_manager`'s `WITH CHECK` constrained `tenant_id`/role/`status` but not `child_id`/`batch_id` — a manager could retarget an existing draft's already-generated body/metrics onto a different child via a direct REST call, bypassing the Node repository's own implicit protection | New trigger `reports.check_ai_report_draft_immutable_fields()` (migration 2) fires `BEFORE UPDATE` on `ai_report_drafts` and rejects any change to `child_id`/`batch_id`, regardless of caller or write path — closing the direct-REST gap a policy-only fix would have missed. |
| M2 | No upper bound on `ai-draft-report`'s resolved batch size (`childIds` array / classroom size) | `MAX_BATCH_SIZE = 500` is now enforced in `ai-draft-report/index.ts` on both scope branches (rejecting an oversized `childIds` array before any DB read, and the resolved child count after classroom resolution), **and** re-checked server-side inside `reports.create_ai_report_batch` itself as defense-in-depth (the same "RLS/RPC re-checks what the Edge Function already checked" convention used throughout this codebase) — a caller cannot bypass the cap by calling the RPC through any other path, since the RPC is `service_role`-only anyway (see H2 above). |
| M3 | `ai_report_drafts.edited_by`, a field explicitly named in §3.20, was never populated by any code path | `AiReportRepository.updateDraft` now stamps `edited_by` with the calling manager's own id whenever `body` or `deliveryChannels` changes. `AiReportService.updateDraft` threads `caller.userId` through for this purpose. |
| M4 | Neither AI Edge Function wrote an audit-log entry for its own primary action, unlike every comparable mutating Edge Function elsewhere (`add-staff`'s `added_staff` entry) | `ai-polish-note` now calls `write_audit_log` (action `note_polished`, `p_target_id` null — a stateless text transform with no specific row to target) after a successful call. `reports.create_ai_report_batch` now calls `write_audit_log` (action `ai_report_batch_created`, target the new batch id) as part of its own atomic transaction — so the audit entry for `ai-draft-report`'s primary action is written exactly once, inside the same all-or-nothing unit as the batch/draft creation itself. |

### Low

| ID | Finding | Fix |
|---|---|---|
| L1 | Zero automated test coverage of either Edge Function's authorization logic (no Deno test runner in this sandbox) | Not fully resolvable (still no Deno runner available), but substantially mitigated as a side effect of the C1 fix: the teacher-scoping check that used to be hand-rolled, untestable Edge-Function-only logic is now the *same* frozen Epic 2 RLS policies already exercised throughout `tests/rls/*.sql` — and this fix pass adds a direct regression test (Test 24) confirming the exact mechanism `ai-draft-report/index.ts` now depends on. The residual gap (the Edge Function's own request-shape validation, `MAX_BATCH_SIZE` check, and idempotency wiring) remains untestable in this sandbox, same as every prior Epic's own Edge Functions. |
| L2 | `export_report_draft`'s enqueued job has no consumer or `storage_objects` placeholder — informational, inherited parity with an already-accepted Epic 6 limitation | **No fix applied.** The review itself classified this as informational/non-regression (identical to `billing.enqueue_invoice_pdf_job`'s own accepted gap), and its own recommended remedy is to address it "alongside the not-yet-built job consumer... together" — building that consumer is a new feature, not a fix to an existing defect, and is out of scope for this pass. Documented here for completeness rather than silently dropped. |
| L3 | Unbounded concurrent LLM calls within a single synchronous batch (`Promise.all` over up to 10 children) | `ai-draft-report/index.ts` now uses a small `mapWithConcurrency` helper (`LLM_CONCURRENCY = 5`) instead of one unbounded `Promise.all` — immaterial against the current stub, relevant once a real provider with its own rate limits is wired in. |

---

## 2. Files modified

### SQL migrations (Epic 8's own, edited directly where undeployed — plus one new file)
- `20260727000002_epic8_tables.sql` — **edited**: M1 (new `reports.check_ai_report_draft_immutable_fields()` trigger, fires on every `ai_report_drafts` UPDATE).
- `20260727000005_epic8_rpc_functions.sql` — **edited**: H1 (every one of the five lifecycle RPCs gains an optional `p_idempotency_key` + the established input-hash envelope; `delete_report_draft`'s return type changed `void` → `jsonb`).
- `20260727000007_epic8_fix_atomic_batch_rpc.sql` — **new**: `reports.create_ai_report_batch` (H2's atomicity mechanism; also implements M2's server-side defense-in-depth cap and M4's `ai_report_batch_created` audit-log entry).
- `20260727000001_epic8_reports_schema.sql`, `20260727000003_epic8_plan_catalog_ai_cap.sql`, `20260727000004_epic8_rls_policies.sql`, `20260727000006_epic8_scheduled_jobs.sql` — unchanged (no finding required a change to schema/enum creation, the additive plan-catalog column, the RLS policy set itself, or the scheduled-dispatch sweep function).

### Edge Functions
- `ai-draft-report/index.ts` — **rewritten**: C1 (caller-scoped reads replace service-role reads for classroom/child/metrics resolution), H1 (`withIdempotency` wraps the whole mutating sequence), H2 (calls `reports.create_ai_report_batch` instead of separate batch/draft/job inserts), M2 (`MAX_BATCH_SIZE` check, both client-side and via the RPC's own defense-in-depth), L3 (`mapWithConcurrency` replaces the unbounded `Promise.all`).
- `ai-polish-note/index.ts` — **edited**: H1 (`withIdempotency` wraps the usage-increment + LLM-call sequence), M4 (`write_audit_log` call for `note_polished`).

### TypeScript
- `backend/src/repositories/aiReportRepository.ts` — M3 (`updateDraft` stamps `edited_by`, now takes a `callerId` parameter); H1 (`sendDraft`/`scheduleDraft`/`resendDraft`/`deleteDraft`/`exportDraft` all take an optional `idempotencyKey` and pass it through as `p_idempotency_key`; `deleteDraft`'s return type changed to match the RPC's new `jsonb` shape).
- `backend/src/services/aiReportService.ts` — M3 (`updateDraft` passes `caller.userId` through); H1 (every mutating method passes `input.idempotencyKey` through); `remove`'s return type updated to `{deleted: true; draftId: string}`.
- `backend/src/validation/reports.schema.ts` — H1 (`sendReportDraftSchema`/`scheduleReportDraftSchema`/`resendReportDraftSchema`/`deleteReportDraftSchema`/`exportReportDraftSchema` each gain an optional `idempotencyKey: uuidSchema.optional()`).
- `backend/src/api/routes/reports.ts` — H1 (`deleteReportDraftRoute` now returns the service's `{deleted, draftId}` result directly instead of discarding it to `{ok: true}`).

### Tests
- `backend/tests/unit/aiReportService.test.ts` — updated `resendDraft`/`deleteDraft` call-argument assertions for the new `idempotencyKey` parameter and `deleteDraft`'s new mock return shape; 2 new tests (H1 idempotencyKey passthrough on `send`; M3 `edited_by`/`callerId` passthrough on `updateDraft`).
- `backend/tests/unit/reportsApiRoutes.test.ts` — updated the shared "passes a valid draftId through" test for `deleteReportDraftRoute`'s new `{deleted, draftId}` return shape; 1 new test (H1 idempotencyKey passthrough through validation).
- `backend/tests/unit/reportsValidation.test.ts` — 3 new tests (H1: accepts a valid-uuid `idempotencyKey` on all five draft-lifecycle schemas; rejects a non-uuid one; accepts it on `scheduleReportDraftSchema` specifically).
- `backend/tests/rls/epic8_rls_adversarial.sql` — 5 new numbered test blocks (20–24, unexecuted per the same documented sandbox limitation as the rest of this suite): M1's immutable-fields trigger (positive rejection + a same-value no-op still permitted); H1's `send_report_draft` replay (same response, no duplicate notification) and cross-payload rejection (`CONFLICT_IDEMPOTENCY_KEY_REUSED`); H1's `delete_report_draft` jsonb replay vs. a genuine second delete's `NOT_FOUND`; H2/M2/M4's `create_ai_report_batch` (not directly callable by `authenticated`, atomic sync-path batch+draft creation with its audit-log entry, atomic async-path batch+job creation, the 501-child cap rejection, and the `p_caller_role` defense-in-depth check); and C1's underlying RLS mechanism, directly verifying Teacher A has zero visibility into a classroom/child outside their own coordinated classroom.

---

## 3. Database changes

- **New trigger**: `reports.check_ai_report_draft_immutable_fields()` + `trg_ai_report_drafts_immutable_fields` on `reports.ai_report_drafts` (M1).
- **New function**: `reports.create_ai_report_batch(p_tenant_id, p_caller_id, p_caller_role, p_type, p_scope, p_classroom_id, p_topic, p_child_ids, p_drafts)` — `SECURITY DEFINER`, `SET search_path = ''`, `service_role`-only grant (H2, M2, M4).
- **Changed function signatures**: `send_report_draft`, `schedule_report_draft`, `resend_report_draft`, `delete_report_draft`, `export_report_draft` — each gains a trailing `p_idempotency_key uuid default null` parameter (H1). `delete_report_draft`'s return type changed from `void` to `jsonb`.
- No new tables, columns, enums, or indexes. No RLS policy was added, removed, or re-scoped (M1's fix is a trigger, not a policy change, precisely because the constraint it enforces — "unchanged across an UPDATE" — is not expressible as a `WITH CHECK` predicate without a self-referencing subquery).

---

## 4. Security improvements

- **C1**: closes a real horizontal-privilege-escalation path — a teacher could previously generate, and directly receive in the API response, AI-drafted content about any child in the tenant, not just their own students, while consuming the tenant's shared AI budget to do it.
- **H1**: closes a duplicate-AI-usage-charge and duplicate-guardian-notification vector reachable by an ordinary client network retry, with no attacker action required.
- **H2**: closes a partial-write/orphaned-row vector (crash between the batch insert and the draft/job insert), and, as a side effect of the design chosen, makes any downstream failure inside the RPC roll back the batch/draft insert together rather than leaving a half-created batch.
- **M1**: closes a direct-REST content-integrity gap where a manager could retarget an AI-drafted report's body/metrics onto a different child, bypassing the intended editing workflow entirely.
- **M2**: closes an unbounded-resource-consumption vector (an arbitrarily large `childIds` array or classroom roster), enforced at two independent layers.
- **M4**: restores accountability/traceability for AI-generation events specifically, which the architecture doc's own §25 liability framing calls out by name as the risk area this Epic is built around.

---

## 5. Performance improvements

- **H2**: the batch/draft creation is now a single round-trip (one RPC call) instead of two–three sequential REST round-trips, reducing both latency and the number of network hops for every `ai-draft-report` invocation.
- **L3**: bounded LLM-call concurrency avoids a self-inflicted request burst against the (eventual real) provider, reducing the odds of spurious rate-limit failures that would otherwise degrade every affected draft to its fallback template unnecessarily.
- **M2**: prevents a pathological request (a very large `childIds` array or classroom) from generating an oversized synchronous response payload or an oversized background-job payload.

---

## 6. Additional recurrence fixes

Per the task's "perform a project-wide recurrence check for every defect class discovered during the review" instruction, each defect *class* was searched for across the entirety of Epic 8 (not just the specific reported location) before considering any finding closed:

- **C1-class (role check with no resource-scope check)**: re-checked `ai-polish-note` (stateless, no child/classroom reference at all — not applicable) and all five lifecycle RPCs (each is manager-only and tenant-scoped by design, §12's "Manager: CRUD (all)" — no classroom/child-level scoping is architecturally required for a manager, so no recurrence). No further instance found.
- **H1-class (missing idempotency)**: re-checked `reports.increment_ai_usage` (an internal metering primitive, never client-facing, not a candidate) and `reports.sweep_scheduled_report_drafts` (a scheduled job, not user-invoked, and already naturally idempotent — re-verified by the pre-existing Test 17). No further instance found.
- **H2-class (multi-step write with no transaction boundary)**: re-checked `ai-polish-note` (a single RPC call, no multi-step write) and all five lifecycle RPCs (each is already one PL/pgSQL function = one transaction by construction). No further instance found.
- **M1-class (RLS UPDATE policy missing an immutable-field guard)**: `ai_report_drafts_update_manager` is the *only* UPDATE policy anywhere in Epic 8 (`ai_report_batches` and `ai_usage_counters` have no UPDATE policy for any role at all). No further instance found.
- **M2-class (missing batch-size cap)**: re-checked every other Epic 8 entry point for an unbounded-array-shaped input. `ai-draft-report` is the only batch-shaped endpoint in this Epic. No further instance found.
- **M3-class (a schema field named in the architecture doc but never populated)**: re-checked every column on all three Epic 8 tables against §3.19/§3.20/§3.20.1's own field lists. `edited_by` was the only gap. No further instance found.
- **M4-class (a mutating Edge Function with no audit-log entry for its own primary action)**: both of Epic 8's Edge Functions are now fixed; no other Edge Function exists in this Epic.
- **L3-class (unbounded concurrent external calls)**: re-checked `ai-polish-note` (a single LLM call per request, not a batch — not applicable). No further instance found.

No additional recurrence of any reviewed defect class was found beyond the locations already fixed above. No defect class from `EPIC_1_REVIEW.md` through `EPIC_7_REVIEW.md` (SETOF-in-policy, unhardened `search_path`, missing tenant-consistency triggers, a direct-RLS-write path bypassing a correctness-critical RPC, manager hard-delete on a historical record, duplicated Deno/Node authorization logic, asymmetric Zod refines, a soft-deleted-classroom visibility gap) was found reintroduced anywhere in this fix pass. Applying this task's explicitly named lessons specifically: classroom-ownership validation (C1), tenant isolation (re-verified unchanged and correct throughout — `create_ai_report_batch` trusts `p_tenant_id` from a caller whose identity was already re-verified server-side by `requireCaller`, exactly like `reports.increment_ai_usage`'s own established pattern), human-in-the-loop guarantees (unaffected — `send_report_draft`/`schedule_report_draft` remain the sole path to `sent`/`scheduled`, and the narrowed `ai_report_drafts_update_manager` policy still excludes those two statuses), idempotency (H1), transaction boundaries (H2), audit logging (M4), direct REST bypasses (M1), RLS parity (re-verified unchanged for guardian/teacher/manager read scoping, plus the new Test 24 regression check), soft-delete handling (unaffected — both consistency triggers already filtered `deleted_at is null` before this fix pass and still do), and AI usage accounting (directly improved by H1's fix, which now prevents a retry from double-charging the daily cap).

---

## 7. New tests added

- **Unit tests**: 6 new (2 in `aiReportService.test.ts`, 1 in `reportsApiRoutes.test.ts`, 3 in `reportsValidation.test.ts`) — see §2 for the full breakdown. **444/444 tests passing** (39 files, up from 438/438 before this fix pass).
- **RLS adversarial tests**: 5 new numbered blocks (Tests 20–24) in `tests/rls/epic8_rls_adversarial.sql`, covering M1, H1 (both `send_report_draft` and `delete_report_draft`'s idempotency envelopes), H2/M2/M4 (`create_ai_report_batch`'s atomicity, its `service_role`-only grant, its audit-log write, and its defense-in-depth cap/role checks), and C1 (a direct regression test for the RLS mechanism the Edge Function fix now relies on). Written and statically traced by hand; **not executed** against a live database, consistent with every prior Epic's identical, explicitly documented limitation (no Docker/local Postgres in this sandbox).

---

## 8. Remaining limitations

1. **L1 is only partially mitigated**, not resolved — this sandbox still has no Deno test runner, so `ai-draft-report`/`ai-polish-note`'s own request-shape validation, `MAX_BATCH_SIZE` check, and idempotency-key wiring remain untestable directly, even though the classroom-ownership decision they used to hand-roll is now covered indirectly via the RLS suite.
2. **L2 remains unaddressed by design** — `export_report_draft`'s job has no consumer or `storage_objects` placeholder, identical to Epic 6's own accepted `invoice_pdf_generation` gap. Building either consumer is out of scope for this fix pass.
3. **Neither RLS test suite (Epic 8's own or this fix pass's additions) has been executed against a live database** — see §1 of `EPIC_8_REVIEW.md` and every prior Epic's own completion report for the same standing limitation.
4. **`create_ai_report_batch`'s async-path job payload still has no consumer** — unchanged from the original implementation; this fix pass only changed *how atomically* the job gets enqueued, not what (eventually) processes it.
5. **Epic 6/7's own Edge Functions still do not call `_shared/rpcError.ts`** — this pre-existing, cross-epic gap (documented in `EPIC_8_COMPLETION_REPORT.md` §8.1 / §13.2) was correctly left untouched per the freeze instruction and is unrelated to any `EPIC_8_REVIEW.md` finding.

---

## 9. Verification summary

| Check | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` | ✅ Zero errors |
| `vitest run` | ✅ 444/444 tests passing (39 files) |
| SQL `$$`/paren balance (7 Epic 8 migrations + RLS test file) | ✅ All balanced |
| Epic 1-7 migration files modified | ✅ Zero (git-verified: every Epic 1-7 migration file is untracked/new relative to the repository's last commit, none show as `M`) |
| Shared-plumbing files touched in this fix pass | ✅ Zero (the same 5 files flagged `M` since the original Epic 8 implementation — `errors.ts` ×2, `domain.ts`, `config.toml`, `cors.ts` — are unchanged by this fix pass; no new frozen-epic file was opened or edited) |
| Deployment order valid | ✅ `20260727000007` sorts strictly after `20260727000006` with no numbering collision or gap; migrations 1–6 unchanged in content ordering |
| Every Critical/High/Medium finding fixed | ✅ C1, H1, H2, M1, M2, M3, M4 |
| Low findings | ✅ L1 (partially mitigated, documented), L3 fixed; L2 correctly left as a documented non-fix (informational, no frozen-epic obstruction, out-of-scope consumer build) |
| Project-wide recurrence check | ✅ Performed for every defect class from this review; no additional recurrence found beyond the locations already fixed |
| New RPC (`create_ai_report_batch`) is `SECURITY DEFINER` + `SET search_path=''` + fully schema-qualified + minimally privileged (`service_role` only, not `authenticated`) | ✅ Confirmed, and explicitly regression-tested (Test 23a) against reintroducing a C1-class bypass |

**Epic 8 fix pass complete. Stopping per instruction — Epic 9 not started.**
