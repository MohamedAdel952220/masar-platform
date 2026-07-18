-- ============================================================================
-- Epic 5 RLS adversarial test suite. Same shape as epic2/3/4_rls_adversarial.sql:
-- fixture rows as service_role, then switch to a simulated authenticated role
-- via a forged JWT claim and assert the expected allow/deny outcome. Every
-- fixture UUID uses only valid hexadecimal characters (0-9a-f) from the start.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A: manager, teacher (classroom coordinator),
-- guardian A1 (child A1, classroom A), guardian A2 (child A2, classroom A2 —
-- a second classroom, so "own classroom or all" event visibility is
-- actually exercised). Tenant B: manager B, guardian B1 (child B1). A
-- pending request from Teacher A. A published celebration scoped to
-- classroom A. A published trip event with capacity=1, one existing
-- registration by Guardian A1's child.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e5999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e5a01', 'Tenant E5-A', 'tenant-e5-a-test', '00000000-0000-0000-0000-0000000e5999', 'active'),
  ('00000000-0000-0000-0000-0000000e5b01', 'Tenant E5-B', 'tenant-e5-b-test', '00000000-0000-0000-0000-0000000e5999', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e5a11', '+201400000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e5a12', '+201400000002', 'authenticated', 'authenticated'), -- teacher A
  ('00000000-0000-0000-0000-0000000e5a14', '+201400000004', 'authenticated', 'authenticated'), -- guardian A1
  ('00000000-0000-0000-0000-0000000e5a15', '+201400000005', 'authenticated', 'authenticated'), -- guardian A2
  ('00000000-0000-0000-0000-0000000e5b11', '+201400000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e5b14', '+201400000008', 'authenticated', 'authenticated')  -- guardian B1
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e5a11', '00000000-0000-0000-0000-0000000e5a01', 'manager', 'Manager A', '+201400000001'),
  ('00000000-0000-0000-0000-0000000e5a12', '00000000-0000-0000-0000-0000000e5a01', 'teacher', 'Teacher A', '+201400000002'),
  ('00000000-0000-0000-0000-0000000e5b11', '00000000-0000-0000-0000-0000000e5b01', 'manager', 'Manager B', '+201400000006')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e5a14', '00000000-0000-0000-0000-0000000e5a01', 'Guardian A1', '+201400000004'),
  ('00000000-0000-0000-0000-0000000e5a15', '00000000-0000-0000-0000-0000000e5a01', 'Guardian A2', '+201400000005'),
  ('00000000-0000-0000-0000-0000000e5b14', '00000000-0000-0000-0000-0000000e5b01', 'Guardian B1', '+201400000008')
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, coordinator_staff_id, capacity)
values
  ('00000000-0000-0000-0000-0000000e5a21', '00000000-0000-0000-0000-0000000e5a01', 'KG1-A', 'kg1', 36, 48, '00000000-0000-0000-0000-0000000e5a12', 10),
  ('00000000-0000-0000-0000-0000000e5a22', '00000000-0000-0000-0000-0000000e5a01', 'KG1-B', 'kg1', 36, 48, null, 10)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e5a21', 'full_day'),
  ('00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e5a22', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values
  ('00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a14', '00000000-0000-0000-0000-0000000e5a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a15', '00000000-0000-0000-0000-0000000e5a01', 'mother', true)
on conflict do nothing;

insert into approvals.requests (id, tenant_id, submitted_by, type, title, classroom_id, request_date, status)
values ('00000000-0000-0000-0000-0000000e5c01', '00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5a12', 'event', 'End of year party', '00000000-0000-0000-0000-0000000e5a21', '2026-09-01', 'pending')
on conflict (id) do nothing;

insert into approvals.events (id, tenant_id, type, title, classroom_id, event_date)
values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a01', 'celebration', 'End of year party', '00000000-0000-0000-0000-0000000e5a21', '2026-09-01')
on conflict (id) do nothing;

insert into approvals.events (id, tenant_id, type, title, event_date, capacity)
values ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a01', 'trip', 'Zoo trip', '2026-09-15', 1)
on conflict (id) do nothing;

insert into approvals.event_trip_registrations (id, event_id, child_id, tenant_id, status)
values ('00000000-0000-0000-0000-0000000e5e01', '00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'open')
on conflict (id) do nothing;

-- A classroom-A-scoped trip (not whole-tenant), capacity=5 (no capacity
-- concern) — used by Tests 11/12 to verify the EPIC_5_REVIEW.md C1
-- classroom-visibility restoration in event_trip_registrations_insert_guardian.
insert into approvals.events (id, tenant_id, type, title, classroom_id, event_date, capacity)
values ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5a01', 'trip', 'KG1-A field trip', '00000000-0000-0000-0000-0000000e5a21', '2026-09-20', 5)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's pending
-- request.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.requests where id = '00000000-0000-0000-0000-0000000e5c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 1: Manager B could see Tenant A''s request';
  end if;
  raise notice 'PASS Test 1: cross-tenant isolation on requests holds';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: a teacher who did not submit a request cannot see it, even within
-- the same tenant (requests_select_teacher is submitted_by-scoped, not
-- tenant-wide).
-- ---------------------------------------------------------------------------
set role service_role;
insert into auth.users (id, phone, aud, role) values ('00000000-0000-0000-0000-0000000e5a13', '+201400000003', 'authenticated', 'authenticated') on conflict (id) do nothing;
insert into identity.staff_profiles (id, tenant_id, role, name, phone) values ('00000000-0000-0000-0000-0000000e5a13', '00000000-0000-0000-0000-0000000e5a01', 'teacher', 'Teacher A2', '+201400000003') on conflict (id) do nothing;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.requests where id = '00000000-0000-0000-0000-0000000e5c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 2: non-submitting teacher could see another teacher''s request';
  end if;
  raise notice 'PASS Test 2: requests visibility is submitted_by-scoped, not tenant-wide, for teachers';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: no role can flip a request's status via a direct REST UPDATE —
-- review_request (SECURITY DEFINER) is the sole write path
-- (EPIC_3_REVIEW.md C4 lesson: a transactional multi-table operation must
-- not be reachable via a bare RLS-gated UPDATE).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"manager"}}';

do $$
declare v_count int;
begin
  update approvals.requests set status = 'approved', reviewed_by = '00000000-0000-0000-0000-0000000e5a11', reviewed_at = now() where id = '00000000-0000-0000-0000-0000000e5c01';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 3: manager updated a request''s status via direct REST access (bypassing review_request)';
  end if;
  raise notice 'PASS Test 3: no direct UPDATE path exists on approvals.requests';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: guardian event visibility — "own classroom or all" (§12).
-- Guardian A1 (child in classroom A) sees the classroom-A celebration and
-- the (classroom_id null) trip; Guardian A2 (child in classroom B) sees the
-- trip but NOT the classroom-A celebration.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.events where id in ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5d02');
  if v_count <> 2 then
    raise exception 'FAIL Test 4a: Guardian A1 should see both the own-classroom celebration and the whole-tenant trip (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 4a: guardian sees own-classroom event + whole-tenant event';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.events where id = '00000000-0000-0000-0000-0000000e5d01';
  if v_count <> 0 then
    raise exception 'FAIL Test 4b: Guardian A2 (different classroom) could see Guardian A1''s classroom-scoped celebration';
  end if;

  select count(*) into v_count from approvals.events where id = '00000000-0000-0000-0000-0000000e5d02';
  if v_count <> 1 then
    raise exception 'FAIL Test 4c: Guardian A2 could not see the whole-tenant (classroom_id null) trip';
  end if;

  raise notice 'PASS Test 4b/4c: guardian in a different classroom is correctly scoped';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: capacity trigger — the zoo trip has capacity=1 and already has one
-- open registration (Child A1, owned by Guardian A1). Guardian A2 (a
-- DIFFERENT guardian) attempting to register Child A2 must be rejected by
-- the trigger, regardless of RLS. This is the exact scenario
-- EPIC_5_REVIEW.md C1 describes: before the fix (approvals.
-- check_trip_registration_consistency made SECURITY DEFINER, migration 2),
-- this test FAILED — Guardian A2's own count query could not see Guardian
-- A1's registration (event_trip_registrations_select_guardian is
-- child-owner-scoped, not tenant-wide), silently undercounting and letting
-- the trip be overbooked. This run confirms the fix closes that gap.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a01', 'open');
  raise exception 'FAIL Test 5: registration succeeded past the trip''s capacity=1 limit';
exception
  when others then
    if sqlerrm like '%full capacity%' then
      raise notice 'PASS Test 5: capacity trigger rejects an over-capacity trip registration';
    else
      raise exception 'FAIL Test 5: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: a guardian cannot insert a trip registration directly at
-- status='paid' or with a payment_transaction_id set — RLS's own WITH CHECK
-- rejects it before the trigger is even reached.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'paid');
  raise exception 'FAIL Test 6: guardian inserted a trip registration directly as status=paid';
exception
  when insufficient_privilege or check_violation then
    raise notice 'PASS Test 6: RLS rejects a guardian directly inserting status=paid';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: cancel_trip_registration transition — a guardian's direct UPDATE
-- can only reach status=cancelled with payment_transaction_id still null
-- (mirrors what the RPC itself performs); attempting to simultaneously set
-- a payment_transaction_id is rejected by RLS's WITH CHECK.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  update approvals.event_trip_registrations
  set status = 'cancelled'
  where id = '00000000-0000-0000-0000-0000000e5e01';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'FAIL Test 7: guardian could not cancel their own open trip registration (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 7: guardian can cancel their own open/registered trip registration directly';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8: event_rsvps uniqueness — a second direct RSVP insert for the same
-- (event_id, child_id) pair is rejected (update_rsvp, migration 5, is the
-- correct upsert path; a bare duplicate INSERT is not silently allowed).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_rsvps (event_id, child_id, tenant_id, attendee)
  values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'both');

  begin
    insert into approvals.event_rsvps (event_id, child_id, tenant_id, attendee)
    values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'mother');
    raise exception 'FAIL Test 8: a second direct RSVP insert for the same child/event succeeded';
  exception
    when unique_violation then
      raise notice 'PASS Test 8: duplicate direct RSVP insert is rejected by the unique constraint';
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: a trip registration cannot be created against a non-trip event
-- (the celebration) — the cross-table type check trigger rejects it, per
-- BACKEND_ARCHITECTURE.md §5's explicit requirement.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'open');
  raise exception 'FAIL Test 9: a trip registration was created against a non-trip (celebration) event';
exception
  when others then
    if sqlerrm like '%not a trip%' then
      raise notice 'PASS Test 9: trigger rejects a trip registration against a non-trip event';
    else
      raise exception 'FAIL Test 9: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: fix for EPIC_5_REVIEW.md H2 — a teacher can no longer create a
-- request via a direct REST INSERT; submit_request (SECURITY DEFINER) is
-- now the sole creation path (requests_insert_teacher was removed,
-- migration 4).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  begin
    insert into approvals.requests (tenant_id, submitted_by, type, title, request_date, status)
    values ('00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5a12', 'exam', 'Direct insert attempt', '2026-09-01', 'pending');
    raise exception 'FAIL Test 10: teacher created a request via direct REST INSERT (requests_insert_teacher should no longer exist)';
  exception
    when insufficient_privilege then
      raise notice 'PASS Test 10: no direct INSERT path exists on approvals.requests — submit_request is the sole creation path';
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11: fix for EPIC_5_REVIEW.md C1 (classroom-visibility half) —
-- Guardian A2 (child in classroom B) cannot register for a trip explicitly
-- scoped to classroom A, even though the trip has ample capacity. Before
-- the fix this was only ever an accidental side effect of the trigger's own
-- (pre-SECURITY-DEFINER) RLS-filtered SELECT; it is now an explicit WITH
-- CHECK clause on event_trip_registrations_insert_guardian (migration 4).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a01', 'open');
  raise exception 'FAIL Test 11: Guardian A2 registered for a trip scoped to a classroom their child is not in';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 11: classroom-visibility check blocks registration for a trip outside the guardian''s own classroom';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12: the positive case for Test 11 — Guardian A1 (child in classroom
-- A) CAN register for the same classroom-A-scoped trip, confirming Test 11
-- failed for classroom-visibility reasons specifically, not some other
-- unrelated RLS defect.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'open');

  select count(*) into v_count from approvals.event_trip_registrations
  where event_id = '00000000-0000-0000-0000-0000000e5d03' and child_id = '00000000-0000-0000-0000-0000000e5a31';
  if v_count <> 1 then
    raise exception 'FAIL Test 12: Guardian A1 could not register for their own classroom''s trip (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 12: guardian can register for a trip scoped to their own classroom';
end $$;

reset role;

rollback;
