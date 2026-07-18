-- ============================================================================
-- Epic 3 — Transport & Safety
-- Migration 4: RLS helper functions
-- Ref: BACKEND_ARCHITECTURE.md §12, §13.1, §13.4; EPIC_2_DEPLOYMENT_FIX.md
--
-- Every helper below returns uuid[] (never SETOF) from the very first draft
-- — the lesson from EPIC_2_DEPLOYMENT_FIX.md's live deployment failure
-- (PostgreSQL rejects set-returning functions anywhere inside a policy
-- expression tree) is applied proactively here, not discovered again.
--
-- current_guardian_child_ids() (Epic 2) is reused unmodified below — cross-
-- epic reuse of an already-shipped helper, not a redefinition.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.current_driver_bus_ids() — the bus(es) this driver currently
-- drives. In practice exactly one (buses_driver_key, migration 2, is a
-- unique partial index), but plural/array-shaped for consistency with every
-- other RLS helper in this codebase and to avoid a signature change if a
-- driver is ever allowed to cover more than one bus.
-- ---------------------------------------------------------------------------
-- Fix for EPIC_3_REVIEW.md L2: now also requires the calling driver's own
-- driver_profiles row to be non-deleted — a terminated driver whose Auth
-- session hasn't yet been revoked previously retained visibility into their
-- former bus/roster until session revocation completed. Mirrors the
-- equivalent (still-outstanding, pre-existing, out of scope here per the
-- review's own framing) gap in Epic 1/2's current_staff_classroom_ids().
create or replace function public.current_driver_bus_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select b.id from transport.buses b
    where b.driver_id = auth.uid()
      and b.deleted_at is null
      and exists (select 1 from identity.driver_profiles dp where dp.id = auth.uid() and dp.deleted_at is null)
  );
$$;

comment on function public.current_driver_bus_ids() is
  'Bus IDs this driver currently drives. Returns uuid[], not SETOF (EPIC_2_DEPLOYMENT_FIX.md). Empty array for non-driver callers or a soft-deleted driver profile (EPIC_3_REVIEW.md L2).';

-- ---------------------------------------------------------------------------
-- public.current_driver_rider_ids() — fix for EPIC_3_REVIEW.md H6:
-- BACKEND_EXECUTION_PLAN.md §15 explicitly names this function
-- ("current_driver_rider_ids() exercised for the first time"); the original
-- delivery built the equivalent capability under a different name/shape
-- (academic.children_driver_safe()) and never shipped a function with this
-- name. Added here, additively, alongside (not instead of)
-- children_driver_safe() — the column-narrowed function remains the correct
-- read surface for children (§14.3), while this uuid[]-returning helper is
-- what any future RLS policy needing "is this child one of my current bus
-- riders" as a direct equality check would use, matching the
-- current_guardian_child_ids()/current_staff_classroom_ids() shape exactly.
-- ---------------------------------------------------------------------------
create or replace function public.current_driver_rider_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select child_id from transport.bus_riders
    where bus_id = any (public.current_driver_bus_ids()) and active
  );
$$;

comment on function public.current_driver_rider_ids() is
  'Child IDs currently riding this driver''s own bus(es) — the specifically-named helper from BACKEND_EXECUTION_PLAN.md §15. Returns uuid[] (EPIC_2_DEPLOYMENT_FIX.md). Empty array for non-driver callers.';

-- ---------------------------------------------------------------------------
-- public.current_driver_trip_ids() — trips on this driver's own bus(es).
-- Lets trip_stops/trip_child_status/gps_pings (all keyed by trip_id, not
-- bus_id) use a direct `trip_id = any(...)` equality instead of a subquery,
-- matching the single-equality-check invariant §13.1 established (and
-- EPIC_2_REVIEW.md H3 retrofitted into Epic 2) from this table's first
-- policy, not as a later fix.
-- ---------------------------------------------------------------------------
create or replace function public.current_driver_trip_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select id from transport.trips
    where bus_id = any (public.current_driver_bus_ids())
  );
$$;

comment on function public.current_driver_trip_ids() is
  'Trip IDs belonging to this driver''s own bus(es). Returns uuid[] (EPIC_2_DEPLOYMENT_FIX.md).';

-- ---------------------------------------------------------------------------
-- public.current_guardian_active_bus_ids() — the bus(es) the calling
-- guardian's own children currently ride (active bus_riders rows only).
-- ---------------------------------------------------------------------------
create or replace function public.current_guardian_active_bus_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select bus_id from transport.bus_riders
    where child_id = any (public.current_guardian_child_ids()) and active
  );
$$;

comment on function public.current_guardian_active_bus_ids() is
  'Bus IDs the calling guardian''s children currently ride. Returns uuid[] (EPIC_2_DEPLOYMENT_FIX.md).';

-- ---------------------------------------------------------------------------
-- public.current_guardian_active_trip_ids() — "live only" (§12) trips for
-- the guardian's own bus(es): scheduled/moving/arrived, never
-- completed/cancelled. gps_pings is the highest-frequency READ in the
-- system (a parent polling live bus position, §18/§29) — this helper avoids
-- a per-row subquery on that table specifically.
-- ---------------------------------------------------------------------------
create or replace function public.current_guardian_active_trip_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select id from transport.trips
    where bus_id = any (public.current_guardian_active_bus_ids())
      and status in ('scheduled', 'moving', 'arrived')
  );
$$;

comment on function public.current_guardian_active_trip_ids() is
  'Live (non-terminal) trip IDs for the guardian''s own bus(es) — "live only" per §12. Returns uuid[] (EPIC_2_DEPLOYMENT_FIX.md).';

-- ---------------------------------------------------------------------------
-- academic.children_driver_safe() — column-narrowed manifest view for a
-- driver's own bus riders, mirroring academic.children_reception_safe()
-- (Epic 2 migration 5) exactly: §12's "R (own bus riders, minimal fields)"
-- cannot be expressed by row-level RLS alone (no column-level restriction),
-- so this SECURITY DEFINER function is the sole read surface — no base-table
-- SELECT policy on academic.children is ever granted to the driver role
-- (migration 5), matching reception's established precedent.
-- ---------------------------------------------------------------------------
create or replace function academic.children_driver_safe()
returns table (
  id             uuid,
  tenant_id      uuid,
  name           text,
  name_ar        text,
  photo_object_id uuid,
  classroom_id   uuid,
  address_line   text,
  building       text,
  area           text,
  city           text,
  address_lat    numeric,
  address_lng    numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.tenant_id, c.name, c.name_ar, c.photo_object_id, c.classroom_id,
         c.address_line, c.building, c.area, c.city, c.address_lat, c.address_lng
  from academic.children c
  join transport.bus_riders br on br.child_id = c.id and br.active
  where br.bus_id = any (public.current_driver_bus_ids())
    and c.deleted_at is null
    and public.current_role() = 'driver';
$$;

comment on function academic.children_driver_safe() is
  'Name/photo/pickup-address-only manifest of a driver''s own bus riders (§12). Returns zero rows for any caller whose role is not driver — defense-in-depth inside the function body, same convention as children_reception_safe() (Epic 2).';

revoke all on function academic.children_driver_safe from public;
grant execute on function academic.children_driver_safe to authenticated;

-- ---------------------------------------------------------------------------
-- academic.set_child_day_path_status() — the sole write path Epic 3 uses to
-- update academic.children.day_path_status and append an
-- academic.day_path_events row from a transport/safety action (bus pickup,
-- drop-off, or gate handover). SECURITY DEFINER so it can write into two
-- Epic 2-owned tables without granting driver/reception a broad UPDATE
-- policy on academic.children or a new INSERT policy on
-- academic.day_path_events (neither of which Epic 2's migrations grant
-- today) — mirrors public.write_audit_log's exact justification (Epic 1):
-- a narrow, purpose-built SECURITY DEFINER seam instead of widening a
-- table's general RLS surface. This is a NEW function added by Epic 3 in
-- the already-existing `academic` schema — no Epic 2 migration file, table,
-- or policy is modified.
--
-- Fix for EPIC_3_REVIEW.md C4 (two changes):
-- 1. `p_actor_id` is no longer a caller-supplied parameter — it was
--    forgeable (any caller could attribute the action to an arbitrary
--    actor_id), defeating the audit trail's "who did this" guarantee. The
--    function now always uses auth.uid() internally, exactly as
--    write_audit_log (Epic 1) already does for the equivalent parameter.
-- 2. EXECUTE is no longer granted to `authenticated` (see the bottom of
--    this block) — the function was reachable directly by any
--    driver/reception/teacher/manager via `supabase.rpc()`, bypassing
--    every guard update_child_trip_status/confirm_handover (migration 6)
--    otherwise enforce (trip ownership, rider membership, valid-scan
--    gating). It is now callable ONLY from within another SECURITY
--    DEFINER function owned by the same role (update_child_trip_status and
--    confirm_handover, both changed to SECURITY DEFINER in migration 6 as
--    part of this same fix) — a nested call from inside a SECURITY
--    DEFINER function is privilege-checked against the *definer's* grants,
--    not the original caller's, so no explicit EXECUTE grant to
--    `authenticated` is needed or given.
-- ---------------------------------------------------------------------------
create or replace function academic.set_child_day_path_status(
  p_child_id  uuid,
  p_status    academic.day_path_status,
  p_source    academic.day_path_source
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id     uuid;
  v_classroom_id  uuid;
begin
  if public.current_role() not in ('driver', 'reception', 'teacher', 'manager') then
    raise exception 'Not authorized to update a child''s day-path status'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'You are not authorized to update this child''s status.',
              'human_message_ar', 'غير مصرح لك بتحديث حالة هذا الطفل.'
            )::text;
  end if;

  select tenant_id, classroom_id into v_tenant_id, v_classroom_id
  from academic.children
  where id = p_child_id and deleted_at is null;

  if v_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_tenant_id <> public.current_tenant_id() then
    raise exception 'This child does not belong to your tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_TENANT_MISMATCH', 'human_message_en', 'This child does not belong to your tenant.', 'human_message_ar', 'هذا الطفل لا ينتمي إلى مؤسستك.')::text;
  end if;

  update academic.children set day_path_status = p_status where id = p_child_id;

  insert into academic.day_path_events (child_id, classroom_id, tenant_id, status, source, actor_id)
  values (p_child_id, v_classroom_id, v_tenant_id, p_status, p_source, auth.uid());
end;
$$;

comment on function academic.set_child_day_path_status(uuid, academic.day_path_status, academic.day_path_source) is
  'Sole write path from Epic 3''s transport/safety RPCs (update_child_trip_status, confirm_handover, migration 6) into Epic 2''s children.day_path_status + day_path_events. SECURITY DEFINER, with its own internal role+tenant check. Fix for EPIC_3_REVIEW.md C4: actor_id is always auth.uid() (no longer a forgeable parameter), and EXECUTE is not granted to authenticated — only reachable via a nested call from another SECURITY DEFINER function (see grant note below).';

revoke all on function academic.set_child_day_path_status from public;
revoke all on function academic.set_child_day_path_status from authenticated;
-- No EXECUTE grant to `authenticated` — intentional (EPIC_3_REVIEW.md C4).
-- update_child_trip_status/confirm_handover (migration 6) are themselves
-- SECURITY DEFINER, so their internal calls to this function are privilege-
-- checked against their own owner's rights, which include EXECUTE on every
-- function that same owner defined — no explicit grant is needed for that
-- path, and no other caller can reach this function at all.
