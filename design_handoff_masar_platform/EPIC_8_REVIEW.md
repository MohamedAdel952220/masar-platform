# Epic 8 Review — AI Report Architecture

Scope: a production-grade architecture and security review of Epic 8 only
(the `reports` schema, its 6 migrations, the 2 AI Edge Functions plus
`_shared/llmProvider.ts`, the TypeScript application layer, and the test
suites). Reviewed against `BACKEND_ARCHITECTURE.md`, `BACKEND_EXECUTION_
PLAN.md`, and the established, frozen conventions of Epics 1-7 (including
every named defect class from `EPIC_2_REVIEW.md` through
`EPIC_7_REVIEW.md`). No code was modified in the production of this
document — this is analysis and static tracing only, cross-checked against
architecture-doc text (quoted verbatim where load-bearing) and precedent
files in the repository.

Method: every RLS policy, trigger, RPC, and Edge Function was traced by
hand against every role/path that can invoke it; every claim below cites
the specific file/line and the specific architecture-doc section or
frozen-epic precedent it is measured against. Where a gap exists in a
frozen (Epic 1-7) file that Epic 8 merely inherits or extends without
introducing new risk, it is noted as out of scope rather than raised as an
Epic 8 finding.

---

## Findings

### C1 — Missing per-classroom / per-student authorization check for teacher callers in `ai-draft-report` (broken access control / horizontal privilege escalation)

**Severity**: Critical

**Location**: `backend/supabase/functions/ai-draft-report/index.ts:87-160`

**Root cause**: The Edge Function's only authorization check for a teacher
caller is `requireRole(caller, ['teacher', 'manager'])` (line 88) — a
**role** check, not a **resource-scope** check. Both scope-resolution
branches then verify only that the target classroom/children belong to the
caller's **tenant**:

- `scope='classroom'` (lines 121-131): verifies `classroom.tenant_id ===
  caller.tenantId`. It never checks whether the calling teacher actually
  coordinates that classroom or teaches a subject in it.
- `scope='children'` (lines 148-159): verifies each child's `tenant_id ===
  caller.tenantId`. It never checks whether any of those children are in a
  classroom the calling teacher has any relationship to.

Every other teacher-facing surface in this codebase — including Epic 8's
own `ai_report_drafts_select_teacher` RLS policy
(`20260727000004_epic8_rls_policies.sql:62-73`) — scopes a teacher's access
through `public.current_staff_classroom_ids()`, the frozen Epic 2 helper
built specifically for this purpose (`EPIC_2_ARCHITECTURE_REVIEW.md
§14.4`). This Edge Function is the one place in Epic 8 that constructs
child-scoped data on a teacher's behalf and is also the one place that
omits the check.

**Risk**: A teacher account in Tenant A, classroom X can request an
AI-drafted report (`scope='classroom'`, any `classroomId` in the tenant, or
`scope='children'`, any `childId` in the tenant) for children in a
classroom they have no coordinating or teaching relationship to. The
response is returned directly in the Edge Function's own JSON body (`mode:
'sync'` returns the full `drafts` array at line 273) — so the exploit
succeeds even though the resulting `ai_report_drafts` rows would
subsequently be invisible to that teacher under
`ai_report_drafts_select_teacher`'s RLS on a follow-up read. This is a
genuine cross-classroom data-exposure and content-generation vector: the
requesting teacher receives AI-generated text about a child that is not
theirs, drawn from that child's real `evaluations`/`attendance_records`
data (§19's own "grounded in actual data, not hallucinating" design), and
the request consumes the tenant's shared daily AI-call budget
(`reports.ai_usage_counters`) doing it. §25's own named "content-quality/
liability risk" (AI content about a specific child) is explicitly the risk
this gap defeats — the human-in-the-loop protection this Epic is built
around governs *sending*, but this hole is upstream of that entirely, at
*generation* time, for the teacher role specifically.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §12 permission
matrix, AI Reports row: "Teacher: C (own students), R own." §19: "Report
drafting (Teacher App **per-student**...)" — the per-student framing
presumes the student is the teacher's own. §25's liability-risk framing.
Contrast with the already-correct sibling policy,
`ai_report_drafts_select_teacher` (migration 4), which does implement this
exact check via `current_staff_classroom_ids()`.

**Recommended fix**: Before resolving children in either scope branch, for
a `teacher`-role caller, additionally verify (server-side, via the same
`current_staff_classroom_ids()`-equivalent logic — e.g., querying
`academic.classrooms`/`academic.subjects` for `coordinator_staff_id =
caller.userId` or `teacher_staff_id = caller.userId`) that every resolved
classroom/child is within the teacher's own scope; reject with
`PERM_ROLE_DENIED`/`VALIDATION_FAILED` otherwise. A `manager` caller
remains tenant-wide per §12 and needs no additional check.

---

### H1 — No idempotency-key protection on `ai-draft-report`, `ai-polish-note`, or any of the 5 report-lifecycle RPCs

**Severity**: High

**Location**: `backend/supabase/functions/ai-draft-report/index.ts` (entire
file), `backend/supabase/functions/ai-polish-note/index.ts` (entire file),
`backend/supabase/migrations/20260727000005_epic8_rpc_functions.sql`
(`send_report_draft`, `schedule_report_draft`, `resend_report_draft`,
`delete_report_draft`, `export_report_draft`).

**Root cause**: `BACKEND_ARCHITECTURE.md:840` (§14.3) states the rule in
absolute terms: *"every mutating RPC/Edge Function above that isn't a
natural upsert-by-unique-key... accepts a client-generated
`idempotency_key` parameter and checks/writes `jobs.idempotency_keys`... as
its first action"* — with exactly one named exception,
`register_device_token`. §25.6 restates this as a hard guarantee: calling
the same mutating action twice with the same key must return the same
result without re-executing the write. The established mechanism already
exists and is used elsewhere in this codebase —
`backend/supabase/functions/_shared/idempotency.ts`'s `withIdempotency`/
`readIdempotencyKey`, consumed by `initiate-payment/index.ts:88-94` and
`enroll-child/index.ts:114-120`. None of Epic 8's seven mutating entry
points (2 Edge Functions + 5 RPCs) imports or calls this shared helper, and
none of the 5 RPCs accepts a `p_idempotency_key` parameter at all.

**Risk**: A client retry (flaky mobile network, a double-tap, a naive
client-side retry-on-timeout) against `ai-draft-report` creates a **second,
independent** `ai_report_batches` row with its own full set of
`ai_report_drafts`, and consumes the tenant's daily AI-call cap a second
time — silent duplicate cost and duplicate manager-facing content requiring
manual cleanup, with no server-side deduplication at any layer (there is
also no unique constraint on `(batch_id, child_id)` on `ai_report_drafts`
that could even partially mitigate this — see also the note under H2).
`resend_report_draft` is the most directly guardian-visible instance: it
has **no** natural single-fire guard at all (unlike `send_report_draft`/
`schedule_report_draft`, which happen to be partially protected by their
own atomic status-guard — see note below) — every retried/duplicated call
fires a fresh `comms.notifications` INSERT, so a flaky connection or an
impatient manager double-clicking "Resend" can spam a guardian with
multiple "new report available" notifications for the same report.
`export_report_draft` similarly enqueues a fresh, undeduplicated
`jobs.background_job_queue` row on every call.

**Partial mitigation acknowledged**: `send_report_draft` and
`schedule_report_draft` are individually protected against a
**successful-then-retried** double-fire by their own M1 atomic
status-guarded UPDATE (a retry after success returns
`STATE_ALREADY_PROCESSED` rather than re-sending) — this is real, but it is
not the same guarantee §25.6 specifies (replay the *same successful
response*, not a *different error*), and it does not extend to
`resend_report_draft` (deliberately repeatable, so the guard is absent by
design) or `delete_report_draft` (a second call returns `NOT_FOUND` rather
than a graceful idempotent no-op).

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §2.2, §14.3, §25.6;
`jobs.idempotency_keys` (§3.53.4,
`20260714000004_epic1_audit_and_idempotency.sql`); the working precedent in
`initiate-payment`/`enroll-child`.

**Recommended fix**: Wrap both Edge Functions' core logic in
`withIdempotency(...)` exactly as `initiate-payment`/`enroll-child` already
do, reading the key via `readIdempotencyKey(req)`. For the 5 RPCs, add a
`p_idempotency_key uuid` parameter and the `jobs.idempotency_keys`
check/write as the function's first action, per §14.3's own literal
prescription — or, if a deliberate, documented exception is intended
(mirroring the one named exception for `register_device_token`), that
decision needs to be made and recorded explicitly rather than left as a
silent omission, since the current state is a direct textual deviation
from an architecture rule stated without qualification for this Epic's
functions.

---

### H2 — No transaction boundary across the usage-increment → batch-insert → draft-insert/job-enqueue sequence in `ai-draft-report`

**Severity**: High

**Location**: `backend/supabase/functions/ai-draft-report/index.ts:170-270`

**Root cause**: The Edge Function performs four to five separate,
independently-committing REST calls in sequence: `increment_ai_usage`
(line 170), the `ai_report_batches` insert (line 173), then either the
`background_job_queue` insert (line 189) or the metrics queries + bulk
`ai_report_drafts` insert (lines 210-269). Each is its own PostgREST/RPC
round-trip with no enclosing transaction. This is exactly the class of
defect Epic 7's own C1 fix addressed for camera creation (`media.cameras` +
`media.camera_connections`) by routing the two-table write through a
single `SECURITY DEFINER` RPC (`public.create_camera`) for atomicity — a
precedent this Epic's own migration comments cite by name
(`20260727000005_epic8_rpc_functions.sql:322` references
`billing.enqueue_invoice_pdf_job`'s pattern, but that pattern is a
DB-internal trigger firing automatically and exactly once per row-insert
event, not a client-retriable multi-step Edge Function sequence — the
precedent is not actually equivalent here).

**Risk**: If the process crashes, times out, or the network drops between
steps, the following partial states are all reachable and unrecoverable
without manual intervention: (a) `increment_ai_usage` succeeds but the
batch insert fails (a validation edge case, e.g. a race where the
classroom/child was soft-deleted between the Edge Function's own resolution
query and the trigger's re-check) — the tenant is charged against its daily
cap for a call that produced zero output; (b) the batch insert succeeds but
the subsequent job-enqueue or draft-insert fails — an orphaned `ai_report_
batches` row exists with zero `ai_report_drafts`, visible to the requesting
teacher via `ai_report_batches_select_teacher` as a batch that silently
produced nothing, with no error surfaced anywhere after the fact and no
compensating action taken. Unlike §25.3's named saga/compensation pattern
for cross-system (Auth+DB, Payment+DB) operations, there is no
compensating step here at all for this same-system (Postgres-only)
multi-statement operation — nor is one strictly needed if the operation
were made atomic instead, exactly as Epic 7's `create_camera` was.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §25.3 (saga/
compensation framing, closest applicable rule);
`20260725000006_epic7_camera_rpc.sql`'s `create_camera` (the concrete
atomicity precedent for a "two-plus-table write from a manager/teacher
action" in this exact codebase).

**Recommended fix**: Fold the usage-increment, batch-insert, and (for the
sync path) draft-insert into a single `SECURITY DEFINER` RPC callable from
the Edge Function (or called by the RPC itself, with the Edge Function
providing only the LLM-generated bodies as input), so the whole sequence
commits or rolls back as one Postgres transaction. The async/job-enqueue
path can use the same RPC with a null draft-body list, enqueuing the job in
the same transaction as the batch row.

---

### M1 — `ai_report_drafts_update_manager` RLS policy does not pin `child_id`/`batch_id` as immutable, permitting draft retargeting via a direct REST call

**Severity**: Medium

**Location**:
`backend/supabase/migrations/20260727000004_epic8_rls_policies.sql:91-94`

**Root cause**: The policy's `WITH CHECK` clause constrains `tenant_id`,
`current_role()`, and `status`, but places no constraint on `child_id` or
`batch_id`. `reports.check_ai_report_draft_consistency()`
(`20260727000002_epic8_tables.sql:152-186`) fires on UPDATE and would
reject a `child_id` pointing outside the draft's own `tenant_id`, but does
**not** reject a `child_id` change to a *different, valid, same-tenant*
child. The application's own Node repository (`aiReportRepository.ts`'s
`updateDraft`) never constructs a patch containing `child_id`/`batch_id`,
so this gap is invisible through the intended API surface — but it is
directly reachable via a raw PostgREST call (e.g., the Supabase JS client
used directly from a frontend, bypassing the Node API layer entirely),
which is a documented, expected access pattern in this architecture (RLS,
not the Node layer, is the authoritative gate).

**Risk**: A manager (already the correct, intended role for this table's
only UPDATE policy) can retarget an existing `draft`/`ready` row —
including one that already contains AI-generated body text and metrics
describing Child A — onto Child B within the same tenant via a single
UPDATE, without regenerating either. If subsequently sent, Child B's
guardian receives a report whose body text and metrics were generated for,
and describe, a different child. This is a content-integrity/liability gap
(§25) reachable through the "Direct REST bypass" surface named explicitly
in this review's scope, not a tenant-isolation breach.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §19's data-grounding
guarantee ("grounded in actual data... not hallucinating"), which implicitly
assumes a draft's body/metrics stay attached to the child they were
generated for; §25 liability framing.

**Recommended fix**: Either narrow the `WITH CHECK` clause to additionally
require `child_id = ai_report_drafts.child_id` and `batch_id =
ai_report_drafts.batch_id` (comparing new against old, matching the
pattern already used elsewhere in this codebase for "field X may never
change via this policy"), or add an explicit trigger-level check rejecting
a `child_id`/`batch_id` change on UPDATE.

---

### M2 — No upper bound on `ai-draft-report`'s batch size (`childIds` array length / classroom size)

**Severity**: Medium

**Location**: `backend/supabase/functions/ai-draft-report/index.ts:112-164`

**Root cause**: Both scope-resolution branches accept and process an
arbitrarily large child set — `scope='children'` deduplicates
`body.childIds` (line 143) but never caps its length before querying and
processing it; `scope='classroom'` resolves every non-deleted child in the
target classroom with no cap either. `SYNC_BATCH_THRESHOLD` (line 34) only
decides *routing* (sync vs. background job), not a hard maximum — an
arbitrarily large `childIds` array (or an arbitrarily large classroom) is
accepted and enqueued as a single background job with an unbounded
`childIds` payload.

**Risk**: A caller (malicious, buggy client, or compromised account) can
submit an extremely large `childIds` array in one request. On the sync
path this means an unbounded number of concurrent LLM calls and a single
unbounded multi-row INSERT; on the async path it produces one background
job whose payload and eventual processing cost are unbounded, with no
consumer yet built to observe or reject an unreasonable size (§13's own
Known Limitation already flags the missing consumer, but not this
compounding sizing gap). This matches the "missing validation" /
"performance regressions" defect classes named in this review's scope.

**Architecture reference**: §19's own batch-threshold framing implies a
bounded, human-scale batch ("a small threshold (e.g., >10 children)")
rather than an unbounded one; no explicit maximum is stated in either
architecture document, which is itself the gap.

**Recommended fix**: Add an explicit `MAX_BATCH_SIZE` (e.g., a few hundred,
matching a realistic maximum classroom/tenant roster size) and reject
requests exceeding it with `VALIDATION_FAILED`, on both scope branches.

---

### M3 — `ai_report_drafts.edited_by` is a named schema field that no code path ever populates

**Severity**: Medium

**Location**:
`backend/supabase/migrations/20260727000002_epic8_tables.sql:53`
(column definition); `backend/src/repositories/aiReportRepository.ts`'s
`updateDraft` (never sets it); no RPC in
`20260727000005_epic8_rpc_functions.sql` sets it either.

**Root cause**: `BACKEND_ARCHITECTURE.md:306` (§3.20) explicitly names
`edited_by staff_id nullable` as one of `ai_report_drafts`'s fields — a
column meant to record which manager last edited an AI-drafted report
before it was sent/scheduled. The migration correctly creates the column
(with its own FK to `identity.staff_profiles`), but nothing in Epic 8's
application layer, repository, or RPCs ever writes to it — the pre-send
manager edit path (`updateDraft`, a direct RLS UPDATE) patches only `body`,
`delivery_channels`, and `status`.

**Risk**: Not a security defect, but a data-completeness gap directly
undermining the traceability/attribution purpose this column exists for —
there is no record of which manager (if any) reviewed or edited an
AI-drafted report's content before it reached a guardian, which is
precisely the kind of accountability signal §25's liability framing would
want available for a "who approved this AI-authored content" audit.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §3.20 (field is
explicitly named in the spec, not an inferred/optional addition).

**Recommended fix**: Have `updateDraft`'s patch include `edited_by:
callerId` whenever `body` or `delivery_channels` changes.

---

### M4 — Neither AI Edge Function writes an audit-log entry for the AI-generation event itself

**Severity**: Medium

**Location**: `backend/supabase/functions/ai-polish-note/index.ts`,
`backend/supabase/functions/ai-draft-report/index.ts` — neither calls
`write_audit_log` anywhere.

**Root cause**: Every one of the 5 lifecycle RPCs in migration 5 calls
`public.write_audit_log(...)` for its own state transition, matching §23's
"audit log calls for every report-lifecycle state change" convention — but
the two events that actually *create* AI-generated content (a note being
polished; a batch of report drafts being generated) are never logged at
all. Comparable Epic 1-7 mutating Edge Functions do write an audit entry
for their own primary action (e.g., `add-staff/index.ts:142-152` calls
`write_audit_log` for `added_staff`), establishing this as the expected
convention for a mutating Edge Function, not just for RPCs.

**Risk**: There is no record of who requested which piece of AI-generated
content, when, for which child(ren)/classroom, or how many times — directly
relevant to both cost accountability (which staff member is driving AI
spend) and the content-liability tracing §25 calls out by name for this
exact feature area. This gap also means Finding C1's exploit path (a
teacher generating content for a child outside their scope) would leave no
audit trail at all, compounding that finding's severity in practice.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §23 (audit logging
convention); `add-staff/index.ts`'s established Edge-Function-level
precedent.

**Recommended fix**: Have `ai-polish-note` write an audit entry (e.g.,
action `note_polished`) after a successful call, and `ai-draft-report`
write one (e.g., action `ai_report_batch_created`) after the batch row is
created, targeting the batch id.

---

### L1 — Zero automated test coverage of either Edge Function's authorization logic

**Severity**: Low

**Location**: `tests/unit/*.test.ts` (no Deno test harness exists for
`ai-polish-note`/`ai-draft-report`); `tests/rls/epic8_rls_adversarial.sql`
exercises RLS/RPCs/triggers only, never the Edge Functions' own request
handling.

**Root cause**: This sandbox has no Deno test runner wired up for Edge
Functions, a limitation shared with every prior Epic's own Edge Functions
(explicitly documented in each prior Epic's completion report) — so no
automated test exists (or could easily have existed) to catch Finding C1
before it reached this review.

**Risk**: Structural blind spot, not a runtime defect on its own — but it
is the direct reason C1 shipped undetected through the unit-test and
RLS-test safety nets, since both are structurally incapable of exercising
Edge-Function-only authorization logic.

**Architecture reference**: N/A — sandbox/tooling limitation, consistent
with every prior Epic.

**Recommended fix**: Out of this Epic's scope to resolve (no Deno test
runner available), but worth flagging as a standing gap: any authorization
logic that lives *only* inside an Edge Function (rather than being RLS- or
RPC-enforced) is currently untestable in this environment and should be
treated as higher-risk by default for that reason alone.

---

### L2 — `export_report_draft`'s enqueued job has no consumer or `storage_objects` placeholder reservation

**Severity**: Low (informational — inherited parity with an already-documented Epic 6 limitation, not a new regression)

**Location**: `public.export_report_draft`
(`20260727000005_epic8_rpc_functions.sql:330-368`).

**Root cause**: The RPC enqueues a `jobs.background_job_queue` row
(`job_type='ai_report_export'`) but never creates a `storage_objects`
placeholder row reserving the eventual PDF's tenant-prefixed path in the
`generated-documents` bucket (§21's stated convention: "no client ever
constructs a Storage path itself... upload flows always go through an
RPC/Edge Function that returns a pre-signed... path"). This exactly mirrors
`billing.enqueue_invoice_pdf_job`'s own identical gap (Epic 6, frozen,
already documented as a Known Limitation there).

**Risk**: None beyond what Epic 6 already accepted for its own equivalent
feature — noted here only for completeness, since no consumer exists yet
for either job type in this codebase to actually exercise the gap.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §21.

**Recommended fix**: Address alongside the (not-yet-built) job consumer for
both `ai_report_export` and `invoice_pdf_generation` together, since the
correct pattern is identical for both.

---

### L3 — Unbounded concurrent LLM calls within a single synchronous batch

**Severity**: Low

**Location**: `backend/supabase/functions/ai-draft-report/index.ts:244-263`
(`Promise.all` over up to `SYNC_BATCH_THRESHOLD` = 10 children).

**Root cause**: The sync path fires one `draftReportWithLLM` call per child
concurrently via `Promise.all`, with no concurrency cap or staggering.
Harmless against the current stub (§13's documented limitation — no real
vendor wired up yet), but §26's own framing ("iterate children, call LLM
per child") doesn't specify concurrent vs. sequential, and a real LLM
provider integration is likely to have its own per-tenant/per-key rate
limits that 10 simultaneous requests could trip.

**Risk**: Low today (stub only); becomes a real operational risk once a
real provider is wired in, potentially causing spurious `draftReportWithLLM`
failures (and therefore unnecessary fallback-template usage, or provider-side
rate-limit errors) purely from self-inflicted concurrency, not actual
provider unavailability.

**Architecture reference**: §19's fallback-template guarantee; §26.

**Recommended fix**: When a real provider is integrated, consider a small
concurrency cap (e.g., 3-5 in flight) rather than firing the full batch at
once — not urgent while the provider remains stubbed.

---

## Summary

### Critical findings
- **C1** — Missing per-classroom/per-student authorization check for teacher callers in `ai-draft-report` (broken access control, horizontal privilege escalation within tenant).

### High findings
- **H1** — No idempotency-key protection on `ai-draft-report`, `ai-polish-note`, or any of the 5 report-lifecycle RPCs, violating §14.3/§25.6's universal mandate.
- **H2** — No transaction boundary across the usage-increment → batch-insert → draft-insert/job-enqueue sequence in `ai-draft-report`; partial failures produce charged-but-empty or orphaned rows with no compensating action.

### Medium findings
- **M1** — `ai_report_drafts_update_manager` RLS policy permits `child_id`/`batch_id` retargeting via a direct REST call, bypassing the Node API's implicit protection.
- **M2** — No upper bound on `ai-draft-report`'s resolved batch size (`childIds` array / classroom size).
- **M3** — `ai_report_drafts.edited_by`, a field explicitly named in §3.20, is never populated by any code path.
- **M4** — Neither AI Edge Function writes an audit-log entry for its own primary action, unlike comparable sibling Edge Functions.

### Low findings
- **L1** — Zero automated test coverage of either Edge Function's authorization logic (structural sandbox limitation; directly relevant to why C1 went undetected).
- **L2** — `export_report_draft`'s job has no consumer or storage placeholder — informational, inherited parity with Epic 6's own identical, already-documented limitation.
- **L3** — Unbounded concurrency in the sync batch's LLM calls — immaterial against the current stub, relevant once a real provider is integrated.
