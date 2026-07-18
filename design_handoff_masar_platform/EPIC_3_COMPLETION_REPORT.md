# Epic 3 Completion Report — Transport & Safety

Scope: `transport` + `safety` schemas, bus fleet management, trip
tracking/GPS, and the pickup-pass gate-security flow. Epic 1 and Epic 2 are
frozen — every migration in this Epic is additive (new schemas, new tables,
new functions, new policies). No Epic 1 or Epic 2 migration file, table,
column, policy, or function was modified. Every lesson from the Epic 2
review/fix/deployment-failure cycle was applied from the first draft rather
than retrofitted: RLS helper functions are `RETURNS uuid[]`, never `RETURNS
SETOF` (EPIC_2_DEPLOYMENT_FIX.md); cross-table tenant-consistency triggers
exist on every new table from its first migration (EPIC_2_REVIEW.md C1/H2);
state-transition RPCs use atomic `UPDATE ... WHERE` (EPIC_2_REVIEW.md M1);
RLS adversarial test fixtures use only valid hex UUIDs (EPIC_2_FIX_REPORT.md).

## 1. Environment reality check (read this first)

Same limitation as Epic 1/2: no Docker, no `psql`, no live Supabase project
in this sandbox. Every claim below about SQL correctness is a **static**
guarantee (balanced `$$`/parens verified programmatically, naming/grant
conventions cross-checked against Epic 1/2's shipped migrations) — not a
live-execution guarantee. `npx tsc --noEmit` and `npx vitest run` (both real
executions, see §6) cover the TypeScript layer; the SQL layer and the RLS
adversarial suite (`tests/rls/epic3_rls_adversarial.sql`) are unexecuted,
exactly as Epic 1/2's were before their own first live deployment.

## 2. Files created (26 new files; 1 one-line additive edit to shared config)

### 2.1 SQL migrations (7) — `backend/supabase/migrations/`

1. `20260717000001_epic3_transport_schema.sql` — `transport` + `safety` schemas.
2. `20260717000002_epic3_fleet_and_trip_tables.sql` — `buses`, `bus_riders`,
   `trips`, `trip_stops`, `trip_stop_riders`, `trip_child_status`,
   `gps_pings` + enums + additive FK on `identity.driver_profiles.bus_id`
   (mirrors Epic 2's `staff_profiles.primary_classroom_id` FK pattern) +
   4 tenant-consistency triggers + 1 capacity trigger.
3. `20260717000003_epic3_safety_tables.sql` — `pickup_passes`,
   `pickup_scan_events` + enums + 2 tenant-consistency triggers.
4. `20260717000004_epic3_rls_helpers.sql` — `current_driver_bus_ids()`,
   `current_driver_trip_ids()`, `current_guardian_active_bus_ids()`,
   `current_guardian_active_trip_ids()` (all `uuid[]`), plus
   `academic.children_driver_safe()` and
   `academic.set_child_day_path_status()` — both new functions added to
   Epic 2's already-existing `academic` schema, not edits to any Epic 2 file.
5. `20260717000005_epic3_rls_policies.sql` — 53 policies across the 9 new tables.
6. `20260717000006_epic3_rpc_functions.sql` — 10 RPC functions (9
   `authenticated`, 1 `service_role`).
7. `20260717000007_epic3_storage_and_realtime.sql` — 2 additive storage
   policies on Epic 1's `identity-documents` bucket + 3 Realtime publication
   additions.

### 2.2 Edge Functions (1) — `backend/supabase/functions/`

- `add-bus/index.ts` — driver + bus provisioning saga, direct extension of
  `add-staff`'s pattern (§10.3, §25.3).

### 2.3 Application layer (13 new files) — `backend/src/`

- `types/database.types.epic3.ts`, `types/domain.epic3.ts`
- `validation/transport.schema.ts`
- `repositories/driverProfileRepository.ts`, `repositories/busRepository.ts`,
  `repositories/tripRepository.ts`, `repositories/pickupPassRepository.ts`
- `services/transportService.ts`, `services/safetyService.ts`,
  `services/addBusService.ts`
- `api/routes/addBus.ts`, `api/routes/transport.ts`

### 2.4 Tests (7 new files) — `backend/tests/`

- `unit/transportService.test.ts` (13 tests)
- `unit/safetyService.test.ts` (6 tests)
- `unit/addBusService.test.ts` (5 tests)
- `unit/transportValidation.test.ts` (18 tests)
- `unit/transportApiRoutes.test.ts` (6 tests)
- `rls/epic3_rls_adversarial.sql` (10 tests, not executed — §1)
- `rls/epic3_README.md`

### 2.5 Additive config change (not a new file)

`backend/supabase/config.toml` — `schemas` list gained `"transport"` and
`"safety"`, mirroring Epic 2's identical one-line addition of `"academic"`.

## 3. Database objects created

| Object | Count |
|---|---|
| Tables | 9 (`buses`, `bus_riders`, `trips`, `trip_stops`, `trip_stop_riders`, `trip_child_status`, `gps_pings`, `pickup_passes`, `pickup_scan_events`) |
| Enums | 6 (`trip_leg`, `trip_status`, `trip_child_status_value`, `pickup_person_relation`, `pickup_pass_status`, `pickup_scan_result`) |
| Tenant-consistency triggers | 7 (one per table with a cross-table FK, except `trip_stop_riders`/`bus_riders`, which get theirs combined with tenant checks; `bus_riders` additionally carries the capacity trigger) |
| Capacity triggers | 1 (`transport.check_bus_rider_consistency`, mirrors `academic.check_children_classroom_consistency`) |
| RLS policies | 53 across 9 tables (FORCE ROW LEVEL SECURITY on all 9) |
| RLS helper functions | 4 new (`uuid[]`-returning) + 1 reused unmodified from Epic 2 (`current_guardian_child_ids()`) |
| Column-narrowing functions | 1 (`academic.children_driver_safe()`, mirrors `children_reception_safe()`) |
| Cross-epic write-seam functions | 1 (`academic.set_child_day_path_status()`, SECURITY DEFINER) |
| RPC functions | 10 (9 `authenticated`, 1 `service_role`) |
| Storage policies | 2 additive (guardian read/write on `identity-documents`) |
| Realtime tables added | 3 (`transport.gps_pings`, `transport.trips`, `transport.trip_child_status`) |

No new storage bucket — pickup-pass ID photos reuse Epic 1's
`identity-documents` bucket per the execution plan's explicit note.

## 4. RPC catalog (10)

| RPC | Grant | Notes |
|---|---|---|
| `assign_bus_rider` | authenticated (manager) | capacity-locked, deactivates prior active row |
| `unassign_bus_rider` | authenticated (manager) | atomic UPDATE...WHERE |
| `start_trip` | authenticated (driver) | snapshots bus riders into stops/status rows |
| `record_gps_ping` | authenticated (driver) | append-only, no idempotency-key (documented exception, §5) |
| `update_child_trip_status` | authenticated (driver, reception) | upsert; routes day-path change via `set_child_day_path_status` |
| `complete_trip` | authenticated (driver) | atomic UPDATE...WHERE; sets arrived_at+completed_at together (§5) |
| `create_pickup_pass` | authenticated (guardian) | opaque high-entropy `qr_token` |
| `scan_pickup_pass` | authenticated (reception) | exact-token lookup only (§13.4); always logs |
| `confirm_handover` | authenticated (reception) | atomic UPDATE...WHERE; routes day-path to `delivered` |
| `create_bus_with_driver_row` | service_role | DB half of the add-bus saga; atomic by construction |

## 5. Cross-Epic integration: the day-path write seam

Epic 2 shipped `academic.day_path_events.source` with a `'driver'` enum
value that nothing wrote yet, and documented this explicitly as anticipating
Epic 3. Rather than adding a new RLS INSERT policy on Epic 2's
`day_path_events` table (which would still be additive but widens that
table's RLS surface), Epic 3 adds one new SECURITY DEFINER function,
`academic.set_child_day_path_status()`, in Epic 2's already-existing
`academic` schema. It performs its own internal role+tenant check, then
updates `academic.children.day_path_status` and inserts the corresponding
`academic.day_path_events` row. `update_child_trip_status` and
`confirm_handover` (both Epic 3 RPCs) are its only two callers. This mirrors
`write_audit_log`'s exact justification from Epic 1: a narrow, purpose-built
write seam instead of widening a table's general RLS surface.

Mapping: AM `picked_up` → `in_bus`; AM `dropped_off` → `classroom`; PM
`picked_up` → `in_bus`; PM `dropped_off` → `delivered`; `absent` → no
day-path change. `confirm_handover` (gate pickup) routes to `delivered`
directly, completing the "handover" source Epic 2's original day-path
permission matrix named but could not implement (no `pickup_passes` table
existed in Epic 2).

## 6. Tests — actually run

```
npx tsc -p tsconfig.json --noEmit   →  0 errors
npx vitest run                       →  15 test files, 140 tests, ALL PASSING
```

The 5 new Epic 3 test files (transportService, safetyService, addBusService,
transportValidation, transportApiRoutes — 48 new tests) run against fake
in-memory repositories/ports, exactly like every existing Epic 1/2 test —
no live Supabase project involved. `tests/rls/epic3_rls_adversarial.sql` is
written but **not executed** (§1); its 10 `do $$ ... $$` blocks are meant to
be run with `psql` against a real `supabase db reset` per
`tests/rls/epic3_README.md`.

Static SQL checks performed (balanced `$$` pairs, balanced parens) on all 7
new migration files: all OK. Policy/trigger/grant counts cross-checked by
`grep` against the file contents (§3/§4 tables above).

## 7. Known limitations (explicitly scoped decisions, not oversights)

1. **No real route optimization/geocoding.** `start_trip` generates one
   `trip_stop` per active bus rider, ordered by assignment (`created_at`)
   — not a routed/sequenced pickup order. `BACKEND_ARCHITECTURE.md` §14.2's
   contract names `trip_stop_riders` as a "snapshot," not a routing engine
   requirement, and no geocoding/routing service is integrated anywhere in
   this codebase. Coordinates come straight from `academic.children`'s
   existing `address_lat`/`address_lng` columns.
2. **`'arrived'` trip status has no dedicated RPC.** §14.2's RPC contract
   list names only `start_trip` and `complete_trip` for trip-level status —
   no "mark arrived" RPC. `complete_trip` sets `arrived_at` (if not already
   set) and `completed_at` together in one driver action. The `'arrived'`
   enum value exists in the schema (matching §3.27 exactly) but is never
   independently observed as an intermediate state in v1.
3. **`activity_log`/`notifications` writes deferred.** `platform.activity_log`
   doesn't exist until Epic 9; `notifications` doesn't exist until Epic 4.
   `confirm_handover` (§14.2 names both as its side effects) omits them,
   written so a later Epic can extend it additively via `CREATE OR REPLACE`
   — the exact precedent Epic 2's `mark_attendance` set for `activity_log`.
4. **`record_gps_ping` has no idempotency-key.** A deliberate, documented
   exception to the mandatory-idempotency convention: this is a pure append
   (never an upsert, never a state transition), a retry only ever adds one
   harmless extra data point, and it is the single highest-frequency write
   in the system (§18: 5-10s client cadence) — adding idempotency-key
   bookkeeping here would contradict §29's own performance-conscious design
   for exactly this table.
5. **GPS ping retention/purge is not implemented.** §18 specifies a
   retention policy; the actual purge job is a Scheduled Jobs concern
   explicitly deferred to Epic 10 per `BACKEND_EXECUTION_PLAN.md`.
6. **`trip_child_status`'s "already in progress" narrowing for reception is
   RPC-level, not RLS-level.** §12 describes reception's write as "confirming
   an already-in-progress child's pickup/drop-off status" — at the DB layer,
   reception's UPDATE policy is tenant-wide (any row), and the INSERT
   policy exists only for driver. In practice a row always pre-exists by
   the time reception acts (created by `start_trip`'s pending-row snapshot),
   so reception's write is a pure UPDATE — matching intent without needing
   RLS to encode a business-process ordering rule row-level security isn't
   suited to expressing.
7. **No frontend wiring.** Same explicit scope boundary as Epic 1/2:
   `window.MasarClient` gains zero new methods in this delivery — this
   report covers backend only.

## 8. Manual QA checklist

- [ ] `supabase db reset` replays Epic 1 + 2 + 3 cleanly from scratch.
- [ ] Add a bus via `add-bus` — verify Auth user, `driver_profiles` row, and
      `buses` row (with `driver_id` set) all exist; verify no password is
      ever returned.
- [ ] Assign more children to a bus than its capacity — verify rejection,
      both via `assign_bus_rider` and via a direct `INSERT` (RLS bypass
      attempt) into `bus_riders`.
- [ ] Start a trip as the assigned driver — verify `trip_stops`,
      `trip_stop_riders`, and `trip_child_status` rows are created for every
      active rider.
- [ ] Record a few GPS pings during a live trip — verify a guardian whose
      child is on that bus can read them in real time (Realtime
      subscription on `trip:{trip_id}:position`), and a guardian whose
      child is not on that bus cannot.
- [ ] Mark a child `picked_up` then `dropped_off` on the AM leg as the
      driver — verify `academic.children.day_path_status` transitions
      `in_bus` → `classroom`, and a `day_path_events` row with
      `source='driver'` is written.
- [ ] Complete a trip — verify `status='completed'`, `arrived_at` and
      `completed_at` are both set, and further GPS pings on that trip are
      rejected.
- [ ] Create a pickup pass as a guardian, scan it as reception — verify
      `valid`; scan an expired one — verify `invalid_expired` and the pass's
      `status` flips to `expired`; scan a revoked one — verify
      `invalid_revoked`; scan a random string — verify `invalid_unknown` and
      that all four attempts are logged in `pickup_scan_events`.
- [ ] Confirm a handover — verify `handover_confirmed=true`, the child's
      `day_path_status` becomes `delivered`, and a second confirm attempt on
      the same scan event is rejected.
- [ ] Run `tests/rls/epic3_rls_adversarial.sql` against a real `supabase db
      reset` and confirm all 10 tests print `PASS`.

## Verdict

Epic 3 (Transport & Safety) implementation is **complete**: 7 new
migrations, 1 new Edge Function, 13 new application-layer files, 5 new unit
test files (48 tests) plus 1 RLS adversarial suite (10 tests, unexecuted per
§1), all additive to Epic 1/2. `npx tsc --noEmit` is clean; `npx vitest run`
passes 140/140 across 15 test files. Stopping here — Epic 4 is out of scope
for this delivery.
