-- ============================================================================
-- Epic 10 RLS / access-boundary adversarial test suite (rewritten in the
-- EPIC_10_FIX_REPORT fix pass). Same shape as epic2-9_rls_adversarial.sql:
-- seed fixtures as service_role, refresh the materialized views, then switch
-- to a simulated authenticated role via a forged JWT claim and assert the
-- expected allow/deny outcome.
--
-- Unexecuted in this sandbox (no local Postgres / Docker), same documented
-- limitation as every prior Epic's RLS suite. Written to pass if executed.
--
-- Focus: the fail-CLOSED guarantees introduced by the fix pass — H1 (no
-- materialized view is client-reachable; the attendance view returns zero
-- rows without a tenant claim), M1 (teacher sees only own-classroom grain),
-- M2 (retention validation), M4 (archival before destructive delete), M5
-- (per-anomaly notification dedup). All fixture UUIDs use only hex chars.
-- ============================================================================

begin;

set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-00000010f001', 'growth10', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status, trial_ends_at)
values
  ('00000000-0000-0000-0000-00000010a001', 'Tenant 10-A', 'tenant-10-a-test', '00000000-0000-0000-0000-00000010f001', 'active', null),
  ('00000000-0000-0000-0000-00000010b001', 'Tenant 10-B', 'tenant-10-b-test', '00000000-0000-0000-0000-00000010f001', 'active', null)
on conflict (id) do nothing;

-- Tenant A: manager, and TWO teachers owning two different classrooms — the
-- fixture M1 needs (a child with attendance in BOTH classrooms).
insert into identity.staff_profiles (id, tenant_id, role, name, phone, employment_status, primary_classroom_id)
values
  ('00000000-0000-0000-0000-00000010a010', '00000000-0000-0000-0000-00000010a001', 'manager', 'Manager 10-A', '+201000010010', 'active', null),
  ('00000000-0000-0000-0000-00000010a011', '00000000-0000-0000-0000-00000010a001', 'teacher', 'Teacher X 10-A', '+201000010012', 'active', '00000000-0000-0000-0000-00000010a020'),
  ('00000000-0000-0000-0000-00000010a012', '00000000-0000-0000-0000-00000010a001', 'teacher', 'Teacher Y 10-A', '+201000010013', 'active', '00000000-0000-0000-0000-00000010a021'),
  ('00000000-0000-0000-0000-00000010b010', '00000000-0000-0000-0000-00000010b001', 'manager', 'Manager 10-B', '+201000010011', 'active', null)
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, capacity)
values
  ('00000000-0000-0000-0000-00000010a020', '00000000-0000-0000-0000-00000010a001', 'Room X 10-A', 20),
  ('00000000-0000-0000-0000-00000010a021', '00000000-0000-0000-0000-00000010a001', 'Room Y 10-A', 20),
  ('00000000-0000-0000-0000-00000010b020', '00000000-0000-0000-0000-00000010b001', 'Room 10-B', 20)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, classroom_id, enrolled_at)
values
  ('00000000-0000-0000-0000-00000010a030', '00000000-0000-0000-0000-00000010a001', 'Child 10-A', '2022-01-01', '00000000-0000-0000-0000-00000010a020', current_date),
  ('00000000-0000-0000-0000-00000010b030', '00000000-0000-0000-0000-00000010b001', 'Child 10-B', '2022-01-01', '00000000-0000-0000-0000-00000010b020', current_date)
on conflict (id) do nothing;

-- Child A has attendance in BOTH classroom X (2 days, both present) and
-- classroom Y (2 days, both absent). A cross-classroom aggregate would read
-- 50%; the per-classroom grain must show 100% for X and 0% for Y.
insert into academic.attendance_records (id, tenant_id, child_id, classroom_id, date, present, marked_by)
values
  ('00000000-0000-0000-0000-00000010a041', '00000000-0000-0000-0000-00000010a001', '00000000-0000-0000-0000-00000010a030', '00000000-0000-0000-0000-00000010a020', current_date - 3, true,  '00000000-0000-0000-0000-00000010a011'),
  ('00000000-0000-0000-0000-00000010a042', '00000000-0000-0000-0000-00000010a001', '00000000-0000-0000-0000-00000010a030', '00000000-0000-0000-0000-00000010a020', current_date - 2, true,  '00000000-0000-0000-0000-00000010a011'),
  ('00000000-0000-0000-0000-00000010a043', '00000000-0000-0000-0000-00000010a001', '00000000-0000-0000-0000-00000010a030', '00000000-0000-0000-0000-00000010a021', current_date - 1, false, '00000000-0000-0000-0000-00000010a012'),
  ('00000000-0000-0000-0000-00000010a044', '00000000-0000-0000-0000-00000010a001', '00000000-0000-0000-0000-00000010a030', '00000000-0000-0000-0000-00000010a021', current_date - 0, false, '00000000-0000-0000-0000-00000010a012'),
  ('00000000-0000-0000-0000-00000010b041', '00000000-0000-0000-0000-00000010b001', '00000000-0000-0000-0000-00000010b030', '00000000-0000-0000-0000-00000010b020', current_date - 1, true,  '00000000-0000-0000-0000-00000010b010')
on conflict (id) do nothing;

refresh materialized view analytics.mv_child_attendance_summary;
refresh materialized view analytics.mv_tenant_billing_summary;
refresh materialized view analytics.mv_tenant_health_summary;

-- ---------------------------------------------------------------------------
-- Test 1 (H1 fail-closed backstop): an authenticated session with NO tenant
-- claim — the shape a service_role/misconfigured client presents — must get
-- ZERO rows, because the view gates on tenant_id = current_tenant_id().
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000010a010","role":"authenticated"}';

do $$
declare v_n int;
begin
  select count(*) into v_n from academic.v_child_attendance_summary;
  assert v_n = 0, 'H1: a session without a tenant claim must see ZERO attendance summary rows (fail closed)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2 (tenant isolation): Manager 10-A sees own-tenant rows only.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000010a010","role":"authenticated","user_role":"manager","tenant_id":"00000000-0000-0000-0000-00000010a001"}';

do $$
declare v_own int; v_foreign int;
begin
  select count(*) into v_own     from academic.v_child_attendance_summary where tenant_id = '00000000-0000-0000-0000-00000010a001';
  select count(*) into v_foreign from academic.v_child_attendance_summary where tenant_id = '00000000-0000-0000-0000-00000010b001';
  assert v_own = 2,     'Manager 10-A should see both per-classroom rows for Child 10-A';
  assert v_foreign = 0, 'Manager 10-A must NOT see Tenant B rows (cross-tenant leak)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3 (M1 — teacher sees ONLY their own classroom's grain, and the
-- percentage is classroom-scoped, not a cross-classroom aggregate).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000010a011","role":"authenticated","user_role":"teacher","tenant_id":"00000000-0000-0000-0000-00000010a001"}';

do $$
declare v_n int; v_pct numeric; v_other int;
begin
  select count(*) into v_n from academic.v_child_attendance_summary;
  select attendance_pct into v_pct from academic.v_child_attendance_summary
    where classroom_id = '00000000-0000-0000-0000-00000010a020';
  select count(*) into v_other from academic.v_child_attendance_summary
    where classroom_id = '00000000-0000-0000-0000-00000010a021';
  assert v_n = 1,        'Teacher X must see exactly one row (own classroom only)';
  assert v_pct = 100.00, 'M1: Teacher X must see the CLASSROOM-scoped 100%, not the 50% cross-classroom aggregate';
  assert v_other = 0,    'M1: Teacher X must NOT see classroom Y rows';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4 (reception is denied): reception has no Attendance permission (§12),
-- so the role branch never matches and the view returns zero rows.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000010a010","role":"authenticated","user_role":"reception","tenant_id":"00000000-0000-0000-0000-00000010a001"}';

do $$
declare v_n int;
begin
  select count(*) into v_n from academic.v_child_attendance_summary;
  assert v_n = 0, 'Reception must see zero attendance summary rows';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5 (H1 — NO materialized view is client-reachable): authenticated has
-- no SELECT grant on any analytics MV, including the attendance one (the
-- grant the pre-fix design required has been removed).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000010a010","role":"authenticated","user_role":"manager","tenant_id":"00000000-0000-0000-0000-00000010a001"}';

do $$
begin
  perform 1 from analytics.mv_child_attendance_summary limit 1;
  raise exception 'H1: authenticated must NOT select analytics.mv_child_attendance_summary directly';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform 1 from analytics.mv_tenant_billing_summary limit 1;
  raise exception 'H1: authenticated must NOT select analytics.mv_tenant_billing_summary directly';
exception when insufficient_privilege then null;
end $$;

-- The archival sinks are equally unreachable (FORCE RLS, no policy, no grant).
do $$
begin
  perform 1 from analytics.activity_log_archive limit 1;
  raise exception 'authenticated must NOT select analytics.activity_log_archive';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform 1 from analytics.trip_route_snapshot limit 1;
  raise exception 'authenticated must NOT select analytics.trip_route_snapshot';
exception when insufficient_privilege then null;
end $$;

-- Platform summaries are Platform-Admin-only: a manager sees zero rows.
do $$
declare v_b int; v_h int;
begin
  select count(*) into v_b from platform.v_tenant_billing_summary;
  select count(*) into v_h from platform.v_tenant_health_summary;
  assert v_b = 0, 'Manager must see zero rows from platform.v_tenant_billing_summary';
  assert v_h = 0, 'Manager must see zero rows from platform.v_tenant_health_summary';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6 (platform admin sees the cross-tenant summaries).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000010c010","role":"authenticated","user_role":"platform_admin","platform_admin_tier":"owner"}';

do $$
declare v_b int; v_h int;
begin
  select count(*) into v_b from platform.v_tenant_billing_summary
    where tenant_id in ('00000000-0000-0000-0000-00000010a001','00000000-0000-0000-0000-00000010b001');
  select count(*) into v_h from platform.v_tenant_health_summary
    where tenant_id in ('00000000-0000-0000-0000-00000010a001','00000000-0000-0000-0000-00000010b001');
  assert v_b = 2, 'Platform Admin should see both tenants in billing summary';
  assert v_h = 2, 'Platform Admin should see both tenants in health summary';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7 (scheduled-job functions remain service_role-only).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000010a010","role":"authenticated","user_role":"manager","tenant_id":"00000000-0000-0000-0000-00000010a001"}';

do $$
begin
  perform identity.run_staff_rating_recomputation();
  raise exception 'authenticated must NOT execute identity.run_staff_rating_recomputation';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform jobs.register_scheduled_jobs();
  raise exception 'authenticated must NOT execute jobs.register_scheduled_jobs';
exception when insufficient_privilege then null;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8 (M2 — retention validation rejects an inverted window).
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  perform transport.run_gps_ping_retention_purge(0);
  raise exception 'M2: a zero retention window must be rejected';
exception when invalid_parameter_value then null;
end $$;

do $$
begin
  perform platform.run_activity_log_archival(-1);
  raise exception 'M2: a negative retention window must be rejected';
exception when invalid_parameter_value then null;
end $$;

do $$
begin
  perform jobs.run_idempotency_key_purge(-24);
  raise exception 'M2: a negative retention window must be rejected';
exception when invalid_parameter_value then null;
end $$;

-- ---------------------------------------------------------------------------
-- Test 9 (M4 — activity_log archival MOVES rows rather than destroying them).
-- ---------------------------------------------------------------------------
insert into platform.activity_log (id, tenant_id, actor_type, actor_id, action, target_type, target_id, occurred_at)
values ('00000000-0000-0000-0000-00000010a050', '00000000-0000-0000-0000-00000010a001', 'system', null,
        'old_action', 'test', null, now() - interval '400 days')
on conflict (id) do nothing;

do $$
declare v_archived int; v_left int;
begin
  perform platform.run_activity_log_archival(365);
  select count(*) into v_archived from analytics.activity_log_archive
    where id = '00000000-0000-0000-0000-00000010a050';
  select count(*) into v_left from platform.activity_log
    where id = '00000000-0000-0000-0000-00000010a050';
  assert v_archived = 1, 'M4: the aged activity_log row must be preserved in the archive';
  assert v_left = 0,     'M4: the aged activity_log row must be removed from the hot table';
end $$;

-- ---------------------------------------------------------------------------
-- Test 10 (M4 — GPS purge generates a route snapshot BEFORE deleting pings).
-- ---------------------------------------------------------------------------
insert into transport.buses (id, tenant_id, plate_number, capacity)
values ('00000000-0000-0000-0000-00000010a060', '00000000-0000-0000-0000-00000010a001', 'TEST-10A', 20)
on conflict (id) do nothing;

insert into transport.trips (id, tenant_id, bus_id, leg, status, started_at)
values ('00000000-0000-0000-0000-00000010a061', '00000000-0000-0000-0000-00000010a001',
        '00000000-0000-0000-0000-00000010a060', 'morning', 'completed', now() - interval '40 days')
on conflict (id) do nothing;

insert into transport.gps_pings (id, trip_id, tenant_id, lat, lng, recorded_at)
values
  ('00000000-0000-0000-0000-00000010a071', '00000000-0000-0000-0000-00000010a061', '00000000-0000-0000-0000-00000010a001', 30.1, 31.1, now() - interval '40 days'),
  ('00000000-0000-0000-0000-00000010a072', '00000000-0000-0000-0000-00000010a061', '00000000-0000-0000-0000-00000010a001', 30.2, 31.2, now() - interval '40 days' + interval '1 minute')
on conflict (id) do nothing;

do $$
declare v_points int; v_remaining int;
begin
  perform transport.run_gps_ping_retention_purge(30);
  select point_count into v_points from analytics.trip_route_snapshot
    where trip_id = '00000000-0000-0000-0000-00000010a061';
  select count(*) into v_remaining from transport.gps_pings
    where trip_id = '00000000-0000-0000-0000-00000010a061';
  assert v_points = 2,   'M4: the route snapshot must capture both pings before the purge';
  assert v_remaining = 0, 'M4: the expired raw pings must be deleted after snapshotting';
end $$;

-- ---------------------------------------------------------------------------
-- Test 11 (M5 — distinct concurrent anomalies produce DISTINCT alerts).
-- Two different source IPs, each over threshold, must not collapse into one.
-- ---------------------------------------------------------------------------
insert into identity.platform_admins (id, name, email, role)
values ('00000000-0000-0000-0000-00000010c010', 'Owner 10', 'owner10@masar.test', 'owner')
on conflict (id) do nothing;

insert into platform.audit_log (tenant_id, actor_type, actor_id, action, target_type, ip_address, occurred_at)
select null, 'system', null, 'auth_login_failed', 'auth', '203.0.113.10'::inet, now()
from generate_series(1, 6);

insert into platform.audit_log (tenant_id, actor_type, actor_id, action, target_type, ip_address, occurred_at)
select null, 'system', null, 'auth_login_failed', 'auth', '203.0.113.99'::inet, now()
from generate_series(1, 6);

do $$
declare v_alerts int;
begin
  perform platform.run_failed_login_anomaly_sweep(1, 5);
  select count(distinct deep_link) into v_alerts
  from comms.notifications
  where recipient_id = '00000000-0000-0000-0000-00000010c010'
    and category = 'security';
  assert v_alerts = 2, 'M5: two distinct (actor, IP) anomalies must yield two distinct alerts, not one collapsed alert';
end $$;

-- ---------------------------------------------------------------------------
-- Test 12 (job-name vocabulary widened, not opened).
-- ---------------------------------------------------------------------------
do $$
begin
  perform jobs.record_scheduled_job_run('staff_rating_recomputation', now(), 'succeeded', 0, null);
  perform jobs.record_scheduled_job_run('gps_ping_retention_purge',  now(), 'succeeded', 0, null);
  perform jobs.record_scheduled_job_run('idempotency_key_purge',     now(), 'succeeded', 0, null);
  perform jobs.record_scheduled_job_run('failed_login_anomaly_sweep',now(), 'succeeded', 0, null);
  perform jobs.record_scheduled_job_run('activity_log_archival',     now(), 'succeeded', 0, null);
  perform jobs.record_scheduled_job_run('refresh_attendance_summary',now(), 'succeeded', 0, null);
  perform jobs.record_scheduled_job_run('refresh_tenant_summaries',  now(), 'succeeded', 0, null);
end $$;

do $$
begin
  insert into jobs.scheduled_job_runs (job_name, started_at, status)
  values ('not_a_real_job', now(), 'succeeded');
  raise exception 'an unknown job_name must violate the CHECK constraint';
exception when check_violation then null;
end $$;

reset role;

rollback;
