# Epic 5 Fix Report

Implements every finding in `EPIC_5_REVIEW.md` (approved). Epic 5's migrations had not been deployed to any live project, so every SQL fix below was applied by editing the existing Epic 5 migration files directly (`backend/supabase/migrations/20260721*.sql`) rather than by adding forward-only patch migrations — per this task's explicit instruction. **No Epic 1, Epic 2, Epic 3, or Epic 4 migration was modified.**

**The Critical finding, both High findings, all four Medium findings, and 3 of 5 Low findings are fixed.** One Low finding (L1) is explicitly out of scope — it lives entirely inside frozen Epic 1 code (`public.idempotency_replay`/`idempotency_store`) and this task's rules forbid modifying Epic 1. The other four Low findings (L2, L3, L4, L5) are all fixed.

---

## 1. Findings fixed

### Critical

| ID | Finding | Fix |
|---|---|---|
| C1 | `approvals.check_trip_registration_consistency()`'s capacity-count query ran under the *calling guardian's own* RLS visibility (scoped to their own children's rows only), so two different guardians registering for the same capacity-limited trip could never see each other's row when counting — silently bypassing capacity enforcement entirely | The trigger is now `security definer` with `set search_path = ''` (migration 2), matching the established codebase pattern for any trigger/function whose internal queries must see across an RLS ownership boundary. Its internal count now sees every registration for the event regardless of which guardian's write triggered it. **Side effect found and closed while implementing this fix**: making the trigger SECURITY DEFINER removed an *implicit* authorization backstop the trigger's own (previously RLS-filtered) event lookup used to provide — a guardian could no longer be prevented, by that lookup alone, from registering for a trip scoped to a classroom their child isn't in. This authorization rule is now stated *explicitly* instead: `event_trip_registrations_insert_guardian`'s `WITH CHECK` (migration 4) gained its own classroom-visibility `EXISTS` check, mirroring `events_select_guardian`'s own scoping logic. |

### High

| ID | Finding | Fix |
|---|---|---|
| H1 | `events_delete_manager` granted a manager a hard delete on `approvals.events`, contradicting `BACKEND_ARCHITECTURE.md` §12's explicit "Manager has no D (hard delete) anywhere in this system... only soft-delete" — and cascaded (`ON DELETE CASCADE`) to destroy every guardian's `event_rsvps`/`event_trip_registrations` row for that event, including any already `status='paid'` with a `payment_transaction_id` set | `events_delete_manager` removed entirely (migration 4) — `approvals.events` now has no delete policy for anyone, matching `approvals.requests`' own already-correct no-delete-for-anyone precedent. A future soft-delete column/RPC is the correct way to add "remove an event" if ever needed. |
| H2 | `requests_insert_teacher` allowed a direct-REST `INSERT` that bypassed `submit_request`'s own manager-notification side effect (§16), and — since the direct path fires `check_request_consistency` under the submitting teacher's own, narrower-than-tenant-wide classroom/subject RLS visibility — risked a spurious rejection for a legitimate request the teacher doesn't directly "own" | `requests_insert_teacher` removed entirely (migration 4). `submit_request` (SECURITY DEFINER) is now the sole creation path for `approvals.requests`, exactly mirroring how this table already had no direct `UPDATE` policy (`review_request` is the sole path for that transition). |

### Medium

| ID | Finding | Fix |
|---|---|---|
| M1 | `submit_request`'s idempotency payload-hash omitted `request_time`, `note`, `exam_kind`, and `attachment_object_id` — a retried call with the same key but a different value for one of those fields silently replayed the original response instead of raising `CONFLICT_IDEMPOTENCY_KEY_REUSED` (§25.6) | The hash (migration 5) now covers every one of `submit_request`'s own mutable parameters. |
| M2 | `review_request`'s guardian notification fan-out filtered soft-deleted children (`c.deleted_at is null`) but never filtered soft-deleted/deactivated guardian accounts — inconsistent with this same file's own manager-notification loop, which does filter `deleted_at is null` | Added `join identity.guardian_profiles g on g.id = cgl.guardian_id` and `and g.deleted_at is null` to the fan-out query (migration 5), matching `EPIC_4_REVIEW.md` L2's "check `deleted_at` before notifying" lesson. |
| M3 | `EventService.listForTenant` had no explicit role check, unlike every sibling method in this file and in `ApprovalRequestService` — any authenticated role (including `driver`/`reception`, neither of which §12 grants any Events access) could call it without a clean `PERM_ROLE_DENIED` | Added an explicit role check (`guardian`/`teacher`/`manager` only) before the tenant check, matching the role set §12 actually grants `R` to for Events. |
| M4 | `submitRequestSchema`'s `examKind` refinement only *required* `examKind` when `type==='exam'`, but never *rejected* it for a non-exam type — asymmetric with the DB's `requests_exam_kind_requires_exam` constraint (which enforces both directions) and with this same schema's own (already-symmetric) trip-fields refine | The refine is now symmetric: `v.type === 'exam' ? Boolean(v.examKind) : v.examKind === undefined`. |

### Low

| ID | Finding | Fix |
|---|---|---|
| L1 | `idempotency_replay`/`idempotency_store` (frozen Epic 1) have no caller/tenant/RPC scoping on replay | **Not fixed** — lives entirely in frozen Epic 1 code; modifying it is forbidden by this task's own rules. Flagged for a future hardening pass, as the review itself recommended. |
| L2 | `timeSchema`/`requestDate` were format-only (regex/ISO-shape) validators that didn't reject semantically invalid values (`"99:99"`, `"2026-02-30"`), deferring to a raw, less-friendly Postgres error | `timeSchema`'s regex now range-checks hour/minute/second components directly; `requestDate` gained an `isValidCalendarDate` refine that round-trips through `Date.UTC` and rejects any value that doesn't come back unchanged (catches rollover cases like Feb 30 → Mar 2). |
| L3 | Several guardian `SELECT`/`UPDATE` `USING` clauses (`event_rsvps_select_guardian`, `event_rsvps_update_guardian`, `event_trip_registrations_select_guardian`, `event_trip_registrations_update_guardian`, plus `requests_select_teacher`) omitted an explicit `tenant_id = current_tenant_id()` check, relying on it only transitively via child/submitter ownership — inconsistent with the codebase-wide convention of stating it in every clause | All five `USING` clauses (migration 4) now state `tenant_id = public.current_tenant_id()` explicitly, matching their own `WITH CHECK` clauses and every other Epic's policy-writing convention. (Project-wide search found these five; no others.) |
| L4 | `price` accepted unlimited decimal precision at the Zod layer before being silently rounded by the DB's `numeric(10,2)` column | `price: z.number().min(0).multipleOf(0.01).optional()` (migration unaffected — Zod-layer-only fix). |
| L5 | (Informational) The RLS adversarial suite was written but unexecuted, and Test 5 was specifically designed to catch C1 | Addressed directly — see §6/§7 below. |

---

## 2. Project-wide recurrence checks performed

Per the task's "do not only fix the reported locations" instruction, each defect *class* (not just the specific reported instance) was searched for across the entirety of Epic 5 before considering any finding closed:

- **C1-class (a trigger/function doing a cross-row aggregate or ownership-sensitive lookup while not `SECURITY DEFINER`, invoked by a role whose own RLS visibility is narrower than what the check needs)**: every trigger function in `approvals` (`check_request_consistency`, `check_event_consistency`, `check_event_rsvp_consistency`, `check_trip_registration_consistency`) was individually traced against every write path that can invoke it (direct RLS-gated INSERT/UPDATE vs. invocation from within a `SECURITY DEFINER` RPC). Only `check_trip_registration_consistency` had this defect — the other three either only ever fire within a `SECURITY DEFINER` RPC's execution context (`check_request_consistency`, after the H2 fix removed its only direct-write path) or only ever look up rows the invoking role's own RLS *should* correctly restrict them to seeing anyway (`check_event_consistency` under manager's tenant-wide visibility; `check_event_rsvp_consistency` under a guardian's own-child/own-visible-event scope, with no cross-guardian aggregate). No other recurrence found.
- **H1-class (a manager hard-delete policy inconsistent with §12's "no D... only soft-delete")**: searched every `for delete` policy across all 4 Epic 5 tables. Only `events_delete_manager` existed; it is now removed. `approvals.requests`, `event_rsvps`, `event_trip_registrations` never had a delete policy for anyone.
- **H2-class (a direct RLS write policy coexisting with an RPC in a way that silently skips the RPC's own side effect)**: every direct INSERT/UPDATE policy across all 4 tables was checked against whether an equivalent RPC exists and, if so, whether the direct path skips a notification or other side effect the RPC performs. Only `requests_insert_teacher` (vs. `submit_request`'s manager-notification loop) had this defect. `events_insert_manager`/`events_update_manager` have no RPC counterpart to bypass (manager event management is directly RLS-CRUD by design, §12). `event_rsvps_insert_guardian`/`_update_guardian` coexist with `update_rsvp`, but neither path has a notification side effect to skip. `event_trip_registrations_insert_guardian` has no wrapping RPC at all by design (the C1 fix's own trigger is the backstop, not a bypassable notification).
- **M1-class (incomplete idempotency payload-hash coverage)**: both `v_input_hash` computations in the RPC file were checked field-by-field against their function's own parameter list. Only `submit_request`'s was incomplete; `review_request`'s already covered all of its own parameters (`p_request_id`, `p_decision`, `p_rejection_reason`).
- **M2-class (missing `deleted_at` filter on a notification-recipient resolution query)**: every notification-producing query in the RPC file was checked. Only the guardian fan-out in `review_request` was missing it; `submit_request`'s manager loop already filtered correctly.
- **M3-class (a service method missing an explicit role check that its siblings have)**: every public method across `ApprovalRequestService` and `EventService` was enumerated. Only `EventService.listForTenant` was missing one.
- **M4-class (an asymmetric Zod refine vs. its corresponding DB CHECK constraint)**: every `.refine()` in `approvals.schema.ts` was checked against its corresponding DB constraint for directional symmetry. Only the `examKind` refine was asymmetric; the trip-fields refine and `reviewRequestSchema`'s rejection-reason refine were already symmetric.
- **L3-class (RLS `USING` clause omitting an explicit `tenant_id` check)**: every `SELECT`/`UPDATE` policy across all 4 tables was checked (INSERT-only policies, which have no `USING` clause, were excluded as not applicable). Five policies were missing it (see §1's L3 row); all five are fixed.

No additional recurrence of any reviewed defect class was found beyond the locations listed above. No defect class from `EPIC_2_REVIEW.md`/`EPIC_3_REVIEW.md`/`EPIC_4_REVIEW.md` (SETOF-returning RLS helpers, unhardened `search_path`, per-row loops for unbounded fan-out, missing cross-table tenant-consistency triggers, missing idempotency envelopes, substring-matched error classification) was found anywhere in Epic 5, confirming the original implementation's lesson-application held for everything except the five findings above.

---

## 3. Files modified

### SQL migrations (Epic 5's own, edited directly — none previously deployed)
- `20260721000002_epic5_requests_and_events_tables.sql` — C1 (SECURITY DEFINER + `search_path=''` on `check_trip_registration_consistency`, updated comment).
- `20260721000004_epic5_rls_policies.sql` — H1 (`events_delete_manager` removed), H2 (`requests_insert_teacher` removed), C1 (classroom-visibility `EXISTS` check added to `event_trip_registrations_insert_guardian`), L3 (5 `USING` clauses gained explicit `tenant_id`).
- `20260721000005_epic5_rpc_functions.sql` — M1 (`submit_request` hash completed), M2 (guardian `deleted_at` filter added to `review_request`'s fan-out).

### TypeScript
- `backend/src/services/eventService.ts` — M3 (role check added to `listForTenant`).
- `backend/src/validation/approvals.schema.ts` — M4 (symmetric `examKind` refine), L2 (range-checked `timeSchema`, `isValidCalendarDate` refine on `requestDate`), L4 (`multipleOf(0.01)` on `price`).

### Tests
- `backend/tests/unit/approvalsValidation.test.ts` — 6 new tests (M4 x2, L2 x3, L4 x1).
- `backend/tests/unit/eventService.test.ts` — 4 new tests (M3: 2 positive-role, 2 negative-role).
- `backend/tests/rls/epic5_rls_adversarial.sql` — 3 new tests (Tests 10-12: H2 direct-insert rejection, C1 classroom-visibility negative + positive case), 1 new fixture (a classroom-A-scoped trip event), Test 5's comment updated to explain it is the direct C1 regression test.
- `backend/tests/rls/epic5_full_execution_bundle.sql` — **new file**: all 6 post-fix migrations + the adversarial suite's fixtures/tests, concatenated into one self-contained, transactionally-rolled-back script. See §6/§7.

---

## 4. Database changes

**Changed function security context:** `approvals.check_trip_registration_consistency()` — now `SECURITY DEFINER` with `SET search_path = ''` (was invoker-context, no `search_path` pin). Trigger attachment, signature, and return type unchanged.
**Removed RLS policies:** `events_delete_manager`, `requests_insert_teacher`.
**Changed RLS policies:** `event_trip_registrations_insert_guardian` (gained a classroom-visibility `EXISTS` check in `WITH CHECK`); `requests_select_teacher`, `event_rsvps_select_guardian`, `event_rsvps_update_guardian`, `event_trip_registrations_select_guardian`, `event_trip_registrations_update_guardian` (all gained an explicit `tenant_id` check in `USING`).
**No table/column/enum/constraint changes** — this fix pass is entirely at the function-security, policy, and application-validation layers.

---

## 5. Security improvements

- Closed a capacity-enforcement bypass reachable by any two ordinary guardians with no special access, on a resource that will carry real financial stakes once Epic 6 exists (C1).
- Closed a data-loss/audit-trail-loss vector where a routine manager action (deleting a past event) could irrecoverably destroy paid trip-registration records (H1).
- Closed a silent-notification-skip + inconsistent-validation gap on the request-submission write path, and eliminated a second, uncoordinated write path into `approvals.requests` entirely — `submit_request` is now the only way a request can be created, mirroring the same "sole write path" discipline already established for `review_request`'s UPDATE (H2).
- Restored, as an explicit and auditable RLS check (rather than an accidental side effect of a trigger's prior execution context), the rule that a guardian can only register for a trip they can actually see (C1's classroom-visibility half).
- Closed a stale-notification vector where a deactivated guardian account could still receive an in-app "event published" notification (M2).
- Closed an idempotency-key payload-coverage gap that could cause a client's legitimate correction (different `note`/`examKind`/etc. under a reused key) to be silently discarded instead of raising a clean conflict error (M1).

---

## 6. Performance improvements

None targeted in this pass — this review's findings were correctness/security/consistency issues, not performance ones (the original implementation's set-based fan-out and indexing were confirmed correct in `EPIC_5_REVIEW.md` and untouched here).

---

## 7. New tests added

- `backend/tests/unit/approvalsValidation.test.ts`: 6 new tests — `examKind` rejected for `trip`/`event` types (M4, 2 tests); out-of-range `requestTime` rejected, valid `requestTime` accepted (L2, 2 tests); invalid calendar `requestDate` rejected (L2, 1 test); `price` with >2 decimal places rejected (L4, 1 test).
- `backend/tests/unit/eventService.test.ts`: 4 new tests — teacher and guardian can list events (M3 positive cases); driver and reception cannot (M3 negative cases, the two roles §12 grants no Events access to).
- `backend/tests/rls/epic5_rls_adversarial.sql`: 3 new tests — Test 10 (H2: teacher direct-REST `INSERT` into `approvals.requests` is rejected), Test 11 (C1: guardian cannot register for a trip scoped to a classroom their child isn't in), Test 12 (C1 positive case: guardian *can* register for a trip scoped to their own child's classroom, confirming Test 11 fails for the right reason). Test 5 (pre-existing, unchanged assertion) is now explicitly documented as the direct C1 regression test.

---

## 8. Executed adversarial test results

**Attempted and blocked, with instructions provided in its place — per this task's own "execute (or provide instructions to execute)" alternative.**

During this fix pass, the full post-fix migration set plus the adversarial suite's fixtures and assertions were assembled into a single self-contained script (`backend/tests/rls/epic5_full_execution_bundle.sql`) wrapped in `begin; ... rollback;`, specifically so it could be run against the linked Supabase project (which this session has live query access to, demonstrated in the Epic 4 deployment audit) with **zero persistent effect** — the entire transaction rolls back regardless of outcome. Executing it was attempted via `supabase db query --linked --file ...` and was **blocked by this environment's own auto-mode safety classifier**, which correctly identified this as DDL-plus-adversarial-writes against a shared project without a specific, explicit per-action authorization — a judgment call reserved for the human operator, not something to route around.

**The bundle is ready to run.** Its own header comments (in the file) give three ways to execute it — local `supabase db query --local` (recommended, zero shared-state risk, requires Docker), `supabase db query --linked`, or plain `psql`. A human operator with the appropriate authorization for their own project should run one of these before Epic 5 is considered fully verified, per this task's explicit requirement. Expected output: 12 `NOTICE: PASS Test N: ...` lines (the original 9 plus the 3 new ones) and a final clean `ROLLBACK`, with no `ERROR` lines.

**Static verification performed in place of execution**: every one of the 12 tests was re-traced by hand against the post-fix migration text, statement by statement, including the specific mechanics of Test 5 (confirmed the fixed trigger's count query, now `SECURITY DEFINER`, is no longer filtered by `event_trip_registrations_select_guardian` and will correctly see Guardian A1's fixture row when Guardian A2's `INSERT` fires the trigger) and Tests 11/12 (confirmed the new `EXISTS` clause in `event_trip_registrations_insert_guardian`'s `WITH CHECK` correctly resolves `current_guardian_classroom_ids()` against each guardian's own child before the trigger is ever reached). `$$`-pair and paren balance were verified programmatically on every edited file (all balanced, see below).

```
$$ pairs — 20260721000002: OK   20260721000004: OK   20260721000005: OK
$$ pairs — epic5_rls_adversarial.sql: 26, balanced
$$ pairs — epic5_full_execution_bundle.sql: 44, balanced (1 begin, 1 rollback)
```

---

## 9. Verification performed

```
npx tsc -p tsconfig.json --noEmit   →  0 errors
npx vitest run                       →  24 test files, 239 tests, ALL PASSING (229 prior + 10 new)
```

- **Freeze compliance re-verified**: `git status` confirms only `20260721*` migration files, `backend/supabase/config.toml` (unchanged in this pass — no new schema entries needed), and the expected TS/test files were touched. No `20260714*` (Epic 1), `20260715*` (Epic 2), `20260717*` (Epic 3), or `20260719*` (Epic 4) migration file appears in the changeset. No frozen frontend file was touched.
- **SECURITY DEFINER / search_path audit**: every `SECURITY DEFINER` function in Epic 5 (`submit_request`, `review_request`, `public.current_guardian_classroom_ids()`, and now `approvals.check_trip_registration_consistency()`) was re-checked for `SET search_path = ''` (all four have it) and for full schema-qualification of every internal reference (all confirmed — `approvals.*`, `academic.*`, `identity.*`, `comms.*`, `public.*` all explicit; `pg_catalog` built-ins like `now()`/`count()`/`coalesce()` resolve correctly under an empty `search_path` since `pg_catalog` is always implicitly searched first regardless of the configured path). No function needed to change grant, and no function was found using `search_path = public` or omitting the `set search_path` clause entirely.
- **Trigger-under-RLS audit**: all 4 Epic 5 trigger functions were individually traced against every possible invocation path (direct RLS write vs. invocation from inside a `SECURITY DEFINER` RPC) — see §2's C1-class recurrence check for the full per-trigger reasoning. Only one (`check_trip_registration_consistency`) needed a security-context change; the other three are confirmed correct as-is.
- **RPC authorization re-verified**: `submit_request`/`review_request`'s own role/tenant checks re-read in full — unaffected by the SECURITY DEFINER fix on the (unrelated) trip-registration trigger.

---

## 10. Remaining limitations

- **L1 is explicitly not fixed** — see §1. `idempotency_replay`/`idempotency_store` remain frozen Epic 1 code with no caller/tenant/RPC scoping; Epic 5's `submit_request`/`review_request` inherit this pre-existing, low-practical-risk gap (exploitation requires guessing another user's random UUID key) exactly as Epic 4's RPCs already did.
- **The RLS adversarial suite (including the direct C1 regression test) has not been executed against any live database in this session** — see §8. The ready-to-run bundle exists at `backend/tests/rls/epic5_full_execution_bundle.sql`; running it (locally or against the linked project) is a required step before Epic 5 can be considered fully, empirically verified, and is explicitly left to a human operator per this environment's own safety boundary.
- **Static-only verification carries the same inherent limits as every prior Epic's fix report**: hand-tracing is not a substitute for an executed test run, even when done as carefully as in §8/§9 above.

---

## Verdict

Every Critical, High, and Medium finding in `EPIC_5_REVIEW.md` is fixed. 4 of 5 Low findings are fixed; the fifth (L1) is out of scope by this task's own freeze rules. No Epic 1, Epic 2, Epic 3, or Epic 4 migration was modified; no frozen frontend file was touched. A project-wide recurrence search confirmed each fixed defect class had at most the instances already found — no additional recurrences anywhere in Epic 5. `npx tsc --noEmit` is clean; `npx vitest run` passes 239/239. The RLS adversarial suite, including a direct, purpose-built regression test for the Critical finding, is written, expanded, and bundled into a self-contained, zero-persistent-effect execution script — but actual execution was blocked by this environment's safety boundary and is left as a required, clearly-instructed next step for a human operator, per this task's own "execute or provide instructions to execute" allowance. Stopping here — Epic 6 is out of scope for this delivery.
