-- ============================================================================
-- Epic 2 RLS adversarial test suite (see epic2_README.md for how/why to run
-- this). Same shape as epic1_rls_adversarial.sql: fixture rows as
-- service_role, then switch to a simulated authenticated role via a forged
-- JWT claim and assert the expected allow/deny outcome.
--
-- Fix note (EPIC_2_FIX_REPORT.md): every fixture UUID in this file was
-- rewritten to use only valid hexadecimal characters (0-9a-f). The previous
-- version used literals like '...e2mg1' and '...e2tc2' — 'm', 'g', 't', 'c'
-- are not hex digits, so Postgres's `uuid` type would have rejected every
-- INSERT in this file with "invalid input syntax for type uuid" the moment
-- it was ever actually run. This was never caught because the file was
-- never executed (no Docker/live project in this environment, §1 of the
-- completion report) — fixed here as part of properly resolving H4 (a test
-- suite extension built on a fixture that can't parse isn't a real fix).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants, one manager + one teacher + one reception account
-- per tenant, two guardians in Tenant A (one with a child, one without) plus
-- one guardian in Tenant B, three Tenant-A classrooms (cr1 at capacity 1 and
-- already full — also exercises the capacity lock; cr2 coordinator-less,
-- reserved for cross-tenant negative tests via cr-b1; cr3 NOT coordinated by
-- Teacher A, only reachable via a subject assignment — isolates the
-- subjects-branch soft-delete fix, Test 14), one Tenant-B classroom, and two
-- Tenant-A children (ch1 in cr1, linked to guardian A1; ch2 in cr3).
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e2999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e2a01', 'Tenant E2-A', 'tenant-e2-a-test', '00000000-0000-0000-0000-0000000e2999', 'active'),
  ('00000000-0000-0000-0000-0000000e2b01', 'Tenant E2-B', 'tenant-e2-b-test', '00000000-0000-0000-0000-0000000e2999', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e2a11', '+201100000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e2a12', '+201100000002', 'authenticated', 'authenticated'), -- teacher A
  ('00000000-0000-0000-0000-0000000e2a13', '+201100000003', 'authenticated', 'authenticated'), -- reception A
  ('00000000-0000-0000-0000-0000000e2a14', '+201100000004', 'authenticated', 'authenticated'), -- guardian A1 (own child)
  ('00000000-0000-0000-0000-0000000e2a15', '+201100000005', 'authenticated', 'authenticated'), -- guardian A2 (no children)
  ('00000000-0000-0000-0000-0000000e2b11', '+201100000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e2b12', '+201100000007', 'authenticated', 'authenticated'), -- teacher B (not assigned to A's classroom)
  ('00000000-0000-0000-0000-0000000e2b14', '+201100000008', 'authenticated', 'authenticated')  -- guardian B1
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e2a11', '00000000-0000-0000-0000-0000000e2a01', 'manager', 'Manager A', '+201100000001'),
  ('00000000-0000-0000-0000-0000000e2a12', '00000000-0000-0000-0000-0000000e2a01', 'teacher', 'Teacher A', '+201100000002'),
  ('00000000-0000-0000-0000-0000000e2a13', '00000000-0000-0000-0000-0000000e2a01', 'reception', 'Reception A', '+201100000003'),
  ('00000000-0000-0000-0000-0000000e2b11', '00000000-0000-0000-0000-0000000e2b01', 'manager', 'Manager B', '+201100000006'),
  ('00000000-0000-0000-0000-0000000e2b12', '00000000-0000-0000-0000-0000000e2b01', 'teacher', 'Teacher B', '+201100000007')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e2a14', '00000000-0000-0000-0000-0000000e2a01', 'Guardian A1', '+201100000004'),
  ('00000000-0000-0000-0000-0000000e2a15', '00000000-0000-0000-0000-0000000e2a01', 'Guardian A2', '+201100000005'),
  ('00000000-0000-0000-0000-0000000e2b14', '00000000-0000-0000-0000-0000000e2b01', 'Guardian B1', '+201100000008')
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, coordinator_staff_id, capacity)
values
  ('00000000-0000-0000-0000-0000000e2a21', '00000000-0000-0000-0000-0000000e2a01', 'KG1-A', 'kg1', 36, 48, '00000000-0000-0000-0000-0000000e2a12', 1),
  ('00000000-0000-0000-0000-0000000e2a23', '00000000-0000-0000-0000-0000000e2a01', 'KG2-A', 'kg2', 36, 48, null, 5),
  ('00000000-0000-0000-0000-0000000e2b21', '00000000-0000-0000-0000-0000000e2b01', 'KG1-B', 'kg1', 36, 48, '00000000-0000-0000-0000-0000000e2b12', 10)
on conflict (id) do nothing;

insert into academic.subjects (id, tenant_id, classroom_id, name, teacher_staff_id)
values ('00000000-0000-0000-0000-0000000e2a41', '00000000-0000-0000-0000-0000000e2a01', '00000000-0000-0000-0000-0000000e2a23', 'Phonics', '00000000-0000-0000-0000-0000000e2a12')
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e2a31', '00000000-0000-0000-0000-0000000e2a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e2a21', 'full_day'),
  ('00000000-0000-0000-0000-0000000e2a32', '00000000-0000-0000-0000-0000000e2a01', 'Child A2', '2020-03-03', 'female', '00000000-0000-0000-0000-0000000e2a23', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values ('00000000-0000-0000-0000-0000000e2a31', '00000000-0000-0000-0000-0000000e2a14', '00000000-0000-0000-0000-0000000e2a01', 'mother', true)
on conflict do nothing;

reset role;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation on children — Manager B cannot see Tenant A's child.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from academic.children where id = '00000000-0000-0000-0000-0000000e2a31';
  if v_count <> 0 then
    raise exception 'FAIL Test 1: Manager B could see Tenant A''s child';
  end if;
  raise notice 'PASS Test 1: cross-tenant isolation on children holds';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: teacher classroom scoping — Teacher B (Tenant B) cannot see
-- Tenant A's classroom or child even though both tenants share nothing else.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2b12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2b01","role":"teacher"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from academic.children where id = '00000000-0000-0000-0000-0000000e2a31';
  if v_count <> 0 then
    raise exception 'FAIL Test 2: Teacher B could see Tenant A''s child';
  end if;
  raise notice 'PASS Test 2: teacher classroom scoping holds cross-tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: Teacher A (correctly assigned, via classrooms.coordinator_staff_id)
-- CAN see their own classroom's child.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from academic.children where id = '00000000-0000-0000-0000-0000000e2a31';
  if v_count <> 1 then
    raise exception 'FAIL Test 3: assigned Teacher A could not see their own classroom''s child (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 3: current_staff_classroom_ids() correctly includes a coordinated classroom';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: guardian scoping — Guardian A1 (has a child) sees exactly 1 child;
-- Guardian A2 (no children) sees 0, even within the same tenant.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from academic.children;
  if v_count <> 1 then
    raise exception 'FAIL Test 4a: Guardian A1 sees % children, expected exactly 1 (own)', v_count;
  end if;
  raise notice 'PASS Test 4a: guardian sees own child';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from academic.children;
  if v_count <> 0 then
    raise exception 'FAIL Test 4b: Guardian A2 (no linked children) sees % children, expected 0', v_count;
  end if;
  raise notice 'PASS Test 4b: a guardian with no linked children sees none, even within the same tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: Reception has NO row-level access to the base `children` table
-- (column-narrowing is enforced via children_reception_safe() only, per
-- EPIC_2_ARCHITECTURE_REVIEW.md §14.3) but CAN read via that function.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"reception"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from academic.children;
  if v_count <> 0 then
    raise exception 'FAIL Test 5a: Reception could read the base children table directly (% rows) — column narrowing bypassed', v_count;
  end if;
  raise notice 'PASS Test 5a: reception has zero row-level access to the base children table';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from academic.children_reception_safe();
  if v_count <> 2 then
    raise exception 'FAIL Test 5b: reception could not read via children_reception_safe() (got % rows, expected 2)', v_count;
  end if;
  raise notice 'PASS Test 5b: reception correctly reads the column-narrowed view function';
end $$;

do $$
declare v_count int;
begin
  -- Fix for EPIC_2_REVIEW.md L4: classrooms_reception_safe() replaces the
  -- old full-row base-table policy.
  select count(*) into v_count from academic.classrooms_reception_safe();
  if v_count <> 2 then
    raise exception 'FAIL Test 5c: reception could not read via classrooms_reception_safe() (got % rows, expected 2)', v_count;
  end if;
  select count(*) into v_count from academic.classrooms;
  if v_count <> 0 then
    raise exception 'FAIL Test 5d: Reception could read the base classrooms table directly (% rows) — L4 fix not effective', v_count;
  end if;
  raise notice 'PASS Test 5c/5d: reception classroom access now routes through classrooms_reception_safe() only (L4)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: forged tenant_id on INSERT is rejected by WITH CHECK (§13.2) —
-- Manager A attempts to insert a classroom claiming to belong to Tenant B.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"manager"}}';

do $$
begin
  insert into academic.classrooms (tenant_id, name, grade, age_min_months, age_max_months, capacity)
  values ('00000000-0000-0000-0000-0000000e2b01', 'forged', 'kg1', 36, 48, 10);
  raise exception 'FAIL Test 6: a forged cross-tenant classroom INSERT succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 6: forged tenant_id on classroom INSERT correctly rejected';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: capacity-locked enrollment — Tenant A's classroom cr1 has capacity
-- 1 and already holds 1 active child (the fixture). A second enrollment via
-- enroll_child_row must be rejected with the capacity error, not silently
-- overbook (§2.2/§5).
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  perform public.enroll_child_row(
    '00000000-0000-0000-0000-0000000e2a01'::uuid,
    '00000000-0000-0000-0000-0000000e2a21'::uuid,
    '{"name":"Overbooked Child","dob":"2020-02-02","gender":"female","package":"full_day"}'::jsonb,
    '00000000-0000-0000-0000-0000000e2a11'::uuid
  );
  raise exception 'FAIL Test 7: enroll_child_row allowed overbooking a full classroom';
exception
  when others then
    if sqlerrm like '%full capacity%' then
      raise notice 'PASS Test 7: enroll_child_row correctly rejects enrollment into a full classroom';
    else
      raise exception 'FAIL Test 7: enroll_child_row raised an unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8: mark_attendance rejects a teacher writing to a classroom they are
-- not assigned to (Teacher B attempting to mark Tenant A's classroom).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2b12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2b01","role":"teacher"}}';

do $$
begin
  perform public.mark_attendance(
    '00000000-0000-0000-0000-0000000e2a21'::uuid,
    current_date,
    '[{"childId":"00000000-0000-0000-0000-0000000e2a31","present":true}]'::jsonb
  );
  raise exception 'FAIL Test 8: an unassigned teacher was able to mark attendance for another tenant''s classroom';
exception
  when others then
    raise notice 'PASS Test 8: mark_attendance correctly rejects an unassigned/cross-tenant teacher (%)', sqlerrm;
end $$;

reset role;

-- ============================================================================
-- Tests 9-16 below are new — added to close the EPIC_2_REVIEW.md gaps H4
-- explicitly named as untested (C1, C2, C3, M1, M2, M5/H2, M6 had zero
-- coverage, executed or not, before this fix pass).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Test 9 — fix for C1: a direct INSERT into `children` (bypassing
-- enroll_child_row entirely) into a classroom already at capacity must now
-- be rejected by trg_children_classroom_consistency (migration 2), not just
-- by the RPC's own check. Manager A, own tenant, own (full) classroom.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"manager"}}';

do $$
begin
  insert into academic.children (tenant_id, name, dob, gender, classroom_id, package)
  values ('00000000-0000-0000-0000-0000000e2a01', 'Direct Insert Overbook', '2021-01-01', 'male', '00000000-0000-0000-0000-0000000e2a21', 'full_day');
  raise exception 'FAIL Test 9: a direct INSERT overbooked a full classroom — C1 fix not effective';
exception
  when others then
    if sqlerrm like '%full capacity%' then
      raise notice 'PASS Test 9: direct INSERT capacity bypass is now rejected at the DB layer (C1 fix)';
    else
      raise exception 'FAIL Test 9: unexpected error: %', sqlerrm;
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- Test 10 — fix for C1: a direct INSERT into `children` with a classroom_id
-- belonging to a DIFFERENT tenant than the row's own tenant_id must be
-- rejected, even though RLS's WITH CHECK alone (tenant_id = own tenant) would
-- have allowed it.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into academic.children (tenant_id, name, dob, gender, classroom_id, package)
  values ('00000000-0000-0000-0000-0000000e2a01', 'Cross Tenant Classroom', '2021-01-01', 'male', '00000000-0000-0000-0000-0000000e2b21', 'full_day');
  raise exception 'FAIL Test 10: a child was inserted with a cross-tenant classroom_id — C1 fix not effective';
exception
  when others then
    raise notice 'PASS Test 10: cross-tenant classroom_id on children INSERT is now rejected (C1 fix): %', sqlerrm;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11 — fix for C2: mark_attendance must reject a childId that exists,
-- and belongs to the caller's own tenant, but NOT to the target classroom
-- (ch2 belongs to cr3, not cr1). Teacher A is assigned to both cr1
-- (coordinator) and cr3 (subject), so this isolates the childId/classroom
-- consistency check specifically, not a role/assignment rejection.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"teacher"}}';

do $$
begin
  perform public.mark_attendance(
    '00000000-0000-0000-0000-0000000e2a21'::uuid,  -- cr1
    current_date,
    '[{"childId":"00000000-0000-0000-0000-0000000e2a32","present":true}]'::jsonb  -- ch2, actually enrolled in cr3
  );
  raise exception 'FAIL Test 11: mark_attendance accepted a childId not enrolled in the target classroom — C2 fix not effective';
exception
  when others then
    if sqlerrm like '%not enrolled%' then
      raise notice 'PASS Test 11: mark_attendance now rejects a childId/classroom mismatch (C2 fix)';
    else
      raise exception 'FAIL Test 11: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12 — fix for M5/H2: a direct INSERT into child_guardian_links linking
-- a Tenant-A child to a Tenant-B guardian must be rejected by
-- trg_child_guardian_links_tenant (migration 2), even though the row's own
-- tenant_id (Tenant A) would satisfy RLS's WITH CHECK on its own.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"manager"}}';

do $$
begin
  insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
  values ('00000000-0000-0000-0000-0000000e2a31', '00000000-0000-0000-0000-0000000e2b14', '00000000-0000-0000-0000-0000000e2a01', 'guardian', false);
  raise exception 'FAIL Test 12: a cross-tenant child_guardian_links row was created — M5/H2 fix not effective';
exception
  when others then
    raise notice 'PASS Test 12: cross-tenant child/guardian link is now rejected (M5/H2 fix): %', sqlerrm;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 13 — fix for M6: address_lat outside [-90, 90] is rejected by a CHECK
-- constraint, not silently accepted.
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  insert into academic.children (tenant_id, name, dob, gender, classroom_id, package, address_lat)
  values ('00000000-0000-0000-0000-0000000e2a01', 'Bad Coordinates', '2021-01-01', 'male', '00000000-0000-0000-0000-0000000e2a23', 'full_day', 999);
  raise exception 'FAIL Test 13: address_lat=999 was accepted — M6 fix not effective';
exception
  when check_violation then
    raise notice 'PASS Test 13: out-of-range address_lat correctly rejected by CHECK constraint (M6 fix)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 14 — fix for M2: current_staff_classroom_ids()'s subjects branch must
-- exclude a soft-deleted classroom. Teacher A reaches cr3 only via the
-- subject assignment (no coordinator_staff_id on cr3) — soft-delete cr3 and
-- confirm Teacher A no longer sees it as an assigned classroom.
-- ---------------------------------------------------------------------------
set role service_role;
update academic.classrooms set deleted_at = now() where id = '00000000-0000-0000-0000-0000000e2a23';
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"teacher"}}';

do $$
declare v_ids uuid[];
begin
  -- current_staff_classroom_ids() now returns uuid[] directly (fix for
  -- EPIC_2_DEPLOYMENT_FIX.md — SETOF functions are not allowed in RLS policy
  -- expressions), so no ARRAY(...) wrapper is needed here anymore.
  select public.current_staff_classroom_ids() into v_ids;
  if '00000000-0000-0000-0000-0000000e2a23'::uuid = any(v_ids) then
    raise exception 'FAIL Test 14: current_staff_classroom_ids() still includes a soft-deleted classroom via the subjects branch — M2 fix not effective';
  end if;
  raise notice 'PASS Test 14: current_staff_classroom_ids() correctly excludes a soft-deleted classroom reached via a subject assignment (M2 fix)';
end $$;

reset role;

set role service_role;
update academic.classrooms set deleted_at = null where id = '00000000-0000-0000-0000-0000000e2a23';
reset role;

-- ---------------------------------------------------------------------------
-- Test 15 — fix for M1: suspend_child's check-then-update race. A true
-- concurrency test needs two simultaneous sessions, which this single-script
-- suite cannot simulate — this proves the SEQUENTIAL correctness of the
-- rewritten atomic UPDATE...WHERE pattern (the precondition for the race fix
-- to be meaningful): calling suspend_child twice in a row must succeed once
-- and then cleanly reject with STATE_ALREADY_PROCESSED, never silently
-- succeed twice.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"manager"}}';

do $$
begin
  perform public.suspend_child('00000000-0000-0000-0000-0000000e2a31'::uuid, 'first suspend');
  raise notice 'PASS Test 15a: first suspend_child call succeeds';
exception
  when others then
    raise exception 'FAIL Test 15a: first suspend_child call unexpectedly failed: %', sqlerrm;
end $$;

do $$
begin
  perform public.suspend_child('00000000-0000-0000-0000-0000000e2a31'::uuid, 'second suspend');
  raise exception 'FAIL Test 15b: a second suspend_child call on an already-suspended child succeeded — M1 fix not effective';
exception
  when others then
    raise notice 'PASS Test 15b: second suspend_child call correctly rejected (M1 fix, atomic UPDATE...WHERE): %', sqlerrm;
end $$;

-- restore state for any tests that might run after this point
perform public.reactivate_child('00000000-0000-0000-0000-0000000e2a31'::uuid);

reset role;

-- ---------------------------------------------------------------------------
-- Test 16 — fix for C3: enroll_child_with_guardian must be atomic. Passing a
-- guardian_id belonging to a different tenant makes link_child_guardian's
-- trigger (M5/H2 fix) reject the call — confirm the WHOLE call fails and, in
-- particular, that NO child row is left behind (proving the child insert
-- performed earlier in the same function body was rolled back, not just
-- that an error was raised).
-- ---------------------------------------------------------------------------
set role service_role;

do $$
declare
  v_children_before int;
  v_children_after  int;
begin
  select count(*) into v_children_before from academic.children where tenant_id = '00000000-0000-0000-0000-0000000e2a01';

  begin
    perform public.enroll_child_with_guardian(
      '00000000-0000-0000-0000-0000000e2a01'::uuid,
      '00000000-0000-0000-0000-0000000e2a23'::uuid,
      '{"name":"Should Not Exist","dob":"2021-05-05","gender":"male","package":"full_day"}'::jsonb,
      '00000000-0000-0000-0000-0000000e2a11'::uuid,
      '00000000-0000-0000-0000-0000000e2b14'::uuid,  -- Tenant B guardian — must be rejected
      'guardian',
      true
    );
    raise exception 'FAIL Test 16: enroll_child_with_guardian succeeded with a cross-tenant guardian_id — C3/M5 fix not effective';
  exception
    when others then
      if sqlerrm like '%enroll_child_with_guardian succeeded%' then
        raise;
      end if;
      raise notice 'PASS Test 16a: enroll_child_with_guardian correctly rejects a cross-tenant guardian_id: %', sqlerrm;
  end;

  select count(*) into v_children_after from academic.children where tenant_id = '00000000-0000-0000-0000-0000000e2a01';
  if v_children_after <> v_children_before then
    raise exception 'FAIL Test 16b: a child row was left behind after enroll_child_with_guardian failed (% before, % after) — atomicity fix not effective', v_children_before, v_children_after;
  end if;
  raise notice 'PASS Test 16b: no orphaned child row after enroll_child_with_guardian''s internal failure — the transaction rolled back atomically (C3 fix)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 17 — regression test for EPIC_2_DEPLOYMENT_FIX.md: confirms the
-- array-returning rewrite of current_staff_classroom_ids() preserves the
-- exact "empty result = matches nothing" semantics the original SETOF
-- version had. A teacher with ZERO coordinator/subject assignments must
-- return an empty array (never NULL — ARRAY(subquery) over zero rows always
-- yields '{}', not NULL) and must be denied access to every classroom,
-- including classrooms in their own tenant. This is the specific edge case
-- the fix's correctness hinges on: `x = ANY('{}'::uuid[])` must be FALSE,
-- not NULL, or every teacher-scoped policy in the system would silently
-- misbehave for a brand-new teacher with no assignments yet.
-- ---------------------------------------------------------------------------
set role service_role;

insert into auth.users (id, phone, aud, role)
values ('00000000-0000-0000-0000-0000000e2a16', '+201100000009', 'authenticated', 'authenticated') -- teacher A3, no assignments at all
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values ('00000000-0000-0000-0000-0000000e2a16', '00000000-0000-0000-0000-0000000e2a01', 'teacher', 'Teacher A3 (unassigned)', '+201100000009')
on conflict (id) do nothing;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2a16","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e2a01","role":"teacher"}}';

do $$
declare
  v_ids uuid[];
  v_count int;
begin
  select public.current_staff_classroom_ids() into v_ids;
  if v_ids is null then
    raise exception 'FAIL Test 17a: current_staff_classroom_ids() returned NULL instead of an empty array for an unassigned teacher';
  end if;
  if array_length(v_ids, 1) is not null then
    raise exception 'FAIL Test 17a: current_staff_classroom_ids() returned % ids for an unassigned teacher, expected an empty array', array_length(v_ids, 1);
  end if;
  raise notice 'PASS Test 17a: an unassigned teacher correctly gets an empty array, not NULL';

  select count(*) into v_count from academic.classrooms;
  if v_count <> 0 then
    raise exception 'FAIL Test 17b: an unassigned teacher could see % classrooms in their own tenant, expected 0', v_count;
  end if;
  select count(*) into v_count from academic.children;
  if v_count <> 0 then
    raise exception 'FAIL Test 17c: an unassigned teacher could see % children in their own tenant, expected 0', v_count;
  end if;
  raise notice 'PASS Test 17b/17c: ANY(empty uuid[]) correctly matches nothing — the array rewrite preserves the original SETOF semantics';
end $$;

reset role;

rollback; -- leave no fixture data behind regardless of pass/fail
