-- ============================================================================
-- Epic 3 RLS adversarial test suite (see epic3_README.md for how/why to
-- run this). Same shape as epic2_rls_adversarial.sql: fixture rows as
-- service_role, then switch to a simulated authenticated role via a forged
-- JWT claim and assert the expected allow/deny outcome. Every fixture UUID
-- uses only valid hexadecimal characters (0-9a-f) from the start — the
-- lesson from EPIC_2_FIX_REPORT.md's discovery that Epic 2's original
-- fixtures used non-hex mnemonic letters and would have failed to parse.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A: manager, driver (bus A1, capacity 1,
-- already at capacity via child A1), reception, guardian A1 (child A1, on
-- bus A1) and guardian A2 (child A2, not on any bus). Tenant B: manager,
-- driver (bus B1), guardian B1 (child B1). A trip is started on bus A1
-- (am leg) to exercise trip/trip_child_status/gps_pings scoping. A pickup
-- pass is created for child A1.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e3999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e3a01', 'Tenant E3-A', 'tenant-e3-a-test', '00000000-0000-0000-0000-0000000e3999', 'active'),
  ('00000000-0000-0000-0000-0000000e3b01', 'Tenant E3-B', 'tenant-e3-b-test', '00000000-0000-0000-0000-0000000e3999', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e3a11', '+201200000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e3a12', '+201200000002', 'authenticated', 'authenticated'), -- driver A1
  ('00000000-0000-0000-0000-0000000e3a13', '+201200000003', 'authenticated', 'authenticated'), -- reception A
  ('00000000-0000-0000-0000-0000000e3a14', '+201200000004', 'authenticated', 'authenticated'), -- guardian A1 (child on bus A1)
  ('00000000-0000-0000-0000-0000000e3a15', '+201200000005', 'authenticated', 'authenticated'), -- guardian A2 (no bus)
  ('00000000-0000-0000-0000-0000000e3b11', '+201200000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e3b12', '+201200000007', 'authenticated', 'authenticated'), -- driver B1
  ('00000000-0000-0000-0000-0000000e3b14', '+201200000008', 'authenticated', 'authenticated')  -- guardian B1
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e3a11', '00000000-0000-0000-0000-0000000e3a01', 'manager', 'Manager A', '+201200000001'),
  ('00000000-0000-0000-0000-0000000e3a13', '00000000-0000-0000-0000-0000000e3a01', 'reception', 'Reception A', '+201200000003'),
  ('00000000-0000-0000-0000-0000000e3b11', '00000000-0000-0000-0000-0000000e3b01', 'manager', 'Manager B', '+201200000006')
on conflict (id) do nothing;

insert into identity.driver_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e3a12', '00000000-0000-0000-0000-0000000e3a01', 'Driver A1', '+201200000002'),
  ('00000000-0000-0000-0000-0000000e3b12', '00000000-0000-0000-0000-0000000e3b01', 'Driver B1', '+201200000007')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e3a14', '00000000-0000-0000-0000-0000000e3a01', 'Guardian A1', '+201200000004'),
  ('00000000-0000-0000-0000-0000000e3a15', '00000000-0000-0000-0000-0000000e3a01', 'Guardian A2', '+201200000005'),
  ('00000000-0000-0000-0000-0000000e3b14', '00000000-0000-0000-0000-0000000e3b01', 'Guardian B1', '+201200000008')
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, capacity)
values
  ('00000000-0000-0000-0000-0000000e3a21', '00000000-0000-0000-0000-0000000e3a01', 'KG1-A', 'kg1', 36, 48, 10),
  ('00000000-0000-0000-0000-0000000e3b21', '00000000-0000-0000-0000-0000000e3b01', 'KG1-B', 'kg1', 36, 48, 10)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e3a31', '00000000-0000-0000-0000-0000000e3a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e3a21', 'full_day'),
  ('00000000-0000-0000-0000-0000000e3a32', '00000000-0000-0000-0000-0000000e3a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e3a21', 'full_day'),
  ('00000000-0000-0000-0000-0000000e3b31', '00000000-0000-0000-0000-0000000e3b01', 'Child B1', '2020-03-03', 'male', '00000000-0000-0000-0000-0000000e3b21', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values
  ('00000000-0000-0000-0000-0000000e3a31', '00000000-0000-0000-0000-0000000e3a14', '00000000-0000-0000-0000-0000000e3a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e3a32', '00000000-0000-0000-0000-0000000e3a15', '00000000-0000-0000-0000-0000000e3a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e3b31', '00000000-0000-0000-0000-0000000e3b14', '00000000-0000-0000-0000-0000000e3b01', 'mother', true)
on conflict do nothing;

insert into transport.buses (id, tenant_id, number, plate, capacity, driver_id)
values
  ('00000000-0000-0000-0000-0000000e3a41', '00000000-0000-0000-0000-0000000e3a01', 'A1', 'AAA-111', 1, '00000000-0000-0000-0000-0000000e3a12'),
  ('00000000-0000-0000-0000-0000000e3b41', '00000000-0000-0000-0000-0000000e3b01', 'B1', 'BBB-111', 10, '00000000-0000-0000-0000-0000000e3b12')
on conflict (id) do nothing;

insert into transport.bus_riders (id, bus_id, child_id, tenant_id, active)
values ('00000000-0000-0000-0000-0000000e3a51', '00000000-0000-0000-0000-0000000e3a41', '00000000-0000-0000-0000-0000000e3a31', '00000000-0000-0000-0000-0000000e3a01', true)
on conflict (id) do nothing;

insert into safety.pickup_passes (id, tenant_id, child_id, created_by, person_name, relation, qr_token, status, expires_at)
values
  ('00000000-0000-0000-0000-0000000e3a71', '00000000-0000-0000-0000-0000000e3a01', '00000000-0000-0000-0000-0000000e3a31', '00000000-0000-0000-0000-0000000e3a14', 'Amira Hassan', 'aunt', 'e3-test-token-active', 'active', now() + interval '1 day'),
  ('00000000-0000-0000-0000-0000000e3a72', '00000000-0000-0000-0000-0000000e3a01', '00000000-0000-0000-0000-0000000e3a31', '00000000-0000-0000-0000-0000000e3a14', 'Old Sitter', 'other', 'e3-test-token-expired', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000e3a73', '00000000-0000-0000-0000-0000000e3a01', '00000000-0000-0000-0000-0000000e3a31', '00000000-0000-0000-0000-0000000e3a14', 'Revoked Person', 'other', 'e3-test-token-revoked', 'revoked', now() + interval '1 day')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's bus.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from transport.buses where id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 0 then
    raise exception 'FAIL Test 1: Manager B could see Tenant A''s bus';
  end if;
  raise notice 'PASS Test 1: cross-tenant isolation on buses holds';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: driver own-bus scoping — Driver B1 cannot see Tenant A's bus,
-- riders, or trip even though nothing else distinguishes the tenants.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3b12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3b01","role":"driver"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from transport.buses where id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 0 then
    raise exception 'FAIL Test 2a: Driver B1 could see Tenant A''s bus';
  end if;

  select count(*) into v_count from transport.bus_riders where bus_id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 0 then
    raise exception 'FAIL Test 2b: Driver B1 could see Tenant A''s bus riders';
  end if;

  raise notice 'PASS Test 2: driver own-bus scoping holds cross-tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: Driver A1 (own bus) CAN see their own bus and rider.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"driver"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from transport.buses where id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 1 then
    raise exception 'FAIL Test 3a: Driver A1 could not see their own bus (got % rows)', v_count;
  end if;

  select count(*) into v_count from transport.bus_riders where bus_id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 1 then
    raise exception 'FAIL Test 3b: Driver A1 could not see their own bus''s rider';
  end if;

  raise notice 'PASS Test 3: driver can see their own bus/riders';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: capacity lock — bus A1 has capacity 1 and already has one active
-- rider (Child A1). assign_bus_rider for Child A2 must be rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"manager"}}';

do $$
begin
  perform public.assign_bus_rider('00000000-0000-0000-0000-0000000e3a41', '00000000-0000-0000-0000-0000000e3a32');
  raise exception 'FAIL Test 4: assign_bus_rider succeeded past bus capacity';
exception
  when others then
    if sqlerrm like '%full capacity%' then
      raise notice 'PASS Test 4: assign_bus_rider correctly rejects an over-capacity bus';
    else
      raise;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: direct INSERT into bus_riders (bypassing assign_bus_rider) is
-- still rejected by the DB-level capacity trigger (transport.check_bus_rider_consistency,
-- migration 2) — the same defense-in-depth invariant established by
-- EPIC_2_REVIEW.md C1 for classrooms/children, applied here from the start.
-- ---------------------------------------------------------------------------
set local role service_role;

do $$
begin
  insert into transport.bus_riders (bus_id, child_id, tenant_id, active)
  values ('00000000-0000-0000-0000-0000000e3a41', '00000000-0000-0000-0000-0000000e3a32', '00000000-0000-0000-0000-0000000e3a01', true);
  raise exception 'FAIL Test 5: direct INSERT into bus_riders bypassed the capacity trigger';
exception
  when others then
    if sqlerrm like '%full capacity%' then
      raise notice 'PASS Test 5: DB-level capacity trigger holds even for a direct INSERT';
    else
      raise;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: start_trip snapshots the bus's riders, then guardian A1 (whose
-- child rides bus A1) can see the live trip and its GPS pings, while
-- guardian A2 (whose child is not on any bus) cannot.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"driver"}}';

do $$
declare v_trip_id uuid;
begin
  select (public.start_trip('00000000-0000-0000-0000-0000000e3a41', 'am')->'trip'->>'id')::uuid into v_trip_id;
  perform public.record_gps_ping(v_trip_id, 30.05, 31.23);
  if v_trip_id is null then
    raise exception 'FAIL Test 6 setup: start_trip did not return a trip id';
  end if;
  raise notice 'PASS Test 6 setup: start_trip created trip % with a GPS ping', v_trip_id;
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from transport.trips where bus_id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 1 then
    raise exception 'FAIL Test 6a: Guardian A1 (child on the bus) could not see the live trip (got % rows)', v_count;
  end if;

  select count(*) into v_count from transport.gps_pings gp join transport.trips t on t.id = gp.trip_id where t.bus_id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 1 then
    raise exception 'FAIL Test 6b: Guardian A1 could not see the GPS ping on their child''s trip';
  end if;

  raise notice 'PASS Test 6a/6b: guardian with a child on the bus sees the live trip and its GPS pings';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from transport.trips where bus_id = '00000000-0000-0000-0000-0000000e3a41';
  if v_count <> 0 then
    raise exception 'FAIL Test 7: Guardian A2 (child NOT on the bus) could see Tenant A''s live trip';
  end if;
  raise notice 'PASS Test 7: guardian with no child on the bus sees zero trips, same tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8 (§13.4 — specifically adversarially tested per BACKEND_ARCHITECTURE.md
-- §14.2's note): scan_pickup_pass never leaks pass existence for an unknown
-- token, correctly flags an expired pass, correctly flags a revoked pass,
-- and every attempt — including the failed ones — is logged.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"reception"}}';

do $$
declare
  v_unknown  jsonb;
  v_expired  jsonb;
  v_revoked  jsonb;
  v_valid    jsonb;
  v_log_count int;
begin
  v_unknown := public.scan_pickup_pass('this-token-does-not-exist-anywhere');
  if v_unknown->>'result' <> 'invalid_unknown' then
    raise exception 'FAIL Test 8a: unknown token did not return invalid_unknown (got %)', v_unknown->>'result';
  end if;
  if v_unknown->'pass' is not null then
    raise exception 'FAIL Test 8a: unknown token leaked a non-null pass payload';
  end if;

  v_expired := public.scan_pickup_pass('e3-test-token-expired');
  if v_expired->>'result' <> 'invalid_expired' then
    raise exception 'FAIL Test 8b: expired token did not return invalid_expired (got %)', v_expired->>'result';
  end if;

  v_revoked := public.scan_pickup_pass('e3-test-token-revoked');
  if v_revoked->>'result' <> 'invalid_revoked' then
    raise exception 'FAIL Test 8c: revoked token did not return invalid_revoked (got %)', v_revoked->>'result';
  end if;

  v_valid := public.scan_pickup_pass('e3-test-token-active');
  if v_valid->>'result' <> 'valid' then
    raise exception 'FAIL Test 8d: active token did not return valid (got %)', v_valid->>'result';
  end if;

  select count(*) into v_log_count from safety.pickup_scan_events where tenant_id = '00000000-0000-0000-0000-0000000e3a01';
  if v_log_count <> 4 then
    raise exception 'FAIL Test 8e: expected 4 logged scan attempts (including the 3 invalid ones), got %', v_log_count;
  end if;

  raise notice 'PASS Test 8: scan_pickup_pass correctly distinguishes unknown/expired/revoked/valid and logs every attempt';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: cross-tenant token guessing — even a correct token string cannot
-- be scanned by a different tenant's reception account (tenant_id filter in
-- scan_pickup_pass, §13.4).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3b01","role":"reception"}}';

do $$
declare v_result jsonb;
begin
  v_result := public.scan_pickup_pass('e3-test-token-active');
  if v_result->>'result' <> 'invalid_unknown' then
    raise exception 'FAIL Test 9: a valid Tenant-A token was NOT reported as invalid_unknown when scanned by Tenant B reception (got %)', v_result->>'result';
  end if;
  raise notice 'PASS Test 9: cross-tenant token scanning correctly reports invalid_unknown, never leaking existence';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: confirm_handover cannot be called twice — the second call must
-- be rejected as STATE_ALREADY_PROCESSED (atomic UPDATE...WHERE, same
-- pattern as Epic 2's post-M1-fix suspend_child).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"reception"}}';

do $$
declare
  v_scan   jsonb;
  v_event_id uuid;
begin
  v_scan := public.scan_pickup_pass('e3-test-token-active');
  v_event_id := (v_scan->>'scanEventId')::uuid;

  perform public.confirm_handover(v_event_id);

  begin
    perform public.confirm_handover(v_event_id);
    raise exception 'FAIL Test 10: confirm_handover succeeded twice on the same scan event';
  exception
    when others then
      if sqlerrm like '%already been confirmed%' or sqlerrm like '%cannot be confirmed%' then
        raise notice 'PASS Test 10: a second confirm_handover call is correctly rejected';
      else
        raise;
      end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Tests 11-20 below verify the fixes in EPIC_3_FIX_REPORT.md (approved
-- EPIC_3_REVIEW.md findings). Each test is labeled with the finding it
-- verifies.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Test 11 — fix for C3: update_child_trip_status must reject a childId that
-- is not an active rider on the trip's bus, even though both belong to the
-- same tenant (Child A2 exists but was never assigned to bus A1).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"driver"}}';

do $$
declare
  v_trip_id uuid;
begin
  select id into v_trip_id from transport.trips where bus_id = '00000000-0000-0000-0000-0000000e3a41' and service_date = current_date;

  begin
    perform public.update_child_trip_status(v_trip_id, '00000000-0000-0000-0000-0000000e3a32', 'picked_up');
    raise exception 'FAIL Test 11: update_child_trip_status accepted a child who is not a rider on this trip''s bus';
  exception
    when others then
      if sqlerrm like '%not assigned to this trip%' then
        raise notice 'PASS Test 11: update_child_trip_status correctly rejects a non-rider child (EPIC_3_REVIEW.md C3)';
      else
        raise;
      end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12 — fix for C3 (DB-level backstop): a direct INSERT into
-- trip_child_status (bypassing update_child_trip_status) for a non-rider
-- child is rejected by transport.check_trip_child_status_consistency.
-- ---------------------------------------------------------------------------
set local role service_role;

do $$
declare
  v_trip_id uuid;
begin
  select id into v_trip_id from transport.trips where bus_id = '00000000-0000-0000-0000-0000000e3a41' and service_date = current_date;

  begin
    insert into transport.trip_child_status (trip_id, child_id, tenant_id, status)
    values (v_trip_id, '00000000-0000-0000-0000-0000000e3a32', '00000000-0000-0000-0000-0000000e3a01', 'picked_up');
    raise exception 'FAIL Test 12: direct INSERT into trip_child_status bypassed the rider-membership trigger backstop';
  exception
    when others then
      if sqlerrm like '%not an active rider%' then
        raise notice 'PASS Test 12: DB-level rider-membership trigger backstop holds for a direct INSERT (EPIC_3_REVIEW.md C3)';
      else
        raise;
      end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 13 — fix for C4: academic.set_child_day_path_status is no longer
-- directly callable by an authenticated driver/reception/teacher/manager —
-- only reachable via update_child_trip_status/confirm_handover.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"driver"}}';

do $$
begin
  perform academic.set_child_day_path_status('00000000-0000-0000-0000-0000000e3a31', 'delivered', 'driver');
  raise exception 'FAIL Test 13: set_child_day_path_status was directly callable by an authenticated driver';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 13: set_child_day_path_status is no longer directly callable (EPIC_3_REVIEW.md C4)';
  when others then
    raise;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 14 — fix for C2: a driver can no longer PATCH transport.buses
-- directly (buses_update_driver was removed entirely) — capacity/plate can
-- no longer be rewritten via direct REST access.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"driver"}}';

do $$
declare v_count int;
begin
  update transport.buses set capacity = 999 where id = '00000000-0000-0000-0000-0000000e3a41';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 14: a driver could directly UPDATE their own bus''s capacity';
  end if;
  raise notice 'PASS Test 14: direct driver UPDATE on buses affects 0 rows — buses_update_driver removed (EPIC_3_REVIEW.md C2)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 15 — fix for C2: reception can no longer directly mark a
-- pickup_scan_events row's handover_confirmed=true unless its own result
-- was 'valid' and it wasn't already confirmed — the exact invariant
-- confirm_handover enforces, now also enforced by RLS for direct access.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"reception"}}';

do $$
declare
  v_invalid_scan  jsonb;
  v_invalid_id    uuid;
  v_count         int;
begin
  v_invalid_scan := public.scan_pickup_pass('this-token-does-not-exist-either');
  v_invalid_id := (v_invalid_scan->>'scanEventId')::uuid;

  update safety.pickup_scan_events set handover_confirmed = true where id = v_invalid_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 15: reception could directly confirm a handover for an invalid_unknown scan via REST';
  end if;
  raise notice 'PASS Test 15: direct REST confirmation of an invalid scan affects 0 rows (EPIC_3_REVIEW.md C2)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 16 — fix for C5: scan_pickup_pass enforces a per-caller rate limit
-- (30 attempts / 60s window) — the 31st attempt within the window is
-- rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"reception"}}';

do $$
declare
  i int;
  v_hit_limit boolean := false;
begin
  for i in 1..35 loop
    begin
      perform public.scan_pickup_pass('rate-limit-probe-token-' || i);
    exception
      when others then
        if sqlerrm like '%Too many scan attempts%' then
          v_hit_limit := true;
          exit;
        else
          raise;
        end if;
    end;
  end loop;

  if not v_hit_limit then
    raise exception 'FAIL Test 16: scan_pickup_pass never rate-limited 35 rapid attempts from the same caller';
  end if;
  raise notice 'PASS Test 16: scan_pickup_pass correctly rate-limits a caller exceeding the window threshold (EPIC_3_REVIEW.md C5)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 17 — fix for H3: scan_pickup_pass's lazy expiry now actually
-- persists — safety.pickup_passes.status for the already-expired test
-- fixture is 'expired' after Test 8's earlier scan (not still 'active').
-- ---------------------------------------------------------------------------
set local role service_role;

do $$
declare v_status safety.pickup_pass_status;
begin
  select status into v_status from safety.pickup_passes where id = '00000000-0000-0000-0000-0000000e3a72';
  if v_status <> 'expired' then
    raise exception 'FAIL Test 17: pickup_passes.status did not persist to ''expired'' after scan_pickup_pass''s lazy transition (got %)', v_status;
  end if;
  raise notice 'PASS Test 17: pickup_passes.status correctly persists ''expired'' — pickup_passes_update_reception policy fix holds (EPIC_3_REVIEW.md H3)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 18 — fix for M4: revoke_pickup_pass is the only legitimate write
-- path to status='revoked'; a second revoke attempt is cleanly rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"guardian"}}';

do $$
declare v_row safety.pickup_passes;
begin
  v_row := public.revoke_pickup_pass('00000000-0000-0000-0000-0000000e3a71');
  if v_row.status <> 'revoked' then
    raise exception 'FAIL Test 18a: revoke_pickup_pass did not set status to revoked';
  end if;

  begin
    perform public.revoke_pickup_pass('00000000-0000-0000-0000-0000000e3a71');
    raise exception 'FAIL Test 18b: revoke_pickup_pass succeeded twice on the same pass';
  exception
    when others then
      if sqlerrm like '%not currently active%' then
        raise notice 'PASS Test 18: revoke_pickup_pass works once and is cleanly rejected on retry (EPIC_3_REVIEW.md M4)';
      else
        raise;
      end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 19 — fix for C1: withdraw_child now cascades into Epic 3's tables —
-- withdrawing Child A1 revokes their active pickup pass(es) and deactivates
-- their bus_riders assignment, in the same transaction.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e3a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e3a01","role":"manager"}}';

do $$
declare
  v_active_rider_count int;
  v_active_pass_count  int;
begin
  perform public.withdraw_child('00000000-0000-0000-0000-0000000e3a31');

  select count(*) into v_active_rider_count from transport.bus_riders where child_id = '00000000-0000-0000-0000-0000000e3a31' and active;
  if v_active_rider_count <> 0 then
    raise exception 'FAIL Test 19a: withdraw_child left an active bus_riders row for the withdrawn child';
  end if;

  select count(*) into v_active_pass_count from safety.pickup_passes where child_id = '00000000-0000-0000-0000-0000000e3a31' and status = 'active';
  if v_active_pass_count <> 0 then
    raise exception 'FAIL Test 19b: withdraw_child left an active pickup pass for the withdrawn child';
  end if;

  raise notice 'PASS Test 19: withdraw_child correctly cascades into bus_riders/pickup_passes (EPIC_3_REVIEW.md C1)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 20 — fix for M6: create_bus_with_driver_row (exercised indirectly —
-- fixture buses were inserted directly as service_role, matching how the
-- add-bus Edge Function would have called it) keeps driver_profiles.bus_id
-- in sync. This test calls the RPC directly to verify the fix.
-- ---------------------------------------------------------------------------
set local role service_role;

do $$
declare
  v_new_driver_id uuid := '00000000-0000-0000-0000-0000000e3c12';
  v_bus           transport.buses;
  v_synced_bus_id uuid;
begin
  insert into auth.users (id, phone, aud, role) values (v_new_driver_id, '+201200000099', 'authenticated', 'authenticated') on conflict (id) do nothing;
  insert into identity.driver_profiles (id, tenant_id, name, phone) values (v_new_driver_id, '00000000-0000-0000-0000-0000000e3a01', 'Driver C', '+201200000099') on conflict (id) do nothing;

  v_bus := public.create_bus_with_driver_row('00000000-0000-0000-0000-0000000e3a01', 'C1', 'CCC-111', 10, null, v_new_driver_id);

  select bus_id into v_synced_bus_id from identity.driver_profiles where id = v_new_driver_id;
  if v_synced_bus_id is distinct from v_bus.id then
    raise exception 'FAIL Test 20: driver_profiles.bus_id was not synced by create_bus_with_driver_row (got %, expected %)', v_synced_bus_id, v_bus.id;
  end if;

  raise notice 'PASS Test 20: create_bus_with_driver_row keeps driver_profiles.bus_id in sync (EPIC_3_REVIEW.md M6)';
end $$;

reset role;

rollback; -- leave no fixture data behind regardless of pass/fail
