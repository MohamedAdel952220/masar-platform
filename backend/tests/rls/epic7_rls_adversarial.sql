-- ============================================================================
-- Epic 7 RLS adversarial test suite. Same shape as epic2-6_rls_adversarial.sql:
-- fixture rows as service_role, then switch to a simulated authenticated role
-- via a forged JWT claim and assert the expected allow/deny outcome. Every
-- fixture UUID uses only valid hexadecimal characters (0-9a-f) from the
-- start. Written per this task's requirement; execution status/instructions
-- are documented in EPIC_7_FIX_REPORT.md (mirrors the precedent set for
-- tests/rls/epic5_rls_adversarial.sql and epic6_rls_adversarial.sql).
--
-- Updated by the EPIC_7_REVIEW.md fix pass: fixtures now reflect the C1 fix
-- (media.camera_connections split out of media.cameras) and the H2 fix
-- (media.camera_service_account_links); new tests cover both new tables,
-- the create_camera RPC, the L5 unique-IP constraint, and the M4
-- soft-deleted-classroom recurrence fix.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A: manager, teacher (in classroom A1),
-- guardian A1 (child A1, classroom A1), guardian A2 (child A2, classroom
-- A2). Tenant B: manager B. Tenant A gets two cameras: Camera A1 (linked to
-- classroom A1 only) and Camera A2 (linked to classroom A2 only), each with
-- its own media.camera_connections row. An active camera_agent service
-- account exists for Tenant A with scope camera:heartbeat, bound (fix for
-- EPIC_7_REVIEW.md H2) to Camera A1 only via media.camera_service_
-- account_links — Camera A2 is deliberately left unbound to exercise the
-- "zero bindings" / "wrong camera" cases at the table-structure level.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e7999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e7a01', 'Tenant E7-A', 'tenant-e7-a-test', '00000000-0000-0000-0000-0000000e7999', 'active'),
  ('00000000-0000-0000-0000-0000000e7b01', 'Tenant E7-B', 'tenant-e7-b-test', '00000000-0000-0000-0000-0000000e7999', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e7a11', '+201600000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e7a12', '+201600000002', 'authenticated', 'authenticated'), -- teacher A (classroom A1)
  ('00000000-0000-0000-0000-0000000e7a14', '+201600000004', 'authenticated', 'authenticated'), -- guardian A1
  ('00000000-0000-0000-0000-0000000e7a15', '+201600000005', 'authenticated', 'authenticated'), -- guardian A2
  ('00000000-0000-0000-0000-0000000e7a16', '+201600000007', 'authenticated', 'authenticated'), -- guardian A3 (M4 fixture)
  ('00000000-0000-0000-0000-0000000e7b11', '+201600000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e7c01', '+201600000009', 'authenticated', 'authenticated')  -- platform admin (support tier)
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e7a11', '00000000-0000-0000-0000-0000000e7a01', 'manager', 'Manager A', '+201600000001'),
  ('00000000-0000-0000-0000-0000000e7a12', '00000000-0000-0000-0000-0000000e7a01', 'teacher', 'Teacher A', '+201600000002'),
  ('00000000-0000-0000-0000-0000000e7b11', '00000000-0000-0000-0000-0000000e7b01', 'manager', 'Manager B', '+201600000006')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e7a14', '00000000-0000-0000-0000-0000000e7a01', 'Guardian A1', '+201600000004'),
  ('00000000-0000-0000-0000-0000000e7a15', '00000000-0000-0000-0000-0000000e7a01', 'Guardian A2', '+201600000005'),
  ('00000000-0000-0000-0000-0000000e7a16', '00000000-0000-0000-0000-0000000e7a01', 'Guardian A3', '+201600000007')
on conflict (id) do nothing;

insert into identity.platform_admins (id, name, email, role)
values ('00000000-0000-0000-0000-0000000e7c01', 'Support Admin', 'support-e7-test@masar.app', 'support')
on conflict (id) do nothing;

-- Teacher A coordinates classroom A1 (coordinator_staff_id) — a genuine
-- current_staff_classroom_ids() membership, not just a same-tenant
-- coincidence, so Test 3's denial is a meaningful negative, not a vacuous
-- one. Classroom A3 (M4 fixture) starts out live and gets soft-deleted
-- mid-suite.
insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, capacity, coordinator_staff_id)
values
  ('00000000-0000-0000-0000-0000000e7d01', '00000000-0000-0000-0000-0000000e7a01', 'KG1-A', 'kg1', 36, 48, 10, '00000000-0000-0000-0000-0000000e7a12'),
  ('00000000-0000-0000-0000-0000000e7d02', '00000000-0000-0000-0000-0000000e7a01', 'KG1-B', 'kg1', 36, 48, 10, null),
  ('00000000-0000-0000-0000-0000000e7d03', '00000000-0000-0000-0000-0000000e7a01', 'KG1-C', 'kg1', 36, 48, 10, null)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e7e31', '00000000-0000-0000-0000-0000000e7a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e7d01', 'full_day'),
  ('00000000-0000-0000-0000-0000000e7e32', '00000000-0000-0000-0000-0000000e7a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e7d02', 'full_day'),
  ('00000000-0000-0000-0000-0000000e7e33', '00000000-0000-0000-0000-0000000e7a01', 'Child A3', '2020-03-03', 'male', '00000000-0000-0000-0000-0000000e7d03', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values
  ('00000000-0000-0000-0000-0000000e7e31', '00000000-0000-0000-0000-0000000e7a14', '00000000-0000-0000-0000-0000000e7a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e7e32', '00000000-0000-0000-0000-0000000e7a15', '00000000-0000-0000-0000-0000000e7a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e7e33', '00000000-0000-0000-0000-0000000e7a16', '00000000-0000-0000-0000-0000000e7a01', 'mother', true)
on conflict do nothing;

-- Fix for EPIC_7_REVIEW.md C1: media.cameras no longer carries ip_address/
-- stream_protocol at all — those live on media.camera_connections below.
insert into media.cameras (id, tenant_id, name, zone, resolution, has_audio, online, admin_disabled)
values
  ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7a01', 'Camera A1', 'classroom', '1080p', true, false, false),
  ('00000000-0000-0000-0000-0000000e7f02', '00000000-0000-0000-0000-0000000e7a01', 'Camera A2', 'classroom', '1080p', true, true, false),
  ('00000000-0000-0000-0000-0000000e7f03', '00000000-0000-0000-0000-0000000e7a01', 'Camera A3', 'classroom', '1080p', true, false, false)
on conflict (id) do nothing;

insert into media.camera_connections (camera_id, tenant_id, ip_address, stream_protocol)
values
  ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7a01', '10.0.0.11', 'rtsp'),
  ('00000000-0000-0000-0000-0000000e7f02', '00000000-0000-0000-0000-0000000e7a01', '10.0.0.12', 'rtsp'),
  ('00000000-0000-0000-0000-0000000e7f03', '00000000-0000-0000-0000-0000000e7a01', '10.0.0.13', 'rtsp')
on conflict (camera_id) do nothing;

insert into media.camera_classroom_links (camera_id, classroom_id, tenant_id)
values
  ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7d01', '00000000-0000-0000-0000-0000000e7a01'),
  ('00000000-0000-0000-0000-0000000e7f02', '00000000-0000-0000-0000-0000000e7d02', '00000000-0000-0000-0000-0000000e7a01'),
  ('00000000-0000-0000-0000-0000000e7f03', '00000000-0000-0000-0000-0000000e7d03', '00000000-0000-0000-0000-0000000e7a01')
on conflict do nothing;

-- Active camera_agent service account for Tenant A, scoped to
-- camera:heartbeat — api_key_hash is a fixture placeholder value (this
-- suite never exercises the Edge-Function-level key-hash comparison, which
-- lives in TypeScript/Deno and is covered by
-- tests/unit/cameraHeartbeatService.test.ts instead).
insert into identity.service_accounts (id, tenant_id, name, purpose, api_key_hash, scopes, status, issued_by)
values ('00000000-0000-0000-0000-0000000e7011', '00000000-0000-0000-0000-0000000e7a01', 'Camera Agent A', 'camera_agent', 'fixture-hash-not-a-real-key', array['camera:heartbeat'], 'active', '00000000-0000-0000-0000-0000000e7a11')
on conflict (id) do nothing;

-- Fix for EPIC_7_REVIEW.md H2: bound to Camera A1 only — Camera A2/A3 are
-- deliberately left unbound.
insert into media.camera_service_account_links (camera_id, service_account_id, tenant_id)
values ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7011', '00000000-0000-0000-0000-0000000e7a01')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's cameras,
-- camera_connections, camera_classroom_links, camera_service_account_links,
-- or service_accounts.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from media.cameras where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_count <> 0 then raise exception 'FAIL Test 1a: Manager B could see Tenant A''s cameras'; end if;

  select count(*) into v_count from media.camera_connections where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_count <> 0 then raise exception 'FAIL Test 1b: Manager B could see Tenant A''s camera_connections'; end if;

  select count(*) into v_count from media.camera_classroom_links where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_count <> 0 then raise exception 'FAIL Test 1c: Manager B could see Tenant A''s camera_classroom_links'; end if;

  select count(*) into v_count from media.camera_service_account_links where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_count <> 0 then raise exception 'FAIL Test 1d: Manager B could see Tenant A''s camera_service_account_links'; end if;

  select count(*) into v_count from identity.service_accounts where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_count <> 0 then raise exception 'FAIL Test 1e: Manager B could see Tenant A''s service_accounts'; end if;

  raise notice 'PASS Test 1: cross-tenant isolation holds on cameras/camera_connections/camera_classroom_links/camera_service_account_links/service_accounts';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2 (the core §17 access-rule test): Guardian A1 sees exactly Camera A1
-- (their own child's classroom) and NOT Camera A2 (Guardian A2's child's
-- classroom) — the direct regression test for §17's "a parent can never
-- list or view a camera outside their child's linked classroom(s)". Also
-- confirms Guardian A1 has zero access to media.camera_connections
-- entirely (fix for EPIC_7_REVIEW.md C1 — this table has no guardian
-- policy at all, regardless of which camera the connection belongs to).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"guardian"}}';

do $$
declare v_a1_count int;
declare v_a2_count int;
declare v_connection_count int;
begin
  select count(*) into v_a1_count from media.cameras where id = '00000000-0000-0000-0000-0000000e7f01';
  select count(*) into v_a2_count from media.cameras where id = '00000000-0000-0000-0000-0000000e7f02';

  if v_a1_count <> 1 then raise exception 'FAIL Test 2a: Guardian A1 could not see their own child''s classroom camera (Camera A1)'; end if;
  if v_a2_count <> 0 then raise exception 'FAIL Test 2b: Guardian A1 could see a camera outside their child''s classroom (Camera A2)'; end if;

  select count(*) into v_connection_count from media.camera_connections where camera_id = '00000000-0000-0000-0000-0000000e7f01';
  if v_connection_count <> 0 then raise exception 'FAIL Test 2c (C1 regression): Guardian A1 could see media.camera_connections for their own visible camera — this table must never be guardian-readable'; end if;

  raise notice 'PASS Test 2: guardian classroom-scoped camera visibility holds both positively and negatively, and camera_connections stays fully guardian-inaccessible';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: Teacher A (§12: Cameras row has NO Teacher access at all, unlike
-- almost every other academic resource) gets zero rows, even though Teacher
-- A is assigned to classroom A1 — the same classroom Camera A1 is linked
-- to. This is the one deliberately non-obvious deny in this Epic's matrix.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from media.cameras where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_count <> 0 then raise exception 'FAIL Test 3: Teacher A could see cameras — §12''s Cameras row grants Teacher no access at all'; end if;
  raise notice 'PASS Test 3: teacher has zero camera visibility, matching §12''s permission matrix exactly';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: Platform Admin (support tier) gets zero rows on cameras/
-- camera_connections/camera_classroom_links/camera_service_account_links —
-- §13.6's bypass list does NOT include any of them (unlike service_accounts,
-- which DOES have a platform_admin SELECT policy from Epic 1 — re-verified
-- here as a non-regression check).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7c01","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_camera_count int;
declare v_connection_count int;
declare v_link_count int;
declare v_sa_link_count int;
declare v_service_account_count int;
begin
  select count(*) into v_camera_count from media.cameras where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_camera_count <> 0 then raise exception 'FAIL Test 4a: platform_admin saw a media.cameras row (no bypass policy should exist)'; end if;

  select count(*) into v_connection_count from media.camera_connections where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_connection_count <> 0 then raise exception 'FAIL Test 4b (C1 regression): platform_admin saw a media.camera_connections row (no bypass policy should exist)'; end if;

  select count(*) into v_link_count from media.camera_classroom_links where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_link_count <> 0 then raise exception 'FAIL Test 4c: platform_admin saw a media.camera_classroom_links row (no bypass policy should exist)'; end if;

  select count(*) into v_sa_link_count from media.camera_service_account_links where tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  if v_sa_link_count <> 0 then raise exception 'FAIL Test 4d (H2 regression): platform_admin saw a media.camera_service_account_links row (no bypass policy should exist)'; end if;

  select count(*) into v_service_account_count from identity.service_accounts where id = '00000000-0000-0000-0000-0000000e7011';
  if v_service_account_count <> 1 then raise exception 'FAIL Test 4e: platform_admin could not see the Epic 1 service_accounts row (regression in the pre-existing, frozen policy)'; end if;

  raise notice 'PASS Test 4: platform_admin has zero bypass on any Epic 7-owned table, and the pre-existing service_accounts read-only bypass (Epic 1) is unaffected';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: a guardian cannot directly INSERT into media.cameras,
-- media.camera_connections, or media.camera_classroom_links — no guardian
-- write policy exists on any of them (§12: Guardian is R-only on Cameras).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"guardian"}}';

do $$
begin
  insert into media.cameras (tenant_id, name, zone, resolution)
  values ('00000000-0000-0000-0000-0000000e7a01', 'Forged Camera', 'common', '720p');
  raise exception 'FAIL Test 5a: guardian inserted a camera directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 5a: no direct INSERT path exists on media.cameras for guardian';
end $$;

do $$
begin
  insert into media.camera_connections (camera_id, tenant_id, ip_address, stream_protocol)
  values ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7a01', '10.0.0.200', 'rtsp');
  raise exception 'FAIL Test 5b (C1 regression): guardian inserted/updated a camera_connections row directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 5b: no direct INSERT path exists on media.camera_connections for guardian';
end $$;

do $$
begin
  insert into media.camera_classroom_links (camera_id, classroom_id, tenant_id)
  values ('00000000-0000-0000-0000-0000000e7f02', '00000000-0000-0000-0000-0000000e7d01', '00000000-0000-0000-0000-0000000e7a01');
  raise exception 'FAIL Test 5c: guardian linked a camera to a classroom directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 5c: no direct INSERT path exists on media.camera_classroom_links for guardian';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: Manager A can toggle admin_disabled directly (§12's own explicit
-- "CRUD incl. admin_disabled toggle" callout) and it persists.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"manager"}}';

do $$
declare v_admin_disabled boolean;
begin
  update media.cameras set admin_disabled = true where id = '00000000-0000-0000-0000-0000000e7f01';
  select admin_disabled into v_admin_disabled from media.cameras where id = '00000000-0000-0000-0000-0000000e7f01';
  if v_admin_disabled is not true then raise exception 'FAIL Test 6: manager could not toggle admin_disabled'; end if;
  raise notice 'PASS Test 6: manager can toggle admin_disabled directly';
end $$;

-- Fix for EPIC_7_REVIEW.md C1: Manager A can read AND update
-- camera_connections directly — the manager-only access path this fix
-- relies on for the Dashboard's own camera-configuration screen.
do $$
declare v_ip inet;
begin
  update media.camera_connections set ip_address = '10.0.0.111' where camera_id = '00000000-0000-0000-0000-0000000e7f01';
  select ip_address into v_ip from media.camera_connections where camera_id = '00000000-0000-0000-0000-0000000e7f01';
  if v_ip is distinct from '10.0.0.111'::inet then raise exception 'FAIL Test 6b: manager could not read back their own camera_connections update'; end if;
  raise notice 'PASS Test 6b: manager can read and update media.camera_connections directly';
end $$;

-- ---------------------------------------------------------------------------
-- Test 7: soft-deleting Camera A1 (manager UPDATE, §8) immediately removes
-- it from Guardian A1's visibility (cameras_select_guardian filters
-- deleted_at is null) without needing a separate DELETE policy anywhere.
-- ---------------------------------------------------------------------------
do $$
begin
  update media.cameras set deleted_at = now() where id = '00000000-0000-0000-0000-0000000e7f01';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from media.cameras where id = '00000000-0000-0000-0000-0000000e7f01';
  if v_count <> 0 then raise exception 'FAIL Test 7: guardian could still see a soft-deleted camera'; end if;
  raise notice 'PASS Test 7: soft-deleted camera immediately disappears from guardian visibility (no DELETE policy needed)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8 (the core scheduled-job regression test): media.sweep_camera_
-- heartbeats() flips a stale-heartbeat camera offline, leaves admin_disabled
-- untouched, and fans a notification out to Tenant A's manager — all in one
-- set-based call.
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  -- Camera A2: online, admin_disabled=false, heartbeat 10 minutes stale —
  -- must flip to online=false.
  update media.cameras set online = true, admin_disabled = false, last_heartbeat_at = now() - interval '10 minutes' where id = '00000000-0000-0000-0000-0000000e7f02';
end $$;

do $$
declare
  v_swept_count      int;
  v_online           boolean;
  v_admin_disabled   boolean;
  v_notification_cnt int;
begin
  select media.sweep_camera_heartbeats() into v_swept_count;

  select online, admin_disabled into v_online, v_admin_disabled from media.cameras where id = '00000000-0000-0000-0000-0000000e7f02';
  if v_online is not false then raise exception 'FAIL Test 8a: sweep did not flip online=false for a stale-heartbeat camera'; end if;
  if v_admin_disabled is not false then raise exception 'FAIL Test 8b: sweep touched admin_disabled (must never — §3.33/§17/§27)'; end if;

  select count(*) into v_notification_cnt
  from comms.notifications
  where tenant_id = '00000000-0000-0000-0000-0000000e7a01' and category = 'system' and recipient_id = '00000000-0000-0000-0000-0000000e7a11';
  if v_notification_cnt < 1 then raise exception 'FAIL Test 8c: sweep did not notify Tenant A''s manager of the offline camera'; end if;

  raise notice 'PASS Test 8: heartbeat sweep flips online=false, never touches admin_disabled, and notifies the tenant''s manager — % camera(s) swept', v_swept_count;
end $$;

-- ---------------------------------------------------------------------------
-- Test 9: a second sweep call immediately after is a safe no-op (the
-- camera is already online=false, so the WHERE online=true predicate
-- excludes it — idempotent re-run, no duplicate notification).
-- ---------------------------------------------------------------------------
do $$
declare
  v_swept_count int;
  v_notification_cnt_before int;
  v_notification_cnt_after int;
begin
  select count(*) into v_notification_cnt_before from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e7a01' and category = 'system';

  select media.sweep_camera_heartbeats() into v_swept_count;

  select count(*) into v_notification_cnt_after from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e7a01' and category = 'system';

  if v_swept_count <> 0 then raise exception 'FAIL Test 9a: a second sweep re-swept an already-offline camera (swept %)', v_swept_count; end if;
  if v_notification_cnt_after <> v_notification_cnt_before then raise exception 'FAIL Test 9b: a second sweep sent a duplicate notification'; end if;

  raise notice 'PASS Test 9: a repeated sweep call is a safe, idempotent no-op';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: the camera_classroom_links consistency trigger rejects a link
-- where the camera and classroom belong to different tenants (M1-class
-- lesson applied from the start, per Epic 2/6 precedent).
-- ---------------------------------------------------------------------------
set role service_role;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, capacity)
values ('00000000-0000-0000-0000-0000000e7d09', '00000000-0000-0000-0000-0000000e7b01', 'Tenant B Classroom', 'kg1', 36, 48, 10)
on conflict (id) do nothing;

do $$
begin
  insert into media.camera_classroom_links (camera_id, classroom_id, tenant_id)
  values ('00000000-0000-0000-0000-0000000e7f02', '00000000-0000-0000-0000-0000000e7d09', '00000000-0000-0000-0000-0000000e7a01');
  raise exception 'FAIL Test 10: a cross-tenant camera_classroom_links row was created';
exception
  when others then
    if sqlerrm like '%do not both belong to the stated tenant%' then
      raise notice 'PASS Test 10: consistency trigger rejects a cross-tenant camera/classroom link';
    else
      raise exception 'FAIL Test 10: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11: Manager A can hard-delete a pure camera_classroom_links row
-- (unlinking, not a historical/financial record — mirrors
-- child_guardian_links_delete_manager's own precedent, Epic 2).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"manager"}}';

do $$
declare v_count int;
begin
  delete from media.camera_classroom_links where camera_id = '00000000-0000-0000-0000-0000000e7f02' and classroom_id = '00000000-0000-0000-0000-0000000e7d02';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'FAIL Test 11: manager could not unlink a camera from a classroom (deleted % rows)', v_count; end if;
  raise notice 'PASS Test 11: manager can hard-delete a camera_classroom_links row directly';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12 (fix for EPIC_7_REVIEW.md C1): public.create_camera atomically
-- creates a media.cameras row AND its media.camera_connections row in one
-- call, as Manager A.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"manager"}}';

do $$
declare
  v_camera_id     uuid;
  v_camera_count  int;
  v_conn_count    int;
  v_ip            inet;
begin
  select id into v_camera_id from public.create_camera('New Camera', 'outdoor', '10.0.0.50'::inet, 'webrtc', '4k', false);

  select count(*) into v_camera_count from media.cameras where id = v_camera_id and tenant_id = '00000000-0000-0000-0000-0000000e7a01';
  select count(*), max(ip_address) into v_conn_count, v_ip from media.camera_connections where camera_id = v_camera_id;

  if v_camera_count <> 1 then raise exception 'FAIL Test 12a: create_camera did not create a media.cameras row'; end if;
  if v_conn_count <> 1 then raise exception 'FAIL Test 12b: create_camera did not create a media.camera_connections row'; end if;
  if v_ip is distinct from '10.0.0.50'::inet then raise exception 'FAIL Test 12c: create_camera''s connection row has the wrong ip_address'; end if;

  raise notice 'PASS Test 12: create_camera atomically creates both the camera and its connection row';
end $$;

reset role;

-- Adversarial case: a guardian calling create_camera at all — rejected by
-- the RPC's own explicit role check before either INSERT is attempted.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"guardian"}}';

do $$
begin
  perform public.create_camera('Guardian Forged Camera', 'common', '10.0.0.61'::inet, 'rtsp', '720p', false);
  raise exception 'FAIL Test 12d: a guardian successfully called create_camera';
exception
  when others then
    if sqlerrm like '%Only a manager can add a camera%' then
      raise notice 'PASS Test 12d: create_camera rejects a guardian caller with its own explicit role check';
    else
      raise exception 'FAIL Test 12d: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 13 (fix for EPIC_7_REVIEW.md L5): the partial unique index on
-- media.camera_connections (tenant_id, ip_address) rejects a duplicate IP
-- within the same tenant.
-- ---------------------------------------------------------------------------
set role service_role;

-- Camera A1's connection ip_address was set to 10.0.0.111 in Test 6b — a
-- fresh camera's connection row deliberately reuses that same IP within
-- the same tenant to exercise the INSERT path against the constraint.
do $$
declare v_new_camera_id uuid;
begin
  insert into media.cameras (tenant_id, name, zone, resolution)
  values ('00000000-0000-0000-0000-0000000e7a01', 'Duplicate-IP Camera', 'common', '720p')
  returning id into v_new_camera_id;

  insert into media.camera_connections (camera_id, tenant_id, ip_address, stream_protocol)
  values (v_new_camera_id, '00000000-0000-0000-0000-0000000e7a01', '10.0.0.111', 'rtsp');

  raise exception 'FAIL Test 13: a duplicate (tenant_id, ip_address) camera_connections row was created';
exception
  when unique_violation then
    raise notice 'PASS Test 13: camera_connections_tenant_ip_key rejects a duplicate IP within the same tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 14 (fix for EPIC_7_REVIEW.md H2): the camera_service_account_links
-- consistency trigger rejects binding a non-camera_agent service account to
-- a camera.
-- ---------------------------------------------------------------------------
set role service_role;

insert into identity.service_accounts (id, tenant_id, name, purpose, api_key_hash, scopes, status, issued_by)
values ('00000000-0000-0000-0000-0000000e7012', '00000000-0000-0000-0000-0000000e7a01', 'Some Integration', 'integration_other', 'fixture-hash-not-a-real-key-2', array['integration:sync'], 'active', '00000000-0000-0000-0000-0000000e7a11')
on conflict (id) do nothing;

do $$
begin
  insert into media.camera_service_account_links (camera_id, service_account_id, tenant_id)
  values ('00000000-0000-0000-0000-0000000e7f02', '00000000-0000-0000-0000-0000000e7012', '00000000-0000-0000-0000-0000000e7a01');
  raise exception 'FAIL Test 14: an integration_other service account was linked to a camera';
exception
  when others then
    if sqlerrm like '%Only a camera_agent service account%' then
      raise notice 'PASS Test 14: consistency trigger rejects binding a non-camera_agent service account to a camera';
    else
      raise exception 'FAIL Test 14: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 15 (fix for EPIC_7_REVIEW.md M4 — the direct recurrence regression
-- test): Guardian A3 can see Camera A3 (linked to classroom A3, their own
-- child's classroom) while classroom A3 is live — then, once classroom A3
-- is soft-deleted (child A3 not yet reassigned, an unusual but real
-- transient state), Guardian A3 immediately loses visibility of Camera A3,
-- confirming cameras_select_guardian's own explicit classroom-deleted_at
-- check (migration 3) — not just the frozen, unmodified
-- current_guardian_classroom_ids() helper — is what's actually doing the
-- work.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a16","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from media.cameras where id = '00000000-0000-0000-0000-0000000e7f03';
  if v_count <> 1 then raise exception 'FAIL Test 15a: Guardian A3 could not see Camera A3 while classroom A3 is live'; end if;
  raise notice 'PASS Test 15a: guardian sees their own child''s classroom camera while the classroom is live';
end $$;

reset role;

set role service_role;
do $$
begin
  update academic.classrooms set deleted_at = now() where id = '00000000-0000-0000-0000-0000000e7d03';
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e7a16","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e7a01","role":"guardian"}}';

do $$
declare v_camera_count int;
declare v_link_count int;
begin
  select count(*) into v_camera_count from media.cameras where id = '00000000-0000-0000-0000-0000000e7f03';
  if v_camera_count <> 0 then raise exception 'FAIL Test 15b (M4 regression): Guardian A3 could still see Camera A3 after its only linked classroom was soft-deleted'; end if;

  select count(*) into v_link_count from media.camera_classroom_links where camera_id = '00000000-0000-0000-0000-0000000e7f03';
  if v_link_count <> 0 then raise exception 'FAIL Test 15c (M4 regression): Guardian A3 could still see the camera_classroom_links row for a soft-deleted classroom'; end if;

  raise notice 'PASS Test 15: soft-deleting the camera''s only linked classroom immediately revokes guardian visibility on both media.cameras and media.camera_classroom_links';
end $$;

reset role;

rollback;
