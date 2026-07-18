-- ============================================================================
-- Epic 3 — Transport & Safety
-- Migration 2: buses, bus_riders, trips, trip_stops, trip_stop_riders,
--              trip_child_status, gps_pings
-- Ref: BACKEND_ARCHITECTURE.md §3.25-3.30, §4, §5, §6, §18
--
-- Every lesson from the Epic 2 review/fix/deployment-failure cycle is applied
-- proactively here rather than retrofitted later: cross-table tenant-
-- consistency triggers exist from this table's first migration (not added in
-- a later "fix" pass), capacity locking mirrors the classrooms/children
-- pattern exactly, and no RLS helper introduced anywhere in this Epic is ever
-- declared RETURNS SETOF (see migration 4) — all are RETURNS <type>[] from
-- the start, avoiding the set-returning-function-in-policy failure mode
-- documented in EPIC_2_DEPLOYMENT_FIX.md entirely, rather than discovering it
-- again at deploy time.
-- ============================================================================

create type transport.trip_leg as enum ('am', 'pm');
create type transport.trip_status as enum ('scheduled', 'moving', 'arrived', 'completed', 'cancelled');
create type transport.trip_child_status_value as enum ('pending', 'picked_up', 'dropped_off', 'absent');

-- ---------------------------------------------------------------------------
-- transport.buses  (§3.25)
-- ---------------------------------------------------------------------------
create table transport.buses (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenancy.tenants(id) on delete restrict,
  number        text not null check (btrim(number) <> ''),
  plate         text not null check (btrim(plate) <> ''),
  capacity      int not null check (capacity > 0),
  service_area  text null,
  driver_id     uuid null references identity.driver_profiles(id) on delete restrict,
  deleted_at    timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index buses_tenant_idx on transport.buses (tenant_id) where deleted_at is null;
create unique index buses_driver_key on transport.buses (driver_id) where deleted_at is null and driver_id is not null;

-- Fix for EPIC_3_REVIEW.md M7: no uniqueness constraint existed on plate/
-- number within a tenant, allowing duplicate records for the same physical
-- vehicle (including via a non-idempotent add-bus retry).
create unique index buses_tenant_plate_key on transport.buses (tenant_id, plate) where deleted_at is null;
create unique index buses_tenant_number_key on transport.buses (tenant_id, number) where deleted_at is null;

create trigger trg_buses_updated_at
  before update on transport.buses
  for each row execute function public.set_updated_at();

comment on table transport.buses is
  'One row per bus. driver_id is nullable (a bus can exist before a driver is assigned) and unique among non-deleted rows — one driver drives at most one bus at a time (§3.25).';

-- ---------------------------------------------------------------------------
-- Additive extension of an Epic 1 table: identity.driver_profiles carries a
-- `bus_id uuid null` column since Epic 1 (see that migration's comment: "FK
-- to transport.buses, added in Epic 3"). Now that transport.buses exists,
-- this migration adds ONLY the foreign-key constraint on that already-
-- existing, already-nullable column — mirrors Epic 2 migration 2's identical
-- extension of staff_profiles.primary_classroom_id exactly. No Epic 1 file
-- is edited.
-- ---------------------------------------------------------------------------
alter table identity.driver_profiles
  add constraint driver_profiles_bus_id_fkey
  foreign key (bus_id) references transport.buses(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Tenant-consistency trigger: buses.driver_id, when set, must belong to the
-- same tenant as the bus. Same pattern as academic.check_classroom_coordinator_tenant
-- (Epic 2 migration 2) — applied here from the first migration, not as a
-- later fix.
-- ---------------------------------------------------------------------------
create or replace function transport.check_bus_driver_tenant()
returns trigger
language plpgsql
as $$
declare
  v_driver_tenant_id uuid;
begin
  if new.driver_id is null then
    return new;
  end if;

  select tenant_id into v_driver_tenant_id from identity.driver_profiles where id = new.driver_id;

  if v_driver_tenant_id is null or v_driver_tenant_id <> new.tenant_id then
    raise exception 'driver_id does not belong to the same tenant as this bus'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'The selected driver does not belong to your tenant.',
              'human_message_ar', 'السائق المحدد لا ينتمي إلى مؤسستك.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_buses_driver_tenant
  before insert or update of driver_id, tenant_id on transport.buses
  for each row execute function transport.check_bus_driver_tenant();

-- ---------------------------------------------------------------------------
-- transport.bus_riders  (§3.26) — one ACTIVE row per child at a time
-- (partial unique index). Reassigning a child to a different bus is done by
-- deactivating the old row and inserting a new one (assign_bus_rider,
-- migration 6) rather than updating bus_id in place, so history is
-- preserved.
-- ---------------------------------------------------------------------------
create table transport.bus_riders (
  id                       uuid primary key default gen_random_uuid(),
  bus_id                   uuid not null references transport.buses(id) on delete restrict,
  child_id                 uuid not null references academic.children(id) on delete restrict,
  tenant_id                uuid not null references tenancy.tenants(id) on delete restrict,
  pickup_address_override  text null,
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index bus_riders_active_child_key on transport.bus_riders (child_id) where active;
create index bus_riders_bus_idx on transport.bus_riders (bus_id) where active;
create index bus_riders_tenant_idx on transport.bus_riders (tenant_id);

create trigger trg_bus_riders_updated_at
  before update on transport.bus_riders
  for each row execute function public.set_updated_at();

comment on table transport.bus_riders is
  'Child <-> bus assignment. At most one active row per child (bus_riders_active_child_key) — assign_bus_rider (migration 6) deactivates any prior active row before inserting the new one, preserving history rather than updating bus_id in place.';

-- ---------------------------------------------------------------------------
-- Tenant-consistency + capacity trigger for bus_riders, applying the SAME
-- pattern academic.check_children_classroom_consistency (Epic 2, post-fix)
-- established for classrooms/children: a single BEFORE INSERT OR UPDATE
-- trigger that (a) locks the bus row, (b) verifies bus_id/child_id both
-- belong to this row's tenant, and (c) rejects the write if the bus is
-- already at capacity. assign_bus_rider (migration 6) performs its own
-- check first for a clean error message; this trigger is the DB-enforced
-- backstop that holds regardless of write path, from day one — not added
-- after a later audit, per the lesson of EPIC_2_REVIEW.md C1.
-- ---------------------------------------------------------------------------
create or replace function transport.check_bus_rider_consistency()
returns trigger
language plpgsql
as $$
declare
  v_bus_tenant_id  uuid;
  v_capacity       int;
  v_child_tenant_id uuid;
  v_current_count  int;
begin
  select tenant_id, capacity into v_bus_tenant_id, v_capacity
  from transport.buses
  where id = new.bus_id and deleted_at is null
  for update;

  if v_bus_tenant_id is null then
    raise exception 'Bus not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Bus not found.', 'human_message_ar', 'لم يتم العثور على الحافلة.')::text;
  end if;

  -- Fix (found while implementing EPIC_3_REVIEW.md C1): deliberately does
  -- NOT filter deleted_at here. withdraw_child's new cascade (migration 6)
  -- deactivates a withdrawn child's bus_riders row (active: true -> false)
  -- in the same transaction as setting children.deleted_at — if this
  -- lookup required deleted_at IS NULL, that deactivation would itself
  -- raise "Child not found" and withdraw_child would fail. tenant_id does
  -- not change on soft-delete, so tenant-consistency remains verifiable
  -- regardless of withdrawal status; blocking a *new* assignment to a
  -- withdrawn child is still enforced separately, by assign_bus_rider's own
  -- `deleted_at is null` check (migration 6) before it ever reaches this
  -- trigger.
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_bus_tenant_id <> new.tenant_id or v_child_tenant_id <> new.tenant_id then
    raise exception 'bus_id/child_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This bus and child do not both belong to your tenant.',
              'human_message_ar', 'هذه الحافلة والطفل لا ينتميان لنفس المؤسسة.'
            )::text;
  end if;

  if new.active and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and (new.bus_id is distinct from old.bus_id or new.active is distinct from old.active))) then
    select count(*) into v_current_count
    from transport.bus_riders
    where bus_id = new.bus_id and active and id <> new.id;

    if v_current_count >= v_capacity then
      raise exception 'Bus is at full capacity'
        using errcode = 'P0001',
              detail = json_build_object(
                'code', 'VALIDATION_FAILED',
                'human_message_en', 'This bus is at full capacity.',
                'human_message_ar', 'هذه الحافلة ممتلئة بالكامل.'
              )::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_bus_riders_consistency
  before insert or update on transport.bus_riders
  for each row execute function transport.check_bus_rider_consistency();

comment on function transport.check_bus_rider_consistency() is
  'Applies the EPIC_2_REVIEW.md C1 lesson from the start: capacity lock + tenant consistency enforced at the DB layer for every write path, not just assign_bus_rider''s own (still-present) check.';

-- ---------------------------------------------------------------------------
-- transport.trips  (§3.27)
-- ---------------------------------------------------------------------------
create table transport.trips (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenancy.tenants(id) on delete restrict,
  bus_id        uuid not null references transport.buses(id) on delete restrict,
  leg           transport.trip_leg not null,
  service_date  date not null,
  status        transport.trip_status not null default 'scheduled',
  started_at    timestamptz null,
  arrived_at    timestamptz null,
  completed_at  timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index trips_bus_leg_date_key on transport.trips (bus_id, leg, service_date);
create index trips_tenant_idx on transport.trips (tenant_id);
create index trips_bus_live_idx on transport.trips (bus_id) where status in ('scheduled', 'moving', 'arrived');

create trigger trg_trips_updated_at
  before update on transport.trips
  for each row execute function public.set_updated_at();

comment on table transport.trips is
  'One row per bus/leg/service_date (unique key makes start_trip, migration 6, a natural once-per-day-per-leg operation). §18: scheduled -> moving -> arrived -> completed, or cancelled.';

create or replace function transport.check_trip_bus_tenant()
returns trigger
language plpgsql
as $$
declare
  v_bus_tenant_id uuid;
begin
  select tenant_id into v_bus_tenant_id from transport.buses where id = new.bus_id and deleted_at is null;

  if v_bus_tenant_id is null or v_bus_tenant_id <> new.tenant_id then
    raise exception 'bus_id does not belong to the same tenant as this trip'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This bus does not belong to your tenant.',
              'human_message_ar', 'هذه الحافلة لا تنتمي إلى مؤسستك.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_trips_bus_tenant
  before insert or update of bus_id, tenant_id on transport.trips
  for each row execute function transport.check_trip_bus_tenant();

-- Fix for EPIC_3_REVIEW.md C2: bus_id/leg/service_date are a trip's identity
-- (the unique key, trips_bus_leg_date_key, is built on exactly these three
-- columns) and must never change after creation — a column-scoped backstop
-- alongside trips_update_driver's (migration 5) status-only WITH CHECK, so
-- even a caller with a broader future grant on this table can't rewrite a
-- trip's identity in place.
create or replace function transport.check_trip_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.bus_id is distinct from old.bus_id
     or new.leg is distinct from old.leg
     or new.service_date is distinct from old.service_date then
    raise exception 'bus_id/leg/service_date cannot be changed after a trip is created'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'A trip''s bus, leg, and date cannot be changed after it starts.',
              'human_message_ar', 'لا يمكن تغيير حافلة الرحلة أو فترتها أو تاريخها بعد بدئها.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_trips_immutable_fields
  before update of bus_id, leg, service_date on transport.trips
  for each row execute function transport.check_trip_immutable_fields();

-- ---------------------------------------------------------------------------
-- transport.trip_stops  (§3.28) — waypoints generated by start_trip
-- (migration 6), one per rider child (§18: no real routing/geocoding engine
-- exists in v1 — sequence is assignment order, not an optimized route; see
-- EPIC_3_COMPLETION_REPORT.md Known Limitations).
-- ---------------------------------------------------------------------------
create table transport.trip_stops (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references transport.trips(id) on delete cascade,
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  sequence     int not null check (sequence >= 0),
  lat          numeric(9,6) null check (lat is null or lat between -90 and 90),
  lng          numeric(9,6) null check (lng is null or lng between -180 and 180),
  label        text null,
  reached_at   timestamptz null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index trip_stops_trip_sequence_key on transport.trip_stops (trip_id, sequence);
create index trip_stops_tenant_idx on transport.trip_stops (tenant_id);

create trigger trg_trip_stops_updated_at
  before update on transport.trip_stops
  for each row execute function public.set_updated_at();

create or replace function transport.check_trip_stop_tenant()
returns trigger
language plpgsql
as $$
declare
  v_trip_tenant_id uuid;
begin
  select tenant_id into v_trip_tenant_id from transport.trips where id = new.trip_id;

  if v_trip_tenant_id is null or v_trip_tenant_id <> new.tenant_id then
    raise exception 'trip_id does not belong to the same tenant as this stop'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This trip does not belong to your tenant.', 'human_message_ar', 'هذه الرحلة لا تنتمي إلى مؤسستك.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_trip_stops_tenant
  before insert or update of trip_id, tenant_id on transport.trip_stops
  for each row execute function transport.check_trip_stop_tenant();

-- ---------------------------------------------------------------------------
-- transport.trip_stop_riders  (§3.28) — pure link/snapshot table, composite
-- PK, no timestamps (same precedent as academic.child_guardian_links).
--
-- Fix for EPIC_3_REVIEW.md M1: trip_id/child_id are denormalized directly
-- onto this table (populated by start_trip, migration 6) so RLS policies
-- (migration 5) can use a direct `= any(...)` equality check instead of the
-- subquery-through-trip_stops/bus_riders shape the original delivery used —
-- the same H3 lesson Epic 2 already applied to day_path_events/evaluations,
-- applied here to the one table in this Epic that had drifted from it.
-- ---------------------------------------------------------------------------
create table transport.trip_stop_riders (
  trip_stop_id   uuid not null references transport.trip_stops(id) on delete cascade,
  bus_rider_id   uuid not null references transport.bus_riders(id) on delete cascade,
  tenant_id      uuid not null references tenancy.tenants(id) on delete restrict,
  trip_id        uuid not null references transport.trips(id) on delete cascade,
  child_id       uuid not null references academic.children(id) on delete restrict,
  eta            timestamptz null,
  primary key (trip_stop_id, bus_rider_id)
);

create index trip_stop_riders_bus_rider_idx on transport.trip_stop_riders (bus_rider_id);
create index trip_stop_riders_tenant_idx on transport.trip_stop_riders (tenant_id);
create index trip_stop_riders_trip_idx on transport.trip_stop_riders (trip_id);
create index trip_stop_riders_child_idx on transport.trip_stop_riders (child_id);

-- Fix for EPIC_3_REVIEW.md M1: now also verifies the denormalized trip_id/
-- child_id agree with trip_stop_id's own trip and bus_rider_id's own child
-- — a stronger consistency guarantee than the original tenant-only check,
-- since a mismatched denormalized column would otherwise silently make the
-- new direct-equality RLS policies (migration 5) wrong.
create or replace function transport.check_trip_stop_rider_tenant()
returns trigger
language plpgsql
as $$
declare
  v_stop_tenant_id  uuid;
  v_stop_trip_id    uuid;
  v_rider_tenant_id uuid;
  v_rider_child_id  uuid;
begin
  select tenant_id, trip_id into v_stop_tenant_id, v_stop_trip_id from transport.trip_stops where id = new.trip_stop_id;
  select tenant_id, child_id into v_rider_tenant_id, v_rider_child_id from transport.bus_riders where id = new.bus_rider_id;

  if v_stop_tenant_id is null or v_rider_tenant_id is null
     or v_stop_tenant_id <> new.tenant_id or v_rider_tenant_id <> new.tenant_id then
    raise exception 'trip_stop_id/bus_rider_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This stop and rider do not both belong to your tenant.', 'human_message_ar', 'هذه المحطة والراكب لا ينتميان لنفس المؤسسة.')::text;
  end if;

  if v_stop_trip_id <> new.trip_id or v_rider_child_id <> new.child_id then
    raise exception 'trip_id/child_id do not match trip_stop_id/bus_rider_id''s own trip/child'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The denormalized trip/child do not match the stop/rider.', 'human_message_ar', 'الرحلة/الطفل غير متطابقين مع المحطة/الراكب.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_trip_stop_riders_tenant
  before insert or update on transport.trip_stop_riders
  for each row execute function transport.check_trip_stop_rider_tenant();

-- ---------------------------------------------------------------------------
-- transport.trip_child_status  (§3.29) — one row per child per trip.
-- changed_by is a plain uuid with no FK (either a driver_profiles.id or a
-- staff_profiles.id can write here per §12 — no single-table FK possible,
-- same precedent as identity.service_accounts.issued_by, Epic 1).
-- ---------------------------------------------------------------------------
create table transport.trip_child_status (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references transport.trips(id) on delete cascade,
  child_id           uuid not null references academic.children(id) on delete restrict,
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  status             transport.trip_child_status_value not null default 'pending',
  status_changed_at  timestamptz null,
  changed_by         uuid null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index trip_child_status_trip_child_key on transport.trip_child_status (trip_id, child_id);
create index trip_child_status_tenant_idx on transport.trip_child_status (tenant_id);

create trigger trg_trip_child_status_updated_at
  before update on transport.trip_child_status
  for each row execute function public.set_updated_at();

-- Fix for EPIC_3_REVIEW.md C3: this trigger previously validated only that
-- trip_id/child_id belonged to the same tenant — never that the child was
-- actually a rider on the trip's bus. update_child_trip_status (migration 6)
-- now performs the equivalent check itself for a clean error message; this
-- trigger is the DB-level backstop that holds regardless of write path
-- (direct table access included), exactly mirroring the C1 pattern Epic 2
-- established for classrooms/children capacity+consistency.
create or replace function transport.check_trip_child_status_consistency()
returns trigger
language plpgsql
as $$
declare
  v_trip_tenant_id  uuid;
  v_trip_bus_id     uuid;
  v_child_tenant_id uuid;
  v_is_rider        boolean;
begin
  select tenant_id, bus_id into v_trip_tenant_id, v_trip_bus_id from transport.trips where id = new.trip_id;
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;

  if v_trip_tenant_id is null or v_child_tenant_id is null
     or v_trip_tenant_id <> new.tenant_id or v_child_tenant_id <> new.tenant_id then
    raise exception 'trip_id/child_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This trip and child do not both belong to your tenant.', 'human_message_ar', 'هذه الرحلة والطفل لا ينتميان لنفس المؤسسة.')::text;
  end if;

  select exists(
    select 1 from transport.bus_riders
    where bus_id = v_trip_bus_id and child_id = new.child_id and active
  ) into v_is_rider;

  if not v_is_rider then
    raise exception 'This child is not an active rider on this trip''s bus'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child is not assigned to this trip''s bus.',
              'human_message_ar', 'هذا الطفل غير معيّن لحافلة هذه الرحلة.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_trip_child_status_consistency
  before insert or update of trip_id, child_id, tenant_id on transport.trip_child_status
  for each row execute function transport.check_trip_child_status_consistency();

-- ---------------------------------------------------------------------------
-- transport.gps_pings  (§3.30) — append-only, high-frequency (§18: 5-10s
-- client-side cadence). No updated_at (matches academic.day_path_events'
-- append-only precedent). The tenant-consistency trigger is a single indexed
-- lookup on trips(id) — kept deliberately minimal given this table's write
-- volume, but not skipped: correctness of tenant isolation applies here too
-- (§2.2 has no volume-based exception).
-- ---------------------------------------------------------------------------
create table transport.gps_pings (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references transport.trips(id) on delete cascade,
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  lat          numeric(9,6) not null check (lat between -90 and 90),
  lng          numeric(9,6) not null check (lng between -180 and 180),
  heading      numeric(5,2) null,
  speed_kph    numeric(5,2) null check (speed_kph is null or speed_kph >= 0),
  recorded_at  timestamptz not null default now()
);

create index gps_pings_trip_recorded_idx on transport.gps_pings (trip_id, recorded_at desc);
create index gps_pings_tenant_idx on transport.gps_pings (tenant_id);

comment on table transport.gps_pings is
  'Append-only, never updated. §18: retention/purge is a Scheduled Jobs concern deferred to Epic 10 (BACKEND_EXECUTION_PLAN.md), not implemented here.';

create or replace function transport.check_gps_ping_tenant()
returns trigger
language plpgsql
as $$
declare
  v_trip_tenant_id uuid;
begin
  select tenant_id into v_trip_tenant_id from transport.trips where id = new.trip_id;

  if v_trip_tenant_id is null or v_trip_tenant_id <> new.tenant_id then
    raise exception 'trip_id does not belong to the same tenant as this ping'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This trip does not belong to your tenant.', 'human_message_ar', 'هذه الرحلة لا تنتمي إلى مؤسستك.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_gps_pings_tenant
  before insert on transport.gps_pings
  for each row execute function transport.check_gps_ping_tenant();
