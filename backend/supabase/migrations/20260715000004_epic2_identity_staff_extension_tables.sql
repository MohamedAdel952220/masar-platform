-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 4: identity schema extension — staff_subjects, staff_leave_records,
--              staff_feedback
-- Ref: BACKEND_ARCHITECTURE.md §3.4, §3.5, §3.6, §33
-- Note: these three tables live in the `identity` schema (owned by the
-- Identity module per §33's module breakdown) even though they ship in
-- Epic 2 per BACKEND_EXECUTION_PLAN.md — this is an ADDITION to that schema,
-- not a modification of any Epic 1 file. Depends on academic.subjects
-- (migration 3), hence sequenced after it.
-- ============================================================================

create type identity.feedback_kind as enum ('complaint', 'commend');
create type identity.feedback_severity as enum ('low', 'medium', 'high');

-- ---------------------------------------------------------------------------
-- identity.staff_subjects  (§3.4) — join table, composite PK, no timestamps
-- (matches the tenancy.plan_catalog_apps precedent from Epic 1 for pure
-- link tables with a natural composite key).
-- ---------------------------------------------------------------------------
create table identity.staff_subjects (
  staff_profile_id    uuid not null references identity.staff_profiles(id) on delete restrict,
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  subject_id          uuid not null references academic.subjects(id) on delete cascade,
  days                text[] not null default '{}',
  sessions_per_week   int not null default 1 check (sessions_per_week > 0),
  primary key (staff_profile_id, subject_id)
);

create index staff_subjects_staff_idx on identity.staff_subjects (staff_profile_id);
create index staff_subjects_tenant_idx on identity.staff_subjects (tenant_id);

comment on table identity.staff_subjects is
  'A teacher''s subject assignments (days/sessions), first exercised with real data in Epic 2 (EPIC_2_ARCHITECTURE_REVIEW.md §4). subject_id''s parent subjects row should agree with this row''s staff_profile_id being the subject''s teacher_staff_id — an application-level consistency expectation, not a DB trigger (§14.2).';

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md H2: verifies staff_profile_id and subject_id both
-- belong to the stated tenant_id. Does NOT enforce the "staff_profile_id
-- should be subjects.teacher_staff_id" expectation noted above — that
-- remains a deliberate application-level convention, not a hard constraint
-- (a school may reasonably want a substitute teacher scheduled here without
-- first reassigning the subject's primary teacher), only the TENANT match
-- is a hard invariant.
-- ---------------------------------------------------------------------------
create or replace function identity.check_staff_subject_tenant()
returns trigger
language plpgsql
as $$
declare
  v_staff_tenant_id    uuid;
  v_subject_tenant_id  uuid;
begin
  select tenant_id into v_staff_tenant_id from identity.staff_profiles where id = new.staff_profile_id;
  select tenant_id into v_subject_tenant_id from academic.subjects where id = new.subject_id;

  if v_staff_tenant_id is null or v_subject_tenant_id is null or v_staff_tenant_id <> new.tenant_id or v_subject_tenant_id <> new.tenant_id then
    raise exception 'staff_profile_id/subject_id/tenant_id are not mutually consistent'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This staff member and subject do not both belong to your tenant.',
              'human_message_ar', 'هذا الموظف والمادة لا ينتميان لنفس المؤسسة.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_staff_subjects_tenant
  before insert or update on identity.staff_subjects
  for each row execute function identity.check_staff_subject_tenant();

-- ---------------------------------------------------------------------------
-- identity.staff_leave_records  (§3.5)
-- tenant_id added per §2.2's no-exception convention even though §3.5's
-- field list doesn't spell it out explicitly.
-- ---------------------------------------------------------------------------
create table identity.staff_leave_records (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  staff_profile_id    uuid not null references identity.staff_profiles(id) on delete restrict,
  from_date           date not null,
  to_date             date not null check (to_date >= from_date),
  reason              text null,
  covering_staff_id   uuid null references identity.staff_profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index staff_leave_records_staff_idx on identity.staff_leave_records (staff_profile_id, from_date desc);
create index staff_leave_records_tenant_idx on identity.staff_leave_records (tenant_id);

create trigger trg_staff_leave_records_updated_at
  before update on identity.staff_leave_records
  for each row execute function public.set_updated_at();

-- Fix for EPIC_2_REVIEW.md H2: verifies staff_profile_id AND, when set,
-- covering_staff_id both belong to the stated tenant — closing the specific
-- gap the review named for this table (a covering teacher from a different
-- tenant was previously not rejected by anything).
create or replace function identity.check_staff_leave_record_tenant()
returns trigger
language plpgsql
as $$
declare
  v_staff_tenant_id     uuid;
  v_covering_tenant_id  uuid;
begin
  select tenant_id into v_staff_tenant_id from identity.staff_profiles where id = new.staff_profile_id;
  if v_staff_tenant_id is null or v_staff_tenant_id <> new.tenant_id then
    raise exception 'staff_profile_id does not belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This staff member does not belong to your tenant.', 'human_message_ar', 'هذا الموظف لا ينتمي إلى مؤسستك.')::text;
  end if;

  if new.covering_staff_id is not null then
    select tenant_id into v_covering_tenant_id from identity.staff_profiles where id = new.covering_staff_id;
    if v_covering_tenant_id is null or v_covering_tenant_id <> new.tenant_id then
      raise exception 'covering_staff_id does not belong to the stated tenant'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The covering staff member does not belong to your tenant.', 'human_message_ar', 'الموظف البديل لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_staff_leave_records_tenant
  before insert or update of staff_profile_id, covering_staff_id, tenant_id on identity.staff_leave_records
  for each row execute function identity.check_staff_leave_record_tenant();

-- ---------------------------------------------------------------------------
-- identity.staff_feedback  (§3.6) — complaints/commends, unified.
-- tenant_id added per §2.2, same reasoning as staff_leave_records above.
-- ---------------------------------------------------------------------------
create table identity.staff_feedback (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenancy.tenants(id) on delete restrict,
  staff_profile_id  uuid not null references identity.staff_profiles(id) on delete restrict,
  kind              identity.feedback_kind not null,
  from_name         text not null check (btrim(from_name) <> ''),
  subject           text null,
  body              text not null check (btrim(body) <> ''),
  severity          identity.feedback_severity null,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index staff_feedback_staff_idx on identity.staff_feedback (staff_profile_id, occurred_at desc);
create index staff_feedback_tenant_idx on identity.staff_feedback (tenant_id);

create trigger trg_staff_feedback_updated_at
  before update on identity.staff_feedback
  for each row execute function public.set_updated_at();

-- Fix for EPIC_2_REVIEW.md H2.
create or replace function identity.check_staff_feedback_tenant()
returns trigger
language plpgsql
as $$
declare
  v_staff_tenant_id uuid;
begin
  select tenant_id into v_staff_tenant_id from identity.staff_profiles where id = new.staff_profile_id;
  if v_staff_tenant_id is null or v_staff_tenant_id <> new.tenant_id then
    raise exception 'staff_profile_id does not belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This staff member does not belong to your tenant.', 'human_message_ar', 'هذا الموظف لا ينتمي إلى مؤسستك.')::text;
  end if;
  return new;
end;
$$;

create trigger trg_staff_feedback_tenant
  before insert or update of staff_profile_id, tenant_id on identity.staff_feedback
  for each row execute function identity.check_staff_feedback_tenant();

comment on column identity.staff_feedback.severity is
  'low/medium/high — deliberately independent from academic.concerns.priority (info/attention/urgent, migration 3). A staff performance signal, not a child-welfare signal (EPIC_2_ARCHITECTURE_REVIEW.md §14.6).';

comment on table identity.staff_feedback is
  'staff_profiles.rating (Epic 1 column) is computed from this table by a weekly scheduled job that ships with Epic 10''s jobs infrastructure — Epic 2 populates the raw feedback rows the job will later consume (EPIC_2_ARCHITECTURE_REVIEW.md §12).';
