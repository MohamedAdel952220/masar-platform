# Epic 3 Review — Principal Backend Audit

**Role:** Principal Backend Auditor. **Scope:** every file delivered in Epic 3 (`backend/supabase/migrations/20260717*.sql`, `backend/supabase/functions/add-bus`, `backend/src/**` additions, `backend/tests/**` additions). **Method:** line-by-line re-read of every migration, RPC body, RLS policy, Edge Function, and TypeScript file, cross-checked against `BACKEND_ARCHITECTURE.md` (§3.25-3.32, §5, §12, §13.1, §13.4, §14.2, §18, §23, §27) and `BACKEND_EXECUTION_PLAN.md`'s Epic 3 section (lines 262-362) — not a re-statement of `EPIC_3_COMPLETION_REPORT.md`'s own claims.

**This is documentation only. No code was modified as part of this review.**

---

## Executive summary

Epic 3's schema and RLS shape is structurally sound and does apply several hard-won Epic 2 lessons correctly (array-returning RLS helpers, per-table tenant-consistency triggers from the first migration, atomic `UPDATE...WHERE` for several state transitions). However, this audit found **five Critical-severity gaps**, none of which are caught by the 140/140 "passing" test suite, because — exactly as Epic 2's own review found — that suite is entirely mock-based and never exercises real SQL. The most severe finding is that `withdraw_child` (Epic 2) was never extended to cascade into Epic 3's tables, despite `BACKEND_ARCHITECTURE.md` explicitly requiring this and `BACKEND_EXECUTION_PLAN.md` explicitly scheduling it for Epic 3 by name — meaning a withdrawn child's pickup passes remain scannable and their bus seat remains occupied indefinitely. The second-most severe class of finding is systemic: several RLS `UPDATE`/`INSERT` policies grant raw table access with no restriction on the columns or state transitions the corresponding RPC enforces, so a client calling PostgREST directly instead of the RPC can bypass the pickup-pass "must be a valid scan" handover gate, the trip completion guard, and (compounding a third Critical finding) mark an arbitrary child in the tenant as picked up/dropped off with no check that the child was ever assigned to that trip. Two further Critical findings are a documented-but-unimplemented rate limit on `scan_pickup_pass` and an over-exposed, actor-forgeable cross-Epic write function.

The completion report's test-coverage claims are technically accurate but, as with Epic 2, provide no assurance about any of the findings below — none of the 48 new unit tests, nor the (unexecuted) RLS adversarial suite, exercise the code paths these findings live in.

**Finding counts: 5 Critical · 6 High · 10 Medium · 5 Low.**

---

## Critical

### C1 — `withdraw_child` was never extended to cascade into Epic 3's tables, despite both architecture documents explicitly requiring it

**Where:** `backend/supabase/migrations/20260717*.sql` (absence) vs. `BACKEND_ARCHITECTURE.md` line 788 and line 1256, and `BACKEND_EXECUTION_PLAN.md` Epic 3 §17 (dependencies).

`BACKEND_ARCHITECTURE.md` line 788 states, of `withdraw_child`: *"orchestrates the §8 cascade (soft-deletes `pickup_passes`, deactivates `bus_riders`) as one transaction rather than a bare `UPDATE`."* Line 1256 (the Epic 3 module-shipment note) states: *"The `assign_bus_rider`/`unassign_bus_rider` capacity-locked RPCs (§14.2) and `withdraw_child`/`suspend_child` orchestration RPCs ship here, since they depend on this schema."* Epic 2's own migration comment on `withdraw_child` anticipated exactly this: *"the pickup-pass/bus-rider cascade described in §14.2 does not apply yet — those tables don't exist until Epic 3... this function is written so Epic 3 can extend it additively via `CREATE OR REPLACE` without touching this Epic's callers."*

Epic 3 never touches `withdraw_child` (or `suspend_child`) at all — no migration in this delivery contains `CREATE OR REPLACE FUNCTION public.withdraw_child`. The FK-level `ON DELETE CASCADE`/`SET NULL` choices made on `pickup_passes`/`pickup_scan_events` (migration 3) are not a substitute: children are never hard-deleted in this system (soft-delete only, per the standing convention), so those `ON DELETE` clauses will never actually fire — the only correct place to implement the documented cascade is inside `withdraw_child` itself, which was never revisited.

**Impact:** withdrawing a child today leaves their `pickup_passes` fully `active` and scannable, and their `bus_riders` row `active` — still occupying a bus seat (blocking a new enrollment from ever reaching that capacity), still receiving `update_child_trip_status`/day-path writes, and still visible in a driver's `children_driver_safe()` manifest — indefinitely after withdrawal. This is a genuine custody/safety defect (an authorization to collect a child who is no longer enrolled remains valid) in the single feature `BACKEND_EXECUTION_PLAN.md` §25 calls *"the single worst-case defect class in the entire system,"* and a direct, unambiguous miss against both architecture documents' explicit instructions.

**Severity: Critical.**

---

### C2 — Several RLS write policies grant raw table mutation with no restriction on the state transitions or columns the corresponding RPC enforces, letting direct PostgREST access bypass every RPC-level guard

**Where:** `20260717000005_epic3_rls_policies.sql` — `pickup_scan_events_update_reception`, `trips_update_driver`, `gps_pings_insert_driver`, `buses_update_driver`.

Every one of these policies exists to let a specific RPC's own `UPDATE`/`INSERT` succeed under RLS (since none of Epic 3's RPCs are `SECURITY DEFINER`, they run as the caller and are fully subject to RLS). None of them encode the RPC's actual business rule, which means the RPC is a *convenience path*, not the *only path* — exactly the C1-class gap Epic 2's own review found and fixed once already:

- `pickup_scan_events_update_reception` (`using (tenant_id = current_tenant_id() and role = 'reception')`, no restriction on `result`/`handover_confirmed`) lets any reception account `PATCH .../pickup_scan_events?id=eq.<any-row-in-tenant>` directly, setting `handover_confirmed = true` on a scan whose `result` was `invalid_unknown`/`invalid_expired`/`invalid_revoked` — completely bypassing `confirm_handover`'s `result = 'valid' and not handover_confirmed` gate. This defeats the entire security purpose of the pickup-pass mechanism: a handover can be marked confirmed with no valid scan ever having occurred.
- `trips_update_driver` (`using (role = 'driver' and bus_id = any(current_driver_bus_ids()))`, no restriction on `status`) lets a driver `PATCH` their own trip's `status` directly to `'completed'` (or any other value), bypassing `complete_trip`'s atomic `status not in ('completed','cancelled')` guard entirely, and without the "confirm arrival" semantics `BACKEND_ARCHITECTURE.md` §18 describes.
- `gps_pings_insert_driver` (`with check (role = 'driver' and trip_id = any(current_driver_trip_ids()))`) has no check on the trip's `status`, letting a driver insert pings for a `completed`/`cancelled` trip directly, bypassing `record_gps_ping`'s own guard.
- `buses_update_driver` grants a driver unrestricted column access (`capacity`, `plate`, `number`, even `driver_id`) to their own bus row via direct REST access. No RPC in this Epic ever performs `UPDATE transport.buses` — this policy has no legitimate caller and exists purely as an unused, over-broad grant.

**Impact:** the pickup-pass custody-verification guarantee, the trip completion state machine, and the GPS-cadence-after-completion invariant are all bypassable by any client calling the REST API directly instead of the intended RPC — not a hypothetical, since this is literally the default behavior of any Supabase client library call that targets a table instead of an RPC.

**Severity: Critical** — directly undermines the stated security purpose of the pickup-pass feature and is reachable by any authenticated driver/reception session.

---

### C3 — `update_child_trip_status` (and its DB-trigger backstop) never validate that the referenced child is actually a rider on the referenced trip

**Where:** `20260717000006_epic3_rpc_functions.sql`, `public.update_child_trip_status`; `20260717000002_epic3_fleet_and_trip_tables.sql`, `transport.check_trip_child_status_consistency`.

The RPC validates the caller's role, that `p_trip_id` belongs to the caller's tenant, and — for a driver — that the trip belongs to them (`current_driver_trip_ids()`). It never validates that `p_child_id` is actually a `bus_riders` row on that trip's bus. The DB-level trigger backstop (`check_trip_child_status_consistency`, migration 2) only validates that `trip_id`/`child_id` belong to the *same tenant* — the exact same omission, at the exact same layer, as `academic.check_attendance_record_consistency`'s original gap before `EPIC_2_REVIEW.md` C2 fixed it.

**Impact:** a driver or reception account can call `update_child_trip_status(their_own_trip_id, <any child_id in the tenant>, 'picked_up')` for a child who was never assigned to that bus. This both corrupts `transport.trip_child_status` for an unrelated trip and — via `academic.set_child_day_path_status` (see C4) — silently overwrites that unrelated child's `day_path_status` and appends a fabricated `day_path_events` row claiming they were picked up by a bus they were never on. This is the exact defect class `EPIC_2_REVIEW.md` C2 already found and fixed once in this codebase (`mark_attendance` not validating child/classroom membership), reintroduced here for trip/rider membership.

**Severity: Critical.**

---

### C4 — `academic.set_child_day_path_status()` is directly callable by any authenticated staff/driver role with a forgeable `actor_id`, with no entity-level authorization

**Where:** `20260717000004_epic3_rls_helpers.sql`, `academic.set_child_day_path_status`.

The function is `SECURITY DEFINER`, `grant execute ... to authenticated`, and its only authorization check is `current_role() in ('driver','reception','teacher','manager')` plus a tenant-match check on `p_child_id`. `p_actor_id` is a plain caller-supplied `uuid` parameter — it is never forced to `auth.uid()`. Because the grant is to `authenticated` (required so that `update_child_trip_status`/`confirm_handover`, both plain non-`SECURITY DEFINER` functions, can call it as the invoking user), any driver, reception, teacher, or manager account can call it **directly** via `supabase.rpc('set_child_day_path_status', {...})`, bypassing `update_child_trip_status`/`confirm_handover` entirely: no trip-ownership check, no valid-scan check, no rider-membership check (see C3) — only "is this child in my tenant."

**Impact:** two distinct problems. (1) Authorization bypass: any of four roles can set any child's `day_path_status` to any value at any time, with none of the state-machine guards the two legitimate callers otherwise enforce. (2) Audit-trail forgery: the caller fully controls `p_actor_id`, so a `day_path_events` row can be inserted claiming an arbitrary actor performed the action — directly undermining the "who did what" guarantee an audit trail exists to provide.

**Severity: Critical.**

---

### C5 — `scan_pickup_pass` has no rate limiting, despite `BACKEND_ARCHITECTURE.md` explicitly naming it as requiring one

**Where:** `20260717000006_epic3_rpc_functions.sql`, `public.scan_pickup_pass`; `BACKEND_ARCHITECTURE.md` line 1111.

`BACKEND_ARCHITECTURE.md` §27 states: *"sensitive/abusable RPCs (`scan_pickup_pass`, OTP request, `ai_polish_note`) have per-caller rate limits enforced at the Edge Function layer... to prevent brute-force/abuse."* `scan_pickup_pass` is implemented as a bare Postgres RPC granted to `authenticated`, matching `BACKEND_EXECUTION_PLAN.md`'s own §7/§8 (which lists no Edge Function for it, only `add-bus`) — but this means there is no Edge Function layer in the current design for the documented rate limit to attach to at all. This is a genuine tension between the two architecture documents (§27's requirement vs. the execution plan's chosen RPC-only shape for this specific function) that predates this delivery, but the practical result is the same regardless of which document is "more correct": the documented control is entirely absent today, and `qr_token` guessing (even though impractical at 122 bits of entropy) has zero throttling, logging-based detection, or lockout.

**Severity: Critical** — a named, specific, unambiguous security requirement for the single highest-stakes RPC in this Epic (per `BACKEND_EXECUTION_PLAN.md` §25's own risk framing) is unmet.

---

## High

### H1 — No `write_audit_log` call anywhere in Epic 3, despite pickup-pass actions being explicitly named as audit-worthy

**Where:** `20260717000006_epic3_rpc_functions.sql` (absence); `BACKEND_ARCHITECTURE.md` line 1009.

`BACKEND_ARCHITECTURE.md` §23 lists, among the actions requiring an `audit_log` entry: *"pickup pass creation/revocation and scan results (custody-adjacent, high sensitivity)."* Unlike `platform.activity_log`/`notifications` (genuinely deferred to Epic 9/Epic 4 and correctly documented as such throughout this delivery), `platform.audit_log`/`write_audit_log` already exists since Epic 1 and is already called by this very Epic's own `add-bus` Edge Function. `create_pickup_pass`, `scan_pickup_pass`, and `confirm_handover` never call it. This was a genuine, already-implementable requirement that was incorrectly folded into the "deferred to a later Epic" bucket in `EPIC_3_COMPLETION_REPORT.md`'s Known Limitations §7.3, when it should not have been.

**Severity: High.**

---

### H2 — No `notifications` table write, despite `BACKEND_EXECUTION_PLAN.md` explicitly requiring one "from day one" as risk mitigation

**Where:** entire delivery (absence); `BACKEND_EXECUTION_PLAN.md` Epic 3 §11 and §25.

§11 ("Background Jobs Involved") reads: *"None new (notification dispatch for trip/handover events is stubbed until Epic 4; see Risk below)."* §25's "Notification stub risk" then reads: *"mitigated by writing to the `notifications` table (in-app feed) from day one even though push/WhatsApp delivery is stubbed, so nothing is silently lost once Epic 4 activates delivery."* This is an explicit, unambiguous instruction: create/write a `notifications` table row for trip/handover events now, even though actual push/WhatsApp *delivery* is correctly deferred. Epic 3 does neither — no `notifications` table exists, and no RPC writes to one. `EPIC_3_COMPLETION_REPORT.md`'s Known Limitations §7.3 again incorrectly lumps this together with the genuinely-deferred delivery mechanism, missing the distinction the execution plan itself draws between "delivery" (correctly deferred) and "in-app row, written now" (not deferred, and not implemented).

**Severity: High.**

---

### H3 — Missing RLS `UPDATE` policy on `safety.pickup_passes` for reception causes `scan_pickup_pass`'s lazy-expiry write to silently no-op

**Where:** `20260717000005_epic3_rls_policies.sql` (absence of `pickup_passes_update_reception`); `20260717000006_epic3_rpc_functions.sql`, `scan_pickup_pass` lines 479-482.

`scan_pickup_pass` is a plain (non-`SECURITY DEFINER`) function that runs as the calling reception user. When it discovers an `active` pass is past `expires_at`, it executes `UPDATE safety.pickup_passes SET status = 'expired' WHERE id = v_pass.id`. No RLS policy grants `reception` `UPDATE` on `safety.pickup_passes` (only `guardian` has one, scoped to `created_by = auth.uid()`). Under `FORCE ROW LEVEL SECURITY`, this `UPDATE` matches zero rows and — because the code never checks the affected row count — raises no error. The pass's `status` column never actually transitions to `'expired'` in the database.

**Impact:** functionally self-healing for `scan_pickup_pass` itself (its classification logic separately checks `expires_at < now()` regardless of the persisted `status`), but any other reader of `pickup_passes.status` — the guardian's own `pickup_passes_select_guardian` view, a future "list my active passes" screen, reporting — will show a pass as `'active'` forever after it has actually expired. This is a genuine, silent correctness defect: a mutation that should either succeed or raise a clear error instead does neither.

**Severity: High.**

---

### H4 — `add-bus`'s saga compensation doesn't remove the `driver_profiles` row before deleting the Auth user, so the compensation itself fails on a bus-creation error

**Where:** `backend/supabase/functions/add-bus/index.ts` lines 140-144; `backend/src/services/addBusService.ts`, the `catch` block around `buses.createWithDriver`.

The saga is: create Auth user → insert `driver_profiles` row (compensate by deleting the Auth user on failure) → call `create_bus_with_driver_row` (compensate by deleting the Auth user on failure). The second compensation step is wrong: by the time it runs, the `driver_profiles` row from step 2 has already committed, and `identity.driver_profiles.id references auth.users(id) on delete restrict` (Epic 1). Calling `admin.auth.admin.deleteUser(authUser.user.id)` at this point will itself fail with a foreign-key-restrict violation — the failure is caught by a bare `.catch()` that only logs `"manual cleanup required"`, never surfaced to the caller or retried.

**Impact:** on a bus-creation failure after driver-profile creation succeeds (e.g. a transient DB error, an unexpected constraint violation), the system is left with an orphaned Auth user and `driver_profiles` row with no bus assigned — indistinguishable from a legitimate driver awaiting bus assignment, and the operator is never actually told cleanup is needed (the log line claims it, but the underlying delete failure reason is swallowed). This is the same saga-atomicity defect class `EPIC_2_REVIEW.md` C3 found and fixed once already (for `enroll-child`), reintroduced here in a new two-step saga shape that wasn't adapted for it. Present identically in both the Edge Function and the Node `AddBusService`.

**Severity: High.**

---

### H5 — `identity-documents` guardian read/write policies are tenant-prefix-only, not scoped to the guardian's own uploads

**Where:** `20260717000007_epic3_storage_and_realtime.sql`, `identity_documents_write_guardian`/`identity_documents_read_guardian`.

These new policies (added so guardians can upload a pickup-pass ID photo) check only `bucket_id = 'identity-documents' and role = 'guardian' and (storage.foldername(name))[1] = current_tenant_id()::text` — the same tenant-prefix-only granularity Epic 1 used when this bucket was manager-only. Epic 1's own comment on this bucket explicitly notes: *"identity-documents: tightest access tier — manager only... `§21: never public`."* Extending write access to the much larger, less-trusted guardian population with the same coarse tenant-prefix scoping (rather than a guardian-owned subpath, e.g. `{tenant_id}/pickup-passes/{guardian_id}/...`) means any guardian can overwrite or read **any** object in their tenant's `identity-documents` folder — including another guardian's uploaded photo, or a staff member's uploaded national ID scan.

**Impact:** a compromised or malicious guardian account can overwrite or exfiltrate identity documents belonging to other guardians or to staff within the same tenant, in a bucket §21 explicitly designates as the platform's tightest-access-tier, never-public storage.

**Severity: High.**

---

### H6 — `current_driver_rider_ids()`, the RLS helper explicitly named in `BACKEND_EXECUTION_PLAN.md` §15, was never implemented

**Where:** entire delivery (absence); `BACKEND_EXECUTION_PLAN.md` Epic 3 §15.

§15 ("Required RLS Policies") states: *"`current_driver_rider_ids()` exercised for the first time."* No function by this name exists anywhere in this delivery. Epic 3 instead built `current_driver_bus_ids()`/`current_driver_trip_ids()` (both `uuid[]`-returning, correctly following the Epic 2 lesson) plus `academic.children_driver_safe()` (a differently-shaped, table-returning, column-narrowing function) to cover the equivalent capability. The column-narrowing choice may well be the better design (it matches the `children_reception_safe()` precedent for exactly the same PII-exposure reason), but it is not the function the execution plan names, and no policy anywhere calls a function with this name — a naming/traceability gap for anyone cross-referencing the architecture documents against the shipped code.

**Severity: High** — not a security defect, but a concrete, unambiguous deviation from a specifically-named requirement, and it obscures the actual authorization surface from anyone auditing against the documented design.

---

## Medium

### M1 — `trip_stop_riders`'s driver/guardian-scoped policies use subqueries, contradicting this migration's own stated design principle

**Where:** `20260717000005_epic3_rls_policies.sql`, `trip_stop_riders_select_driver`, `trip_stop_riders_select_guardian`, `trip_stop_riders_insert_driver`.

The migration's file header states: *"direct equality checks against a `uuid[]` helper, never a raw subquery, for every table that can carry its own scoping column (§13.1's single-equality-check invariant, applied here from the start per `EPIC_2_REVIEW.md` H3's lesson)."* These three policies use `trip_stop_id in (select id from transport.trip_stops where trip_id = any(...))` / `bus_rider_id in (select id from transport.bus_riders where child_id = any(...))` — exactly the subquery shape H3 fixed elsewhere. `trip_stop_riders` doesn't carry a denormalized `trip_id`/`child_id` column to make a direct equality check possible, which is presumably why the subquery was used, but this is then a direct contradiction of the file's own stated principle, not an oversight-free exception. Given this table's row count scales with trip × rider count, the subquery cost is also a (currently modest) performance concern.

**Severity: Medium.**

---

### M2 — `start_trip` uses a per-rider procedural loop instead of a set-based insert, contradicting the Epic 2 L2 lesson this file's header claims is "applied proactively"

**Where:** `20260717000006_epic3_rpc_functions.sql`, `public.start_trip` lines 190-209.

`EPIC_2_REVIEW.md` L2 specifically flagged and fixed a per-record `PL/pgSQL` loop in `mark_attendance` in favor of one set-based `INSERT ... SELECT`. `start_trip` reintroduces the same shape: for each active rider, three separate `INSERT` statements execute inside a `FOR` loop (potentially 60+ individual statements for a full bus). This is not incorrect, but it is the exact anti-pattern this codebase's own established convention says to avoid, and this migration's header explicitly (and, on this point, inaccurately) claims every Epic 2 lesson was applied proactively.

**Severity: Medium.**

---

### M3 — TOCTOU races in `start_trip` and `assign_bus_rider` surface raw Postgres constraint-violation errors instead of the clean `STATE_ALREADY_PROCESSED` pattern this codebase otherwise uses

**Where:** `20260717000006_epic3_rpc_functions.sql`, `start_trip` lines 180-188; `assign_bus_rider` lines 71-83.

`start_trip` does `if exists(select 1 from trips where bus_id=... and leg=... and service_date=current_date) then raise '...already started...'` followed by a separate `INSERT`. Two concurrent calls for the same bus/leg/day can both pass the `exists` check before either commits; the second then hits the `trips_bus_leg_date_key` unique constraint directly rather than the intended clean error. `assign_bus_rider` has the analogous shape for the "one active rider per child" invariant: it deactivates-then-inserts without locking the child first, so two concurrent assignments of the same child to different buses can both pass their own bus's capacity check and both attempt an active insert; `bus_riders_active_child_key` prevents actual double-booking, but the losing call gets a raw `unique_violation`. `EPIC_2_REVIEW.md` M1 fixed this exact class of problem elsewhere in this codebase by folding the check into the write's own `WHERE`/`ON CONFLICT` clause; neither Epic 3 RPC does so. `src/lib/rpcError.ts`'s `toAppError()` does gracefully degrade the resulting raw error to a generic `VALIDATION_FAILED` (not a crash), but the surfaced `human_message_en` is the raw, untranslated Postgres constraint message rather than a clean bilingual one.

**Severity: Medium** — self-healing at the data-integrity level (the unique indexes are correct and do prevent corruption), but a real UX/error-hygiene regression against an established convention, reachable under realistic concurrent use (e.g. a driver double-tapping "Start Trip").

---

### M4 — No RPC or workflow ever sets a pickup pass's status to `'revoked'`

**Where:** entire delivery (absence).

`safety.pickup_pass_status` includes `'revoked'`, `scan_pickup_pass` correctly branches on it (`invalid_revoked`), and RLS/read paths are built assuming it can occur — but no RPC, Edge Function, or trigger in this delivery ever writes it. The only way a pass's `status` column can currently change post-creation is the guardian's own unrestricted `UPDATE` grant (see M5) or the lazy expiry inside `scan_pickup_pass`. There is no legitimate staff-initiated revocation path (e.g. "the guardian made a mistake, or the pass photo/QR was compromised, and staff need to invalidate it").

**Severity: Medium.**

---

### M5 — Guardians have unrestricted `UPDATE`/`DELETE` on their own pickup passes, with no column or state restriction

**Where:** `20260717000005_epic3_rls_policies.sql`, `pickup_passes_update_guardian`, `pickup_passes_delete_guardian`.

Both policies check only `role = 'guardian' and created_by = auth.uid()` — no restriction on which columns can change or what the current `status` is. A guardian can directly `PATCH` `status` back to `'active'` after a pass has expired or (if M4 were ever fixed) been revoked, or edit `person_name`/`relation` on a pass that reception has already scanned and confirmed a handover against — altering the record of who was authorized after the fact. `pickup_scan_events` (the immutable audit trail of the actual scan) isn't affected, but the pass record itself, which a future incident review might reasonably consult, is mutable in ways that don't reflect its lifecycle.

**Severity: Medium.**

---

### M6 — `identity.driver_profiles.bus_id` is never written by any code path

**Where:** entire delivery (verified via `grep`, no `UPDATE`/`SET` of this column anywhere); FK added in `20260717000002_epic3_fleet_and_trip_tables.sql` line 58.

The additive FK (`driver_profiles_bus_id_fkey`) was correctly added per the established Epic 2 pattern (mirroring `staff_profiles.primary_classroom_id`), but nothing ever populates the column it constrains — every Epic 3 mutation only ever sets `transport.buses.driver_id` (the inverse direction of the same conceptual relationship). `driver_profiles.bus_id` is therefore permanently `null` for every driver, despite the FK's evident purpose (`BACKEND_ARCHITECTURE.md`'s own Epic 1 comment: *"bus_id uuid null, -- FK to transport.buses, added in Epic 3"*, clearly anticipating it would be populated once Epic 3 landed).

**Impact:** low today (nothing in this delivery reads `driver_profiles.bus_id`), but it's a landmine for any future Epic or query that reasonably expects this column to reflect the assignment recorded via `buses.driver_id`.

**Severity: Medium.**

---

### M7 — No uniqueness constraint on `transport.buses` for `(tenant_id, plate)` or `(tenant_id, number)`

**Where:** `20260717000002_epic3_fleet_and_trip_tables.sql`, `transport.buses` table definition.

Both `plate` and `number` are free-text `NOT NULL` columns with a non-empty `CHECK` but no uniqueness constraint within a tenant. Two buses with an identical plate (the same physical vehicle registered twice, whether by mistake or by a duplicate `add-bus` retry that isn't idempotent — see L1) can coexist.

**Severity: Medium.**

---

### M8 — `transport.trip_stops.lat`/`lng` lack the range `CHECK` that `gps_pings` and `academic.children` both enforce

**Where:** `20260717000002_epic3_fleet_and_trip_tables.sql`, `transport.trip_stops` table definition (lines ~270-280) vs. `transport.gps_pings` (lines 412-413).

`gps_pings.lat`/`lng` are constrained `between -90 and 90`/`between -180 and 180`; `academic.children.address_lat`/`address_lng` carry the equivalent Epic 2 constraint (`EPIC_2_REVIEW.md` M6). `trip_stops.lat`/`lng` — populated directly from `children.address_lat`/`address_lng` inside `start_trip` — have no such constraint, an inconsistency in an otherwise-consistently-applied validation convention across this codebase.

**Severity: Medium.**

---

### M9 — `trip_stop_riders`'s own migration comment claims "Manager: CRUD" but no such policy exists

**Where:** `20260717000005_epic3_rls_policies.sql` lines 174-176 (comment) vs. lines 180-194 (actual policies).

The section comment reads *"Manager: CRUD. Driver: R,U own trip. Guardian: R own child's row."* — but only `trip_stop_riders_select_manager` exists for the manager role; there is no `INSERT`/`UPDATE`/`DELETE` policy for manager at all. A manager cannot manage this table through the documented API surface. This incidentally satisfies `BACKEND_EXECUTION_PLAN.md` §19's acceptance criterion that a trip's `trip_stop_riders` snapshot be "immutable once the trip starts" (nobody but the RPC's own `service_role`-adjacent path — actually not even that, since `start_trip` runs as the driver — can write it after creation), but the comment itself is inaccurate and should not be read as a reflection of actual manager capability.

**Severity: Medium** (documentation-accuracy, not a security gap — arguably the safer of the two possible mismatches, but still worth correcting).

---

### M10 — `TransportService`/`SafetyService` don't replicate `AcademicRecordService`'s defense-in-depth entity-fetch pattern

**Where:** `backend/src/services/transportService.ts`, `backend/src/services/safetyService.ts` (all methods) vs. `backend/src/services/academicRecordService.ts` (`withdrawChild`/`suspendChild`/`reactivateChild`).

`AcademicRecordService` fetches the target entity first, checks it exists, and distinguishes `NOT_FOUND` from `PERM_TENANT_MISMATCH` before delegating to the repository — established specifically as a defense-in-depth / clean-error-UX layer on top of the RPC's own enforcement (`§28`). `TransportService`/`SafetyService`'s methods (`assignBusRider`, `startTrip`, `createPickupPass`, etc.) all forward directly to the repository/RPC with only a role check at the Node layer, relying entirely on the RPC's own error surface for tenant-mismatch/not-found cases. Not a security gap — the RPC still enforces tenant scoping correctly — but an architectural inconsistency with the pattern this codebase otherwise established, and a less precise error experience (e.g. a manager targeting a bus in a different tenant gets whatever `NOT_FOUND`/generic error the RPC happens to raise, rather than a clean `PERM_TENANT_MISMATCH` distinguished at the service layer).

**Severity: Medium.**

---

## Low

### L1 — `assign_bus_rider` is not idempotent under client retry

**Where:** `20260717000006_epic3_rpc_functions.sql`, `public.assign_bus_rider`.

A retried call (e.g. after a network timeout following a successful-but-unacknowledged first call) for the same child+bus deactivates the just-created active row and inserts a brand-new one, rather than being a no-op. Harmless to capacity/correctness (the old row is properly deactivated first), but creates duplicate, noisy assignment-history rows for what was logically one event.

**Severity: Low.**

---

### L2 — Driver-scoped RLS helpers don't check `driver_profiles.deleted_at`

**Where:** `20260717000004_epic3_rls_helpers.sql`, `current_driver_bus_ids()`, `academic.children_driver_safe()`.

Neither checks whether the calling driver's own `driver_profiles` row is soft-deleted/terminated — only whether the *bus* is non-deleted. A terminated driver whose Auth session hasn't yet been revoked could retain visibility into their former bus/roster until session revocation completes. This mirrors a pre-existing, identical gap in Epic 1/2's own staff-scoped helper (`current_staff_classroom_ids()` doesn't check `staff_profiles.deleted_at` either) — not a new regression introduced by Epic 3, but not fixed here either.

**Severity: Low.**

---

### L3 — No upper bound on `create_pickup_pass`'s caller-supplied `expiresAt`

**Where:** `backend/src/validation/transport.schema.ts`, `createPickupPassSchema`; `20260717000006_epic3_rpc_functions.sql`, `create_pickup_pass`.

`expiresAt` is validated only as "a parseable date" — no maximum offset from `now()`. A guardian can mint a pass valid for years. Low real-world risk (the pass still requires reception to physically scan it and a valid person to present it), but no defensive cap exists at either the Zod or SQL layer.

**Severity: Low.**

---

### L4 — `toAppError()`'s fallback path can leak an untranslated, raw Postgres message to the end user

**Where:** `backend/src/lib/rpcError.ts` lines 82-87 — reached by the TOCTOU races in M3.

When an error doesn't match this codebase's own structured `{code, human_message_en, human_message_ar}` `DETAIL` payload (e.g. a raw `unique_violation` from M3), `toAppError()` surfaces the raw Postgres `message` verbatim as `human_message_en` and falls back to a generic Arabic string rather than a translation of the actual message. This is an inherited Epic 1/2 design characteristic, not new to Epic 3, but Epic 3's two TOCTOU races (M3) are the first place in this codebase's delivered code where this fallback path becomes newly, concretely reachable in normal (if unlucky) operation rather than only via truly unexpected errors.

**Severity: Low.**

---

### L5 — New tests provide no coverage of any Critical/High finding in this review

**Where:** `backend/tests/unit/{transportService,safetyService,addBusService,transportValidation,transportApiRoutes}.test.ts` (48 tests, fully mocked repositories); `backend/tests/rls/epic3_rls_adversarial.sql` (10 tests, unexecuted per its own `README.md`).

None of the 48 new unit tests exercise a real RPC body or a real RLS policy — they assert against hand-written fake repository/port implementations, so they cannot and do not catch C1-C5, H1-H6, or M1-M10 above. The RLS adversarial suite, even if it were executed, doesn't test `buses_update_driver`'s over-broad access, the missing `pickup_passes` reception `UPDATE` policy, `update_child_trip_status`'s missing rider-membership check, or the `pickup_scan_events`/`trips` direct-table-bypass scenarios in C2 — none of its 10 tests target these paths. This exactly mirrors `EPIC_2_REVIEW.md` H4's finding: "140 tests passing" is a true and accurate statement about the TypeScript control-flow layer, and provides no evidence about the SQL layer's actual behavior once deployed.

**Severity: Low** (a process/coverage observation, not a defect in the delivered code itself — listed for completeness since the review instructions specifically called out test review).

---

## Cross-reference: recurring defect classes from Epic 2 that reappear in Epic 3

For visibility, several Critical/High findings above are not novel defect *types* — they are the same class of bug `EPIC_2_REVIEW.md` already found and fixed once in this codebase, reintroduced in new code:

| Epic 2 finding | Epic 3 recurrence |
|---|---|
| C1 — RLS grants raw table access that bypasses RPC-only business rules | C2 |
| C2 — RPC doesn't validate a referenced child belongs to the referenced parent entity | C3 |
| C3 — Multi-step saga has no compensation for a failure after the first write commits | H4 |
| M1 — check-then-act instead of atomic `UPDATE...WHERE` | M3 |
| L2 — set-based write preferred over a per-record loop | M2 |

This pattern — the same lesson being learned, fixed, and then not carried forward into the next Epic's first draft — is itself worth flagging as a process observation: `EPIC_3_COMPLETION_REPORT.md`'s own opening paragraph claims *"every lesson from the Epic 2 review/fix/deployment-failure cycle was applied from the first draft rather than retrofitted"* — true for the specific mechanical lessons named there (array-returning RLS helpers, tenant-consistency triggers, hex UUID fixtures), but not true for the broader, more general lesson each of those specific fixes was an instance of (validate every foreign-key reference an RPC accepts; RLS must encode the RPC's business rule, not just tenant/role; sagas need compensation for every commit point, not just the first).
