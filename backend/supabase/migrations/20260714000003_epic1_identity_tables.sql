-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 3: identity schema — staff_profiles, guardian_profiles,
--              driver_profiles, platform_admins, service_accounts
-- Ref: BACKEND_ARCHITECTURE.md §3.3, §3.7, §3.8, §3.9, §3.9.1
-- Note: staff_subjects / staff_leave_records / staff_feedback belong to
--       Epic 2 (Core Academic Data) per BACKEND_EXECUTION_PLAN.md and are
--       intentionally NOT created by this migration.
-- ============================================================================

create type identity.staff_role as enum ('manager', 'teacher', 'reception');
create type identity.employment_status as enum ('active', 'on_leave', 'terminated');
create type identity.language as enum ('en', 'ar');
create type identity.platform_admin_tier as enum ('owner', 'admin', 'support');
create type identity.service_account_purpose as enum ('camera_agent', 'integration_other');
create type identity.service_account_status as enum ('active', 'revoked');

-- ---------------------------------------------------------------------------
-- identity.staff_profiles  (§3.3)
-- id == auth.users.id (1:1) — see §7 UUID Strategy / §10 Authentication.
-- ---------------------------------------------------------------------------
create table identity.staff_profiles (
  id                    uuid primary key references auth.users(id) on delete restrict,
  tenant_id             uuid not null references tenancy.tenants(id) on delete restrict,
  role                  identity.staff_role not null,
  name                  text not null check (btrim(name) <> ''),
  name_ar               text null,
  phone                 text not null,
  email                 text null,
  photo_object_id       uuid null,               -- FK to media.storage_objects, added when that schema exists (Epic 6/2)
  national_id           text null,
  preferred_language    identity.language not null default 'ar',
  join_date             date not null default current_date,
  employment_status     identity.employment_status not null default 'active',
  primary_classroom_id  uuid null,                -- FK to academic.classrooms, added in Epic 2
  rating                numeric(2,1) null check (rating is null or (rating >= 0 and rating <= 5)),
  created_by            uuid null references identity.staff_profiles(id),
  deleted_at            timestamptz null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- §2.2: tenant_id indexed on every tenant-scoped table (RLS baseline).
create index staff_profiles_tenant_idx on identity.staff_profiles (tenant_id) where deleted_at is null;
create unique index staff_profiles_tenant_phone_key on identity.staff_profiles (tenant_id, phone) where deleted_at is null;
create index staff_profiles_role_idx on identity.staff_profiles (tenant_id, role) where deleted_at is null;

create trigger trg_staff_profiles_updated_at
  before update on identity.staff_profiles
  for each row execute function public.set_updated_at();

comment on table identity.staff_profiles is
  'Manager/teacher/reception accounts. id is shared 1:1 with auth.users.id so RLS can join on auth.uid() with zero indirection (§7).';

-- ---------------------------------------------------------------------------
-- identity.guardian_profiles  (§3.7) — schema only in Epic 1, first rows in Epic 2
-- ---------------------------------------------------------------------------
create table identity.guardian_profiles (
  id                  uuid primary key references auth.users(id) on delete restrict,
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  name                text not null check (btrim(name) <> ''),
  name_ar             text null,
  phone               text not null,
  email               text null,
  photo_object_id     uuid null,
  national_id         text null,
  preferred_language  identity.language not null default 'ar',
  created_by          uuid null references identity.staff_profiles(id),
  deleted_at          timestamptz null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index guardian_profiles_tenant_idx on identity.guardian_profiles (tenant_id) where deleted_at is null;
create unique index guardian_profiles_tenant_phone_key on identity.guardian_profiles (tenant_id, phone) where deleted_at is null;

create trigger trg_guardian_profiles_updated_at
  before update on identity.guardian_profiles
  for each row execute function public.set_updated_at();

comment on table identity.guardian_profiles is
  'Parent/guardian accounts. A guardian belongs to exactly one tenant in v1 (§3.7). Populated starting Epic 2 (child enrollment).';

-- ---------------------------------------------------------------------------
-- identity.driver_profiles  (§3.8) — schema only in Epic 1, first rows in Epic 3
-- ---------------------------------------------------------------------------
create table identity.driver_profiles (
  id                  uuid primary key references auth.users(id) on delete restrict,
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  bus_id              uuid null,                 -- FK to transport.buses, added in Epic 3
  name                text not null check (btrim(name) <> ''),
  name_ar             text null,
  phone               text not null,
  photo_object_id     uuid null,
  national_id         text null,
  preferred_language  identity.language not null default 'ar',
  created_by          uuid null references identity.staff_profiles(id),
  deleted_at          timestamptz null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index driver_profiles_tenant_idx on identity.driver_profiles (tenant_id) where deleted_at is null;
create unique index driver_profiles_tenant_phone_key on identity.driver_profiles (tenant_id, phone) where deleted_at is null;

create trigger trg_driver_profiles_updated_at
  before update on identity.driver_profiles
  for each row execute function public.set_updated_at();

comment on table identity.driver_profiles is 'Bus driver accounts. Populated starting Epic 3 (bus/fleet management).';

-- ---------------------------------------------------------------------------
-- identity.platform_admins  (§3.9) — no tenant_id, operates above tenancy
-- ---------------------------------------------------------------------------
create table identity.platform_admins (
  id          uuid primary key references auth.users(id) on delete restrict,
  name        text not null check (btrim(name) <> ''),
  email       text not null,
  role        identity.platform_admin_tier not null default 'support',
  deleted_at  timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index platform_admins_email_key on identity.platform_admins (email) where deleted_at is null;
create index platform_admins_role_idx on identity.platform_admins (role) where deleted_at is null;

create trigger trg_platform_admins_updated_at
  before update on identity.platform_admins
  for each row execute function public.set_updated_at();

comment on table identity.platform_admins is
  'Masar operator accounts. role is a permission tier (owner/admin/support, §12.1), never self-registered.';

-- ---------------------------------------------------------------------------
-- identity.service_accounts  (§3.9.1) — schema only in Epic 1, first rows in Epic 7
-- Machine-to-machine identity: API-key authenticated, NOT an auth.users row.
-- ---------------------------------------------------------------------------
create table identity.service_accounts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid null references tenancy.tenants(id) on delete restrict,  -- null = platform-global
  name          text not null check (btrim(name) <> ''),
  purpose       identity.service_account_purpose not null,
  api_key_hash  text not null,                    -- sha-256 hash; raw key shown exactly once at issuance
  scopes        text[] not null default '{}',
  status        identity.service_account_status not null default 'active',
  issued_by     uuid null,                         -- staff_profiles.id or platform_admins.id (no single-table FK possible)
  issued_at     timestamptz not null default now(),
  revoked_at    timestamptz null,
  last_used_at  timestamptz null
);

create index service_accounts_tenant_idx on identity.service_accounts (tenant_id) where status = 'active';
create index service_accounts_status_idx on identity.service_accounts (status);

comment on table identity.service_accounts is
  'Machine identities (e.g. camera relay agents, §10.7). Never receives a Supabase Auth JWT — authorized via API-key + Edge Function scope check, not RLS (§13.7).';
