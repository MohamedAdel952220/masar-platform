-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 2: classrooms, children, child_guardian_links
-- Ref: BACKEND_ARCHITECTURE.md §3.10, §3.11, §3.13, §4, §5, §6, §8
--      EPIC_2_ARCHITECTURE_REVIEW.md §2, §3, §14.1
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type academic.grade_level as enum ('pre_kg', 'kg1', 'kg2', 'nursery');
create type academic.gender as enum ('male', 'female');
create type academic.package_type as enum ('full_day', 'half_day');
create type academic.membership_status as enum ('active', 'overdue', 'suspended');
create type academic.day_path_status as enum ('at_home', 'in_bus', 'classroom', 'playing', 'nap', 'delivered');
create type academic.guardian_relation as enum ('father', 'mother', 'guardian');

-- ---------------------------------------------------------------------------
-- academic.classrooms  (§3.10)
-- ---------------------------------------------------------------------------
create table academic.classrooms (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenancy.tenants(id) on delete restrict,
  name                  text not null check (btrim(name) <> ''),
  grade                 academic.grade_level not null,
  age_min_months        int not null check (age_min_months >= 0),
  age_max_months        int not null check (age_max_months >= age_min_months),
  coordinator_staff_id  uuid null references identity.staff_profiles(id) on delete restrict,
  capacity              int not null check (capacity > 0),
  color_tag             text null,
  deleted_at            timestamptz null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- §2.2 / §6: tenant_id indexed on every tenant-scoped table (RLS baseline).
create index classrooms_tenant_idx on academic.classrooms (tenant_id) where deleted_at is null;
create index classrooms_coordinator_idx on academic.classrooms (coordinator_staff_id) where deleted_at is null;
create index classrooms_search_idx on academic.classrooms using gin (to_tsvector('simple', name));

create trigger trg_classrooms_updated_at
  before update on academic.classrooms
  for each row execute function public.set_updated_at();

comment on table academic.classrooms is
  'Nursery classrooms/rooms. children.classroom_id references this table with ON DELETE RESTRICT — a room must be re-emptied before it can be soft-deleted (§4).';

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md H2: no cross-table tenant-consistency enforcement
-- existed anywhere in the schema. This trigger ensures coordinator_staff_id,
-- when set, actually belongs to the same tenant as the classroom — enforced
-- at the DB layer regardless of insert/update path (RPC, Edge Function, or
-- direct PostgREST access), unlike RLS's WITH CHECK which only ever verified
-- the row's OWN tenant_id.
-- ---------------------------------------------------------------------------
create or replace function academic.check_classroom_coordinator_tenant()
returns trigger
language plpgsql
as $$
declare
  v_staff_tenant_id uuid;
begin
  if new.coordinator_staff_id is null then
    return new;
  end if;

  select tenant_id into v_staff_tenant_id from identity.staff_profiles where id = new.coordinator_staff_id;

  if v_staff_tenant_id is null or v_staff_tenant_id <> new.tenant_id then
    raise exception 'coordinator_staff_id does not belong to the same tenant as this classroom'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'The selected coordinator does not belong to your tenant.',
              'human_message_ar', 'المنسّق المحدد لا ينتمي إلى مؤسستك.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_classrooms_coordinator_tenant
  before insert or update of coordinator_staff_id, tenant_id on academic.classrooms
  for each row execute function academic.check_classroom_coordinator_tenant();

comment on function academic.check_classroom_coordinator_tenant() is
  'Fixes EPIC_2_REVIEW.md H2 for classrooms.coordinator_staff_id — DB-level backstop independent of RLS.';

-- ---------------------------------------------------------------------------
-- Additive extension of an Epic 1 table: identity.staff_profiles carries a
-- `primary_classroom_id uuid null` column since Epic 1 (see that migration's
-- comment: "FK to academic.classrooms, added in Epic 2"). Now that
-- academic.classrooms exists, this migration adds ONLY the foreign-key
-- constraint on that already-existing, already-nullable column — the column
-- itself is untouched, no Epic 1 file is edited, and no data can be broken
-- by this change (it is a pure additive constraint on a column that has
-- carried no non-null values before this Epic populates classrooms).
-- ---------------------------------------------------------------------------
alter table identity.staff_profiles
  add constraint staff_profiles_primary_classroom_id_fkey
  foreign key (primary_classroom_id) references academic.classrooms(id) on delete set null;

-- ---------------------------------------------------------------------------
-- academic.children  (§3.11) — the widest table in the system.
-- created_by is included per the general §2.2 convention (every table has a
-- nullable created_by for audit reconstruction, except pure event-stream
-- tables — children is not one) even though §3.11's field table does not
-- explicitly list it, consistent with staff_profiles/guardian_profiles
-- already carrying created_by in Epic 1.
-- ---------------------------------------------------------------------------
create table academic.children (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references tenancy.tenants(id) on delete restrict,
  name                      text not null check (btrim(name) <> ''),
  name_ar                   text null,
  dob                       date not null check (dob < current_date),
  gender                    academic.gender not null,
  blood_type                text null,
  allergies                 text null,
  notes                     text null,
  photo_object_id           uuid null,               -- FK to media.storage_objects, added when that schema exists (Epic 6)
  classroom_id              uuid not null references academic.classrooms(id) on delete restrict,
  package                   academic.package_type not null,
  membership_status         academic.membership_status not null default 'active',
  day_path_status           academic.day_path_status not null default 'at_home',
  address_line              text null,
  building                  text null,
  area                      text null,
  city                      text null,
  address_lat               numeric(9,6) null,
  address_lng               numeric(9,6) null,
  emergency_contact_name    text null,
  emergency_contact_phone   text null,
  emergency_contact_relation text null,
  father_name               text null,
  father_phone              text null,
  father_job                text null,
  father_national_id        text null,
  mother_name               text null,
  mother_phone               text null,
  mother_job                text null,
  mother_national_id        text null,
  enrolled_at               date not null default current_date,
  created_by                uuid null references identity.staff_profiles(id),
  deleted_at                timestamptz null,          -- soft-delete = withdrawal (§8)
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index children_tenant_idx on academic.children (tenant_id) where deleted_at is null;
create index children_classroom_idx on academic.children (tenant_id, classroom_id) where deleted_at is null;
create index children_membership_status_idx on academic.children (tenant_id, membership_status) where deleted_at is null;
create index children_search_idx on academic.children using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(name_ar, '')));

create trigger trg_children_updated_at
  before update on academic.children
  for each row execute function public.set_updated_at();

comment on table academic.children is
  'One row per enrolled child. day_path_status is intentionally a live column (not purely derived) — see day_path_events (migration 3) and §29 for the hybrid strategy.';

comment on column academic.children.membership_status is
  'Drives future billing gating (Epic 5). Toggled by suspend_child/reactivate_child (migration 7) — Epic 2 owns the column and its transitions; Epic 5 is simply its first real consumer.';

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md M6: no DB-level format/range validation existed
-- on children's free-text contact/geo fields. Ranges match the Zod schema
-- (src/validation/academic.schema.ts) exactly; phone check is deliberately
-- loose (these are informational contact fields, not login identities —
-- unlike tenant_phone_registry.phone, which keeps its strict E.164 check)
-- so real-world messy entries aren't rejected, while outright garbage is.
-- ---------------------------------------------------------------------------
alter table academic.children
  add constraint children_address_lat_range_chk check (address_lat is null or address_lat between -90 and 90),
  add constraint children_address_lng_range_chk check (address_lng is null or address_lng between -180 and 180),
  add constraint children_father_phone_format_chk check (father_phone is null or father_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  add constraint children_mother_phone_format_chk check (mother_phone is null or mother_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  add constraint children_emergency_contact_phone_format_chk check (emergency_contact_phone is null or emergency_contact_phone ~ '^\+?[0-9 ()-]{6,20}$');

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md C1: RLS's WITH CHECK only ever validated a row's
-- OWN tenant_id, never that classroom_id belonged to that same tenant, and
-- the capacity lock (§2.2/§5) only existed inside enroll_child_row — meaning
-- a direct INSERT/UPDATE via PostgREST (bypassing the RPC entirely) could
-- both inject a cross-tenant classroom_id AND overbook a classroom with no
-- capacity check at all. This trigger enforces both invariants at the DB
-- layer, for EVERY insert/update path, closing the gap the RPC-only capacity
-- check left open. Column-scoped (`of classroom_id, tenant_id`) so routine
-- attribute updates (name/notes/membership_status) never pay this cost or
-- risk lock contention.
-- ---------------------------------------------------------------------------
create or replace function academic.check_children_classroom_consistency()
returns trigger
language plpgsql
as $$
declare
  v_classroom_tenant_id  uuid;
  v_capacity              int;
  v_current_count         int;
begin
  select tenant_id, capacity into v_classroom_tenant_id, v_capacity
  from academic.classrooms
  where id = new.classroom_id and deleted_at is null
  for update;

  if v_classroom_tenant_id is null then
    raise exception 'Classroom not found or has been withdrawn'
      using errcode = 'P0002',
            detail = json_build_object(
              'code', 'NOT_FOUND',
              'human_message_en', 'Classroom not found.',
              'human_message_ar', 'لم يتم العثور على الفصل.'
            )::text;
  end if;

  if v_classroom_tenant_id <> new.tenant_id then
    raise exception 'classroom_id does not belong to the same tenant as this child'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This classroom does not belong to your tenant.',
              'human_message_ar', 'هذا الفصل لا ينتمي إلى مؤسستك.'
            )::text;
  end if;

  -- Capacity only re-checked when the child is newly entering this classroom
  -- (INSERT, or an UPDATE that actually changes classroom_id) — moving a
  -- child OUT is never blocked, and attribute-only updates never re-count.
  if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and new.classroom_id is distinct from old.classroom_id) then
    select count(*) into v_current_count
    from academic.children
    where classroom_id = new.classroom_id and deleted_at is null and id <> new.id;

    if v_current_count >= v_capacity then
      raise exception 'Classroom is at full capacity'
        using errcode = 'P0001',
              detail = json_build_object(
                'code', 'VALIDATION_FAILED',
                'human_message_en', 'This classroom is at full capacity.',
                'human_message_ar', 'هذا الفصل ممتلئ بالكامل.'
              )::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_children_classroom_consistency
  before insert or update of classroom_id, tenant_id on academic.children
  for each row execute function academic.check_children_classroom_consistency();

comment on function academic.check_children_classroom_consistency() is
  'Fixes EPIC_2_REVIEW.md C1 — moves the capacity lock and tenant-consistency check from "RPC-only convenience" to a DB-enforced invariant that holds regardless of write path. enroll_child_row (migration 7) still performs its own check first for a clean error message; this trigger is the backstop that makes the guarantee real.';

-- ---------------------------------------------------------------------------
-- academic.child_guardian_links  (§3.13) — many-to-many, composite PK.
-- No created_at/updated_at columns, matching this codebase's established
-- precedent for pure link/join tables with a composite primary key
-- (tenancy.plan_catalog_apps, Epic 1) — a link row's existence IS its fact,
-- there is nothing to timestamp beyond "does this row exist."
-- ---------------------------------------------------------------------------
create table academic.child_guardian_links (
  child_id            uuid not null references academic.children(id) on delete cascade,
  guardian_id         uuid not null references identity.guardian_profiles(id) on delete cascade,
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  relation            academic.guardian_relation not null,
  is_primary_contact  boolean not null default false,
  primary key (child_id, guardian_id)
);

-- §3.13: indexed on guardian_id alone since "list this guardian's children"
-- is the single hottest access path on this table (Parent App multi-child
-- switcher, current_guardian_child_ids() RLS helper, migration 5).
create index child_guardian_links_guardian_idx on academic.child_guardian_links (guardian_id);
create index child_guardian_links_tenant_idx on academic.child_guardian_links (tenant_id);

comment on table academic.child_guardian_links is
  'Many-to-many child<->guardian. tenant_id is denormalized per §2.2''s zero-exception convention even though it is derivable via either parent.';

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md M5/H2: link_child_guardian (migration 7) trusted
-- its caller entirely, with no verification that child_id/guardian_id
-- actually belonged to the stated tenant. This trigger makes that guarantee
-- hold at the DB layer for every insert/update path (the RPC, or any future
-- direct access), independent of caller discipline.
-- ---------------------------------------------------------------------------
create or replace function academic.check_child_guardian_link_tenant()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id     uuid;
  v_guardian_tenant_id  uuid;
begin
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id;
  select tenant_id into v_guardian_tenant_id from identity.guardian_profiles where id = new.guardian_id;

  if v_child_tenant_id is null or v_guardian_tenant_id is null
     or v_child_tenant_id <> new.tenant_id or v_guardian_tenant_id <> new.tenant_id then
    raise exception 'child_id/guardian_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child and guardian do not both belong to your tenant.',
              'human_message_ar', 'هذا الطفل وولي الأمر لا ينتميان لنفس المؤسسة.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_child_guardian_links_tenant
  before insert or update on academic.child_guardian_links
  for each row execute function academic.check_child_guardian_link_tenant();

comment on function academic.check_child_guardian_link_tenant() is
  'Fixes EPIC_2_REVIEW.md M5/H2 — DB-level backstop for link_child_guardian and enroll_child_with_guardian (migration 7), independent of caller correctness.';
