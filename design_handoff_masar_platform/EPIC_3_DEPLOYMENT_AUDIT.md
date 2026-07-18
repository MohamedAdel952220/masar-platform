# Epic 3 Deployment Audit

**Scope:** the live/linked Supabase project, as represented by every file in `backend/supabase/migrations/20260717*.sql`, `backend/supabase/functions/add-bus/`, and the Epic 3 additions to `backend/src/**`, in their final post-`EPIC_3_FIX_REPORT.md` state. **Method:** every migration re-read in full; every table, enum, constraint, FK, index, RLS policy, helper function, and RPC cross-checked one by one against `BACKEND_ARCHITECTURE.md` §3.25-3.32/§12/§13/§14.2/§15/§18/§21/§23/§27 and `BACKEND_EXECUTION_PLAN.md`'s Epic 3 section; TS repository RPC call sites cross-checked against final RPC parameter names; `config.toml` and seed scripts checked for compatibility.

**Environment limitation (unchanged from every prior audit in this project):** no Docker, `psql`, or Supabase MCP/CLI connection is available in this sandbox. Every claim below is a **static** verification against the migration files themselves — balanced SQL, correct object-creation order, correct grants, internal cross-references resolving — not a live query against the deployed project. The user's statement that deployment succeeded is taken at face value; this audit checks that the *deployed source* is internally correct and architecture-compliant, not that the live database matches it byte-for-byte.

**This is documentation only. No code was modified.**

---

## 1. Migrations verified

All 7 Epic 3 migrations, in order:

1. `20260717000001_epic3_transport_schema.sql` — `transport`/`safety` schema creation. OK.
2. `20260717000002_epic3_fleet_and_trip_tables.sql` — 7 tables, 3 enums, 8 triggers (including the two added during the fix pass: `check_trip_immutable_fields`, and the corrected `check_bus_rider_consistency`). OK — every object referenced by a later migration (buses, bus_riders, trips, trip_stops, trip_stop_riders, trip_child_status, gps_pings) is created here, before any later migration needs it.
3. `20260717000003_epic3_safety_tables.sql` — 2 tables, 3 enums, plus the two fix-pass additions (`safety.pickup_scan_rate_limits`, `platform.notification_outbox`), both created here — before migration 6 (which writes to both) needs them. OK.
4. `20260717000004_epic3_rls_helpers.sql` — 5 `uuid[]`-returning helpers (including the fix-pass-added `current_driver_rider_ids()`), `academic.children_driver_safe()`, `academic.set_child_day_path_status()` — all created before migration 5 (policies referencing them) and migration 6 (RPCs calling them). OK.
5. `20260717000005_epic3_rls_policies.sql` — 53 policies across 9 tables, all `FORCE ROW LEVEL SECURITY`. OK — every helper function referenced resolves to migration 4; every denormalized column referenced (`trip_stop_riders.trip_id`/`child_id`) resolves to migration 2.
6. `20260717000006_epic3_rpc_functions.sql` — 10 RPCs. OK — every table/function referenced resolves to an earlier migration; `platform.notification_outbox`/`safety.pickup_scan_rate_limits` (migration 3) and `academic.set_child_day_path_status` (migration 4) are both available by this point.
7. `20260717000007_epic3_storage_and_realtime.sql` — 2 storage policies, 3 realtime publication additions. OK.

No migration references an object defined in a later-numbered migration. No migration modifies an Epic 1 (`20260714*`) or Epic 2 (`20260715*`) file — confirmed by direct inspection of all 7 files' `ALTER`/`CREATE` targets: every `ALTER TABLE` targets either an Epic 3 table or the two documented additive Epic 1/2 extension points (`identity.driver_profiles.bus_id` FK, `public.withdraw_child` via `CREATE OR REPLACE`).

---

## 2. Tables verified (9 + 2 support tables)

| Table | §3.25-32 match | Notes |
|---|---|---|
| `transport.buses` | Yes | Plus fix-pass additions: `buses_tenant_plate_key`/`buses_tenant_number_key` unique indexes (not in the original architecture doc field list — a correctness addition, see §6). |
| `transport.bus_riders` | Yes | Partial unique index on `(child_id) WHERE active` matches §5's documented invariant exactly. |
| `transport.trips` | Yes | |
| `transport.trip_stops` | Yes | `lat`/`lng` now carry the same range `CHECK` as `gps_pings`/`children` (fix-pass addition). |
| `transport.trip_stop_riders` | Yes, plus 2 denormalized columns | `trip_id`/`child_id` added beyond §3.28's literal field list (fix-pass addition, for RLS single-equality-check compliance with §13.1 — not a spec deviation, a spec *compliance* fix). |
| `transport.trip_child_status` | Yes | |
| `transport.gps_pings` | Yes | |
| `safety.pickup_passes` | Yes | |
| `safety.pickup_scan_events` | Yes | |
| `safety.pickup_scan_rate_limits` | Not in §3.25-32 | Fix-pass addition (`EPIC_3_REVIEW.md` C5) — see §6. |
| `platform.notification_outbox` | Not in §3.25-32 | Fix-pass addition (`EPIC_3_REVIEW.md` H2) — see §6, §7. |

## 3. Enums verified (6)

`transport.trip_leg`, `transport.trip_status`, `transport.trip_child_status_value`, `safety.pickup_person_relation`, `safety.pickup_pass_status`, `safety.pickup_scan_result` — all six match §3.25-32's documented value lists exactly (cross-checked value-by-value).

## 4. Constraints and foreign keys verified

- Every table's `tenant_id` FK → `tenancy.tenants(id) ON DELETE RESTRICT` — present on all 11 tables (9 business + 2 support), zero exceptions, matching §2.2's "zero exceptions" convention.
- `identity.driver_profiles.bus_id` FK → `transport.buses(id) ON DELETE SET NULL` — additive extension confirmed present, correctly deferred until `transport.buses` exists (migration 2, after the FK's own table).
- `bus_riders_active_child_key` (partial unique, `WHERE active`) — matches §5's "one active bus assignment per child" invariant literally.
- `trips_bus_leg_date_key` (unique on `bus_id, leg, service_date`) — present, and `start_trip` (migration 6) correctly targets it via `ON CONFLICT (bus_id, leg, service_date)`.
- `pickup_passes_qr_token_key` (unique, global) — present, matches §5's "`pickup_passes.qr_token` globally unique" requirement exactly.
- `buses_tenant_plate_key`/`buses_tenant_number_key` — fix-pass additions, not in the original doc, correctly implemented as tenant-scoped partial unique indexes.
- All `CHECK` constraints (non-empty text fields, positive capacity, lat/lng ranges, non-negative speed) verified present and consistent with the equivalent Epic 2 conventions (`children.address_lat`/`lng`, etc.).

No missing constraint was found relative to §3.25-32/§5.

## 5. Indexes verified

Every table carries a `tenant_id` index (or a composite leading with `tenant_id`), matching §2.2's RLS-baseline convention. `gps_pings (trip_id, recorded_at desc)` and `pickup_passes (qr_token)` match §6's explicitly-named index requirements exactly ("must be O(log n), it's on the critical path of a physical handover"). `trips (bus_id) WHERE status IN (...)` matches the "current trip" partial-index pattern used elsewhere in this codebase. No missing index identified against §6.

## 6. RLS policies verified (53 policies, 9 business tables + 2 zero-policy support tables)

All 9 business tables carry `ENABLE`+`FORCE ROW LEVEL SECURITY`. Policy-by-policy re-verification against the final (post-fix) state confirms:
- `transport.buses` has no driver `UPDATE` policy (removed per `EPIC_3_REVIEW.md` C2 — confirmed absent).
- `transport.trips`'s driver `UPDATE` policy is scoped to exactly the `complete_trip` transition (non-terminal → `'completed'`), matching the RPC's own guard.
- `transport.gps_pings`'s driver `INSERT` policy includes the trip-not-terminal `EXISTS` check.
- `safety.pickup_passes` carries both `pickup_passes_update_guardian` (tightened to `status = 'active'`) and the new `pickup_passes_update_reception` (scoped to `active → expired` only).
- `safety.pickup_scan_events`'s reception `UPDATE` policy is scoped to `result = 'valid' AND NOT handover_confirmed → handover_confirmed = true`, matching `confirm_handover`'s own guard exactly.
- `transport.trip_stop_riders`'s three role-scoped `SELECT`/`INSERT` policies use direct `= any(...)` equality against the migration-2 denormalized columns, not a subquery.
- `safety.pickup_scan_rate_limits` and `platform.notification_outbox` both have zero policies under `FORCE ROW LEVEL SECURITY` — a correct, intentional hard-deny for tables with no legitimate direct caller.

No RLS gap from `EPIC_3_REVIEW.md` (C2, C3-adjacent, H3, H5) was found reopened in the deployed source.

## 7. Helper functions verified

`current_driver_bus_ids()`, `current_driver_trip_ids()`, `current_driver_rider_ids()`, `current_guardian_active_bus_ids()`, `current_guardian_active_trip_ids()` — all `RETURNS uuid[]`, never `SETOF` (confirmed, avoiding the `EPIC_2_DEPLOYMENT_FIX.md` failure mode). `current_driver_bus_ids()` correctly includes the `driver_profiles.deleted_at IS NULL` check added for `EPIC_3_REVIEW.md` L2. `academic.children_driver_safe()` and `academic.set_child_day_path_status()` (now 3-parameter, `EXECUTE` revoked from `authenticated`) both verified present and correctly grant-restricted.

`current_driver_rider_ids()` satisfies `BACKEND_EXECUTION_PLAN.md` §15's literal naming requirement ("`current_driver_rider_ids()` exercised for the first time") — this was missing at Epic 3's original completion and is now present (added during the `EPIC_3_REVIEW.md` H6 fix).

## 8. RPCs verified (10)

All 10 present with correct grants (`create_bus_with_driver_row` → `service_role` only; the other 9 → `authenticated`). Security-context re-verified: `update_child_trip_status`, `scan_pickup_pass`, `confirm_handover`, and `withdraw_child` are `SECURITY DEFINER` with `search_path = ''` and every internal reference fully schema-qualified (spot-checked line by line — no unqualified table/function reference found in any of the four). `withdraw_child`'s cascade (into `pickup_passes`/`bus_riders`) and the corrected `check_bus_rider_consistency` trigger (which no longer requires the child to be non-deleted) are both present and mutually consistent.

**Return-shape deviations from §14.2's literal contract** (see §11, Architecture Deviations) — non-breaking, but worth recording:
- `record_gps_ping`, `update_child_trip_status`, `confirm_handover` are documented as `→ void`; all three return the affected row instead.
- `create_pickup_pass` is documented as `→ {pass, qr_payload}`; it returns the pass row directly (the token is reachable as `pass.qrToken`, not a separate `qr_payload` key).

`revoke_pickup_pass` is not in the original §14.2 catalog — a fix-pass addition (`EPIC_3_REVIEW.md` M4) with no equivalent documented RPC; see §11.

## 9. Edge Function verified

`add-bus` — the only Edge Function §7 of the execution plan requires for this Epic. Saga compensation order re-verified: on a bus-creation failure, `driver_profiles` is deleted before the Auth user (the `EPIC_3_REVIEW.md` H4 fix), avoiding the `ON DELETE RESTRICT` failure the original delivery had.

## 10. Storage verified

No new bucket — `identity-documents` (Epic 1) is reused, matching §9/§21 exactly. Guardian read/write policies now require the path's 2nd/3rd segments to be `pickup-passes/{own auth.uid()}` (the `EPIC_3_REVIEW.md` H5 fix) — confirmed present in migration 7, alongside Epic 1's untouched manager policies on the same bucket.

## 11. Realtime verified

`transport.gps_pings`, `transport.trips`, `transport.trip_child_status` added to `supabase_realtime` — matches §6 of the execution plan ("`postgres_changes` on `gps_pings`/`trips`/`trip_child_status`") exactly. `academic.day_path_events` (Epic 2's own publication addition) is unchanged and is now actually exercised by Epic 3's write path, matching §10's "`classroom:{id}:day_path` (now fully exercised)" note.

## 12. Seed compatibility verified

Epic 1's `seed-dev-data.mjs` and Epic 2's `seed-dev-data-epic2.mjs` contain zero references to any `transport.*`/`safety.*` table or to `identity.driver_profiles` — confirmed by direct grep. Neither seed script can be broken by any Epic 3 constraint (new `NOT NULL` columns, new triggers, new unique indexes), since neither ever writes to the tables those constraints live on. **No `seed-dev-data-epic3.mjs` was ever created** — see §13, Missing Items.

---

## 13. Missing items

1. **No `seed-dev-data-epic3.mjs`.** Both Epic 1 and Epic 2 shipped a seed script enabling Integration Validation against realistic data; Epic 3 has none. This does not block deployment or block any RPC/policy from functioning — it means end-to-end QA of buses/trips/pickup-passes currently requires manual API calls rather than a repeatable seeded dataset. Recommended before Epic 3 is exercised in a QA pass, not before Epic 4 begins.
2. **`platform` schema is not in `config.toml`'s exposed `schemas` list**, and this predates Epic 3 — it has never included `platform` since Epic 1. `platform.audit_log` carries RLS `SELECT` policies for `platform_admin` and manager (own tenant), created in Epic 1, implying a direct-REST-read design (matching `BACKEND_ARCHITECTURE.md`'s description of a Platform Admin "Audit" screen) — but PostgREST cannot expose a table in a schema that isn't in this list, regardless of its RLS policies. This is now newly *relevant* to Epic 3 because `platform.notification_outbox` (this Epic's own fix-pass addition) lives in the same unexposed schema — by design, for `notification_outbox` specifically, since it has zero RLS policies and is meant to be reached only via `SECURITY DEFINER` RPCs and a future Epic 4 service-role dispatcher, not directly. For `audit_log`, however, this looks like a genuine, still-open gap from Epic 1 that this audit is surfacing because Epic 3 is the first Epic to add a second object to the same blind spot. Recommend a decision (expose `platform` with a narrower `audit_log`-only policy set, or confirm the Audit screen was always intended to go through a dedicated RPC/Edge Function instead) before Epic 9 (`platform` schema's own Epic) relies on this being resolved one way or the other. **Not an Epic 3 regression and does not block Epic 3's own functionality**, which lives entirely in the already-exposed `transport`/`safety` schemas.

## 14. Deployment issues

None found. No migration references an object not yet created at that point in the sequence; no circular dependency; no grant applied to a function/table before that object exists.

## 15. Security issues

None found beyond what `EPIC_3_REVIEW.md`/`EPIC_3_FIX_REPORT.md` already identified and fixed — this audit's independent re-read of every touched policy and RPC (§6, §8) confirms each fix is present and correctly shaped in the final source. No new issue was introduced by the fix pass itself, with one exception already caught and corrected *during* that pass and documented in `EPIC_3_FIX_REPORT.md` §5 (the `check_bus_rider_consistency`/`withdraw_child` ordering bug) — re-verified here as correctly resolved in the final state.

## 16. Architecture deviations

1. `record_gps_ping`/`update_child_trip_status`/`confirm_handover` return the affected row instead of the documented `void` (§8/§11) — non-breaking, arguably an improvement (saves the caller a follow-up read), but a literal deviation from §14.2.
2. `create_pickup_pass` returns the pass row directly rather than the documented `{pass, qr_payload}` shape (§8).
3. `scan_pickup_pass`'s rate limit (`EPIC_3_REVIEW.md` C5) is enforced inside the RPC body against a Postgres table, not "at the Edge Function layer" as §27 literally states — the closest compliant option given `BACKEND_EXECUTION_PLAN.md` §7/§8's own RPC-only (no Edge Function) shape for this specific function; the architecture doc's §27 requirement and the execution plan's §7/§8 implementation shape are themselves in tension independent of this delivery.
4. `revoke_pickup_pass`, `safety.pickup_scan_rate_limits`, `platform.notification_outbox`, and `current_driver_rider_ids()` (the latter is a documented-but-originally-unimplemented requirement, not a new deviation) have no equivalent entry in `BACKEND_ARCHITECTURE.md`'s original Epic 3 catalog — all four are `EPIC_3_REVIEW.md`-driven additions, correctly explained in `EPIC_3_FIX_REPORT.md`, but a reader consulting only `BACKEND_ARCHITECTURE.md` would not find them.
5. `complete_trip` remains driver-authorized, matching §14.2's explicit RPC grant (`driver`) rather than §18's narrative description ("`completed` is a manager/system-confirmed closeout") — a pre-existing internal tension in `BACKEND_ARCHITECTURE.md` itself, not an implementation deviation; already disclosed in `EPIC_3_COMPLETION_REPORT.md`'s Known Limitations and re-confirmed unchanged here.

## 17. Documentation inconsistencies

1. `EPIC_3_COMPLETION_REPORT.md`'s RPC catalog (§4) and table/database-object counts (§3) reflect Epic 3's *original* delivery and were not retroactively updated after `EPIC_3_FIX_REPORT.md`'s additions (`revoke_pickup_pass`, `pickup_scan_rate_limits`, `notification_outbox`, `current_driver_rider_ids()`). `EPIC_3_FIX_REPORT.md` itself documents all four correctly — the completion report alone is now a stale, incomplete snapshot rather than an inaccurate one.
2. No other count/claim inconsistency was found in `EPIC_3_FIX_REPORT.md` against the actual final migration contents (policy count, table count, and grant list were independently re-counted in this audit and matched the fix report's own claims exactly: 53 policies, 10 RPCs, 9+2 tables).

---

## Verdict

No Critical, High, or Medium finding from `EPIC_3_REVIEW.md` was found reopened or incompletely fixed in the deployed source. No Epic 1 or Epic 2 migration was modified. The two Missing Items (§13) are both non-blocking for Epic 3's own functionality: the seed-script gap only limits automated QA convenience, and the `platform` schema exposure gap predates Epic 3, lives outside the schemas Epic 3's own features depend on (`transport`/`safety`, both correctly exposed), and only affects a Platform Admin screen this Epic never touches. The Architecture Deviations (§16) are all non-breaking return-shape or implementation-detail differences, already substantially self-disclosed in `EPIC_3_COMPLETION_REPORT.md`/`EPIC_3_FIX_REPORT.md`.

**READY FOR EPIC 4**
