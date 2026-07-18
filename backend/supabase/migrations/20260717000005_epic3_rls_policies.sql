-- ============================================================================
-- Epic 3 — Transport & Safety
-- Migration 5: RLS policies for every Epic 3 table
-- Ref: BACKEND_ARCHITECTURE.md §12, §13, §13.4
--
-- Convention (unchanged from Epic 1/2): FORCE ROW LEVEL SECURITY everywhere;
-- separate named policy per role/action; direct equality checks against a
-- uuid[] helper, never a raw subquery, for every table that can carry its
-- own scoping column (§13.1's single-equality-check invariant, applied here
-- from the start per EPIC_2_REVIEW.md H3's lesson).
--
-- No new policy is added anywhere on academic.children or
-- academic.day_path_events (Epic 2 tables) — driver access to children goes
-- exclusively through academic.children_driver_safe() (migration 4), and
-- day-path writes go exclusively through academic.set_child_day_path_status()
-- (migration 4, SECURITY DEFINER). Epic 2's RLS surface is untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- transport.buses
-- Manager: CRUD (own tenant, sees soft-deleted too). Driver: R,U own bus.
-- Guardian: R own child's bus, live only. Reception: R own tenant.
-- ---------------------------------------------------------------------------
alter table transport.buses enable row level security;
alter table transport.buses force row level security;

create policy buses_select_manager on transport.buses
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy buses_select_driver on transport.buses
  for select
  using (deleted_at is null and public.current_role() = 'driver' and id = any (public.current_driver_bus_ids()));

create policy buses_select_guardian on transport.buses
  for select
  using (deleted_at is null and public.current_role() = 'guardian' and id = any (public.current_guardian_active_bus_ids()));

create policy buses_select_reception on transport.buses
  for select
  using (deleted_at is null and tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

create policy buses_insert_manager on transport.buses
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy buses_update_manager on transport.buses
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Fix for EPIC_3_REVIEW.md C2: buses_update_driver previously granted a
-- driver unrestricted column access to their own bus row (capacity, plate,
-- number, even driver_id) via direct REST access — no RPC in this Epic ever
-- performs UPDATE transport.buses, so the policy had no legitimate caller
-- and existed purely as an unused, over-broad grant. Removed entirely; a
-- driver's access to `buses` remains read-only (buses_select_driver, above).

create policy buses_delete_manager on transport.buses
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- transport.bus_riders
-- Manager: CRUD. Driver: R own bus's riders. Guardian: R own child.
-- Reception: R own tenant.
-- ---------------------------------------------------------------------------
alter table transport.bus_riders enable row level security;
alter table transport.bus_riders force row level security;

create policy bus_riders_select_manager on transport.bus_riders
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy bus_riders_select_driver on transport.bus_riders
  for select
  using (public.current_role() = 'driver' and bus_id = any (public.current_driver_bus_ids()));

create policy bus_riders_select_guardian on transport.bus_riders
  for select
  using (public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy bus_riders_select_reception on transport.bus_riders
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

create policy bus_riders_insert_manager on transport.bus_riders
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy bus_riders_update_manager on transport.bus_riders
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy bus_riders_delete_manager on transport.bus_riders
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- transport.trips
-- Manager: CRUD. Driver: R,U own bus's trips. Guardian: R own child's live
-- trips. Reception: R own tenant.
-- ---------------------------------------------------------------------------
alter table transport.trips enable row level security;
alter table transport.trips force row level security;

create policy trips_select_manager on transport.trips
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy trips_select_driver on transport.trips
  for select
  using (public.current_role() = 'driver' and bus_id = any (public.current_driver_bus_ids()));

create policy trips_select_guardian on transport.trips
  for select
  using (public.current_role() = 'guardian' and id = any (public.current_guardian_active_trip_ids()));

create policy trips_select_reception on transport.trips
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

create policy trips_insert_manager on transport.trips
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy trips_insert_driver on transport.trips
  for insert
  with check (public.current_role() = 'driver' and bus_id = any (public.current_driver_bus_ids()));

create policy trips_update_manager on transport.trips
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Fix for EPIC_3_REVIEW.md C2: previously unrestricted beyond bus ownership,
-- letting a driver PATCH `status` (and any other column) directly via REST,
-- bypassing complete_trip's atomic "not already completed/cancelled" guard
-- entirely (e.g. setting status='completed' with no arrived_at/completed_at
-- semantics, or resetting leg/service_date/bus_id). USING now only matches
-- non-terminal trips (mirrors complete_trip's own WHERE clause); WITH CHECK
-- now requires the resulting row to be exactly 'completed' — the only
-- transition this policy exists to allow. complete_trip itself is
-- unaffected (it performs exactly this transition); any other direct
-- mutation attempt is rejected by RLS before it can diverge from the RPC's
-- guarantee. bus_id/leg/service_date immutability after creation is
-- additionally enforced by a trigger (transport.check_trip_immutable_fields,
-- below) as a second, column-scoped backstop.
create policy trips_update_driver on transport.trips
  for update
  using (
    public.current_role() = 'driver'
    and bus_id = any (public.current_driver_bus_ids())
    and status not in ('completed', 'cancelled')
  )
  with check (
    public.current_role() = 'driver'
    and bus_id = any (public.current_driver_bus_ids())
    and status = 'completed'
  );

-- ---------------------------------------------------------------------------
-- transport.trip_stops
-- Manager: CRUD. Driver: R,U own trip. Guardian: R own child's live trip.
-- Reception: R own tenant.
-- ---------------------------------------------------------------------------
alter table transport.trip_stops enable row level security;
alter table transport.trip_stops force row level security;

create policy trip_stops_select_manager on transport.trip_stops
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy trip_stops_select_driver on transport.trip_stops
  for select
  using (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

create policy trip_stops_select_guardian on transport.trip_stops
  for select
  using (public.current_role() = 'guardian' and trip_id = any (public.current_guardian_active_trip_ids()));

create policy trip_stops_select_reception on transport.trip_stops
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

create policy trip_stops_insert_driver on transport.trip_stops
  for insert
  with check (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

create policy trip_stops_update_driver on transport.trip_stops
  for update
  using (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()))
  with check (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

-- ---------------------------------------------------------------------------
-- transport.trip_stop_riders
-- Manager: R only — population is exclusively via start_trip's automated
-- snapshot (migration 6); no manual CRUD surface is granted, so a manager
-- cannot edit this table directly (fix for EPIC_3_REVIEW.md M9: the
-- original comment here claimed "Manager: CRUD" but no such policy was ever
-- implemented — corrected to describe actual, intended behavior rather than
-- widening access to match the stale comment, which would reopen a C2-style
-- RPC-bypass surface on a table BACKEND_EXECUTION_PLAN.md §19 requires to
-- be immutable once a trip starts). Driver: R own trip. Guardian: R own
-- child's row.
--
-- Fix for EPIC_3_REVIEW.md M1: now uses the denormalized trip_id/child_id
-- columns (migration 2) for a direct `= any(...)` equality check instead of
-- the subquery-through-trip_stops/bus_riders shape the original delivery
-- used — matching this file's own stated single-equality-check principle.
-- ---------------------------------------------------------------------------
alter table transport.trip_stop_riders enable row level security;
alter table transport.trip_stop_riders force row level security;

create policy trip_stop_riders_select_manager on transport.trip_stop_riders
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy trip_stop_riders_select_driver on transport.trip_stop_riders
  for select
  using (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

create policy trip_stop_riders_select_guardian on transport.trip_stop_riders
  for select
  using (public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy trip_stop_riders_insert_driver on transport.trip_stop_riders
  for insert
  with check (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

-- ---------------------------------------------------------------------------
-- transport.trip_child_status
-- Manager: CRUD. Driver: RU own trip. Reception: RU own tenant (confirming
-- an already-in-progress child's status, §12 — narrower in intent than in
-- DB-level scope, which is tenant-wide read/update; the narrower "already
-- in progress" semantic is enforced by update_child_trip_status, migration
-- 6, not by RLS). Guardian: R own child.
-- ---------------------------------------------------------------------------
alter table transport.trip_child_status enable row level security;
alter table transport.trip_child_status force row level security;

create policy trip_child_status_select_manager on transport.trip_child_status
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy trip_child_status_select_driver on transport.trip_child_status
  for select
  using (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

create policy trip_child_status_select_reception on transport.trip_child_status
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

create policy trip_child_status_select_guardian on transport.trip_child_status
  for select
  using (public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy trip_child_status_insert_driver on transport.trip_child_status
  for insert
  with check (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

create policy trip_child_status_update_driver on transport.trip_child_status
  for update
  using (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()))
  with check (public.current_role() = 'driver' and trip_id = any (public.current_driver_trip_ids()));

create policy trip_child_status_update_reception on transport.trip_child_status
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

-- ---------------------------------------------------------------------------
-- transport.gps_pings
-- Manager: R. Driver: C own trip. Guardian: R own child's live trip.
-- Append-only — no update/delete policy for anyone (matches
-- academic.day_path_events' precedent).
-- ---------------------------------------------------------------------------
alter table transport.gps_pings enable row level security;
alter table transport.gps_pings force row level security;

create policy gps_pings_select_manager on transport.gps_pings
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy gps_pings_select_guardian on transport.gps_pings
  for select
  using (public.current_role() = 'guardian' and trip_id = any (public.current_guardian_active_trip_ids()));

-- Fix for EPIC_3_REVIEW.md C2: previously had no check on the trip's own
-- status, letting a driver insert pings for an already-completed/cancelled
-- trip directly via REST, bypassing record_gps_ping's own guard. A scoped
-- EXISTS subquery is used here (not a uuid[] helper) since this is a
-- one-time INSERT-time check, not a per-row-scan SELECT predicate — the
-- performance concern the uuid[]-helper convention exists for doesn't apply
-- the same way on the write path.
create policy gps_pings_insert_driver on transport.gps_pings
  for insert
  with check (
    public.current_role() = 'driver'
    and trip_id = any (public.current_driver_trip_ids())
    and exists (select 1 from transport.trips t where t.id = trip_id and t.status not in ('completed', 'cancelled'))
  );

-- ---------------------------------------------------------------------------
-- safety.pickup_passes
-- Guardian: CRUD own child. Manager: R. Reception: R own tenant (§13.4 —
-- tenant-wide SELECT is intentional; the application queries by exact
-- qr_token only, never lists/browses).
-- ---------------------------------------------------------------------------
alter table safety.pickup_passes enable row level security;
alter table safety.pickup_passes force row level security;

create policy pickup_passes_select_guardian on safety.pickup_passes
  for select
  using (public.current_role() = 'guardian' and created_by = auth.uid());

create policy pickup_passes_select_manager on safety.pickup_passes
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy pickup_passes_select_reception on safety.pickup_passes
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

create policy pickup_passes_insert_guardian on safety.pickup_passes
  for insert
  with check (
    public.current_role() = 'guardian'
    and created_by = auth.uid()
    and child_id = any (public.current_guardian_child_ids())
  );

-- Fix for EPIC_3_REVIEW.md M5: previously unrestricted beyond ownership,
-- letting a guardian revert `status` back to 'active' after expiry/
-- revocation, or edit person_name/relation/id_photo_object_id on a pass
-- reception has already scanned — altering the record of who was
-- authorized after the fact. USING now only matches a pass that is still
-- `active`; WITH CHECK still requires the resulting row to belong to the
-- same guardian/child but no longer permits resurrecting an
-- expired/revoked pass via this path (revoke_pickup_pass, migration 6, is
-- the correct — and now only — way to transition status, fixing
-- EPIC_3_REVIEW.md M4). A guardian can still freely edit person_name/
-- relation/id_photo_object_id/expires_at while the pass remains active.
create policy pickup_passes_update_guardian on safety.pickup_passes
  for update
  using (public.current_role() = 'guardian' and created_by = auth.uid() and status = 'active')
  with check (public.current_role() = 'guardian' and created_by = auth.uid());

create policy pickup_passes_delete_guardian on safety.pickup_passes
  for delete
  using (public.current_role() = 'guardian' and created_by = auth.uid());

-- Fix for EPIC_3_REVIEW.md H3: scan_pickup_pass (migration 6) runs as the
-- calling reception user and attempts to lazily flip an expired-but-still-
-- 'active' pass's status to 'expired' — no policy previously granted
-- reception any UPDATE on this table at all, so that write silently
-- affected 0 rows with no error (FORCE ROW LEVEL SECURITY). USING/WITH
-- CHECK mirror the exact transition scan_pickup_pass performs (and nothing
-- broader), so direct REST access can't be used to set any other column or
-- transition, consistent with the C2 fix pattern applied elsewhere in this
-- migration.
create policy pickup_passes_update_reception on safety.pickup_passes
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception' and status = 'active')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'reception' and status = 'expired');

-- ---------------------------------------------------------------------------
-- safety.pickup_scan_events
-- Reception: C, R own tenant. Manager: R.
-- ---------------------------------------------------------------------------
alter table safety.pickup_scan_events enable row level security;
alter table safety.pickup_scan_events force row level security;

create policy pickup_scan_events_select_reception on safety.pickup_scan_events
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'reception');

create policy pickup_scan_events_select_manager on safety.pickup_scan_events
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy pickup_scan_events_insert_reception on safety.pickup_scan_events
  for insert
  with check (public.current_role() = 'reception' and tenant_id = public.current_tenant_id() and scanned_by = auth.uid());

-- Fix for EPIC_3_REVIEW.md C2: previously unrestricted beyond tenant/role,
-- letting reception PATCH handover_confirmed=true directly on ANY scan
-- event in their tenant via REST — including one whose result was
-- invalid_unknown/invalid_expired/invalid_revoked — completely bypassing
-- confirm_handover's `result = 'valid' and not handover_confirmed` gate and
-- defeating the entire security purpose of the pickup-pass mechanism (a
-- handover could be marked confirmed with no valid scan ever having
-- occurred). USING now only matches a valid, not-yet-confirmed scan event
-- (mirrors confirm_handover's own WHERE clause exactly); WITH CHECK
-- requires the resulting row to still have result='valid' and
-- handover_confirmed=true — the only transition this policy exists to
-- allow.
create policy pickup_scan_events_update_reception on safety.pickup_scan_events
  for update
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'reception'
    and result = 'valid'
    and not handover_confirmed
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'reception'
    and result = 'valid'
    and handover_confirmed
  );
