# Epic 8 Completion Report — AI Report Architecture

Scope: the new `reports` schema (`ai_report_batches`, `ai_report_drafts`,
`ai_usage_counters`), the per-tenant daily AI-usage cap (an additive column
on Epic 1's frozen `tenancy.plan_catalog`), the two AI Edge Functions
(`ai-polish-note`, `ai-draft-report`), the human-in-the-loop lifecycle RPCs
(`send_report_draft`, `schedule_report_draft`, `resend_report_draft`,
`delete_report_draft`, `export_report_draft`), and the scheduled-dispatch
sweep. Epic 1 through Epic 7 are frozen — every migration in this Epic is
purely additive (new schema, new tables, new functions, new policies,
additive extensions to four shared plumbing files: the Node/Deno error
taxonomies and the Node/Deno RPC-error-parsing whitelists).
**No Epic 1-7 migration file was modified** (git-verified: zero migration
file shows as `M` against the repository's last commit — see §11). No frozen
frontend file was touched.

This is the first Epic with a real external-LLM-provider integration point
and the first to enforce a per-tenant usage cap on an external-service call
— both risks are treated the same way Epic 6/7 treated their own first
external-integration points (payment gateway, media relay): a fully stubbed
provider port behind a narrow interface, a deterministic-failure-simulation
env var, and a caller-side fallback that never fails the end user's request.

---

## 1. Environment reality check

Same limitation as every prior Epic: no Docker/local Postgres in this
sandbox, and deployment is out of scope for an implementation task — the
user's instruction was to implement and report, not deploy. Every SQL-layer
claim below is a **static** guarantee — balanced `$$`/parens verified
programmatically on every migration file and the RLS test file, every RLS
policy, trigger, and RPC individually traced by hand against every
role/path that can invoke it. `node node_modules/typescript/bin/tsc -p
tsconfig.json --noEmit` and `node node_modules/vitest/vitest.mjs run` are
real executions and both pass (438/438 tests, 39 files, including 46 new
Epic 8 tests). `tests/rls/epic8_rls_adversarial.sql` is written, covering
every RPC, every RLS policy, both consistency triggers, the scheduled
sweep, and the usage-cap boundary — but **not executed** against any
database, consistent with every prior Epic's identical, explicitly
documented limitation.

---

## 2. Files created

### 2.1 SQL migrations (6) — `backend/supabase/migrations/`

1. `20260727000001_epic8_reports_schema.sql` — `reports` schema; 4 enums (`report_type`, `report_scope`, `report_draft_status`, `delivery_channel`).
2. `20260727000002_epic8_tables.sql` — `ai_report_batches`, `ai_report_drafts`, `ai_usage_counters` + 2 consistency triggers + `updated_at` trigger.
3. `20260727000003_epic8_plan_catalog_ai_cap.sql` — additive `tenancy.plan_catalog.ai_daily_call_cap` column (Epic 1's table, new forward-only migration — does not touch `20260714000002_epic1_tenancy_tables.sql`).
4. `20260727000004_epic8_rls_policies.sql` — 7 policies across the 3 new tables.
5. `20260727000005_epic8_rpc_functions.sql` — 6 SQL functions (1 internal, 5 client-facing RPCs).
6. `20260727000006_epic8_scheduled_jobs.sql` — `reports.sweep_scheduled_report_drafts()`.

### 2.2 Edge Functions (2 + 1 shared) — `backend/supabase/functions/`

- `ai-polish-note/index.ts` — teacher, JWT-authenticated. Stateless text-in/text-out LLM call plus the shared usage-cap increment; no database write beyond the counter.
- `ai-draft-report/index.ts` — teacher or manager, JWT-authenticated. Server-side scope resolution (classroom or explicit child list), server-side metrics computation from `academic.evaluations`/`academic.attendance_records`, sync drafting for ≤10 children, enqueue-and-defer for >10.
- `_shared/llmProvider.ts` — stubbed LLM provider port (new file, mirrors `_shared/paymentGateway.ts`/`_shared/mediaRelay.ts`'s established pattern). `LLM_PROVIDER_SIMULATE_FAILURE=true` deterministically exercises the fallback path (§20's "LLM provider simulated outage" scenario).

### 2.3 Application layer (6 new files) — `backend/src/`

- `types/database.types.epic8.ts`, `types/domain.epic8.ts` (new)
- `validation/reports.schema.ts` (new)
- `repositories/aiReportRepository.ts` (new)
- `services/aiReportService.ts` (new)
- `api/routes/reports.ts` (new)

No Node-side mirror exists for `ai-polish-note`/`ai-draft-report` — both
call an external LLM provider, matching the established "no Node mirror for
a function whose core purpose is calling an external service" precedent
(`PaymentService`/`initiate-payment`, Epic 7's `camera-stream-token`).

### 2.4 Shared plumbing — additive edits only

- `backend/src/lib/errors.ts` — `EXTERNAL_AI_QUOTA_EXCEEDED` added to the `ErrorCode` union (and `EXTERNAL_MEDIA_RELAY_FAILURE` backfilled — see §8.1).
- `backend/supabase/functions/_shared/errors.ts` — `EXTERNAL_AI_QUOTA_EXCEEDED` added to the `ErrorCode` union and `STATUS_BY_CODE` map (→ 429).
- `backend/src/lib/rpcError.ts` — `EXTERNAL_AI_QUOTA_EXCEEDED` (and the Epic 6/7 codes it was already missing — see §8.1) added to `KNOWN_CODES`.
- `backend/supabase/functions/_shared/rpcError.ts` — same additive extension to its own `KNOWN_CODES` (this file is an **Epic 2** file, not new — see §8.1 for why this mattered).

No changes were needed to `supabase/config.toml` or `_shared/cors.ts` —
neither AI Edge Function needs a `verify_jwt = false` override (both are
called by an authenticated human user, unlike `payment-webhook`/
`camera-heartbeat`) or a new custom request header.

### 2.5 Tests (3 new files, 46 tests)

- `tests/unit/reportsValidation.test.ts` (19 tests)
- `tests/unit/aiReportService.test.ts` (17 tests)
- `tests/unit/reportsApiRoutes.test.ts` (10 tests)
- `tests/rls/epic8_rls_adversarial.sql` (19 tests, unexecuted per §1)

---

## 3. Tables created

| Table | Columns | Notes |
|---|---|---|
| `reports.ai_report_batches` | `id, tenant_id, type, scope, classroom_id, topic, created_by, created_at` | One row per drafting request — a single-child request is a batch of size 1. `scope='classroom'` requires `classroom_id`; `scope='children'` forbids it. |
| `reports.ai_report_drafts` | `id, batch_id, tenant_id, child_id, body, metrics, status, scheduled_for, sent_at, delivery_channels, edited_by, created_at, updated_at` | One row per child per batch. `metrics` is a point-in-time jsonb display snapshot, not a fact table. `scheduled_for`/`sent_at` are each required iff `status` matches. |
| `reports.ai_usage_counters` | `id, tenant_id, usage_date, calls_used` | One row per tenant per day, lazily created. Unique `(tenant_id, usage_date)`. |

7 indexes total: `ai_report_batches_tenant_idx`, `ai_report_batches_
created_by_idx`; `ai_report_drafts_tenant_idx`, `_batch_idx`, `_child_idx`,
plus two partial indexes matching the exact predicates guardian-read and
scheduled-sweep each use (`_sent_idx` on `status='sent'`, `_scheduled_idx`
on `status='scheduled'`); `ai_usage_counters_tenant_idx`.

---

## 4. Enums created

| Enum | Values |
|---|---|
| `reports.report_type` | `monthly_progress`, `subject_report`, `behavior_social`, `attendance_summary` |
| `reports.report_scope` | `classroom`, `children` |
| `reports.report_draft_status` | `draft`, `ready`, `scheduled`, `sent` |
| `reports.delivery_channel` | `app`, `whatsapp`, `email` |

---

## 5. Constraints

- `ai_report_batches_scope_classroom_id_check` — `scope='classroom'` requires `classroom_id`; `scope='children'` forbids it.
- `ai_report_drafts_scheduled_for_check` / `_sent_at_check` — each nullable column is non-null iff `status` matches the corresponding value.
- `ai_report_drafts.body` — `check (btrim(body) <> '')`.
- `ai_usage_counters_tenant_date_key` — unique `(tenant_id, usage_date)`.
- `ai_usage_counters.calls_used` — `check (calls_used >= 0)`.
- `tenancy.plan_catalog.ai_daily_call_cap` — `not null default 50 check (ai_daily_call_cap > 0)` (additive column, migration 3).

---

## 6. Triggers

| Trigger | Table | Fires | Purpose |
|---|---|---|---|
| `trg_ai_report_batches_consistency` | `ai_report_batches` | before insert/update | `classroom_id` (when present) and `created_by` must both belong to the batch's own `tenant_id`; child's classroom soft-delete is checked. |
| `trg_ai_report_drafts_consistency` | `ai_report_drafts` | before insert/update | `batch_id` and `child_id` must both belong to the draft's own `tenant_id`; child soft-delete is checked. |
| `trg_ai_report_drafts_updated_at` | `ai_report_drafts` | before update | Standard `public.set_updated_at()` (Epic 1, frozen, reused as-is). |

---

## 7. RLS policies

7 policies across the 3 new tables, `FORCE ROW LEVEL SECURITY` set on all
three:

| Table | Policy | Role | Scope |
|---|---|---|---|
| `ai_report_batches` | `ai_report_batches_select_manager` | manager | tenant-wide |
| `ai_report_batches` | `ai_report_batches_select_teacher` | teacher | own drafting requests only (`created_by = auth.uid()`) |
| `ai_report_drafts` | `ai_report_drafts_select_manager` | manager | tenant-wide |
| `ai_report_drafts` | `ai_report_drafts_select_teacher` | teacher | child's classroom is one the teacher coordinates (`current_staff_classroom_ids()`) |
| `ai_report_drafts` | `ai_report_drafts_select_guardian` | guardian | `status='sent'` only, own child only — the direct enforcement surface for the human-in-the-loop invariant |
| `ai_report_drafts` | `ai_report_drafts_update_manager` | manager | narrowed to `status IN ('draft','ready')` on both `USING` and `WITH CHECK` (EPIC_6_REVIEW.md M2 pattern) — a bare UPDATE can never reach `scheduled`/`sent` |
| `ai_usage_counters` | `ai_usage_counters_select_manager` | manager | tenant-wide, read-only |

No policy exists for reception, driver, or platform_admin on any of the
three tables — §12's AI Reports row grants them nothing, and §13.6's
platform_admin bypass list does not include the `reports` schema. **No
INSERT policy** exists on `ai_report_batches` or `ai_report_drafts` for any
role — both are created exclusively by the `ai-draft-report` Edge Function
(`service_role`), matching the established "no direct RLS write path
alongside a correctness-critical Edge Function" lesson
(EPIC_5_REVIEW.md H2, EPIC_6_REVIEW.md H1/H2). **No DELETE policy** exists
on `ai_report_drafts` for any role — deletion is exclusively via
`delete_report_draft`, which additionally enforces "never delete an
already-sent draft," a rule a bare RLS DELETE policy cannot express. **No
UPDATE policy exists for teacher at all** — a teacher's own drafts are
read-only once created; editing before send is a manager-only action.

---

## 8. Helper functions

No new RLS helper functions were needed — every policy above reuses
existing, frozen Epic 2 helpers (`public.current_tenant_id()`,
`public.current_role()`, `public.current_staff_classroom_ids()`,
`public.current_guardian_child_ids()`) unmodified.

### 8.1 Recurrence check — pre-existing gap in a frozen file, closed additively

While confirming every new Edge Function correctly surfaces structured RPC
errors (rather than collapsing to a generic 500), it became clear that
`backend/supabase/functions/_shared/rpcError.ts` — an **Epic 2** file
(`EPIC_2_REVIEW.md H1/M4` fix) that Deno-side parses an RPC's structured
`{code, human_message_en, human_message_ar}` DETAIL payload — had never been
updated with the `EXTERNAL_PAYMENT_GATEWAY_TIMEOUT`/`_FAILURE` (Epic 6),
`EXTERNAL_MEDIA_RELAY_FAILURE` (Epic 7), or `EXTERNAL_AI_QUOTA_EXCEEDED`
(Epic 8) codes in its `KNOWN_CODES` whitelist, even though every one of
those codes already existed in `_shared/errors.ts`'s own taxonomy. An
unrecognized code silently falls back to a generic `VALIDATION_FAILED`
(422) instead of the correct, specific code and status — meaning, in
practice, that if any Epic 6/7 Edge Function had ever routed an error
through this helper, the caller would have seen the wrong HTTP status and a
misleading generic message instead of e.g. a 429 quota error or a 502
payment-gateway failure.

Separately, `backend/src/lib/errors.ts` (Node-side) was missing
`EXTERNAL_MEDIA_RELAY_FAILURE` even though `_shared/errors.ts` (Deno-side)
already had it from Epic 7 — a one-sided taxonomy drift between the two
mirror files.

**Resolution, scoped correctly**: both gaps are pre-existing, and the
files are Epic 2/Epic 7 files respectively — per the explicit "never modify
Epic 1-7" instruction, no Epic 6/7 *behavior* was retroactively changed
(no Epic 6/7 Edge Function that doesn't already call `toAppError` was
edited to start doing so). Both taxonomy files were additively extended
(all four missing codes added to each `KNOWN_CODES` whitelist / `ErrorCode`
union) so that **this Epic's own** two new Edge Functions correctly surface
`EXTERNAL_AI_QUOTA_EXCEEDED` as a clean 429 rather than a generic 500 — the
direct implementation of §19's own Acceptance Criteria ("A tenant that
exceeds its daily AI-call cap receives a clean `EXTERNAL_AI_QUOTA_EXCEEDED`
error, not a silent failure or an uncapped bill"). The pre-existing gap in
Epic 6/7's own Edge Functions (none of which currently call `_shared/
rpcError.ts#toAppError` at all — they use a bare `if (error) throw error`)
is documented as a **Known Limitation** below rather than silently
retrofitted, since fixing it would mean editing frozen Epic 6/7 Edge
Function files.

---

## 9. RPCs

6 SQL functions, all `SECURITY DEFINER`, `SET search_path = ''`, every
table/function reference inside each fully schema-qualified:

| Function | Grant | Purpose |
|---|---|---|
| `reports.increment_ai_usage(p_tenant_id)` | `service_role` only | Atomic cap-check-and-increment (`INSERT...ON CONFLICT...DO UPDATE...RETURNING`), looks up the tenant's plan cap internally so there is no read-then-write race window. Raises `EXTERNAL_AI_QUOTA_EXCEEDED` (P0001) if the post-increment count exceeds the cap — the increment itself still happens (conservative, cost-safe: a rejected call still counts). |
| `public.send_report_draft(p_draft_id)` | `authenticated` (manager-only via internal role check) | Sole path from `draft`/`ready` to `sent`. Atomic guarded `UPDATE...WHERE status IN (...) RETURNING`, M1 `NOT_FOUND`/`STATE_ALREADY_PROCESSED` disambiguation, set-based guardian notification fan-out (filtering `deleted_at is null`, EPIC_5_REVIEW.md M2 lesson), audit log. |
| `public.schedule_report_draft(p_draft_id, p_scheduled_for)` | `authenticated` (manager-only) | Sole path from `draft`/`ready` to `scheduled`. Rejects a past `p_scheduled_for`. Same M1 pattern, audit log. Delivery happens later via the sweep. |
| `public.resend_report_draft(p_draft_id)` | `authenticated` (manager-only) | Re-fires the guardian notification for an already-`sent` draft only. Never mutates `status`/`sent_at`. Audit log. |
| `public.delete_report_draft(p_draft_id)` | `authenticated` (manager-only) | Hard-deletes a `draft`/`ready`/`scheduled` row. Refuses to delete a `sent` one (preserves delivered-report history, same judgment call §8 applies to every other historical record in this system). Audit log. |
| `public.export_report_draft(p_draft_id)` | `authenticated` (manager-only) | Enqueues a `jobs.background_job_queue` row (`job_type='ai_report_export'`) rather than rendering synchronously — mirrors `billing.enqueue_invoice_pdf_job`'s established enqueue-and-defer pattern. No status restriction. Audit log. |

**Idempotency-key decision** (documented, not silently skipped): none of
the five client-facing RPCs accepts a `p_idempotency_key`. This mirrors
Epic 7's own `create_camera` precedent (also no idempotency key) and is
deliberate: `send_report_draft`/`schedule_report_draft`'s own M1 atomic
status-guard already makes a client retry safe — a second call after a
successful first one returns `STATE_ALREADY_PROCESSED` rather than
double-sending, which is the same practical guarantee an idempotency key
would provide, without the extra column/lookup machinery. `resend_report_
draft` is explicitly a repeatable action by design (a manager may
legitimately want to resend more than once), so idempotency does not apply
to it at all.

---

## 10. Edge Functions

| Function | Auth | Behavior |
|---|---|---|
| `ai-polish-note` | teacher, JWT | `{rawText}` → `{polishedText, usedFallback}`. Calls `reports.increment_ai_usage` (service_role, via `toAppError`-wrapped RPC call). Calls `polishNoteWithLLM`; on any failure, falls back to a deterministic template (trim/capitalize/terminal-punctuation) and sets `usedFallback=true` — never fails the caller's request. No database write beyond the usage counter; persisting a polished note onto `academic.evaluations.note` uses the existing, frozen Epic 2 teacher RLS UPDATE path. |
| `ai-draft-report` | teacher or manager, JWT | Resolves `scope`/`type`/`topic`/`classroomId`/`childIds` from the request body. Re-verifies classroom/child tenant ownership server-side (never trusts a client-supplied child list). One `increment_ai_usage` call per batch (not per child). Computes `metrics` server-side from `academic.evaluations`/`academic.attendance_records` over a rolling 30-day window. childCount ≤ 10: drafts synchronously, per-child LLM call with per-child fallback, bulk-inserts all drafts, returns `{batchId, mode:'sync', drafts}` (201). childCount > 10: enqueues one `jobs.background_job_queue` row (`job_type='ai_report_batch_generation'`) and returns `{batchId, mode:'queued', childCount}` (202) immediately. |
| `_shared/llmProvider.ts` | n/a | `polishNoteWithLLM`/`draftReportWithLLM` — the only two functions a real vendor integration needs to change. `LLM_PROVIDER_SIMULATE_FAILURE=true` makes both throw unconditionally (the documented way to exercise the fallback path in staging, §20). |

---

## 11. Tests

**46 new Epic 8 tests, 438/438 total tests passing** (39 files):

- `tests/unit/reportsValidation.test.ts` — 19 tests: every schema's valid/invalid shapes, including the explicit "the schema itself rejects `status: 'sent'`/`'scheduled'`" tests that mirror `ai_report_drafts_update_manager`'s own narrowed `WITH CHECK`.
- `tests/unit/aiReportService.test.ts` — 17 tests: every role combination for every service method (manager/teacher/guardian/reception/platform_admin), confirming defense-in-depth role checks match the RLS matrix exactly (including the reception/platform_admin zero-access cases).
- `tests/unit/reportsApiRoutes.test.ts` — 10 tests: validation-then-delegate for every route handler.
- `tests/rls/epic8_rls_adversarial.sql` — 19 numbered test blocks (unexecuted per §1): cross-tenant isolation; guardian sent-only visibility (positive + negative, including a guardian with zero sent reports); teacher own-classroom visibility; manager tenant-wide SELECT; direct manager edit of a draft/ready row; the narrowed UPDATE policy silently rejecting a `status='sent'` write; `send_report_draft` (role check, success + notification fan-out, `STATE_ALREADY_PROCESSED`, `NOT_FOUND`); `resend_report_draft` (notification re-fire without mutating `sent_at`, `NOT_FOUND`); `delete_report_draft` (refuses a sent draft, succeeds on a draft, role check); `export_report_draft` (queues a job); the usage-cap boundary (exactly-at-cap succeeds, one-over-cap rejected with `EXTERNAL_AI_QUOTA_EXCEEDED`, the rejected call still increments the counter); both consistency triggers (cross-tenant batch/classroom, cross-tenant draft/child); `schedule_report_draft` (success, past-timestamp rejection) plus the scheduled sweep (transitions a due draft, notifies the guardian, idempotent re-run); platform_admin zero-bypass; and the "no direct INSERT path exists for any role, including manager" regression test.

Freeze-compliance verification (git-based, per the established methodology):
`git status --porcelain` shows **zero** migration files (`20260714*`
through `20260727*`) as modified (`M`) — every migration file, including
every Epic 1-7 one, is either untracked (never committed at all in this
sandbox's single-commit history) or, for this Epic's own six files, newly
created. The only modified (`M`) files are the four shared-plumbing files
listed in §2.4, each confirmed by `git diff` to contain purely additive
changes (new union members / new whitelist entries), matching the identical
pattern every prior Epic's own completion report documents.

---

## 12. Coverage

Every RPC, every RLS policy, and both consistency triggers have at least
one positive and one negative RLS test. Every service method has a role-
matrix test. Every validation schema has both an accept and a reject case
for each of its meaningful branches. Not covered (see §13): the two Edge
Functions' own runtime bodies (Deno-only, no local Deno test runner in this
sandbox — the same limitation as every prior Epic's Edge Functions), and
the two background-job payloads (`ai_report_batch_generation`,
`ai_report_export`) have no consumer to test against yet.

---

## 13. Known limitations

1. **No `ai_report_batch_generation`/`ai_report_export` job consumer
   exists yet.** Both are enqueued (batch-drafting for >10 children;
   report export) but nothing currently polls `jobs.background_job_queue`
   for either `job_type`. This mirrors every prior Epic's own first
   background job (`notification-dispatch`, Epic 4; `generate-invoice-pdf`,
   Epic 6) — the queue and enqueue side are correct and complete; the
   consumer is a deliberately deferred, separately-scoped piece of work.
2. **Epic 6/7 Edge Functions do not use `_shared/rpcError.ts`.** Per §8.1,
   this Epic closed the *whitelist* gap in the shared parsing helper but did
   not — and, per the freeze instruction, could not — retrofit Epic 6/7's
   own Edge Functions to actually call it. Any RPC error path in those
   Epics still collapses to a generic 500 rather than a specific code.
3. **LLM provider is fully stubbed**, per `BACKEND_EXECUTION_PLAN.md`
   Epic 8 §13's own explicit acknowledgment that real vendor selection is
   outside this document's scope. `polishNoteWithLLM`/`draftReportWithLLM`
   are the only two functions a real integration needs to change.
4. **`ai_report_drafts.metrics` is a point-in-time display snapshot**, not
   re-computed after the fact — if a child's evaluation/attendance data
   changes after a draft is generated, the draft's own `metrics` field does
   not retroactively update (by design, per §3.20's own explicit note).
5. **No pg_cron registration** for `reports.sweep_scheduled_report_drafts()`
   — pg_cron is not installed in the linked project (per
   `EPIC_7_DEPLOYMENT_AUDIT_FINAL.md §7`), so, matching every prior Epic's
   identical limitation, the function itself is complete and callable
   on-demand but no actual schedule entry exists.
6. **Not executed against a live database** — see §1.

---

## 14. Manual QA checklist

- [ ] Teacher calls `ai-polish-note` with a short raw note; response includes `polishedText` and `usedFallback=false` under normal provider conditions.
- [ ] Set `LLM_PROVIDER_SIMULATE_FAILURE=true`; same call now returns `usedFallback=true` with a non-empty `polishedText`, and the call still succeeds (200).
- [ ] Teacher calls `ai-draft-report` with `scope='classroom'` for a classroom with ≤10 children; response is `mode='sync'` (201) with one draft per child, each with sensible `metrics`.
- [ ] Same call for a classroom with >10 children; response is `mode='queued'` (202) with a `batchId` and correct `childCount`, and a `jobs.background_job_queue` row with `job_type='ai_report_batch_generation'` exists.
- [ ] A tenant at its `ai_daily_call_cap` gets a 429 `EXTERNAL_AI_QUOTA_EXCEEDED` on the next `ai-polish-note`/`ai-draft-report` call.
- [ ] Manager edits a `draft`-status report's body/delivery_channels directly (PATCH-equivalent), and it persists.
- [ ] Manager calls `send_report_draft`; guardian(s) of that child receive an in-app notification with `category='report_ready'` and can now see the report (previously invisible while `draft`).
- [ ] Manager calls `schedule_report_draft` with a future timestamp; draft shows `status='scheduled'`; guardian still cannot see it.
- [ ] Running `reports.sweep_scheduled_report_drafts()` once `scheduled_for` has passed transitions the draft to `sent` and notifies the guardian.
- [ ] Manager calls `resend_report_draft` on an already-sent report; a second notification fires; `sent_at` is unchanged.
- [ ] Manager attempts `delete_report_draft` on a sent report; rejected with `VALIDATION_FAILED`. Succeeds on a `draft`-status report.
- [ ] Manager calls `export_report_draft`; a `jobs.background_job_queue` row with `job_type='ai_report_export'` appears.
- [ ] Guardian never sees a `draft`/`ready`/`scheduled` report for their child under any circumstance, including via direct table access if RLS is exercised manually.
- [ ] Teacher (non-manager) attempts `send_report_draft`/`schedule_report_draft`/`resend_report_draft`/`delete_report_draft`/`export_report_draft`; every one is rejected with `PERM_ROLE_DENIED`.

---

## 15. Verification summary

| Check | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` | ✅ Zero errors |
| `vitest run` | ✅ 438/438 tests passing (39 files), including 46 new Epic 8 tests |
| SQL `$$`/paren balance (6 migrations + RLS test file) | ✅ All balanced |
| Epic 1-7 migration files modified | ✅ Zero (git-verified) |
| Frozen frontend files touched | ✅ Zero |
| New RPCs are `SECURITY DEFINER` + `SET search_path=''` + fully schema-qualified | ✅ Confirmed on all 6 new SQL functions |
| Set-based SQL (no per-row loops) | ✅ Confirmed in migrations 5 and 6 |
| No direct RLS INSERT path alongside a correctness-critical Edge Function | ✅ Confirmed (migration 4) and RLS-tested (Test 19) |
| No manager hard-delete of a sent/historical report | ✅ Enforced in `delete_report_draft`, RLS-tested (Test 10a) |
| Guardian sent-only visibility (§19 human-in-the-loop invariant) | ✅ RLS-tested positively and negatively (Test 2) |
| Usage-cap boundary (exactly-at-cap / one-over-cap) | ✅ RLS-tested (Test 12) |
| Project-wide recurrence check against Epic 2-7 defect classes | ✅ Performed; one pre-existing gap found and additively closed (§8.1), one gap documented as a Known Limitation (§13.2) |

**Epic 8 implementation complete. Stopping per instruction — Epic 9 not started.**
