-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 2: tenancy schema — tenants, plan_catalog, plan_catalog_apps,
--              tenant_provisioning_state, tenant_phone_registry
-- Ref: BACKEND_ARCHITECTURE.md §3.1, §3.1.1, §3.1.2, §3.2, §3.2.1
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type tenancy.tenant_status as enum ('trial', 'active', 'overdue', 'suspended');
create type tenancy.plan_code as enum ('starter', 'growth', 'premium');
create type tenancy.app_code as enum ('dashboard', 'parent', 'teacher', 'reception', 'driver');
create type tenancy.provisioning_step as enum
  ('created', 'initial_manager_created', 'plan_apps_provisioned', 'welcome_sent', 'complete');
create type tenancy.phone_account_type as enum ('staff', 'guardian', 'driver');

-- ---------------------------------------------------------------------------
-- tenancy.plan_catalog  (§3.2) — global reference data, no tenant_id
-- ---------------------------------------------------------------------------
create table tenancy.plan_catalog (
  id            uuid primary key default gen_random_uuid(),
  code          tenancy.plan_code not null unique,
  monthly_price numeric(10,2) not null check (monthly_price >= 0),
  setup_fee     numeric(10,2) not null check (setup_fee >= 0),
  max_children  int null check (max_children is null or max_children > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table tenancy.plan_catalog is 'Global plan tiers (starter/growth/premium). Not tenant-scoped.';

create trigger trg_plan_catalog_updated_at
  before update on tenancy.plan_catalog
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tenancy.plan_catalog_apps  (§3.2.1) — which apps a plan provisions
-- ---------------------------------------------------------------------------
create table tenancy.plan_catalog_apps (
  plan_id  uuid not null references tenancy.plan_catalog(id) on delete cascade,
  app_code tenancy.app_code not null,
  primary key (plan_id, app_code)
);
comment on table tenancy.plan_catalog_apps is
  'Join table (not an array column) so per-app metadata/feature-flags can be added later without a breaking migration.';

-- ---------------------------------------------------------------------------
-- tenancy.tenants  (§3.1)
-- ---------------------------------------------------------------------------
create table tenancy.tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (btrim(name) <> ''),
  slug              text not null,
  city              text null,
  plan_id           uuid not null references tenancy.plan_catalog(id) on delete restrict,
  status            tenancy.tenant_status not null default 'trial',
  contact_name      text null,
  contact_email     text null,
  contact_phone     text null,
  trial_ends_at     timestamptz null,
  suspended_at      timestamptz null,
  suspended_reason  text null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Slug is globally unique, lowercase, DNS-safe (§7, §34) — enforced as a check
-- (format) plus a partial unique index (uniqueness, soft-delete-aware per §8;
-- tenants are never hard-deleted so the partial predicate is trivially true
-- today but keeps the index shape consistent with every other soft-deletable
-- table's uniqueness pattern in this codebase).
alter table tenancy.tenants
  add constraint tenants_slug_format_chk check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$');
create unique index tenants_slug_key on tenancy.tenants (slug);
create index tenants_status_idx on tenancy.tenants (status);

create trigger trg_tenants_updated_at
  before update on tenancy.tenants
  for each row execute function public.set_updated_at();

comment on table tenancy.tenants is 'One row per nursery tenant. Never hard-deleted — status=suspended is the reversible "off" state (§8).';

-- ---------------------------------------------------------------------------
-- tenancy.tenant_provisioning_state  (§3.1.1)
-- ---------------------------------------------------------------------------
create table tenancy.tenant_provisioning_state (
  tenant_id   uuid primary key references tenancy.tenants(id) on delete cascade,
  step        tenancy.provisioning_step not null default 'created',
  last_error  text null,
  updated_at  timestamptz not null default now()
);
comment on table tenancy.tenant_provisioning_state is
  'Resumability state for provision-tenant: lets a retried/failed provisioning call skip steps already completed.';

create trigger trg_tenant_provisioning_state_updated_at
  before update on tenancy.tenant_provisioning_state
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tenancy.tenant_phone_registry  (§3.1.2)
-- The concrete mechanism behind "one phone = one login identity per tenant"
-- across staff_profiles / guardian_profiles / driver_profiles, which live in
-- three separate tables Postgres cannot natively cross-uniquify (§5).
-- ---------------------------------------------------------------------------
create table tenancy.tenant_phone_registry (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenancy.tenants(id) on delete cascade,
  phone         text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  account_type  tenancy.phone_account_type not null,
  account_id    uuid not null,
  created_at    timestamptz not null default now()
);
create unique index tenant_phone_registry_tenant_phone_key
  on tenancy.tenant_phone_registry (tenant_id, phone);
create index tenant_phone_registry_account_idx
  on tenancy.tenant_phone_registry (account_type, account_id);

comment on table tenancy.tenant_phone_registry is
  'This table IS the uniqueness constraint for "one phone per tenant" across staff/guardian/driver profiles — not just a lookup convenience.';
