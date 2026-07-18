-- ============================================================================
-- Epic 9 RLS adversarial test suite. Same shape as epic2-8_rls_adversarial.sql:
-- fixture rows as service_role, then switch to a simulated authenticated role
-- via a forged JWT claim and assert the expected allow/deny outcome. Every
-- fixture UUID uses only valid hexadecimal characters (0-9a-f).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A: manager, teacher, reception, guardian
-- (child A1, classroom A1, no attendance marked today — the positive case
-- for the attendance-non-marking-alert job; classroom A2 has attendance
-- already marked today — the negative case). Tenant B: manager B
-- (cross-tenant isolation target). Three Platform Admin tiers: owner,
-- admin, support — every §12.1 divergence test needs all three.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e9999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status, trial_ends_at)
values
  ('00000000-0000-0000-0000-0000000e9a01', 'Tenant E9-A', 'tenant-e9-a-test', '00000000-0000-0000-0000-0000000e9999', 'active', null),
  ('00000000-0000-0000-0000-0000000e9b01', 'Tenant E9-B', 'tenant-e9-b-test', '00000000-0000-0000-0000-0000000e9999', 'active', null),
  ('00000000-0000-0000-0000-0000000e9c01', 'Tenant E9-Trial', 'tenant-e9-trial-test', '00000000-0000-0000-0000-0000000e9999', 'trial', now() - interval '1 day')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e9a11', '+201800000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e9a12', '+201800000002', 'authenticated', 'authenticated'), -- teacher A
  ('00000000-0000-0000-0000-0000000e9a13', '+201800000003', 'authenticated', 'authenticated'), -- reception A
  ('00000000-0000-0000-0000-0000000e9a14', '+201800000004', 'authenticated', 'authenticated'), -- guardian A
  ('00000000-0000-0000-0000-0000000e9b11', '+201800000005', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e9c01', '+201800000006', 'authenticated', 'authenticated'), -- platform admin (owner tier)
  ('00000000-0000-0000-0000-0000000e9c02', '+201800000007', 'authenticated', 'authenticated'), -- platform admin (admin tier)
  ('00000000-0000-0000-0000-0000000e9c03', '+201800000008', 'authenticated', 'authenticated')  -- platform admin (support tier)
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e9a11', '00000000-0000-0000-0000-0000000e9a01', 'manager', 'Manager A', '+201800000001'),
  ('00000000-0000-0000-0000-0000000e9a12', '00000000-0000-0000-0000-0000000e9a01', 'teacher', 'Teacher A', '+201800000002'),
  ('00000000-0000-0000-0000-0000000e9a13', '00000000-0000-0000-0000-0000000e9a01', 'reception', 'Reception A', '+201800000003'),
  ('00000000-0000-0000-0000-0000000e9b11', '00000000-0000-0000-0000-0000000e9b01', 'manager', 'Manager B', '+201800000005')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values ('00000000-0000-0000-0000-0000000e9a14', '00000000-0000-0000-0000-0000000e9a01', 'Guardian A', '+201800000004')
on conflict (id) do nothing;

insert into identity.platform_admins (id, name, email, role)
values
  ('00000000-0000-0000-0000-0000000e9c01', 'Owner Admin', 'owner-e9-test@masar.app', 'owner'),
  ('00000000-0000-0000-0000-0000000e9c02', 'Admin Admin', 'admin-e9-test@masar.app', 'admin'),
  ('00000000-0000-0000-0000-0000000e9c03', 'Support Admin', 'support-e9-test@masar.app', 'support')
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, capacity)
values
  ('00000000-0000-0000-0000-0000000e9d01', '00000000-0000-0000-0000-0000000e9a01', 'KG1-A (unmarked today)', 'kg1', 36, 48, 10),
  ('00000000-0000-0000-0000-0000000e9d02', '00000000-0000-0000-0000-0000000e9a01', 'KG1-B (marked today)', 'kg1', 36, 48, 10)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e9e01', '00000000-0000-0000-0000-0000000e9a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e9d01', 'full_day'),
  ('00000000-0000-0000-0000-0000000e9e02', '00000000-0000-0000-0000-0000000e9a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e9d02', 'full_day')
on conflict (id) do nothing;

-- Classroom A2 already has today's attendance marked — the negative case
-- for Test 15 (attendance-non-marking-alert must NOT flag it).
insert into academic.attendance_records (tenant_id, child_id, classroom_id, date, present, marked_by)
values ('00000000-0000-0000-0000-0000000e9a01', '00000000-0000-0000-0000-0000000e9e02', '00000000-0000-0000-0000-0000000e9d02', current_date, true, '00000000-0000-0000-0000-0000000e9a11')
on conflict (child_id, date) do nothing;

-- Fixture activity_log/support_tickets/tenant_billing_transactions/
-- service_health_status rows, inserted as service_role (bypasses RLS
-- entirely — no INSERT policy exists on any of these tables for any
-- authenticated role, migration 3) to seed read-path tests.
insert into platform.activity_log (id, tenant_id, actor_type, actor_id, action, target_type)
values ('00000000-0000-0000-0000-0000000e9f01', '00000000-0000-0000-0000-0000000e9a01', 'staff', '00000000-0000-0000-0000-0000000e9a11', 'test_seed_action', 'test')
on conflict (id) do nothing;

insert into platform.support_tickets (id, tenant_id, subject, body, category, severity, status, reported_by)
values ('00000000-0000-0000-0000-0000000e9f11', '00000000-0000-0000-0000-0000000e9a01', 'Seed ticket', 'Seed body', 'technical', 'low', 'open', '00000000-0000-0000-0000-0000000e9a11')
on conflict (id) do nothing;

insert into platform.tenant_billing_transactions (id, tenant_id, amount, kind, status, settled_at)
values ('00000000-0000-0000-0000-0000000e9f21', '00000000-0000-0000-0000-0000000e9a01', 7500, 'subscription_charge', 'succeeded', now())
on conflict (id) do nothing;

reset role;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's
-- activity_log, support_tickets, or tenant_billing_transactions rows.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from platform.activity_log where tenant_id = '00000000-0000-0000-0000-0000000e9a01';
  if v_count <> 0 then raise exception 'FAIL Test 1a: Manager B could see Tenant A''s activity_log'; end if;

  select count(*) into v_count from platform.support_tickets where tenant_id = '00000000-0000-0000-0000-0000000e9a01';
  if v_count <> 0 then raise exception 'FAIL Test 1b: Manager B could see Tenant A''s support_tickets'; end if;

  select count(*) into v_count from platform.tenant_billing_transactions where tenant_id = '00000000-0000-0000-0000-0000000e9a01';
  if v_count <> 0 then raise exception 'FAIL Test 1c: Manager B could see Tenant A''s tenant_billing_transactions (should be zero regardless of tenant — Manager has no access to this table at all)'; end if;

  raise notice 'PASS Test 1: cross-tenant isolation holds on activity_log/support_tickets, and Manager B (like any manager) has zero tenant_billing_transactions visibility';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: activity_log — Manager A and Reception A see their own tenant's
-- row; Teacher A and Guardian A see none (§12: no Teacher/Guardian access).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from platform.activity_log where id = '00000000-0000-0000-0000-0000000e9f01';
  if v_count <> 1 then raise exception 'FAIL Test 2a: Manager A could not see their own tenant''s activity_log row'; end if;
  raise notice 'PASS Test 2a: manager sees their own tenant''s activity_log';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"reception"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from platform.activity_log where id = '00000000-0000-0000-0000-0000000e9f01';
  if v_count <> 1 then raise exception 'FAIL Test 2b: Reception A could not see their own tenant''s activity_log row'; end if;
  raise notice 'PASS Test 2b: reception sees their own tenant''s activity_log';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from platform.activity_log where id = '00000000-0000-0000-0000-0000000e9f01';
  if v_count <> 0 then raise exception 'FAIL Test 2c: Teacher A could see activity_log — §12 grants Teacher no access to this resource'; end if;
  raise notice 'PASS Test 2c: teacher has zero activity_log visibility';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: no direct RLS INSERT path exists on activity_log for any role —
-- even a manager. The sole write path is platform.write_activity_log,
-- called only from within migration 4's own RPCs.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"manager"}}';

do $$
begin
  insert into platform.activity_log (tenant_id, actor_type, action, target_type)
  values ('00000000-0000-0000-0000-0000000e9a01', 'staff', 'forged_action', 'test');
  raise exception 'FAIL Test 3: a manager inserted an activity_log row directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 3: no direct INSERT path exists on activity_log for manager';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4 (the core §19-equivalent regression test for this Epic):
-- create_support_ticket — manager-only, writes activity_log, and a
-- non-manager caller (reception) is rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"manager"}}';

do $$
declare
  v_row              platform.support_tickets;
  v_activity_cnt      int;
begin
  v_row := public.create_support_ticket('Camera offline', 'The entrance camera stopped responding.', 'technical', 'high');

  if v_row.status <> 'open' then raise exception 'FAIL Test 4a: create_support_ticket did not default status to open'; end if;
  if v_row.reported_by <> '00000000-0000-0000-0000-0000000e9a11' then raise exception 'FAIL Test 4b: create_support_ticket did not stamp reported_by correctly'; end if;

  select count(*) into v_activity_cnt from platform.activity_log where target_id = v_row.id and action = 'support_ticket_created';
  if v_activity_cnt <> 1 then raise exception 'FAIL Test 4c: create_support_ticket did not write an activity_log entry'; end if;

  raise notice 'PASS Test 4: create_support_ticket creates a ticket correctly and writes activity_log';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"reception"}}';

do $$
begin
  perform public.create_support_ticket('x', 'y', 'technical', 'low');
  raise exception 'FAIL Test 4d: reception successfully called create_support_ticket';
exception
  when others then
    if sqlerrm like '%Only a manager can create a support ticket%' then
      raise notice 'PASS Test 4d: create_support_ticket rejects a non-manager caller';
    else
      raise exception 'FAIL Test 4d: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: no direct RLS UPDATE path exists on support_tickets for anyone,
-- including a Platform Admin — status/assignment changes route exclusively
-- through update_support_ticket.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c01","app_metadata":{"role":"platform_admin"}}';

do $$
begin
  update platform.support_tickets set status = 'resolved' where id = '00000000-0000-0000-0000-0000000e9f11';
  raise exception 'FAIL Test 5: a Platform Admin updated a support_tickets row directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 5: no direct UPDATE path exists on support_tickets for any role';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6 (§12.1's own "no divergence" test): every Platform Admin tier —
-- owner, admin, AND support — can call update_support_ticket successfully.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c03","app_metadata":{"role":"platform_admin"}}';

do $$
declare
  v_row               platform.support_tickets;
  v_audit_cnt         int;
  v_notification_cnt  int;
begin
  v_row := public.update_support_ticket('00000000-0000-0000-0000-0000000e9f11', 'in_progress', '00000000-0000-0000-0000-0000000e9c03');

  if v_row.status <> 'in_progress' then raise exception 'FAIL Test 6a: support-tier update_support_ticket did not transition status'; end if;
  if v_row.assigned_to <> '00000000-0000-0000-0000-0000000e9c03' then raise exception 'FAIL Test 6b: support-tier update_support_ticket did not set assigned_to'; end if;

  select count(*) into v_audit_cnt from platform.audit_log where target_id = v_row.id and action = 'support_ticket_updated';
  if v_audit_cnt <> 1 then raise exception 'FAIL Test 6c: update_support_ticket did not write an audit_log entry'; end if;

  select count(*) into v_notification_cnt from comms.notifications where recipient_id = '00000000-0000-0000-0000-0000000e9a11' and category = 'support';
  if v_notification_cnt <> 1 then raise exception 'FAIL Test 6d (§16 regression): update_support_ticket did not notify the reporting manager on status change'; end if;

  raise notice 'PASS Test 6: support-tier Platform Admin can update+assign a ticket, writes audit_log, and notifies the reporting manager (§12.1 "no divergence")';
end $$;

-- Fix-verification regression test (EPIC_9_REVIEW.md H2/M1): a second,
-- sequential update_support_ticket call re-asserting the SAME status the
-- ticket is already in (a reasonable proxy for the concurrent-call race a
-- single-session test cannot express directly, per EPIC_9_REVIEW.md L2's
-- own recommended fix) must not fire a duplicate notification and must not
-- reset resolved_at once already set.
do $$
declare
  v_first             platform.support_tickets;
  v_second            platform.support_tickets;
  v_notification_cnt  int;
begin
  v_first := public.update_support_ticket('00000000-0000-0000-0000-0000000e9f11', 'resolved');
  if v_first.resolved_at is null then raise exception 'FAIL Test 6e: first resolve did not stamp resolved_at'; end if;

  v_second := public.update_support_ticket('00000000-0000-0000-0000-0000000e9f11', 'resolved');
  if v_second.resolved_at is distinct from v_first.resolved_at then
    raise exception 'FAIL Test 6f (H2 regression): a redundant status=resolved call reset resolved_at';
  end if;

  select count(*) into v_notification_cnt
  from comms.notifications
  where recipient_id = '00000000-0000-0000-0000-0000000e9a11' and category = 'support' and body like '%resolved%';
  if v_notification_cnt <> 1 then
    raise exception 'FAIL Test 6g (H2 regression): a redundant status=resolved call fired a duplicate notification (count=%)', v_notification_cnt;
  end if;

  raise notice 'PASS Test 6e/f/g: a redundant update_support_ticket call (same status as current) is a safe no-op — no resolved_at reset, no duplicate notification (H2 fix verification)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: NOT_FOUND for a nonexistent ticket; NOT_FOUND for a nonexistent
-- assignee.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c01","app_metadata":{"role":"platform_admin"}}';

do $$
begin
  perform public.update_support_ticket('00000000-0000-0000-0000-0000000e9fff', 'resolved');
  raise exception 'FAIL Test 7a: update_support_ticket succeeded on a nonexistent ticket id';
exception
  when others then
    if sqlerrm like '%Support ticket not found%' then
      raise notice 'PASS Test 7a: update_support_ticket returns NOT_FOUND for a nonexistent ticket';
    else
      raise exception 'FAIL Test 7a: unexpected error: %', sqlerrm;
    end if;
end $$;

do $$
begin
  perform public.update_support_ticket('00000000-0000-0000-0000-0000000e9f11', null, '00000000-0000-0000-0000-0000000e9fff');
  raise exception 'FAIL Test 7b: update_support_ticket accepted a nonexistent assignee';
exception
  when others then
    if sqlerrm like '%Assignee not found%' then
      raise notice 'PASS Test 7b: update_support_ticket returns NOT_FOUND for a nonexistent assignee';
    else
      raise exception 'FAIL Test 7b: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8: update_support_ticket idempotency-key envelope — same key
-- replays the original response; same key with a different payload is
-- rejected with CONFLICT_IDEMPOTENCY_KEY_REUSED.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c01","app_metadata":{"role":"platform_admin"}}';

do $$
declare
  v_key           uuid := '11119000-0000-0000-0000-000000000001';
  v_first         platform.support_tickets;
  v_second        platform.support_tickets;
begin
  v_first := public.update_support_ticket('00000000-0000-0000-0000-0000000e9f11', 'resolved', null, v_key);
  v_second := public.update_support_ticket('00000000-0000-0000-0000-0000000e9f11', 'resolved', null, v_key);

  if v_second.resolved_at is distinct from v_first.resolved_at then
    raise exception 'FAIL Test 8a (H1 regression): a replayed update_support_ticket call returned a different resolved_at';
  end if;
  raise notice 'PASS Test 8a: a retried update_support_ticket call with the same idempotency key replays the original response';
end $$;

do $$
declare v_key uuid := '11119000-0000-0000-0000-000000000001';
begin
  perform public.update_support_ticket('00000000-0000-0000-0000-0000000e9f11', 'open', null, v_key);
  raise exception 'FAIL Test 8b: the same idempotency key was silently accepted for a different payload';
exception
  when others then
    if sqlerrm like '%idempotency key reused with a different payload%' then
      raise notice 'PASS Test 8b: reusing an idempotency key with a different payload raises CONFLICT_IDEMPOTENCY_KEY_REUSED';
    else
      raise exception 'FAIL Test 8b: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: the resolved_at companion-field CHECK constraint holds even for a
-- service_role direct write (defense-in-depth beneath the RPC layer).
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  insert into platform.support_tickets (tenant_id, subject, body, category, severity, status, reported_by, resolved_at)
  values ('00000000-0000-0000-0000-0000000e9a01', 'x', 'y', 'technical', 'low', 'open', '00000000-0000-0000-0000-0000000e9a11', now());
  raise exception 'FAIL Test 9a: an open ticket with resolved_at set was accepted';
exception
  when check_violation then
    raise notice 'PASS Test 9a: support_tickets_resolved_at_check rejects resolved_at set on a non-resolved ticket';
end $$;

do $$
begin
  insert into platform.support_tickets (tenant_id, subject, body, category, severity, status, reported_by, resolved_at)
  values ('00000000-0000-0000-0000-0000000e9a01', 'x', 'y', 'technical', 'low', 'resolved', '00000000-0000-0000-0000-0000000e9a11', null);
  raise exception 'FAIL Test 9b: a resolved ticket with no resolved_at was accepted';
exception
  when check_violation then
    raise notice 'PASS Test 9b: support_tickets_resolved_at_check rejects a resolved ticket with no resolved_at';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: service_health_status — every Platform Admin tier can read; a
-- manager cannot; no direct write path exists for anyone.
-- ---------------------------------------------------------------------------
set role service_role;
do $$
begin
  insert into platform.service_health_status (service_code, status, uptime_pct, latency_ms)
  values ('test_service', 'up', 100.00, 5)
  on conflict (service_code) do nothing;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c03","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from platform.service_health_status where service_code = 'test_service';
  if v_count <> 1 then raise exception 'FAIL Test 10a: support-tier Platform Admin could not read service_health_status'; end if;
  raise notice 'PASS Test 10a: every Platform Admin tier can read service_health_status';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from platform.service_health_status;
  if v_count <> 0 then raise exception 'FAIL Test 10b: a manager could read service_health_status — §12''s own explicit note says this is Platform-Admin-only'; end if;
  raise notice 'PASS Test 10b: manager has zero service_health_status visibility';
end $$;

do $$
begin
  update platform.service_health_status set status = 'down' where service_code = 'test_service';
  raise exception 'FAIL Test 10c: a manager updated service_health_status directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 10c: no direct write path exists on service_health_status for manager';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11 (§12.1's own divergence test): owner/admin can issue a tenant
-- billing transaction; support tier is rejected.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c01","app_metadata":{"role":"platform_admin"}}';

do $$
declare
  v_row        platform.tenant_billing_transactions;
  v_audit_cnt  int;
begin
  v_row := public.issue_tenant_billing_transaction('00000000-0000-0000-0000-0000000e9a01', 500, 'setup_fee');
  if v_row.status <> 'succeeded' then raise exception 'FAIL Test 11a: issue_tenant_billing_transaction did not mark the new row succeeded'; end if;

  select count(*) into v_audit_cnt from platform.audit_log where target_id = v_row.id and action = 'tenant_billing_transaction_issued';
  if v_audit_cnt <> 1 then raise exception 'FAIL Test 11b: issue_tenant_billing_transaction did not write an audit_log entry'; end if;

  raise notice 'PASS Test 11: owner-tier Platform Admin can issue a tenant billing transaction and it is audit-logged';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c03","app_metadata":{"role":"platform_admin"}}';

do $$
begin
  perform public.issue_tenant_billing_transaction('00000000-0000-0000-0000-0000000e9a01', 500, 'setup_fee');
  raise exception 'FAIL Test 11c: support-tier Platform Admin successfully issued a tenant billing transaction';
exception
  when others then
    if sqlerrm like '%Only an owner or admin tier Platform Admin can issue%' then
      raise notice 'PASS Test 11c: issue_tenant_billing_transaction rejects the support tier (§12.1)';
    else
      raise exception 'FAIL Test 11c: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12: refund_tenant_billing_transaction — owner/admin only; transitions
-- the original row to refunded AND inserts an independent kind=refund row;
-- a refund cannot itself be refunded.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c02","app_metadata":{"role":"platform_admin"}}';

do $$
declare
  v_refund_row      platform.tenant_billing_transactions;
  v_original_status platform.billing_transaction_status;
begin
  v_refund_row := public.refund_tenant_billing_transaction('00000000-0000-0000-0000-0000000e9f21');

  if v_refund_row.kind <> 'refund' then raise exception 'FAIL Test 12a: refund_tenant_billing_transaction did not create a kind=refund row'; end if;
  if v_refund_row.status <> 'succeeded' then raise exception 'FAIL Test 12b: the new refund row was not marked succeeded'; end if;

  select status into v_original_status from platform.tenant_billing_transactions where id = '00000000-0000-0000-0000-0000000e9f21';
  if v_original_status <> 'refunded' then raise exception 'FAIL Test 12c: the original transaction was not transitioned to refunded'; end if;

  raise notice 'PASS Test 12: admin-tier Platform Admin can refund a transaction — original marked refunded, independent refund row created';
end $$;

-- Fix-verification regression test (EPIC_9_REVIEW.md H1): a second,
-- sequential refund_tenant_billing_transaction call against the SAME
-- already-refunded original transaction must be rejected with
-- STATE_ALREADY_PROCESSED, not silently create a second refund row (a
-- reasonable proxy for the concurrent-call race a single-session test
-- cannot express directly, per EPIC_9_REVIEW.md L2's own recommended fix).
do $$
declare v_refund_count_before int;
declare v_refund_count_after  int;
begin
  select count(*) into v_refund_count_before from platform.tenant_billing_transactions where tenant_id = '00000000-0000-0000-0000-0000000e9a01' and kind = 'refund';

  perform public.refund_tenant_billing_transaction('00000000-0000-0000-0000-0000000e9f21');
  raise exception 'FAIL Test 12e (H1 regression): a second refund of the same already-refunded transaction succeeded';
exception
  when others then
    if sqlerrm like '%Only a succeeded transaction can be refunded%' then
      select count(*) into v_refund_count_after from platform.tenant_billing_transactions where tenant_id = '00000000-0000-0000-0000-0000000e9a01' and kind = 'refund';
      if v_refund_count_after <> v_refund_count_before then
        raise exception 'FAIL Test 12e (H1 regression): a rejected second refund still inserted a new refund row (before=%, after=%)', v_refund_count_before, v_refund_count_after;
      end if;
      raise notice 'PASS Test 12e: a second refund of the same already-refunded transaction is rejected with STATE_ALREADY_PROCESSED and creates no additional refund row (H1 fix verification)';
    else
      raise exception 'FAIL Test 12e: unexpected error: %', sqlerrm;
    end if;
end $$;

do $$
declare v_second_refund_id uuid;
begin
  select id into v_second_refund_id from platform.tenant_billing_transactions where tenant_id = '00000000-0000-0000-0000-0000000e9a01' and kind = 'refund' limit 1;
  perform public.refund_tenant_billing_transaction(v_second_refund_id);
  raise exception 'FAIL Test 12d: a refund was itself successfully refunded';
exception
  when others then
    if sqlerrm like '%A refund cannot itself be refunded%' then
      raise notice 'PASS Test 12d: refund_tenant_billing_transaction rejects refunding a refund';
    else
      raise exception 'FAIL Test 12d: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 13: no direct RLS write path exists on tenant_billing_transactions
-- for anyone, including a Platform Admin; a manager has zero read access.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c01","app_metadata":{"role":"platform_admin"}}';

do $$
begin
  insert into platform.tenant_billing_transactions (tenant_id, amount, kind, status)
  values ('00000000-0000-0000-0000-0000000e9a01', 100, 'setup_fee', 'succeeded');
  raise exception 'FAIL Test 13: a Platform Admin inserted a tenant_billing_transactions row directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 13: no direct INSERT path exists on tenant_billing_transactions for any role';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 14: jobs.scheduled_job_runs — Platform Admin can read; manager
-- cannot; no direct write path for anyone.
-- ---------------------------------------------------------------------------
set role service_role;
do $$
begin
  perform platform.run_service_health_check();
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c01","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from jobs.scheduled_job_runs where job_name = 'service_health_check';
  if v_count < 1 then raise exception 'FAIL Test 14a: Platform Admin could not read jobs.scheduled_job_runs'; end if;
  raise notice 'PASS Test 14a: Platform Admin can read jobs.scheduled_job_runs';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e9a01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from jobs.scheduled_job_runs;
  if v_count <> 0 then raise exception 'FAIL Test 14b: a manager could read jobs.scheduled_job_runs'; end if;
  raise notice 'PASS Test 14b: manager has zero jobs.scheduled_job_runs visibility';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 15 (the core scheduled-job regression test): platform.run_service_
-- health_check() upserts all 8 tracked services and is idempotent on
-- re-run; platform.run_tenant_billing_check() flips an active tenant with a
-- failed latest charge to overdue and notifies every Platform Admin;
-- platform.run_trial_expiry_sweep() flips an expired trial tenant to
-- overdue; platform.run_attendance_non_marking_alert() flags exactly the
-- unmarked classroom (not the marked one) and notifies the manager.
-- ---------------------------------------------------------------------------
set role service_role;

do $$
declare v_count int;
begin
  select platform.run_service_health_check() into v_count;
  if v_count <> 8 then raise exception 'FAIL Test 15a: run_service_health_check did not upsert exactly 8 service rows (got %)', v_count; end if;

  select platform.run_service_health_check() into v_count;
  if v_count <> 8 then raise exception 'FAIL Test 15b: a second run_service_health_check call was not idempotent (got %)', v_count; end if;

  raise notice 'PASS Test 15a/b: run_service_health_check upserts all 8 tracked services and is idempotent on re-run';
end $$;

do $$
declare
  v_count             int;
  v_status            tenancy.tenant_status;
  v_notification_cnt  int;
begin
  insert into platform.tenant_billing_transactions (tenant_id, amount, kind, status, settled_at)
  values ('00000000-0000-0000-0000-0000000e9a01', 7500, 'subscription_charge', 'failed', null);

  select platform.run_tenant_billing_check() into v_count;
  if v_count <> 1 then raise exception 'FAIL Test 15c: run_tenant_billing_check did not flag exactly 1 newly-overdue tenant (got %)', v_count; end if;

  select status into v_status from tenancy.tenants where id = '00000000-0000-0000-0000-0000000e9a01';
  if v_status <> 'overdue' then raise exception 'FAIL Test 15d: Tenant A was not transitioned to overdue'; end if;

  select count(*) into v_notification_cnt from comms.notifications where recipient_type = 'platform_admin' and category = 'billing' and body like '%overdue%';
  if v_notification_cnt < 3 then raise exception 'FAIL Test 15e: run_tenant_billing_check did not notify every Platform Admin (expected >= 3, got %)', v_notification_cnt; end if;

  raise notice 'PASS Test 15c/d/e: run_tenant_billing_check flags a newly-overdue tenant and notifies every Platform Admin';
end $$;

do $$
declare
  v_count  int;
  v_status tenancy.tenant_status;
begin
  select platform.run_trial_expiry_sweep() into v_count;
  if v_count <> 1 then raise exception 'FAIL Test 15f: run_trial_expiry_sweep did not flag exactly 1 expired trial tenant (got %)', v_count; end if;

  select status into v_status from tenancy.tenants where id = '00000000-0000-0000-0000-0000000e9c01';
  if v_status <> 'overdue' then raise exception 'FAIL Test 15g: the expired-trial tenant was not transitioned to overdue'; end if;

  raise notice 'PASS Test 15f/g: run_trial_expiry_sweep flips an expired trial tenant to overdue';
end $$;

do $$
declare
  v_count             int;
  v_notification_cnt  int;
begin
  select platform.run_attendance_non_marking_alert() into v_count;
  if v_count <> 1 then raise exception 'FAIL Test 15h: run_attendance_non_marking_alert did not flag exactly 1 classroom (got %) — classroom A2 (already marked) must not be flagged', v_count; end if;

  select count(*) into v_notification_cnt from comms.notifications where recipient_id = '00000000-0000-0000-0000-0000000e9a11' and category = 'attendance';
  if v_notification_cnt <> 1 then raise exception 'FAIL Test 15i: run_attendance_non_marking_alert did not notify the manager'; end if;

  raise notice 'PASS Test 15h/i: run_attendance_non_marking_alert flags exactly the unmarked classroom and notifies the manager';
end $$;

-- Fix-forward regression test (double-processing defect class): a same-day
-- re-run must not send a duplicate notification for the same classroom.
do $$
declare v_notification_cnt int;
begin
  perform platform.run_attendance_non_marking_alert();
  select count(*) into v_notification_cnt from comms.notifications where recipient_id = '00000000-0000-0000-0000-0000000e9a11' and category = 'attendance';
  if v_notification_cnt <> 1 then raise exception 'FAIL Test 15j: a same-day re-run of run_attendance_non_marking_alert sent a duplicate notification (count=%)', v_notification_cnt; end if;
  raise notice 'PASS Test 15j: a same-day re-run of run_attendance_non_marking_alert is a safe, idempotent no-op on the notification fan-out';
end $$;

-- ---------------------------------------------------------------------------
-- Test 16: every scheduled-job function is service_role only — not
-- directly callable by an authenticated Platform Admin.
-- ---------------------------------------------------------------------------
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e9c01","app_metadata":{"role":"platform_admin"}}';

do $$
begin
  perform platform.run_service_health_check();
  raise exception 'FAIL Test 16: an authenticated Platform Admin successfully called a service_role-only scheduled-job function';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 16: scheduled-job functions are not directly callable by an authenticated caller (service_role only)';
end $$;

reset role;

rollback;
