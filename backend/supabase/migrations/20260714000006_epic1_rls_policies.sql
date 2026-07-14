-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 6: RLS policies for every Epic 1 table
-- Ref: BACKEND_ARCHITECTURE.md §12, §12.1, §13, §28
--
-- Convention: FORCE ROW LEVEL SECURITY everywhere, so not even the table
-- owner role can bypass it outside explicit service_role use (§13.1). Absence
-- of a policy is a hard deny — this is deliberate for platform_admins,
-- tenant_provisioning_state and tenant_phone_registry (§13.6).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- tenancy.tenants
-- Platform Admin: R all; write (suspend/reactivate/plan-change) gated to
-- owner/admin tier (§12.1). Manager: R,U own tenant only (§12).
-- ---------------------------------------------------------------------------
alter table tenancy.tenants enable row level security;
alter table tenancy.tenants force row level security;

create policy tenants_select_platform_admin on tenancy.tenants
  for select
  using (public.is_platform_admin());

create policy tenants_select_own on tenancy.tenants
  for select
  using (id = public.current_tenant_id());

create policy tenants_insert_platform_admin_manager_tier on tenancy.tenants
  for insert
  with check (public.is_platform_admin() and public.is_platform_admin_manager_tier());

create policy tenants_update_platform_admin_manager_tier on tenancy.tenants
  for update
  using (public.is_platform_admin() and public.is_platform_admin_manager_tier())
  with check (public.is_platform_admin() and public.is_platform_admin_manager_tier());

create policy tenants_update_own_manager on tenancy.tenants
  for update
  using (id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- tenancy.plan_catalog / plan_catalog_apps — read-only reference data.
-- Every authenticated identity may read it (needed to render plan names/apps
-- in both Dashboard and Platform Admin); only owner/admin may write (§28:
-- "RLS is mandatory even on tables that feel safe").
-- ---------------------------------------------------------------------------
alter table tenancy.plan_catalog enable row level security;
alter table tenancy.plan_catalog force row level security;

create policy plan_catalog_select_authenticated on tenancy.plan_catalog
  for select
  using (auth.role() = 'authenticated');

create policy plan_catalog_write_platform_admin_manager_tier on tenancy.plan_catalog
  for all
  using (public.is_platform_admin() and public.is_platform_admin_manager_tier())
  with check (public.is_platform_admin() and public.is_platform_admin_manager_tier());

alter table tenancy.plan_catalog_apps enable row level security;
alter table tenancy.plan_catalog_apps force row level security;

create policy plan_catalog_apps_select_authenticated on tenancy.plan_catalog_apps
  for select
  using (auth.role() = 'authenticated');

create policy plan_catalog_apps_write_platform_admin_manager_tier on tenancy.plan_catalog_apps
  for all
  using (public.is_platform_admin() and public.is_platform_admin_manager_tier())
  with check (public.is_platform_admin() and public.is_platform_admin_manager_tier());

-- ---------------------------------------------------------------------------
-- tenancy.tenant_provisioning_state — internal workflow table.
-- No policies for any authenticated role: only service_role (which bypasses
-- RLS by design) ever touches this, from inside the provision-tenant Edge
-- Function. Absence of policy = hard deny for every other caller (§13.6).
-- ---------------------------------------------------------------------------
alter table tenancy.tenant_provisioning_state enable row level security;
alter table tenancy.tenant_provisioning_state force row level security;

-- ---------------------------------------------------------------------------
-- tenancy.tenant_phone_registry — internal uniqueness-constraint table.
-- Same reasoning: service_role only.
-- ---------------------------------------------------------------------------
alter table tenancy.tenant_phone_registry enable row level security;
alter table tenancy.tenant_phone_registry force row level security;

-- ---------------------------------------------------------------------------
-- identity.staff_profiles
-- Manager: CRUD within own tenant. Staff: R own row. Platform Admin: R (any
-- tenant, support-context) — never write (§12: "Staff/Driver accounts ...
-- R (support only)" for Platform Admin).
-- ---------------------------------------------------------------------------
alter table identity.staff_profiles enable row level security;
alter table identity.staff_profiles force row level security;

create policy staff_profiles_select_manager on identity.staff_profiles
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_profiles_select_self on identity.staff_profiles
  for select
  using (id = auth.uid());

create policy staff_profiles_select_platform_admin on identity.staff_profiles
  for select
  using (public.is_platform_admin());

create policy staff_profiles_insert_manager on identity.staff_profiles
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_profiles_update_manager on identity.staff_profiles
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_profiles_update_self_limited on identity.staff_profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- identity.guardian_profiles
-- Manager: CRUD within own tenant. Guardian: R own row. Platform Admin: R.
-- ---------------------------------------------------------------------------
alter table identity.guardian_profiles enable row level security;
alter table identity.guardian_profiles force row level security;

create policy guardian_profiles_select_manager on identity.guardian_profiles
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy guardian_profiles_select_self on identity.guardian_profiles
  for select
  using (id = auth.uid());

create policy guardian_profiles_select_platform_admin on identity.guardian_profiles
  for select
  using (public.is_platform_admin());

create policy guardian_profiles_insert_manager on identity.guardian_profiles
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy guardian_profiles_update_manager on identity.guardian_profiles
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy guardian_profiles_update_self_limited on identity.guardian_profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- identity.driver_profiles
-- Manager: CRUD within own tenant. Driver: R own row. Platform Admin: R.
-- ---------------------------------------------------------------------------
alter table identity.driver_profiles enable row level security;
alter table identity.driver_profiles force row level security;

create policy driver_profiles_select_manager on identity.driver_profiles
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy driver_profiles_select_self on identity.driver_profiles
  for select
  using (id = auth.uid());

create policy driver_profiles_select_platform_admin on identity.driver_profiles
  for select
  using (public.is_platform_admin());

create policy driver_profiles_insert_manager on identity.driver_profiles
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy driver_profiles_update_manager on identity.driver_profiles
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy driver_profiles_update_self_limited on identity.driver_profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- identity.platform_admins
-- owner tier: CRUD all. admin/support: SELECT own row only (§12.1: "Platform
-- admin accounts themselves | CRUD (owner only, not admin) | –").
-- ---------------------------------------------------------------------------
alter table identity.platform_admins enable row level security;
alter table identity.platform_admins force row level security;

create policy platform_admins_select_self on identity.platform_admins
  for select
  using (id = auth.uid());

create policy platform_admins_all_owner_tier on identity.platform_admins
  for all
  using (public.current_platform_admin_tier() = 'owner')
  with check (public.current_platform_admin_tier() = 'owner');

-- ---------------------------------------------------------------------------
-- identity.service_accounts
-- Manager: CRUD within own tenant (issue/revoke keys). Platform Admin: R
-- (support-context). Machine callers never reach this via RLS at all — they
-- authenticate via API key inside a service_role Edge Function (§13.7).
-- ---------------------------------------------------------------------------
alter table identity.service_accounts enable row level security;
alter table identity.service_accounts force row level security;

create policy service_accounts_select_manager on identity.service_accounts
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy service_accounts_select_platform_admin on identity.service_accounts
  for select
  using (public.is_platform_admin());

create policy service_accounts_insert_manager on identity.service_accounts
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy service_accounts_update_manager on identity.service_accounts
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- platform.audit_log — immutable, append-only (§23).
-- INSERT only via service_role (no INSERT policy for any authenticated
-- role — every write routes through a SECURITY DEFINER RPC, see migration 7).
-- SELECT: platform_admin (all tenants), manager (own tenant only).
-- No UPDATE/DELETE policy exists for anyone — immutability by omission.
-- ---------------------------------------------------------------------------
alter table platform.audit_log enable row level security;
alter table platform.audit_log force row level security;

create policy audit_log_select_platform_admin on platform.audit_log
  for select
  using (public.is_platform_admin());

create policy audit_log_select_manager_own_tenant on platform.audit_log
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- jobs.idempotency_keys — service_role only, no client access whatsoever.
-- ---------------------------------------------------------------------------
alter table jobs.idempotency_keys enable row level security;
alter table jobs.idempotency_keys force row level security;
