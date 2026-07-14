-- ============================================================================
-- Epic 1 RLS adversarial test suite (see README.md for how/why to run this)
-- Each block: sets up fixture rows as service_role, then switches to a
-- simulated authenticated role (via `set local role` + a forged JWT claim
-- through `set local request.jwt.claims`) and asserts the expected
-- allow/deny outcome. Any failed assertion raises and aborts the script.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants, one manager each, one platform admin per tier.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000000p1', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-00000000ten1', 'Tenant A', 'tenant-a-test', '00000000-0000-0000-0000-0000000000p1', 'active'),
  ('00000000-0000-0000-0000-00000000ten2', 'Tenant B', 'tenant-b-test', '00000000-0000-0000-0000-0000000000p1', 'active')
on conflict (id) do nothing;

-- NOTE: staff_profiles.id must reference a real auth.users row in a live
-- environment. In this fixture we insert directly into auth.users with
-- service_role for TEST PURPOSES ONLY — application code must never do this
-- (§10.3 mandates the Auth Admin API). This is acceptable here because the
-- goal is exercising RLS policies, not exercising the provisioning flow.
insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000mgra1', '+201000000001', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000mgrb1', '+201000000002', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000pa0wn1', 'pa-owner@masar.app', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000pasup1', 'pa-support@masar.app', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000mgra1', '00000000-0000-0000-0000-00000000ten1', 'manager', 'Manager A', '+201000000001'),
  ('00000000-0000-0000-0000-0000000mgrb1', '00000000-0000-0000-0000-00000000ten2', 'manager', 'Manager B', '+201000000002')
on conflict (id) do nothing;

insert into identity.platform_admins (id, name, email, role)
values
  ('00000000-0000-0000-0000-000000pa0wn1', 'Owner PA', 'pa-owner@masar.app', 'owner'),
  ('00000000-0000-0000-0000-000000pasup1', 'Support PA', 'pa-support@masar.app', 'support')
on conflict (id) do nothing;

reset role;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation on staff_profiles
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000mgra1","app_metadata":{"tenant_id":"00000000-0000-0000-0000-00000000ten1","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from identity.staff_profiles where tenant_id = '00000000-0000-0000-0000-00000000ten2';
  if v_count <> 0 then
    raise exception 'FAIL Test 1: Manager A could see Tenant B staff (% rows)', v_count;
  end if;
  raise notice 'PASS Test 1: cross-tenant isolation on staff_profiles holds';
end $$;

-- Manager A must NOT be able to update Tenant B's manager row.
do $$
begin
  update identity.staff_profiles set name = 'hacked' where id = '00000000-0000-0000-0000-0000000mgrb1';
  if found then
    raise exception 'FAIL Test 1b: Manager A updated a Tenant B row';
  end if;
  raise notice 'PASS Test 1b: cross-tenant UPDATE correctly a no-op (0 rows affected)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: tenants — manager sees/updates only their own tenant
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000mgra1","app_metadata":{"tenant_id":"00000000-0000-0000-0000-00000000ten1","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from tenancy.tenants;
  if v_count <> 1 then
    raise exception 'FAIL Test 2: Manager A sees % tenant rows, expected exactly 1', v_count;
  end if;
  raise notice 'PASS Test 2: manager sees only own tenant row';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: support-tier platform admin cannot write tenants (Critical C8)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000pasup1","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from tenancy.tenants; -- support CAN read
  if v_count < 2 then
    raise exception 'FAIL Test 3a: support tier could not read tenants (expected >=2, got %)', v_count;
  end if;
  raise notice 'PASS Test 3a: support tier retains read access to tenants';
end $$;

do $$
begin
  update tenancy.tenants set status = 'suspended' where id = '00000000-0000-0000-0000-00000000ten1';
  if found then
    raise exception 'FAIL Test 3b: support-tier platform admin was able to suspend a tenant';
  end if;
  raise notice 'PASS Test 3b: support tier correctly blocked from writing tenants';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: owner-tier platform admin CAN write tenants
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000pa0wn1","app_metadata":{"role":"platform_admin"}}';

do $$
begin
  update tenancy.tenants set status = 'suspended' where id = '00000000-0000-0000-0000-00000000ten1';
  if not found then
    raise exception 'FAIL Test 4: owner-tier platform admin could NOT suspend a tenant';
  end if;
  raise notice 'PASS Test 4: owner tier can write tenants';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: platform_admins table — admin/support can only see their own row
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000pasup1","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from identity.platform_admins;
  if v_count <> 1 then
    raise exception 'FAIL Test 5: support tier sees % platform_admins rows, expected exactly 1 (own)', v_count;
  end if;
  raise notice 'PASS Test 5: non-owner platform admin sees only their own row';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: audit_log immutability — no UPDATE/DELETE policy for any role
-- ---------------------------------------------------------------------------
set role service_role;
select public.write_audit_log(
  '00000000-0000-0000-0000-00000000ten1'::uuid, 'system', null,
  'test_event', 'test_target', null, null
) as seeded_audit_id \gset
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000mgra1","app_metadata":{"tenant_id":"00000000-0000-0000-0000-00000000ten1","role":"manager"}}';

do $$
begin
  update platform.audit_log set action = 'tampered' where action = 'test_event';
  if found then
    raise exception 'FAIL Test 6: a manager was able to UPDATE an audit_log row';
  end if;
  raise notice 'PASS Test 6: audit_log rows cannot be updated by any authenticated role';
end $$;

do $$
begin
  insert into platform.audit_log (tenant_id, actor_type, actor_id, action, target_type)
  values ('00000000-0000-0000-0000-00000000ten1', 'staff', null, 'direct_insert_attempt', 'test');
  raise exception 'FAIL Test 6b: a manager was able to INSERT into audit_log directly (bypassing write_audit_log)';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 6b: direct INSERT into audit_log correctly denied — only the RPC can write';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: tenant_provisioning_state / tenant_phone_registry — no
-- authenticated-role access whatsoever (service_role only).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000pa0wn1","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from tenancy.tenant_provisioning_state;
  if v_count <> 0 then
    raise exception 'FAIL Test 7: an authenticated role could read tenant_provisioning_state (% rows)', v_count;
  end if;
  raise notice 'PASS Test 7: tenant_provisioning_state is correctly service_role-only';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8: forged tenant_id on INSERT is rejected by WITH CHECK (§13.2)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000mgra1","app_metadata":{"tenant_id":"00000000-0000-0000-0000-00000000ten1","role":"manager"}}';

do $$
begin
  -- Manager A (tenant 1) attempts to insert a service_account row claiming
  -- to belong to tenant 2 — WITH CHECK must reject this regardless of the
  -- client-sent tenant_id value.
  insert into identity.service_accounts (tenant_id, name, purpose, api_key_hash)
  values ('00000000-0000-0000-0000-00000000ten2', 'forged', 'camera_agent', 'x');
  raise exception 'FAIL Test 8: a forged cross-tenant INSERT succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 8: forged tenant_id on INSERT correctly rejected';
end $$;

reset role;

rollback; -- leave no fixture data behind regardless of pass/fail
