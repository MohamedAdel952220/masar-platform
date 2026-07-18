# Epic 5 Completion Report — Approvals & Events

Scope: the `approvals` schema (`requests`, `events`, `event_rsvps`,
`event_trip_registrations`), the teacher-request → manager-approval →
published-event pipeline, guardian RSVP, and guardian trip registration.
Epic 1, Epic 2, Epic 3, and Epic 4 are frozen — every migration in this Epic
is purely additive (new schema, new tables, new functions, new policies, one
additive line in `config.toml`). **No Epic 1, Epic 2, Epic 3, or Epic 4
migration file was modified.** No frozen frontend file was touched.

Every lesson from the Epic 2/3/4 review/fix cycle is applied from the first
draft, not retrofitted later — see §8 for the full list with citations.

---

## 1. Environment reality check (read this first)

This session has live, read-only query access to the linked Supabase project
(via `supabase db query --linked`), which was used earlier in this session
to audit Epic 4's deployed state. **Deployment of Epic 5 was not performed**
— the user's instruction was to implement Epic 5 and report, not to deploy
it, and pushing new schema to a live project without an explicit deployment
request would be presumptuous. No local Docker/Postgres is available in this
sandbox either (`supabase db dump`/`db start` both fail with
`LegacyDockerRunError`), so there is no local database to run migrations
against as an alternative.

Consequently: every SQL-layer claim below is a **static** guarantee —
balanced `$$`/parens verified programmatically, naming/grant conventions
cross-checked against Epic 1-4's shipped migrations, and every RPC/trigger
body traced by hand against its own stated invariant. `npx tsc --noEmit` and
`npx vitest run` are real executions and both pass. `tests/rls/epic5_rls_adversarial.sql`
is written but **not executed** against any database, local or remote.

---

## 2. Files created

### 2.1 SQL migrations (6) — `backend/supabase/migrations/`

1. `20260721000001_epic5_approvals_schema.sql` — `approvals` schema; 6 enums.
2. `20260721000002_epic5_requests_and_events_tables.sql` — `requests`, `events`, `event_rsvps`, `event_trip_registrations` + 4 tenant/type-consistency triggers + 1 combined capacity/payment trigger.
3. `20260721000003_epic5_rls_helpers.sql` — `public.current_guardian_classroom_ids()`.
4. `20260721000004_epic5_rls_policies.sql` — 17 policies across all 4 tables.
5. `20260721000005_epic5_rpc_functions.sql` — `submit_request`, `review_request`, `update_rsvp`, `cancel_trip_registration`.
6. `20260721000006_epic5_storage_and_realtime.sql` — no new bucket/policy (reuses Epic 2's `academic-attachments`); 1 Realtime publication addition.

### 2.2 Application layer (8 new files) — `backend/src/`

- `types/database.types.epic5.ts`, `types/domain.epic5.ts`
- `validation/approvals.schema.ts`
- `repositories/approvalRequestRepository.ts`, `repositories/eventRepository.ts`
- `services/approvalRequestService.ts`, `services/eventService.ts`
- `api/routes/approvals.ts`

### 2.3 Tests (5 new files) — `backend/tests/`

- `unit/approvalsValidation.test.ts` (16 tests)
- `unit/approvalRequestService.test.ts` (10 tests)
- `unit/eventService.test.ts` (7 tests)
- `unit/approvalsApiRoutes.test.ts` (9 tests)
- `rls/epic5_rls_adversarial.sql` (9 numbered tests, 10 PASS assertions — not executed, §1)

### 2.4 Additive config change (not a new file)

`backend/supabase/config.toml` — `schemas` list gained `"approvals"`, the identical one-line pattern every prior Epic used.

No Edge Function was added — `BACKEND_EXECUTION_PLAN.md` Epic 5 §7 states "None new — this Epic is pure RPC/PostgREST," and that held exactly as written.

---

## 3. Tables created

| Table | Purpose | Notable columns |
|---|---|---|
| `approvals.requests` | Teacher-submitted, manager-reviewed request (event/trip/exam) | `attachment_object_id` — bare nullable `uuid`, no FK yet (`media.storage_objects` doesn't exist until Epic 7), matching the established `photo_object_id`/`id_photo_object_id` precedent (Epic 1/2/3) |
| `approvals.events` | Published, guardian-visible calendar entry | `classroom_id` nullable = whole-tenant event; `capacity` nullable = unlimited |
| `approvals.event_rsvps` | Guardian headcount confirmation | unique `(event_id, child_id)` — the row `update_rsvp` upserts into |
| `approvals.event_trip_registrations` | Guardian trip registration | `payment_transaction_id` — bare nullable `uuid`, no FK yet (`billing.payment_transactions` doesn't exist until Epic 6); unique `(event_id, child_id)` |

**Constraints:** `requests_exam_kind_requires_exam`, `requests_trip_fields_require_trip`, `requests_review_fields_consistency`, `requests_rejection_requires_reason` (all CHECK); every FK's `ON DELETE` behavior matches §5's not-null discipline (`RESTRICT` for required relationships, `SET NULL` for `events.source_request_id`, `CASCADE` for the two child tables keyed to their parent event).

**Indexes:** `tenant_id` on all 4 tables (RLS baseline, §6); `requests_pending_idx` partial on `status='pending'` (Manager's approvals-queue hot path); `events_date_idx`, `events_classroom_idx`; `event_trip_registrations_active_idx` partial on non-cancelled status (the capacity trigger's own hot-path count query).

---

## 4. Policies created

17 RLS policies across all 4 tables, all `FORCE ROW LEVEL SECURITY`:

| Table | Policies | Key design decision |
|---|---|---|
| `requests` | 3 (teacher select-own, manager select-tenant, teacher insert-own) | **No UPDATE policy for anyone.** `review_request` (SECURITY DEFINER) is the sole path from `pending` to `approved`/`rejected` — a direct RLS-gated UPDATE would let a manager flip `status` without the transactional event-creation `review_request` performs, the exact class of gap `EPIC_3_REVIEW.md` C4 closed for `set_child_day_path_status`. RLS Adversarial Test 3 asserts this directly. |
| `events` | 6 (manager CRUD, teacher select-all, guardian select-scoped) | Guardian visibility is "own classroom or all" (§12) via the new `current_guardian_classroom_ids()` helper — a direct equality check, not a subquery (§13.1). Adversarial Tests 4a-4c assert exact scoping. |
| `event_rsvps` | 4 (guardian CRU-own, manager select-tenant) | No delete policy anywhere — matches §12's literal "CRU (own child)". |
| `event_trip_registrations` | 4 (guardian select/insert/update-own, manager select-tenant) | Guardian `INSERT` WITH CHECK pins `status='open'` and `payment_transaction_id IS NULL`; guardian `UPDATE` (the direct-REST mirror of `cancel_trip_registration`) only reaches `open`/`registered` → `cancelled`, never `paid` — RLS encodes exactly the RPC's own invariant (`EPIC_3_REVIEW.md` C2 / `EPIC_4_REVIEW.md` H2 lesson). Adversarial Tests 6-7 assert this. |

---

## 5. RPCs

| RPC | Grant | Idempotency-key | Notes |
|---|---|---|---|
| `submit_request` | authenticated (teacher) | **Yes** — creates a new row, not a natural upsert (§14.3 default) | SECURITY DEFINER to reach `comms.enqueue_notification`; notifies the tenant's manager(s) via a small bounded-N loop (`EPIC_3_REVIEW.md` L1's own reasoning: manager count is always small) |
| `review_request` | authenticated (manager) | **Yes** — a retry after a successful approval must never create a second event | Atomic `UPDATE...WHERE` (`pending` → decision); on approval, transactionally promotes to `approvals.events` and set-based-fans-out an "event published" notification to the relevant guardians (`EPIC_4_REVIEW.md` H4: no per-row loop for a potentially-unbounded audience); always notifies the submitting teacher |
| `update_rsvp` | authenticated (guardian) | No — natural upsert via `event_rsvps_event_child_key` (§14.3's stated exception) | Satisfies the Test Scenario "double-tap must be idempotent, not duplicate" directly |
| `cancel_trip_registration` | authenticated (guardian) | No — atomic `UPDATE...WHERE`, naturally retry-safe (same pattern as `revoke_pickup_pass`/`unassign_bus_rider`, Epic 3) | A paid registration cannot be cancelled here — reserved for a future Epic 6 refund RPC |

Trip-registration **creation** deliberately does **not** get a bespoke RPC:
it goes through a direct PostgREST `INSERT` under RLS
(`event_trip_registrations_insert_guardian`), with the capacity/type/payment
trigger (migration 2) as the authoritative backstop — mirroring
`transport.bus_riders`' established two-layer pattern (Epic 3) exactly,
rather than inventing a 5th RPC beyond the 4 `BACKEND_EXECUTION_PLAN.md`
§8 names.

---

## 6. Edge Functions

None. `BACKEND_EXECUTION_PLAN.md` Epic 5 §7 states this explicitly ("this
Epic is pure RPC/PostgREST"), and no Edge-Function-only capability (external
API call, Admin API, scheduled/cron logic, file processing) was needed
anywhere in this Epic's scope.

---

## 7. Tests

```
npx tsc -p tsconfig.json --noEmit   →  0 errors
npx vitest run                       →  24 test files, 229 tests, ALL PASSING (187 prior + 42 new)
```

42 new unit tests (16 validation + 10 `ApprovalRequestService` + 7
`EventService` + 9 API routes) run against fake in-memory repositories,
exactly like every existing Epic 1-4 test. `tests/rls/epic5_rls_adversarial.sql`
(9 numbered tests) is written but not executed — §1.

### Coverage by concern

- **Validation layer**: exam-requires-examKind, trip-only place/price, rejection-requires-reason, E.164 phone format — every DB-constraint-backed invariant has a matching Zod-layer test.
- **Service layer (role authorization)**: every RPC's role restriction has a positive and negative test (teacher can submit, manager cannot; manager can review, teacher cannot; guardian can RSVP/register/cancel, other roles cannot).
- **API routes**: validation-failure-before-service-call is asserted for every route (mirrors the established "service.method not called" pattern from `commsApiRoutes.test.ts`).
- **RLS adversarial (written, unexecuted)**: cross-tenant isolation on requests (Test 1); submitted_by-scoping, not tenant-wide, for teacher request visibility (Test 2); no direct-REST approval path exists (Test 3); "own classroom or all" guardian event visibility (Test 4a-4c); capacity trigger rejects over-booking (Test 5); RLS blocks a direct `status='paid'` insert (Test 6); guardian can cancel via direct REST, matching the RPC's own transition (Test 7); RSVP uniqueness (Test 8); cross-table `events.type='trip'` check (Test 9).

---

## 8. Lessons applied from previous Epic reviews

| Lesson | Origin | Applied here |
|---|---|---|
| RLS helpers return an array type, never `SETOF` | `EPIC_2_DEPLOYMENT_FIX.md` | `current_guardian_classroom_ids()` returns `uuid[]` from its first draft |
| Cross-table tenant-consistency triggers from the first migration | `EPIC_2_REVIEW.md` C1/H2 | All 4 tables get a consistency trigger in migration 2, not retrofitted later |
| Capacity-constrained inserts: `SELECT...FOR UPDATE` + DB-trigger backstop, correctness requirement not optional | `EPIC_2_REVIEW.md` C1, `EPIC_3_REVIEW.md` C2/C3, `BACKEND_ARCHITECTURE.md` §14.3 | `check_trip_registration_consistency()` locks the event row and rejects over-capacity inserts regardless of write path, mirroring `transport.check_bus_rider_consistency` exactly |
| "Type/status requires companion field" enforced as a DB constraint from day one | `EPIC_4_REVIEW.md` H1 | `requests_exam_kind_requires_exam`, `requests_trip_fields_require_trip`, `requests_rejection_requires_reason` all shipped in migration 2, plus the matching Zod + RPC + service-layer checks (3-4 layer validation, same shape as H1's own fix) |
| RLS policies encode exactly the RPC's own invariant, never broader | `EPIC_3_REVIEW.md` C2, `EPIC_4_REVIEW.md` H2 | No `requests` UPDATE policy at all (forces the transactional path through `review_request`); `event_trip_registrations_update_guardian`'s `WITH CHECK` matches `cancel_trip_registration`'s exact transition |
| `SECURITY DEFINER` only where a controlled cross-table write requires it, function's own checks as the sole gate | `EPIC_3_REVIEW.md` C4, `EPIC_4_REVIEW.md` (`comms.enqueue_notification` locked to `service_role`) | `submit_request`/`review_request` are `SECURITY DEFINER` solely to reach `comms.enqueue_notification`; both retain their own full role/tenant checks |
| Idempotency-key + payload-hash envelope for non-upsert mutating RPCs | `EPIC_4_REVIEW.md` H3, `BACKEND_ARCHITECTURE.md` §25.6 | `submit_request`/`review_request` both implement the `{_inputHash, data}` envelope over the frozen `idempotency_replay`/`idempotency_store` helpers |
| Natural-upsert RPCs skip the idempotency-key parameter entirely | `BACKEND_ARCHITECTURE.md` §14.3's own stated exception | `update_rsvp` has no `p_idempotency_key` — the unique constraint is the idempotency mechanism |
| Set-based fan-out for potentially-unbounded notification recipients; a small bounded-N loop remains acceptable | `EPIC_4_REVIEW.md` H4; `EPIC_3_REVIEW.md` L1's own reasoning | `review_request`'s guardian fan-out is one `INSERT...SELECT` (H4-style); `submit_request`'s manager notification stays a small loop (L1-style, tenant manager count is always small) |
| Never grant a blanket cross-boundary bypass on a participant/tenant-scoped resource | `EPIC_4_REVIEW.md` C1 | No `platform_admin` policy exists anywhere in this Epic — approvals/events are tenant-operational data, correctly outside Platform Admin's bypass scope per §13.6 |
| Atomic `UPDATE...WHERE` for state transitions, disambiguated on the (rare) 0-row path | `EPIC_2_REVIEW.md` M1, `EPIC_3_REVIEW.md` M3 | `review_request` and `cancel_trip_registration` both use this shape |
| FK columns to a not-yet-existing schema are a bare nullable `uuid` with an explanatory comment, no FK constraint | Epic 1/2/3 precedent (`photo_object_id`, `id_photo_object_id`) | `requests.attachment_object_id` (Epic 7), `event_trip_registrations.payment_transaction_id` (Epic 6) |
| Reuse a bucket/policy an earlier Epic already built ahead of time, rather than re-litigating it | `EPIC_3_REVIEW.md` migration 7 precedent (`identity-documents`) | `academic-attachments` (built in Epic 2 specifically "for Epic 5") needed zero new policies |
| `write_audit_log`/`platform.audit_log` scope is deliberate, not "log everything" | `BACKEND_ARCHITECTURE.md` §23's own enumerated list | Approvals/events actions are not in that list (unlike pickup-pass scans, session revocations, etc.) — no audit-log call was added, avoiding scope creep into a control the architecture doesn't require here |

---

## 9. Known limitations (explicitly scoped decisions, not oversights)

1. **No live/local execution of the SQL layer.** Same limitation as every prior Epic's environment — see §1. Deployment (and therefore a live deployment audit) was out of scope for this task; the user's instruction was implementation only ("Begin Epic 5 implementation... Stop after Epic 5").
2. **`review_request`'s `request.type='event'` → `events.type='celebration'` mapping is a resolved documentation ambiguity, not an architecture change.** `BACKEND_ARCHITECTURE.md` §3.21 and §3.22 name their type enums differently (`requests.type` has `event`, `events.type` has `celebration` instead) with no explicit mapping stated; this report resolves it as the only sensible 1:1 correspondence and documents it inline in migration 5's own comment.
3. **`events.capacity` is only enforced for trip-type events.** The architecture's capacity-checked-RPC language (§14.3) specifically names "review_request's trip-registration path"; celebration/exam capacity (if ever needed) is not enforced by this Epic's trigger, since no capacity-checked write path exists for those types in the current RPC catalog.
4. **`event_trip_registrations.status` values `registered` and `paid` have no reachable write path in this Epic** — only `open` (guardian insert) and `cancelled` (guardian cancel) are reachable. `paid` is reserved for a future Epic 6 payment RPC; `registered` has no defined trigger in the current spec and is carried in the enum for forward-compatibility only, mirroring the precedent `EPIC_3_COMPLETION_REPORT.md` set for `trips.status='scheduled'` being enum-present but practically unobserved in v1.
5. **Exam-paper "preview" relies entirely on Epic 2's pre-built `academic-attachments` bucket policies**, which grant tenant-wide read (not narrowed to "reviewing manager only") — this is Epic 2's own frozen policy, unchanged and out of scope to narrow here; documented as inherited, not introduced.
6. **No frontend wiring.** Same explicit scope boundary as every prior Epic.

---

## 10. Manual QA checklist

- [ ] `supabase db reset` (or a fresh linked-project migration push) replays Epic 1-5 cleanly from scratch.
- [ ] A teacher calls `submit_request` with `type='exam', examKind='weekly'` — verify a `pending` row appears and every manager in the tenant receives an `approval`-category notification.
- [ ] A teacher calls `submit_request` with `type='exam'` and no `examKind` — verify `VALIDATION_FAILED` at the RPC layer (and separately, at the Zod/service layers via the unit tests already passing).
- [ ] A manager calls `review_request` with `decision='approved'` — verify the request flips to `approved`, an `approvals.events` row appears with `source_request_id` set, the submitting teacher gets an `approval` notification, and every relevant guardian gets an `event` notification.
- [ ] A manager calls `review_request` with `decision='rejected'` and a `rejectionReason` — verify the teacher's notification body carries that reason (Test Scenario: "verify teacher sees the reason, not a generic denial"), and no event row is created.
- [ ] Retry the same `review_request` call with the same `idempotencyKey` — verify no second event is created, the original response is replayed.
- [ ] Attempt a direct `PATCH` to `approvals.requests.status` as a manager via PostgREST — verify it affects 0 rows (RLS Adversarial Test 3).
- [ ] A guardian calls `update_rsvp` twice in quick succession with the same payload (double-tap) — verify only one `event_rsvps` row exists, no duplicate/error.
- [ ] A guardian inserts a 2nd `event_trip_registrations` row against a `capacity=1` trip that's already full — verify `VALIDATION_FAILED` ("This trip is at full capacity").
- [ ] A guardian calls `cancel_trip_registration` on their own `open` registration, then calls it again — verify the second call returns `STATE_ALREADY_PROCESSED`, not a silent success or a race.
- [ ] A guardian in Classroom B queries `approvals.events` — verify they see the whole-tenant trip but not Classroom A's celebration (RLS Adversarial Test 4).
- [ ] Run `tests/rls/epic5_rls_adversarial.sql` against a real `supabase db reset` and confirm all 9 tests print `PASS`.

---

## 11. Self-verification

- **Security**: every RPC checks `current_role()` as its first action; no function trusts RLS alone for its own multi-table writes (§14.3's own convention). `submit_request`/`review_request`'s `SECURITY DEFINER` status is justified solely by the need to reach `comms.enqueue_notification` (locked to `service_role` since Epic 4) — both retain their full original authorization checks, unaffected by the elevated execution context.
- **RLS**: all 4 tables have `FORCE ROW LEVEL SECURITY`; every policy re-read against the exact transition its corresponding RPC (or intended direct-CRUD path) performs; no `platform_admin` bypass exists anywhere in this Epic's tables (correct default-deny per §13.6).
- **Tenant isolation**: every table carries `tenant_id`; every trigger verifies cross-table `tenant_id` agreement before allowing a write (mirrors `EPIC_2_REVIEW.md` H2's fix, applied from the start here); every RLS policy's `tenant_id` check uses `current_tenant_id()`, never a client-supplied value.
- **Transaction safety**: `review_request`'s approve-and-promote-to-event is one PL/pgSQL function body (implicitly one transaction) — a failure after the `events` insert but before the notification fan-out rolls back the entire function, including the `requests` status flip, so a "half-approved" state is not reachable; `cancel_trip_registration`/`review_request`'s atomic `UPDATE...WHERE` shapes eliminate the check-then-write race class `EPIC_2_REVIEW.md` M1 identified.
- **Performance**: every RLS-filtering column is indexed (§6); the capacity trigger's count query is served by `event_trip_registrations_active_idx`; `review_request`'s guardian fan-out is a single set-based `INSERT...SELECT`, not O(n) round-trips.
- **Authorization**: enforced at every layer per the task's requirement — Zod (input shape), service (role + companion-field checks), RPC (role + tenant + state-machine), RLS (row-level backstop), DB trigger (cross-table backstop that holds regardless of write path).
- **Architecture compliance**: table/column shapes match §3.21-3.24 field-for-field (bare `_object_id` columns for not-yet-existing schemas per established precedent); all 4 named RPCs (§8) implemented with matching signatures; Realtime channel `tenant:{id}:approvals` backed by `approvals.requests` in `supabase_realtime` (§10, §15); no Edge Function added, matching §7's explicit "none new."

---

## Verdict

Epic 5 (Approvals & Events) implementation is **complete**: 6 new migrations
(4 tables, 6 enums, 7 triggers, 17 RLS policies, 1 new RLS helper, 4 public
RPCs), 8 new application-layer files, 5 new test files (42 unit tests + 9
RLS adversarial tests, the latter unexecuted per §1), all additive to Epic
1-4. `npx tsc --noEmit` is clean; `npx vitest run` passes 229/229 across 24
test files. No Epic 1, Epic 2, Epic 3, or Epic 4 migration was modified; no
frozen frontend file was touched. Every lesson catalogued in §8 was applied
proactively rather than discovered later. Stopping here — Epic 6 is out of
scope for this delivery.
