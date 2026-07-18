# Epic 5 Review — Approvals & Events

Production-grade architecture and code review of Epic 5 as delivered in
`EPIC_5_COMPLETION_REPORT.md`: 6 migrations (`approvals` schema, 4 tables, 6
enums, 7 triggers, 1 RLS helper, 17 RLS policies, 4 RPCs), 8 application-layer
files, 5 test files. No code was modified during this review. Every finding
below was verified by direct reading of the shipped migration/TS files
(`backend/supabase/migrations/20260721*.sql`, `backend/src/**`,
`backend/tests/**`), not by re-reading the completion report's own claims.

**Executive summary**: the RLS/trigger architecture correctly applies most
of the Epic 2-4 lessons it cites (atomic `UPDATE...WHERE`, tenant-consistency
triggers, `uuid[]`-returning RLS helpers, idempotency-key + payload-hash
envelopes, set-based fan-out). However, one **Critical** defect defeats the
Epic's own headline correctness guarantee — trip capacity enforcement is
silently bypassable by any two distinct guardians — because the enforcing
trigger is not `SECURITY DEFINER` and its own count query is filtered by the
*calling guardian's* RLS policy, not the event's true registration count.
One **High** finding is a genuine, if narrower, architecture-principle
violation (`events_delete_manager` grants a manager a hard delete that
cascades to destroy potentially-paid trip registrations, contradicting §12's
"Manager has no D... only soft-delete"). The remaining findings are real but
lower-impact gaps in idempotency-hash coverage, notification-recipient
filtering, defense-in-depth consistency, and validation-layer symmetry.

---

## Critical

### C1 — Trip-registration capacity enforcement is bypassable by any two distinct guardians

**Location**: `backend/supabase/migrations/20260721000002_epic5_requests_and_events_tables.sql`, `approvals.check_trip_registration_consistency()` (lines ~299-375); consumed via `event_trip_registrations_insert_guardian` (migration 4) and `backend/src/repositories/eventRepository.ts`'s `registerForTrip`.

**Root cause**: `approvals.check_trip_registration_consistency()` is a plain
(`language plpgsql`, no `security definer`) `BEFORE INSERT OR UPDATE`
trigger on `approvals.event_trip_registrations`. Trip-registration
*creation* has no wrapping RPC — by design, it goes through a direct
PostgREST `INSERT` under RLS (`event_trip_registrations_insert_guardian`),
with this trigger as "the authoritative backstop regardless of write path"
(the migration's own comment). Because the trigger is **not** `SECURITY
DEFINER`, its internal capacity-count query —

```sql
select count(*) into v_current_count
from approvals.event_trip_registrations
where event_id = new.event_id and status in ('open','registered','paid') and id <> new.id;
```

— executes under the *calling guardian's own* row-level security context,
not a privileged one. The only `SELECT` policy on this table is
`event_trip_registrations_select_guardian`, scoped to
`child_id = any(current_guardian_child_ids())`: a guardian's own query can
only ever see rows belonging to *their own children*. Two different
guardians registering for the same capacity-limited trip each run this count
query under their own restricted visibility — neither can see the other's
row — so each independently computes a count of `0` (or whatever their own
children's registrations total), never the event's true total.

The reviewer traced this against the Epic 3 precedent this trigger's own
comment cites (`transport.check_bus_rider_consistency`) and confirmed *why*
that precedent worked and this one doesn't: `bus_riders` capacity-checked
inserts are exclusively **manager**-initiated (`bus_riders_insert_manager`),
and `manager`'s own `SELECT` policy on `bus_riders` is tenant-wide, not
per-child-scoped — so the non-`SECURITY DEFINER` trigger's count query
happened to see every row regardless. Epic 5 is the first Epic to apply this
same "trigger is the backstop, no wrapping RPC" pattern to a table whose
*write role* (guardian) has a *per-owner-scoped* (not tenant-wide) `SELECT`
policy — the one precondition that makes the pattern silently unsafe, and
nothing in this Epic's design or review process checked for that precondition
before reusing the pattern.

**Risk**: Any two guardians (no elevated privilege, no coordination, not
even concurrent timing required — this reproduces on two sequential,
unrelated requests) can jointly register more children into a trip than its
`capacity` allows, in direct contradiction of the Epic's own Acceptance
Criteria framing ("capacity-checked... this is a correctness requirement,
no overbooking under concurrent requests... not merely a performance
concern," `BACKEND_ARCHITECTURE.md` §14.3) and the Test Scenario this Epic
was supposed to satisfy. For a paid trip this is a direct operational/
financial exposure (more attendees confirmed than the vehicle/venue can hold,
with no server-side signal anything went wrong — no error, no log, the
`INSERT` simply succeeds). There is **no second enforcement layer**
anywhere else in the stack for this table — no wrapping RPC, no
service-layer count, no application-side check — so this single broken
trigger is the *entire* enforcement mechanism, and it is broken for
every guardian-initiated registration, not an edge case.

Notably, `tests/rls/epic5_rls_adversarial.sql` Test 5 was written
specifically to assert this exact scenario is rejected (two different
guardians, `capacity=1`) — had it been executed against a live database (it
was not; see `EPIC_5_COMPLETION_REPORT.md` §1's own stated limitation), it
would have failed and caught this before delivery. This underscores that
"written but unexecuted" was not merely a formality for this Epic.

**Recommended fix**: Mark `approvals.check_trip_registration_consistency()`
`security definer` with `set search_path = ''` (the same pattern already
used throughout Epic 3/4 whenever a trigger or RPC needs a count/lookup that
must see across an RLS ownership boundary — e.g. `withdraw_child`'s
pickup-pass cascade, `academic.set_child_day_path_status`). This makes the
count query see every registration for the event regardless of which
guardian's `INSERT` triggered it, restoring the same correctness guarantee
`transport.check_bus_rider_consistency` actually has. After the fix, execute
`tests/rls/epic5_rls_adversarial.sql` Test 5 for real against a live
database as the acceptance check, not just a static read.

---

## High

### H1 — `events_delete_manager` grants a manager a hard delete that cascades to destroy trip registrations, including potentially-paid ones

**Location**: `backend/supabase/migrations/20260721000004_epic5_rls_policies.sql`, `events_delete_manager` policy; cascade behavior defined in `backend/supabase/migrations/20260721000002_epic5_requests_and_events_tables.sql` (`event_trip_registrations.event_id ... on delete cascade`, `event_rsvps.event_id ... on delete cascade`).

**Root cause**: `approvals.events` is given a plain `for delete` RLS policy
for `manager` (tenant-scoped, no other restriction), and both child tables
(`event_rsvps`, `event_trip_registrations`) reference it with `ON DELETE
CASCADE`. `BACKEND_ARCHITECTURE.md` §12's own notes section states
explicitly: *"Manager has no `D` (hard delete) anywhere in this system per
§8 — only soft-delete, which is functionally a `U`."* No soft-delete column
(`deleted_at`) exists on `approvals.events` at all, so there is no non-
destructive alternative available even if the policy were narrowed. (Note
for context, not mitigation: `transport.buses` in Epic 3 already has an
analogous `buses_delete_manager` hard-delete policy that was not flagged in
`EPIC_3_REVIEW.md` — this is not a wholly new pattern in the codebase. What
is new and specific to Epic 5 is the *consequence*: deleting a `buses` row
has no cascade onto a payment-linked table, while deleting an `events` row
cascades onto `event_trip_registrations`, which carries `payment_transaction_id`
— a financial-reconciliation-relevant field the moment Epic 6 exists.)

**Risk**: A manager deleting a published event (accidentally, or to "clean
up" a past trip) silently and irreversibly destroys every guardian's RSVP
and trip-registration row for that event — including any row already in
`status='paid'` with a `payment_transaction_id` set. There is no recovery
path (hard delete, not soft delete) and no confirmation/warning mechanism
built into the RLS layer or any RPC (there is no delete RPC at all — the
direct RLS grant is the only path, so there's no seam to add a guard even at
the application layer without changing the policy itself). This is a
data-loss / audit-trail-loss risk that will only become externally visible
once Epic 6 (billing) exists and a real payment gets orphaned by a deleted
event.

**Recommended fix**: Either (a) remove `events_delete_manager` entirely
(matching `approvals.requests`, which correctly has no delete policy for
anyone) and let event "removal" be a future soft-delete `UPDATE` once a
`deleted_at`/`cancelled_at` column exists, or (b) narrow the policy's
`USING` clause to only permit deletion of an event with zero non-cancelled
registrations (`not exists (select 1 from approvals.event_trip_registrations
where event_id = events.id and status in ('open','registered','paid'))`),
mirroring the "RLS encodes exactly the safe transition" convention already
used elsewhere in this Epic (`event_trip_registrations_update_guardian`).
Option (a) is more consistent with the architecture's own stated absolute
and is the lower-risk fix.

### H2 — `requests_insert_teacher`'s direct-REST path bypasses `submit_request`'s manager notification and is subject to the submitting teacher's own (narrower) RLS visibility inside the consistency trigger

**Location**: `backend/supabase/migrations/20260721000004_epic5_rls_policies.sql`, `requests_insert_teacher` policy; `backend/supabase/migrations/20260721000002_epic5_requests_and_events_tables.sql`, `approvals.check_request_consistency()`; contrast with `submit_request` in `backend/supabase/migrations/20260721000005_epic5_rpc_functions.sql`.

**Root cause**: Two independent, uncoordinated write paths exist for the
same action — a direct RLS `INSERT` policy (`requests_insert_teacher`) *and*
the `submit_request` RPC — and they are not equivalent:

1. **Notification gap**: only `submit_request`'s own function body contains
   the `§16`-mandated "New request submitted → Manager" notification loop.
   A direct REST `INSERT` (which `requests_insert_teacher`'s existence
   explicitly permits) creates a fully valid `pending` request but no
   manager is ever notified — the request only becomes visible when a
   manager happens to poll `listPending`.
2. **RLS-visibility mismatch inside the trigger**: `submit_request` is
   `SECURITY DEFINER`, so `check_request_consistency()`'s internal
   `classroom_id`/`subject_id` tenant-lookups run with full (RLS-bypassing)
   visibility when invoked through the RPC. A direct `INSERT`, by contrast,
   runs the same trigger under the *submitting teacher's own* RLS context —
   and a teacher's documented `Classrooms`/`subjects` access is `R (own)`,
   not tenant-wide (`BACKEND_ARCHITECTURE.md` §12). A teacher submitting a
   legitimate request about a classroom/subject they don't directly "own"
   (e.g. a subject-only teacher, or a cross-classroom trip proposal) would
   get a spurious `classroom_id does not belong to your tenant` rejection
   for a classroom that *does* belong to their tenant — it's simply outside
   their own row-level visibility.

**Risk**: Functional correctness / architecture-compliance gap, not a
tenant-isolation or authorization bypass (the direct path is still tenant-
and role-scoped correctly). Impact is either a silently un-notified manager
(the request sits invisible until manually polled) or an incorrectly
rejected legitimate request, depending on the teacher's classroom/subject
visibility. This is the same *class* of defect the Epic 3/4 reviews
repeatedly flagged under "RLS policy doesn't encode the RPC's own
invariant" — except inverted: here the RLS grant permits *less* than the RPC
guarantees (a working but side-effect-incomplete write), rather than more.

**Recommended fix**: Remove `requests_insert_teacher` and require
`submit_request` as the sole creation path — consistent with how this same
Epic already treats `approvals.requests`' `UPDATE` (no direct policy at
all, `review_request` only) and with `broadcast_announcement`/`send_message`
(Epic 4), neither of which has a parallel direct-`INSERT` RLS policy. If a
direct-REST path is intentionally desired for API flexibility, at minimum
add a low-priority follow-up item to also enqueue the manager notification
via a trigger (`AFTER INSERT` on `pending` rows), so the notification
guarantee holds regardless of write path — mirroring how `comms.notifications`'
dispatch-enqueue trigger (Epic 4) is deliberately trigger-based specifically
so it can't be skipped by write-path choice.

---

## Medium

### M1 — `submit_request`'s idempotency payload-hash omits four of its own mutable parameters

**Location**: `backend/supabase/migrations/20260721000005_epic5_rpc_functions.sql`, `submit_request`, the `v_input_hash` computation (~lines 81-84).

**Root cause**: The hash covers `p_type`, `p_title`, `p_request_date`,
`p_classroom_id`, `p_subject_id`, `p_place`, `p_price` but omits
`p_request_time`, `p_note`, `p_exam_kind`, and `p_attachment_object_id`. Two
calls sharing the same `idempotencyKey` but differing only in one of those
four fields hash identically, so the second call silently replays the
*first* call's stored response instead of raising
`CONFLICT_IDEMPOTENCY_KEY_REUSED`.

**Risk**: Violates `BACKEND_ARCHITECTURE.md` §25.6's contract verbatim
("...calling it with the same key but a *different* payload raises
`CONFLICT_IDEMPOTENCY_KEY_REUSED` rather than silently applying either
version"). Concretely: a teacher submits an exam request with
`examKind='weekly'` under key `K`; a client-side bug or user correction
resubmits under the *same* key `K` with `examKind='monthly'` — the second
call silently returns the original `weekly` request untouched, with no
error, and the caller has no signal that their correction was discarded.
(`review_request`'s equivalent hash, checked as a comparison, correctly
covers all of its own parameters — this is specific to `submit_request`.)

**Recommended fix**: Extend the hash's concatenation to include
`coalesce(p_request_time::text,'')`, `coalesce(p_note,'')`,
`coalesce(p_exam_kind::text,'')`, and `coalesce(p_attachment_object_id::text,'')`.

### M2 — `review_request`'s guardian notification fan-out doesn't filter deactivated guardian accounts

**Location**: `backend/supabase/migrations/20260721000005_epic5_rpc_functions.sql`, `review_request`, the `insert into comms.notifications ... from academic.child_guardian_links cgl join academic.children c ...` block (~lines 240-248).

**Root cause**: The fan-out query filters `c.deleted_at is null` (the
child) but never checks `identity.guardian_profiles.deleted_at` for the
guardian being notified. In the very same migration file, `submit_request`'s
manager-notification loop correctly filters `identity.staff_profiles ...
and deleted_at is null` — the omission on the guardian side is an internal
inconsistency, not a deliberate design choice.

**Risk**: Low-severity but real: a soft-deleted/deactivated guardian account
can still receive an "event published" notification. Not a data leak (the
guardian's own session would already be revoked per Epic 1's session
model), but wasted writes and a violation of the same "check `deleted_at`
before notifying" convention `EPIC_4_REVIEW.md`'s L2 lesson
(`current_account_is_active()`) established for RLS visibility, applied
here to notification generation instead.

**Recommended fix**: Add `and g.deleted_at is null` to the fan-out query via
a join to `identity.guardian_profiles g on g.id = cgl.guardian_id`.

### M3 — `EventService.listForTenant` has no role check, unlike every sibling service method

**Location**: `backend/src/services/eventService.ts`, `listForTenant`.

**Root cause**: Every other method in `EventService` and
`ApprovalRequestService` (`updateRsvp`, `registerForTrip`,
`cancelTripRegistration`, `submit`, `review`, `listOwn`, `listPending`)
explicitly checks `caller.role` before delegating to the repository.
`listForTenant` checks only that `caller.tenantId` is present — any
authenticated role (including `driver` or `reception`, neither of which
`BACKEND_ARCHITECTURE.md` §12's permission matrix grants any `Events`
access at all) can call it without a `PERM_ROLE_DENIED` rejection.

**Risk**: RLS backstops the actual data exposure — `approvals.events` has no
`SELECT` policy for `driver`/`reception`, so the query returns an empty
array, not a leak. However, this is an inconsistency with the task's own
explicit requirement ("authorization is enforced at every layer") and with
this same file's own established convention, and produces a confusing UX
(silent empty list rather than a clear, actionable `PERM_ROLE_DENIED`) for
a caller who has no business calling this endpoint at all.

**Recommended fix**: Add `if (!['guardian','teacher','manager'].includes(caller.role ?? '')) throw new AppError('PERM_ROLE_DENIED', ...)` before the tenant check, matching the role set §12 actually grants `R` to for `Events`.

### M4 — `submitRequestSchema` doesn't reject `examKind` for a non-exam type, asymmetric with its own "trip fields" refinement and with the DB constraint

**Location**: `backend/src/validation/approvals.schema.ts`, `submitRequestSchema`.

**Root cause**: The schema's second `.refine()` correctly rejects
`place`/`price` when `type !== 'trip'` (both directions). Its first
`.refine()` only requires `examKind` *when* `type === 'exam'` — it never
rejects `examKind` being supplied when `type` is `'event'` or `'trip'`,
unlike the DB's `requests_exam_kind_requires_exam` constraint (migration 2),
which enforces the invariant in both directions.

**Risk**: A payload like `{type: 'trip', examKind: 'weekly', place: 'Zoo',
price: 100}` passes Zod validation and reaches the RPC/DB layer, where it is
correctly rejected — but as a raw constraint-violation mapped to a generic
`VALIDATION_FAILED` by `rpcError.ts`'s `EPIC_3_REVIEW.md` L4 fallback,
rather than a precise, field-specific Zod error at the API boundary (the
whole point of the 3-layer validation pattern `EPIC_4_REVIEW.md` H1
established). Not a security issue — a documentation/consistency gap in the
validation layer's completeness.

**Recommended fix**: Change the first `.refine()` to
`v.type === 'exam' ? Boolean(v.examKind) : v.examKind === undefined`,
mirroring the symmetric shape already used for the trip-fields check.

---

## Low

### L1 — Idempotency-key replay has no caller/tenant/RPC scoping (inherited from frozen Epic 1, not introduced here)

**Location**: `backend/supabase/migrations/20260714000007_epic1_rpc_functions.sql`, `public.idempotency_replay`/`public.idempotency_store` (frozen, out of scope to modify); consumed by `submit_request`/`review_request` in Epic 5.

**Root cause**: `jobs.idempotency_keys.key` is the sole primary key (not
composite with `tenant_id`/`caller_id`/`rpc_name`), and `idempotency_replay(p_key)`
returns whatever `response_snapshot` is stored for that key with **no**
check that the replaying caller matches the original `caller_id`, that the
tenant matches, or even that the `rpc_name` matches the RPC currently being
called. This is entirely Epic 1's (frozen) design — this review flags it
only because Epic 5 is now the third consumer of this shared helper (after
Epic 4's `send_message`/`broadcast_announcement`), and it was not flagged in
`EPIC_4_REVIEW.md` either.

**Risk**: Low in practice — exploitation requires an attacker to guess or
otherwise obtain another user's randomly-generated (v4) UUID idempotency
key, which is computationally infeasible. Architecturally, though, there is
zero caller-scoping on this shared primitive, and every new Epic that adopts
the idempotency-key convention inherits this gap silently.

**Recommended fix**: Out of scope for Epic 5 (modifying Epic 1 is
forbidden by this task's own rules). Recommend a dedicated, explicitly-
scoped hardening item in a future epic: add `caller_id`/`rpc_name` checks to
`idempotency_replay`, or key `jobs.idempotency_keys` on
`(key, caller_id, rpc_name)` instead of `key` alone.

### L2 — Format-only date/time validation at the Zod layer defers semantic errors to a raw Postgres error

**Location**: `backend/src/validation/approvals.schema.ts`, `timeSchema` and `submitRequestSchema`'s `requestDate: z.string().date()`.

**Root cause**: `timeSchema`'s regex (`^\d{2}:\d{2}(:\d{2})?$`) and Zod's
built-in `.date()` validator both check *shape*, not *semantic validity* —
`"99:99"` and `"2026-02-30"` both pass Zod and are rejected only when
Postgres attempts to cast them to `time`/`date`, surfacing as a generic,
less-friendly error via `rpcError.ts`'s constraint-violation fallback rather
than a precise Zod field error.

**Risk**: UX-quality gap only, not a security or data-integrity issue
(Postgres's own type system is the actual backstop and never accepts an
invalid value).

**Recommended fix**: Low priority. Could add a Zod `.refine()` using
`Date.parse` / a manual hour/minute range check if tighter client-side error
messages are desired; not required for correctness.

### L3 — Guardian `UPDATE` policies on `event_rsvps`/`event_trip_registrations` omit an explicit `tenant_id` check in `USING`

**Location**: `backend/supabase/migrations/20260721000004_epic5_rls_policies.sql`, `event_rsvps_update_guardian` and `event_trip_registrations_update_guardian`.

**Root cause**: Both policies' `USING` clauses check `current_role() =
'guardian' and child_id = any(current_guardian_child_ids())` but not
`tenant_id = current_tenant_id()` (their `WITH CHECK` clauses do include it).
Since `current_guardian_child_ids()` can only ever return children within
the guardian's own single tenant, this is not independently exploitable —
but it's an inconsistency with this codebase's general convention of
stating `tenant_id` explicitly in every policy clause, and with `WITH CHECK`
in the very same two policies.

**Risk**: Cosmetic/consistency only; no exploitable gap given
`current_guardian_child_ids()`'s own tenant-scoping.

**Recommended fix**: Add `and tenant_id = public.current_tenant_id()` to
both `USING` clauses for consistency, no functional change expected.

### L4 — `price` accepts unlimited decimal precision at the Zod layer before silent DB-side rounding

**Location**: `backend/src/validation/approvals.schema.ts`, `submitRequestSchema`'s `price: z.number().min(0)`.

**Root cause**: No `.multipleOf(0.01)` or similar constraint; the DB column
is `numeric(10,2)`, which silently rounds (rather than rejects) excess
precision on insert.

**Risk**: Cosmetic — a caller passing `price: 100.999` gets `100.99`/`101.00`
silently rather than a validation error naming the problem. No financial
correctness issue at this Epic's scope (no payment processing exists yet).

**Recommended fix**: Low priority; add `.multipleOf(0.01)` if precise
client-facing feedback is desired before Epic 6 (billing) makes rounding
behavior more consequential.

### L5 — (Informational) The RLS adversarial suite is written but unexecuted, and this Epic specifically demonstrates why that gap is consequential

**Location**: `backend/tests/rls/epic5_rls_adversarial.sql`; `EPIC_5_COMPLETION_REPORT.md` §1.

**Root cause**: No Docker/local Postgres is available in this environment,
and deployment (which would allow running the suite against the linked
Supabase project) was out of scope for the implementation task. This is a
carried-forward limitation from every prior Epic, not new to Epic 5.

**Risk**: Test 5 in this exact suite was written to assert the precise
scenario C1 describes and would have failed had it been run — meaning the
tooling to catch C1 before this review already existed and simply wasn't
executed. This is not a new category of risk, but it is worth recording
explicitly here as evidence that "unexecuted, static-only verification" is
not a purely theoretical caveat for this codebase.

**Recommended fix**: Execute `tests/rls/epic5_rls_adversarial.sql` (ideally
via a real `supabase db reset` or an ephemeral Postgres instance with
Docker) as part of closing out C1, and treat a green run of this suite as a
release gate for any future Epic that introduces a new capacity- or
uniqueness-enforcing trigger.

---

## Findings by review category (cross-reference)

| Category (from the review brief) | Findings |
|---|---|
| Security issues / RLS bypasses | C1, L1 |
| Tenant isolation issues | None found — every table/trigger/policy correctly scopes by `tenant_id`, verified independently in each of C1/H1/H2/M1-M4 |
| Race conditions / transaction safety | None found beyond C1 (C1 is a visibility bug, not a race — the underlying `FOR UPDATE` locking is correct) |
| Capacity bypass | C1 |
| Duplicate processing / idempotency | M1 |
| Authorization issues | H2, M3 |
| Architecture violations / inconsistency with `BACKEND_ARCHITECTURE.md` | H1 (§12 "no D"), H2 (§16 Notification Matrix), M1 (§25.6) |
| Missing validation | M4, L2, L4 |
| Performance / missing indexes | None found — every RLS-filtering and capacity-counting column is indexed (verified against `BACKEND_ARCHITECTURE.md` §6) |
| Missing constraints | None found beyond what M4/L2 note at the validation layer (DB constraints themselves are complete) |
| Code duplication | None found |
| Scalability issues | None found — `review_request`'s guardian fan-out is correctly set-based, not a per-row loop |

---

## Verdict

Epic 5 is **not production-ready as delivered**. One Critical finding (C1)
defeats the Epic's own primary correctness guarantee (trip capacity
enforcement) via a mechanism (non-`SECURITY DEFINER` trigger reading through
the calling guardian's own RLS) that is straightforward to fix (one
`security definer` + `set search_path = ''` addition, matching an already-
established codebase pattern) but must be fixed, and verified by actually
running the existing RLS adversarial test, before this Epic can be
considered complete. One High finding (H1) is a genuine, if narrower,
contradiction of an explicit architectural absolute with real data-loss
consequences once Epic 6 exists. The remaining High and Medium findings are
real but narrower gaps (a missing notification on an alternate write path, a
false-rejection edge case, incomplete idempotency-hash coverage, a missing
`deleted_at` filter, an inconsistent service-layer role check, an asymmetric
validation refinement) that should be fixed but do not block a production
verdict on their own. No Epic 1, Epic 2, Epic 3, or Epic 4 migration file
was modified — freeze compliance is confirmed (only `20260721*` files were
added; `backend/supabase/config.toml` received the one-line additive
`"approvals"` schema entry, matching every prior Epic's identical pattern).
Stopping here per this task's instruction — no code was changed as part of
this review.
