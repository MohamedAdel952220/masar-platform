-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 5: RLS helper functions (SECURITY DEFINER)
-- Ref: BACKEND_ARCHITECTURE.md §13.1, §12.1
--
-- These exist so every RLS policy in the system is a short, testable
-- equality check against a function call, never inline JWT-parsing logic
-- repeated per policy (§13.1).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- current_tenant_id() — the JWT's own tenant claim. NEVER derived from client
-- input (§13.2); this is the only source of truth for "which tenant is this
-- request scoped to" once authenticated.
-- ---------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

comment on function public.current_tenant_id() is
  'Tenant claim from the caller''s own JWT app_metadata. Never client-suppliable (§13.2).';

-- ---------------------------------------------------------------------------
-- current_role() — one of guardian|teacher|reception|manager|driver|platform_admin
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role';
$$;

comment on function public.current_role() is 'RBAC role claim from the caller''s JWT app_metadata (§11.1).';

-- ---------------------------------------------------------------------------
-- current_platform_admin_tier() — owner|admin|support, read from the table
-- itself (not the JWT) since it's the least-frequently-changing, highest-
-- privilege claim in the system and the extra lookup is cheap at this volume
-- (§12.1).
-- ---------------------------------------------------------------------------
create or replace function public.current_platform_admin_tier()
returns identity.platform_admin_tier
language sql
stable
security definer
set search_path = public
as $$
  select role
  from identity.platform_admins
  where id = auth.uid()
    and deleted_at is null;
$$;

comment on function public.current_platform_admin_tier() is
  'owner/admin/support tier for the caller if they are a platform admin, else NULL (§12.1).';

-- ---------------------------------------------------------------------------
-- is_platform_admin() / is_manager_of_own_tenant() — small readability
-- helpers used repeatedly across policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'platform_admin';
$$;

create or replace function public.is_platform_admin_manager_tier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_platform_admin_tier() in ('owner', 'admin');
$$;

comment on function public.is_platform_admin_manager_tier() is
  'True only for owner/admin tiers — the "canManage" boundary that support-tier accounts must never cross (§12.1, §28).';
