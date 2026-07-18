-- ============================================================================
-- Epic 3 — Transport & Safety
-- Migration 6: RPC functions
-- Ref: BACKEND_ARCHITECTURE.md §14.2, §18, §25.1, §25.2; §13.4
--
-- Error codes reused from Epic 1's already-shipped, deliberately generic
-- taxonomy throughout this file (VALIDATION_FAILED, STATE_ALREADY_PROCESSED,
-- NOT_FOUND, PERM_ROLE_DENIED, PERM_TENANT_MISMATCH,
-- EXTERNAL_AUTH_ADMIN_FAILURE) — no new error code is added, no Epic 1 file
-- is touched (same convention Epic 2 established).
--
-- Revised per EPIC_3_REVIEW.md (approved) — every function below carries an
-- inline "Fix for EPIC_3_REVIEW.md <id>" comment at its point of change; see
-- EPIC_3_FIX_REPORT.md for the full findings-to-fixes mapping.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.assign_bus_rider — manager only. Deactivates any existing active
-- bus_riders row for this child first (a child can only ride one bus at a
-- time), then inserts the new one. Capacity is checked here for a clean
-- error message; transport.check_bus_rider_consistency (migration 2) is the
-- DB-level backstop that holds regardless of write path.
--
-- Fix for EPIC_3_REVIEW.md M3: previously deactivated-then-inserted without
-- locking the child, so two concurrent assign_bus_rider calls for the same
-- child to two different buses could both pass their own bus's capacity
-- check and both attempt to insert an active row — bus_riders_active_
-- child_key (the partial unique index) prevented actual double-booking, but
-- the losing call surfaced a raw unique_violation instead of a clean error.
-- Now locks the child's own row (SELECT ... FOR UPDATE on academic.children)
-- before the deactivate+insert sequence, serializing any two concurrent
-- assignments of the same child — the same SELECT...FOR UPDATE convention
-- already used for capacity locking (§2.2), applied here to a different
-- invariant (one active assignment per child).
-- ---------------------------------------------------------------------------
create or replace function public.assign_bus_rider(
  p_bus_id                    uuid,
  p_child_id                  uuid,
  p_pickup_address_override   text default null
)
returns transport.bus_riders
language plpgsql
as $$
declare
  v_tenant_id      uuid := public.current_tenant_id();
  v_capacity       int;
  v_current_count  int;
  v_row            transport.bus_riders;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can assign a bus rider'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can assign a bus rider.', 'human_message_ar', 'فقط المدير يمكنه تعيين راكب حافلة.')::text;
  end if;

  select capacity into v_capacity
  from transport.buses
  where id = p_bus_id and tenant_id = v_tenant_id and deleted_at is null
  for update;

  if v_capacity is null then
    raise exception 'Bus not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Bus not found.', 'human_message_ar', 'لم يتم العثور على الحافلة.')::text;
  end if;

  -- Fix for EPIC_3_REVIEW.md M3: lock the child row so two concurrent
  -- assignments of the same child (to any bus) serialize.
  if not exists (select 1 from academic.children where id = p_child_id and tenant_id = v_tenant_id and deleted_at is null for update) then
    raise exception 'Child not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  select count(*) into v_current_count from transport.bus_riders where bus_id = p_bus_id and active;

  if v_current_count >= v_capacity then
    raise exception 'Bus is at full capacity'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This bus is at full capacity.', 'human_message_ar', 'هذه الحافلة ممتلئة بالكامل.')::text;
  end if;

  update transport.bus_riders set active = false where child_id = p_child_id and active;

  insert into transport.bus_riders (bus_id, child_id, tenant_id, pickup_address_override, active)
  values (p_bus_id, p_child_id, v_tenant_id, p_pickup_address_override, true)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.assign_bus_rider is
  'Deactivates any prior active bus_riders row for this child before inserting the new one — a child rides at most one bus at a time. Capacity-locked (§2.2/§5); child-locked (EPIC_3_REVIEW.md M3) to avoid a raw constraint-violation error under concurrent reassignment.';

revoke all on function public.assign_bus_rider from public;
grant execute on function public.assign_bus_rider to authenticated;

-- ---------------------------------------------------------------------------
-- public.unassign_bus_rider — manager only. Atomic UPDATE...WHERE (same
-- pattern as Epic 2's post-fix suspend_child/reactivate_child,
-- EPIC_2_REVIEW.md M1) — folds the "already inactive" check into the
-- UPDATE's own WHERE clause so two concurrent calls can't both succeed.
-- ---------------------------------------------------------------------------
create or replace function public.unassign_bus_rider(p_bus_rider_id uuid)
returns transport.bus_riders
language plpgsql
as $$
declare
  v_row     transport.bus_riders;
  v_exists  boolean;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can unassign a bus rider'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can unassign a bus rider.', 'human_message_ar', 'فقط المدير يمكنه إلغاء تعيين راكب حافلة.')::text;
  end if;

  update transport.bus_riders
  set active = false
  where id = p_bus_rider_id and tenant_id = public.current_tenant_id() and active
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select exists(select 1 from transport.bus_riders where id = p_bus_rider_id and tenant_id = public.current_tenant_id()) into v_exists;

  if not v_exists then
    raise exception 'Bus rider not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Bus rider not found.', 'human_message_ar', 'لم يتم العثور على راكب الحافلة.')::text;
  else
    raise exception 'This bus rider is already inactive'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This bus rider is already inactive.', 'human_message_ar', 'راكب الحافلة هذا غير نشط بالفعل.')::text;
  end if;
end;
$$;

revoke all on function public.unassign_bus_rider from public;
grant execute on function public.unassign_bus_rider to authenticated;

-- ---------------------------------------------------------------------------
-- public.start_trip — driver only, own bus. Creates the trip row directly in
-- 'moving' status (started_at = now()) — v1 has no separate "trip created,
-- not yet started" driver action, so 'scheduled' as a distinct pre-start
-- state is never actually observed in practice (documented in
-- EPIC_3_COMPLETION_REPORT.md Known Limitations). Snapshots the bus's
-- current active riders into one trip_stop per child (§18: no
-- routing/geocoding engine exists in v1 — sequence is assignment order, not
-- an optimized route).
--
-- Fix for EPIC_3_REVIEW.md M3: the previous "if exists(...) then raise"
-- pre-check followed by a separate INSERT was a TOCTOU race — two
-- concurrent start_trip calls for the same bus/leg/day could both pass the
-- exists check before either committed, and the loser then hit
-- trips_bus_leg_date_key's unique-violation directly instead of a clean
-- error. Now a single atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING`,
-- with a read-only disambiguation query only on the (rare) conflict path —
-- the same atomic-attempt-then-disambiguate shape EPIC_2_REVIEW.md M1
-- established for suspend_child/reactivate_child.
--
-- Fix for EPIC_3_REVIEW.md M2: the per-rider PL/pgSQL loop (3 individual
-- INSERTs per rider) is replaced with one set-based statement chain
-- (multiple data-modifying CTEs), matching the EPIC_2_REVIEW.md L2
-- convention this file's original header claimed was "applied
-- proactively" but, for this function, was not.
--
-- Fix for EPIC_3_REVIEW.md M1: trip_stop_riders is now populated with its
-- denormalized trip_id/child_id columns (migration 2).
-- ---------------------------------------------------------------------------
create or replace function public.start_trip(
  p_bus_id  uuid,
  p_leg     transport.trip_leg
)
returns jsonb
language plpgsql
as $$
declare
  v_tenant_id     uuid := public.current_tenant_id();
  v_trip          transport.trips;
  v_stop_riders   jsonb;
begin
  if public.current_role() <> 'driver' then
    raise exception 'Only a driver can start a trip'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a driver can start a trip.', 'human_message_ar', 'فقط السائق يمكنه بدء الرحلة.')::text;
  end if;

  if p_bus_id <> all (public.current_driver_bus_ids()) then
    raise exception 'You do not drive this bus'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'You do not drive this bus.', 'human_message_ar', 'أنت لا تقود هذه الحافلة.')::text;
  end if;

  insert into transport.trips (tenant_id, bus_id, leg, service_date, status, started_at)
  values (v_tenant_id, p_bus_id, p_leg, current_date, 'moving', now())
  on conflict (bus_id, leg, service_date) do nothing
  returning * into v_trip;

  if v_trip.id is null then
    raise exception 'This trip has already been started today'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This trip has already been started today.', 'human_message_ar', 'تم بدء هذه الرحلة اليوم بالفعل.')::text;
  end if;

  -- Set-based snapshot (EPIC_3_REVIEW.md M2): one riders CTE, one INSERT
  -- into trip_stops (returning the generated ids keyed by sequence), one
  -- INSERT into trip_stop_riders joining back on sequence, one INSERT into
  -- trip_child_status — no per-row loop.
  with riders as (
    select
      br.id as bus_rider_id,
      br.child_id,
      c.address_lat,
      c.address_lng,
      c.address_line,
      (row_number() over (order by br.created_at) - 1)::int as seq
    from transport.bus_riders br
    join academic.children c on c.id = br.child_id
    where br.bus_id = p_bus_id and br.active
  ),
  inserted_stops as (
    insert into transport.trip_stops (trip_id, tenant_id, sequence, lat, lng, label)
    select v_trip.id, v_tenant_id, seq, address_lat, address_lng, address_line from riders
    returning id, sequence
  ),
  inserted_stop_riders as (
    insert into transport.trip_stop_riders (trip_stop_id, bus_rider_id, tenant_id, trip_id, child_id)
    select s.id, r.bus_rider_id, v_tenant_id, v_trip.id, r.child_id
    from inserted_stops s join riders r on r.seq = s.sequence
    returning trip_stop_id, bus_rider_id, child_id
  ),
  inserted_status as (
    insert into transport.trip_child_status (trip_id, child_id, tenant_id, status)
    select v_trip.id, child_id, v_tenant_id, 'pending' from riders
    returning child_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tripStopId', isr.trip_stop_id,
           'busRiderId', isr.bus_rider_id,
           'childId', isr.child_id,
           'sequence', s.sequence
         ) order by s.sequence), '[]'::jsonb)
  into v_stop_riders
  from inserted_stop_riders isr
  join inserted_stops s on s.id = isr.trip_stop_id;

  return jsonb_build_object('trip', to_jsonb(v_trip), 'tripStopRiders', v_stop_riders);
end;
$$;

comment on function public.start_trip is
  'Creates today''s trip for bus_id/leg (moving from creation, §18) atomically (EPIC_3_REVIEW.md M3: ON CONFLICT DO NOTHING, not check-then-insert) and snapshots the bus''s current active riders into trip_stops/trip_stop_riders/trip_child_status via one set-based statement chain (EPIC_3_REVIEW.md M2: no per-row loop). Stop-per-child ordering, no routing engine in v1 (EPIC_3_COMPLETION_REPORT.md Known Limitations).';

revoke all on function public.start_trip from public;
grant execute on function public.start_trip to authenticated;

-- ---------------------------------------------------------------------------
-- public.record_gps_ping — driver only, own trip, trip not yet
-- completed/cancelled (§18: pings stop once a trip is terminal). No
-- idempotency-key — see EPIC_3_COMPLETION_REPORT.md for why this table is a
-- documented exception to the mandatory-idempotency convention.
-- ---------------------------------------------------------------------------
create or replace function public.record_gps_ping(
  p_trip_id    uuid,
  p_lat        numeric,
  p_lng        numeric,
  p_heading    numeric default null,
  p_speed_kph  numeric default null
)
returns transport.gps_pings
language plpgsql
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_status    transport.trip_status;
  v_row       transport.gps_pings;
begin
  if public.current_role() <> 'driver' then
    raise exception 'Only a driver can record a GPS ping'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a driver can record a GPS ping.', 'human_message_ar', 'فقط السائق يمكنه تسجيل موقع GPS.')::text;
  end if;

  select status into v_status from transport.trips where id = p_trip_id and bus_id = any (public.current_driver_bus_ids());

  if v_status is null then
    raise exception 'Trip not found or not your own'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Trip not found.', 'human_message_ar', 'لم يتم العثور على الرحلة.')::text;
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'This trip has already ended'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This trip has already ended.', 'human_message_ar', 'انتهت هذه الرحلة بالفعل.')::text;
  end if;

  insert into transport.gps_pings (trip_id, tenant_id, lat, lng, heading, speed_kph)
  values (p_trip_id, v_tenant_id, p_lat, p_lng, p_heading, p_speed_kph)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_gps_ping from public;
grant execute on function public.record_gps_ping to authenticated;

-- ---------------------------------------------------------------------------
-- public.update_child_trip_status — driver (own trip) or reception (own
-- tenant). Upserts trip_child_status, then routes the corresponding
-- day-path change through academic.set_child_day_path_status (migration 4).
--
-- Fix for EPIC_3_REVIEW.md C3: previously never validated that p_child_id
-- was actually a rider on p_trip_id's bus — a driver or reception account
-- could mark ANY child in the tenant as picked_up/dropped_off on a trip
-- that child was never assigned to, corrupting trip_child_status and
-- cascading an incorrect day-path status/event for an unrelated child. Now
-- explicitly checks bus_riders for an active rider row before writing
-- anything; transport.check_trip_child_status_consistency (migration 2) is
-- the DB-level backstop that holds regardless of write path.
--
-- Fix for EPIC_3_REVIEW.md C4: now SECURITY DEFINER so it can call
-- academic.set_child_day_path_status (migration 4), which is no longer
-- grantable to `authenticated` directly. All of this function's own
-- authorization (role, tenant, trip ownership, rider membership) is
-- unaffected — auth.uid()/current_role()/current_tenant_id() reflect the
-- original caller regardless of SECURITY DEFINER, and this function's own
-- checks are the sole authorization gate for its own writes (RLS is
-- bypassed for this function's queries by virtue of SECURITY DEFINER, the
-- same mechanism children_reception_safe()/set_child_day_path_status
-- already relied on).
--
-- Fix for EPIC_3_REVIEW.md H2: on a picked_up/dropped_off transition, also
-- enqueues a row in platform.notification_outbox (see migration 3) so
-- nothing is silently lost once Epic 4 activates real delivery.
-- ---------------------------------------------------------------------------
create or replace function public.update_child_trip_status(
  p_trip_id   uuid,
  p_child_id  uuid,
  p_status    transport.trip_child_status_value
)
returns transport.trip_child_status
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_role       text := public.current_role();
  v_tenant_id  uuid := public.current_tenant_id();
  v_bus_id     uuid;
  v_leg        transport.trip_leg;
  v_row        transport.trip_child_status;
  v_day_path   academic.day_path_status;
  v_source     academic.day_path_source;
  v_is_rider   boolean;
begin
  if v_role not in ('driver', 'reception') then
    raise exception 'Only a driver or reception can update a child''s trip status'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a driver or reception can update a child''s trip status.', 'human_message_ar', 'فقط السائق أو موظف الاستقبال يمكنه تحديث حالة رحلة الطفل.')::text;
  end if;

  select bus_id, leg into v_bus_id, v_leg from transport.trips where id = p_trip_id and tenant_id = v_tenant_id;

  if v_leg is null then
    raise exception 'Trip not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Trip not found.', 'human_message_ar', 'لم يتم العثور على الرحلة.')::text;
  end if;

  if v_role = 'driver' and p_trip_id <> all (public.current_driver_trip_ids()) then
    raise exception 'You do not drive this trip'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'You do not drive this trip.', 'human_message_ar', 'أنت لا تقود هذه الرحلة.')::text;
  end if;

  -- Fix for EPIC_3_REVIEW.md C3.
  select exists(select 1 from transport.bus_riders where bus_id = v_bus_id and child_id = p_child_id and active) into v_is_rider;
  if not v_is_rider then
    raise exception 'This child is not assigned to this trip''s bus'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This child is not assigned to this trip''s bus.', 'human_message_ar', 'هذا الطفل غير معيّن لحافلة هذه الرحلة.')::text;
  end if;

  insert into transport.trip_child_status (trip_id, child_id, tenant_id, status, status_changed_at, changed_by)
  values (p_trip_id, p_child_id, v_tenant_id, p_status, now(), auth.uid())
  on conflict (trip_id, child_id) do update
    set status = excluded.status, status_changed_at = excluded.status_changed_at, changed_by = excluded.changed_by, updated_at = now()
  returning * into v_row;

  v_source := case v_role when 'driver' then 'driver' else 'reception' end;

  v_day_path := case
    when p_status = 'picked_up' then 'in_bus'
    when p_status = 'dropped_off' and v_leg = 'am' then 'classroom'
    when p_status = 'dropped_off' and v_leg = 'pm' then 'delivered'
    else null
  end;

  if v_day_path is not null then
    perform academic.set_child_day_path_status(p_child_id, v_day_path, v_source);

    -- Fix for EPIC_3_REVIEW.md H2.
    insert into platform.notification_outbox (tenant_id, recipient_type, recipient_id, category, payload)
    select v_tenant_id, 'guardian', cgl.guardian_id, 'trip_update',
           jsonb_build_object('childId', p_child_id, 'tripId', p_trip_id, 'status', p_status, 'dayPathStatus', v_day_path)
    from academic.child_guardian_links cgl
    where cgl.child_id = p_child_id and cgl.tenant_id = v_tenant_id;
  end if;

  return v_row;
end;
$$;

comment on function public.update_child_trip_status is
  'Upserts transport.trip_child_status (unique (trip_id, child_id) makes this a natural upsert). Validates the child is an active rider on the trip''s bus before writing anything (EPIC_3_REVIEW.md C3). SECURITY DEFINER (EPIC_3_REVIEW.md C4) to reach set_child_day_path_status. Enqueues a notification_outbox row on picked_up/dropped_off (EPIC_3_REVIEW.md H2).';

revoke all on function public.update_child_trip_status from public;
grant execute on function public.update_child_trip_status to authenticated;

-- ---------------------------------------------------------------------------
-- public.complete_trip — driver only, own trip. Atomic UPDATE...WHERE
-- (same M1 pattern as Epic 2's suspend_child/reactivate_child). v1 has no
-- separate "mark arrived" RPC in §14.2's contract list — completing a trip
-- sets arrived_at (if not already set) and completed_at together in one
-- driver action (documented simplification, EPIC_3_COMPLETION_REPORT.md
-- Known Limitations). Compatible with the tightened trips_update_driver RLS
-- policy (migration 5, EPIC_3_REVIEW.md C2): this UPDATE's WHERE clause and
-- resulting status ('completed') exactly match what that policy now allows.
-- ---------------------------------------------------------------------------
create or replace function public.complete_trip(p_trip_id uuid)
returns transport.trips
language plpgsql
as $$
declare
  v_row     transport.trips;
  v_exists  boolean;
begin
  if public.current_role() <> 'driver' then
    raise exception 'Only a driver can complete a trip'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a driver can complete a trip.', 'human_message_ar', 'فقط السائق يمكنه إنهاء الرحلة.')::text;
  end if;

  update transport.trips
  set status = 'completed',
      arrived_at = coalesce(arrived_at, now()),
      completed_at = now()
  where id = p_trip_id
    and bus_id = any (public.current_driver_bus_ids())
    and status not in ('completed', 'cancelled')
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select exists(select 1 from transport.trips where id = p_trip_id and bus_id = any (public.current_driver_bus_ids())) into v_exists;

  if not v_exists then
    raise exception 'Trip not found or not your own'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Trip not found.', 'human_message_ar', 'لم يتم العثور على الرحلة.')::text;
  else
    raise exception 'This trip has already ended'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This trip has already ended.', 'human_message_ar', 'انتهت هذه الرحلة بالفعل.')::text;
  end if;
end;
$$;

revoke all on function public.complete_trip from public;
grant execute on function public.complete_trip to authenticated;

-- ---------------------------------------------------------------------------
-- public.create_pickup_pass — guardian only, own child. qr_token is a
-- cryptographically random, high-entropy opaque bearer value (§13.4) — a v4
-- UUID via gen_random_uuid(). Defaults expires_at to now() + 24h when not
-- supplied.
--
-- Fix for EPIC_3_REVIEW.md L3: expires_at is now capped at 30 days out,
-- regardless of caller-supplied value.
--
-- Note on EPIC_3_REVIEW.md H1: unlike scan_pickup_pass/confirm_handover
-- (both staff-initiated, below), this action cannot be written to
-- platform.audit_log — platform.audit_actor_type (Epic 1, frozen) is
-- `enum('platform_admin', 'staff', 'system')` and has no 'guardian' value,
-- so a guardian-initiated action has no representable actor_type in the
-- existing, un-modifiable enum. Documented as a remaining limitation in
-- EPIC_3_FIX_REPORT.md rather than worked around by misrepresenting the
-- actor type.
-- ---------------------------------------------------------------------------
create or replace function public.create_pickup_pass(
  p_child_id            uuid,
  p_person_name         text,
  p_relation            safety.pickup_person_relation,
  p_id_photo_object_id  uuid default null,
  p_expires_at          timestamptz default null
)
returns safety.pickup_passes
language plpgsql
as $$
declare
  v_tenant_id  uuid := public.current_tenant_id();
  v_expires_at timestamptz;
  v_row        safety.pickup_passes;
begin
  if public.current_role() <> 'guardian' then
    raise exception 'Only a guardian can create a pickup pass'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a guardian can create a pickup pass.', 'human_message_ar', 'فقط ولي الأمر يمكنه إنشاء تصريح استلام.')::text;
  end if;

  if p_child_id <> all (public.current_guardian_child_ids()) then
    raise exception 'This is not your child'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'This is not your child.', 'human_message_ar', 'هذا ليس طفلك.')::text;
  end if;

  if btrim(coalesce(p_person_name, '')) = '' then
    raise exception 'person_name is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The pickup person''s name is required.', 'human_message_ar', 'اسم الشخص المستلم مطلوب.')::text;
  end if;

  -- Fix for EPIC_3_REVIEW.md L3: cap at 30 days regardless of input.
  v_expires_at := least(coalesce(p_expires_at, now() + interval '24 hours'), now() + interval '30 days');

  insert into safety.pickup_passes (tenant_id, child_id, created_by, person_name, relation, id_photo_object_id, qr_token, status, expires_at)
  values (v_tenant_id, p_child_id, auth.uid(), btrim(p_person_name), p_relation, p_id_photo_object_id, gen_random_uuid()::text, 'active', v_expires_at)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_pickup_pass from public;
grant execute on function public.create_pickup_pass to authenticated;

-- ---------------------------------------------------------------------------
-- public.revoke_pickup_pass — fix for EPIC_3_REVIEW.md M4: no legitimate
-- write path previously existed to ever set a pass's status to 'revoked' —
-- the enum value, scan_pickup_pass's invalid_revoked branch, and every read
-- path assuming it could occur were all unreachable in practice. Guardian
-- only (§12: "Pickup passes | CRUD (own child)" — manager only has R, per
-- the permission matrix, so revocation is a guardian self-service action,
-- not a manager-initiated one). Atomic UPDATE...WHERE (M1 pattern).
-- ---------------------------------------------------------------------------
create or replace function public.revoke_pickup_pass(p_pickup_pass_id uuid)
returns safety.pickup_passes
language plpgsql
as $$
declare
  v_row     safety.pickup_passes;
  v_exists  boolean;
begin
  if public.current_role() <> 'guardian' then
    raise exception 'Only a guardian can revoke a pickup pass'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a guardian can revoke a pickup pass.', 'human_message_ar', 'فقط ولي الأمر يمكنه إلغاء تصريح الاستلام.')::text;
  end if;

  update safety.pickup_passes
  set status = 'revoked'
  where id = p_pickup_pass_id and created_by = auth.uid() and status = 'active'
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select exists(select 1 from safety.pickup_passes where id = p_pickup_pass_id and created_by = auth.uid()) into v_exists;

  if not v_exists then
    raise exception 'Pickup pass not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Pickup pass not found.', 'human_message_ar', 'لم يتم العثور على تصريح الاستلام.')::text;
  else
    raise exception 'This pickup pass is not currently active'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This pickup pass is not currently active.', 'human_message_ar', 'تصريح الاستلام هذا غير نشط حاليًا.')::text;
  end if;
end;
$$;

comment on function public.revoke_pickup_pass is
  'Fix for EPIC_3_REVIEW.md M4 — the only legitimate write path to safety.pickup_passes.status = ''revoked''. Guardian-only per §12''s permission matrix (Pickup passes: CRUD own child, manager R-only).';

revoke all on function public.revoke_pickup_pass from public;
grant execute on function public.revoke_pickup_pass to authenticated;

-- ---------------------------------------------------------------------------
-- public.scan_pickup_pass — reception only. Looks up by exact qr_token
-- match (§13.4 — never a partial/prefix match, never a listing query).
-- Always writes a pickup_scan_events row, even for an unmatched/invalid
-- token (§3.32: "logged anyway for security review"). Lazily transitions a
-- past-expiry 'active' pass to 'expired' when discovered by a scan.
--
-- Fix for EPIC_3_REVIEW.md C5: enforces a per-caller rate limit
-- (safety.pickup_scan_rate_limits, migration 3) — BACKEND_ARCHITECTURE.md
-- §27 explicitly names this RPC as requiring one; since it has no Edge
-- Function layer (matching BACKEND_EXECUTION_PLAN.md §7/§8's RPC-only
-- shape for this function), the check lives in the RPC body against the
-- "small Postgres table" the architecture doc names as an acceptable
-- implementation. Fixed 60-second window, 30 attempts — generous enough for
-- a legitimate drop-off-rush scanning pace, tight enough to meaningfully
-- throttle automated guessing (though qr_token's 122 bits of entropy
-- already make brute-forcing computationally infeasible regardless — this
-- is a documented-compliance and anomaly-detection control, not the sole
-- defense).
--
-- Fix for EPIC_3_REVIEW.md H1: writes a platform.audit_log entry via
-- write_audit_log (Epic 1) for every scan result — pickup pass scan results
-- are explicitly named in BACKEND_ARCHITECTURE.md §23 as "custody-adjacent,
-- high sensitivity" audit-worthy events, and actor_type='staff' is fully
-- representable in the existing enum (reception is a staff role).
--
-- Now SECURITY DEFINER so it can write into
-- safety.pickup_scan_rate_limits (which has zero RLS policies by design,
-- migration 3) — its own role check remains the authorization gate; RLS on
-- pickup_passes/pickup_scan_events is bypassed for this function's own
-- queries by virtue of SECURITY DEFINER (same mechanism already used by
-- children_reception_safe()), and remains the direct-REST-access backstop
-- for any other caller.
-- ---------------------------------------------------------------------------
create or replace function public.scan_pickup_pass(p_qr_token text)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id      uuid := public.current_tenant_id();
  v_pass           safety.pickup_passes;
  v_result         safety.pickup_scan_result;
  v_event          safety.pickup_scan_events;
  v_window_start   timestamptz;
  v_attempt_count  int;
begin
  if public.current_role() <> 'reception' then
    raise exception 'Only reception can scan a pickup pass'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only reception can scan a pickup pass.', 'human_message_ar', 'فقط موظف الاستقبال يمكنه مسح تصريح الاستلام.')::text;
  end if;

  -- Fix for EPIC_3_REVIEW.md C5: fixed 60s window, reset when stale.
  insert into safety.pickup_scan_rate_limits (scanned_by, window_started_at, attempt_count)
  values (auth.uid(), now(), 1)
  on conflict (scanned_by) do update
    set attempt_count = case when safety.pickup_scan_rate_limits.window_started_at < now() - interval '60 seconds'
                              then 1
                              else safety.pickup_scan_rate_limits.attempt_count + 1 end,
        window_started_at = case when safety.pickup_scan_rate_limits.window_started_at < now() - interval '60 seconds'
                                  then now()
                                  else safety.pickup_scan_rate_limits.window_started_at end
  returning window_started_at, attempt_count into v_window_start, v_attempt_count;

  if v_attempt_count > 30 then
    raise exception 'Too many scan attempts — please wait a moment and try again'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Too many scan attempts. Please wait a moment and try again.', 'human_message_ar', 'محاولات مسح كثيرة جدًا. برجاء الانتظار قليلاً والمحاولة مرة أخرى.')::text;
  end if;

  select * into v_pass from safety.pickup_passes where qr_token = p_qr_token and tenant_id = v_tenant_id;

  if v_pass.id is null then
    v_result := 'invalid_unknown';
  elsif v_pass.status = 'revoked' then
    v_result := 'invalid_revoked';
  elsif v_pass.status = 'expired' or v_pass.expires_at < now() then
    if v_pass.status = 'active' then
      update safety.pickup_passes set status = 'expired' where id = v_pass.id;
    end if;
    v_result := 'invalid_expired';
  else
    v_result := 'valid';
  end if;

  insert into safety.pickup_scan_events (tenant_id, pickup_pass_id, scanned_by, result)
  values (v_tenant_id, v_pass.id, auth.uid(), v_result)
  returning * into v_event;

  -- Fix for EPIC_3_REVIEW.md H1.
  perform public.write_audit_log(
    v_tenant_id, 'staff', auth.uid(), 'pickup_pass_scanned', 'pickup_scan_events', v_event.id
  );

  return jsonb_build_object(
    'result', v_result,
    'scanEventId', v_event.id,
    'pass', case when v_pass.id is not null then to_jsonb(v_pass) else null end
  );
end;
$$;

comment on function public.scan_pickup_pass is
  'Exact qr_token match only (§13.4). Logs every scan attempt, valid or not (§3.32), to both pickup_scan_events and platform.audit_log (EPIC_3_REVIEW.md H1). Rate-limited per caller (EPIC_3_REVIEW.md C5). SECURITY DEFINER (EPIC_3_REVIEW.md C5, to reach the RLS-policy-free rate-limit table).';

revoke all on function public.scan_pickup_pass from public;
grant execute on function public.scan_pickup_pass to authenticated;

-- ---------------------------------------------------------------------------
-- public.confirm_handover — reception only, own tenant. Atomic UPDATE...
-- WHERE requiring the scan's own result = 'valid' and not yet confirmed.
-- Routes the child's day-path status to 'delivered' via
-- academic.set_child_day_path_status (migration 4).
--
-- Fix for EPIC_3_REVIEW.md C4: now SECURITY DEFINER so it can call
-- set_child_day_path_status (no longer directly callable by `authenticated`)
-- — see update_child_trip_status's comment above for the full rationale;
-- identical reasoning applies here.
--
-- Fix for EPIC_3_REVIEW.md H1: writes a platform.audit_log entry.
-- Fix for EPIC_3_REVIEW.md H2: enqueues a platform.notification_outbox row.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_handover(p_pickup_scan_event_id uuid)
returns safety.pickup_scan_events
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_row       safety.pickup_scan_events;
  v_exists    boolean;
  v_child_id  uuid;
begin
  if public.current_role() <> 'reception' then
    raise exception 'Only reception can confirm a handover'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only reception can confirm a handover.', 'human_message_ar', 'فقط موظف الاستقبال يمكنه تأكيد التسليم.')::text;
  end if;

  update safety.pickup_scan_events
  set handover_confirmed = true
  where id = p_pickup_scan_event_id
    and tenant_id = v_tenant_id
    and result = 'valid'
    and not handover_confirmed
  returning * into v_row;

  if v_row.id is null then
    select exists(select 1 from safety.pickup_scan_events where id = p_pickup_scan_event_id and tenant_id = v_tenant_id) into v_exists;

    if not v_exists then
      raise exception 'Scan event not found'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Scan event not found.', 'human_message_ar', 'لم يتم العثور على عملية المسح.')::text;
    else
      raise exception 'This handover cannot be confirmed (already confirmed, or the scan was invalid)'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This handover has already been confirmed, or the scan was invalid.', 'human_message_ar', 'تم تأكيد هذا التسليم بالفعل، أو أن المسح غير صالح.')::text;
    end if;
  end if;

  select child_id into v_child_id from safety.pickup_passes where id = v_row.pickup_pass_id;

  if v_child_id is not null then
    perform academic.set_child_day_path_status(v_child_id, 'delivered', 'reception');

    -- Fix for EPIC_3_REVIEW.md H2.
    insert into platform.notification_outbox (tenant_id, recipient_type, recipient_id, category, payload)
    select v_tenant_id, 'guardian', cgl.guardian_id, 'handover_confirmed',
           jsonb_build_object('childId', v_child_id, 'scanEventId', v_row.id)
    from academic.child_guardian_links cgl
    where cgl.child_id = v_child_id and cgl.tenant_id = v_tenant_id;
  end if;

  -- Fix for EPIC_3_REVIEW.md H1.
  perform public.write_audit_log(
    v_tenant_id, 'staff', auth.uid(), 'pickup_handover_confirmed', 'pickup_scan_events', v_row.id
  );

  return v_row;
end;
$$;

comment on function public.confirm_handover is
  'Atomic UPDATE...WHERE (result=valid, not yet confirmed). SECURITY DEFINER (EPIC_3_REVIEW.md C4). Writes platform.audit_log (EPIC_3_REVIEW.md H1) and enqueues platform.notification_outbox (EPIC_3_REVIEW.md H2).';

revoke all on function public.confirm_handover from public;
grant execute on function public.confirm_handover to authenticated;

-- ---------------------------------------------------------------------------
-- public.create_bus_with_driver_row — service_role only. DB half of the
-- add-bus saga. Atomic by construction — driver_id is set in the same
-- INSERT as the bus row.
--
-- Fix for EPIC_3_REVIEW.md M6: identity.driver_profiles.bus_id (the FK
-- added additively in migration 2) was never written by any code path,
-- leaving it permanently null despite its evident purpose. Now set in the
-- same transaction as the bus insert, keeping both directions of this
-- bidirectional relationship consistent from the moment a bus is created.
-- ---------------------------------------------------------------------------
create or replace function public.create_bus_with_driver_row(
  p_tenant_id     uuid,
  p_number        text,
  p_plate         text,
  p_capacity      int,
  p_service_area  text,
  p_driver_id     uuid
)
returns transport.buses
language plpgsql
as $$
declare
  v_row transport.buses;
begin
  insert into transport.buses (tenant_id, number, plate, capacity, service_area, driver_id)
  values (p_tenant_id, p_number, p_plate, p_capacity, p_service_area, p_driver_id)
  returning * into v_row;

  -- Fix for EPIC_3_REVIEW.md M6.
  update identity.driver_profiles set bus_id = v_row.id where id = p_driver_id;

  return v_row;
end;
$$;

comment on function public.create_bus_with_driver_row is
  'DB half of the add-bus saga (Edge Function performs the Auth Admin API driver step first, §25.3). Atomic by construction. Also sets identity.driver_profiles.bus_id (EPIC_3_REVIEW.md M6). service_role only.';

revoke all on function public.create_bus_with_driver_row from public;
grant execute on function public.create_bus_with_driver_row to service_role;

-- ---------------------------------------------------------------------------
-- public.withdraw_child — fix for EPIC_3_REVIEW.md C1: BACKEND_ARCHITECTURE.md
-- line 788 requires withdraw_child to "orchestrate the §8 cascade
-- (soft-deletes pickup_passes, deactivates bus_riders) as one transaction";
-- Epic 2's own comment on this function ("this function is written so
-- Epic 3 can extend it additively via CREATE OR REPLACE without touching
-- this Epic's callers") anticipated exactly this. This CREATE OR REPLACE
-- is that additive extension — the function's signature, return type, and
-- every existing caller's contract are unchanged; only the body gains the
-- Epic 3 cascade. No Epic 2 migration file is modified.
--
-- Children are never hard-deleted (soft-delete only), so pickup_passes'
-- ON DELETE CASCADE FK (migration 3) never actually fires in practice —
-- this RPC-level cascade (setting status='revoked' / active=false) is the
-- only correct place to implement the documented soft-delete cascade.
--
-- SECURITY DEFINER (found necessary while implementing this fix): a manager
-- has no RLS UPDATE policy on safety.pickup_passes at all (only guardian
-- and reception do, both narrowly scoped to their own actions) — without
-- SECURITY DEFINER, the pickup_passes cascade UPDATE below would silently
-- affect 0 rows under RLS (bus_riders_update_manager does exist, so that
-- half of the cascade would work, masking the pickup_passes half's
-- silent failure). This function's own role/tenant checks (unchanged from
-- Epic 2) remain the sole authorization gate, same pattern as
-- update_child_trip_status/confirm_handover/scan_pickup_pass above.
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_child(
  p_child_id  uuid,
  p_reason    text default null
)
returns academic.children
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_row academic.children;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can withdraw a child'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'Only a manager can withdraw a child.',
              'human_message_ar', 'فقط المدير يمكنه سحب طفل.'
            )::text;
  end if;

  update academic.children
  set deleted_at = now()
  where id = p_child_id and tenant_id = public.current_tenant_id() and deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Child not found or already withdrawn'
      using errcode = 'P0002',
            detail = json_build_object(
              'code', 'NOT_FOUND',
              'human_message_en', 'Child not found or already withdrawn.',
              'human_message_ar', 'لم يتم العثور على الطفل أو تم سحبه بالفعل.'
            )::text;
  end if;

  -- Fix for EPIC_3_REVIEW.md C1: cascade into Epic 3's tables, same
  -- transaction as the withdrawal itself.
  update safety.pickup_passes
  set status = 'revoked'
  where child_id = p_child_id and status = 'active';

  update transport.bus_riders
  set active = false
  where child_id = p_child_id and active;

  return v_row;
end;
$$;

comment on function public.withdraw_child is
  'Fix for EPIC_3_REVIEW.md C1 — additively extends Epic 2''s withdraw_child (unchanged signature/contract) to cascade-revoke the withdrawn child''s active pickup_passes and deactivate their bus_riders assignment in the same transaction, per BACKEND_ARCHITECTURE.md line 788. SECURITY DEFINER so the pickup_passes half of the cascade does not silently no-op under RLS for a manager caller. No Epic 2 migration file is modified.';

revoke all on function public.withdraw_child from public;
grant execute on function public.withdraw_child to authenticated;
