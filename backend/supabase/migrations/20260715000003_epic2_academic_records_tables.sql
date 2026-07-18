-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 3: day_path_events, attendance_records, subjects, lessons,
--              evaluations, concerns
-- Ref: BACKEND_ARCHITECTURE.md §3.12, §3.14-3.18, §4, §5, §6
--      EPIC_2_ARCHITECTURE_REVIEW.md §14.1, §14.5, §14.6
-- ============================================================================

create type academic.day_path_source as enum ('driver', 'teacher', 'reception', 'system');
create type academic.homework_status as enum ('done', 'partial', 'none');
create type academic.concern_category as enum ('academic', 'behavior', 'social', 'health');
create type academic.concern_priority as enum ('info', 'attention', 'urgent');
create type academic.concern_status as enum ('open', 'acknowledged', 'resolved');

-- ---------------------------------------------------------------------------
-- academic.day_path_events  (§3.12) — append-only history behind
-- children.day_path_status. The `driver` source value exists from day one
-- even though nothing writes it until Epic 3's bus/trip actions exist
-- (EPIC_2_ARCHITECTURE_REVIEW.md §8) — this avoids an enum-altering
-- migration later.
-- ---------------------------------------------------------------------------
-- classroom_id added per EPIC_2_REVIEW.md H3: without it, every teacher-
-- scoping RLS policy on this table was forced into a subquery joining
-- through `children` rather than a direct indexed equality, contradicting
-- §13.1's explicit "single equality check, never a subquery" invariant. No
-- rows exist yet in this unshipped table, so the column is added NOT NULL
-- directly rather than as a nullable-then-backfilled column.
create table academic.day_path_events (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references academic.children(id) on delete cascade,
  classroom_id  uuid not null references academic.classrooms(id) on delete restrict,
  tenant_id     uuid not null references tenancy.tenants(id) on delete restrict,
  status        academic.day_path_status not null,
  source        academic.day_path_source not null,
  actor_id      uuid null,   -- staff_profiles.id, driver_profiles.id, or null for source='system'
  occurred_at   timestamptz not null default now()
);

create index day_path_events_child_idx on academic.day_path_events (child_id, occurred_at desc);
create index day_path_events_classroom_idx on academic.day_path_events (classroom_id, occurred_at desc);
create index day_path_events_tenant_idx on academic.day_path_events (tenant_id, occurred_at desc);

comment on table academic.day_path_events is
  'Append-only audit trail behind children.day_path_status (hybrid current-state + history pattern, §29). Never updated or deleted.';

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md H2: verifies child_id/classroom_id/tenant_id are
-- mutually consistent on every insert (this table is append-only — no
-- UPDATE path exists or is granted to any role, migration 6 — so the
-- trigger only needs to fire BEFORE INSERT).
-- ---------------------------------------------------------------------------
create or replace function academic.check_day_path_event_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id      uuid;
  v_child_classroom_id   uuid;
begin
  select tenant_id, classroom_id into v_child_tenant_id, v_child_classroom_id
  from academic.children
  where id = new.child_id and deleted_at is null;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_child_tenant_id <> new.tenant_id or v_child_classroom_id <> new.classroom_id then
    raise exception 'child_id/classroom_id/tenant_id are not mutually consistent for this day-path event'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child, classroom, and tenant do not match.',
              'human_message_ar', 'الطفل والفصل والمؤسسة غير متطابقين.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_day_path_events_consistency
  before insert on academic.day_path_events
  for each row execute function academic.check_day_path_event_consistency();

-- ---------------------------------------------------------------------------
-- academic.attendance_records  (§3.14)
-- EPIC_2_ARCHITECTURE_REVIEW.md §14.1: kept at daily (child_id, date) grain
-- per the schema's existing design — the live Attendance screen's
-- per-subject "attended" list is derived from lessons/evaluations existing
-- for that child/day, not a separately stored fact (option (a) in the review).
-- ---------------------------------------------------------------------------
create table academic.attendance_records (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenancy.tenants(id) on delete restrict,
  child_id         uuid not null references academic.children(id) on delete restrict,
  classroom_id     uuid not null references academic.classrooms(id) on delete restrict,
  date             date not null,
  present          boolean not null,
  marked_by        uuid not null references identity.staff_profiles(id),
  notified_parent  boolean not null default false,
  notified_at      timestamptz null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index attendance_records_child_date_key on academic.attendance_records (child_id, date);
create index attendance_records_classroom_date_idx on academic.attendance_records (classroom_id, date);
create index attendance_records_tenant_idx on academic.attendance_records (tenant_id);
-- Fix for EPIC_2_REVIEW.md L5: "own raised/marked records" lookups had no
-- dedicated index beyond the composite ones above.
create index attendance_records_marked_by_idx on academic.attendance_records (marked_by);

create trigger trg_attendance_records_updated_at
  before update on academic.attendance_records
  for each row execute function public.set_updated_at();

comment on table academic.attendance_records is
  'One present/absent fact per child per day. Unique (child_id, date) makes mark_attendance (migration 7) a natural upsert.';

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md C2/H2: mark_attendance (migration 7) inserted a
-- record for any child_id supplied in its records array with no check that
-- the child belonged to the target classroom or even the caller's tenant —
-- and, per C1, RLS's WITH CHECK never verified this either, so a direct
-- table INSERT/UPDATE had the same hole. This trigger closes both paths at
-- once: child_id, classroom_id, and tenant_id must always be mutually
-- consistent, regardless of who/what is writing the row.
-- ---------------------------------------------------------------------------
create or replace function academic.check_attendance_record_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id     uuid;
  v_child_classroom_id  uuid;
  v_marker_tenant_id    uuid;
begin
  select tenant_id, classroom_id into v_child_tenant_id, v_child_classroom_id
  from academic.children
  where id = new.child_id and deleted_at is null;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  select tenant_id into v_marker_tenant_id from identity.staff_profiles where id = new.marked_by;

  if v_child_tenant_id <> new.tenant_id or v_child_classroom_id <> new.classroom_id
     or v_marker_tenant_id is null or v_marker_tenant_id <> new.tenant_id then
    raise exception 'child_id/classroom_id/marked_by/tenant_id are not mutually consistent for this attendance record'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child is not enrolled in the specified classroom/tenant.',
              'human_message_ar', 'هذا الطفل غير مسجّل في هذا الفصل/المؤسسة.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_attendance_records_consistency
  before insert or update of child_id, classroom_id, tenant_id, marked_by on academic.attendance_records
  for each row execute function academic.check_attendance_record_consistency();

-- ---------------------------------------------------------------------------
-- academic.subjects  (§3.15)
-- ---------------------------------------------------------------------------
create table academic.subjects (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenancy.tenants(id) on delete restrict,
  classroom_id      uuid not null references academic.classrooms(id) on delete restrict,
  name              text not null check (btrim(name) <> ''),
  teacher_staff_id  uuid null references identity.staff_profiles(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index subjects_tenant_idx on academic.subjects (tenant_id);
create index subjects_classroom_idx on academic.subjects (classroom_id);
create index subjects_teacher_idx on academic.subjects (teacher_staff_id);

create trigger trg_subjects_updated_at
  before update on academic.subjects
  for each row execute function public.set_updated_at();

-- Fix for EPIC_2_REVIEW.md H2 — same pattern as classrooms.coordinator_staff_id.
create or replace function academic.check_subject_teacher_tenant()
returns trigger
language plpgsql
as $$
declare
  v_staff_tenant_id uuid;
begin
  if new.teacher_staff_id is null then
    return new;
  end if;

  select tenant_id into v_staff_tenant_id from identity.staff_profiles where id = new.teacher_staff_id;

  if v_staff_tenant_id is null or v_staff_tenant_id <> new.tenant_id then
    raise exception 'teacher_staff_id does not belong to the same tenant as this subject'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'The selected teacher does not belong to your tenant.',
              'human_message_ar', 'المعلّم المحدد لا ينتمي إلى مؤسستك.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_subjects_teacher_tenant
  before insert or update of teacher_staff_id, tenant_id on academic.subjects
  for each row execute function academic.check_subject_teacher_tenant();

comment on table academic.subjects is
  'One row per subject taught in a classroom. teacher_staff_id is the authoritative "who currently teaches this subject" (EPIC_2_ARCHITECTURE_REVIEW.md §14.2) — identity.staff_subjects (migration 4) is the richer per-teacher scheduling record (days/sessions) and is expected to stay consistent with this column at the application layer.';

-- ---------------------------------------------------------------------------
-- academic.lessons  (§3.16)
-- ---------------------------------------------------------------------------
create table academic.lessons (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenancy.tenants(id) on delete restrict,
  subject_id    uuid not null references academic.subjects(id) on delete cascade,
  classroom_id  uuid not null references academic.classrooms(id) on delete restrict,
  date          date not null,
  title_en      text not null check (btrim(title_en) <> ''),
  title_ar      text null,
  covered_en    text null,
  covered_ar    text null,
  objective_en  text null,
  objective_ar  text null,
  created_by    uuid not null references identity.staff_profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index lessons_subject_date_key on academic.lessons (subject_id, date);
create index lessons_classroom_date_idx on academic.lessons (classroom_id, date desc);
create index lessons_tenant_idx on academic.lessons (tenant_id);

create trigger trg_lessons_updated_at
  before update on academic.lessons
  for each row execute function public.set_updated_at();

-- Fix for EPIC_2_REVIEW.md H2: verifies created_by belongs to the same
-- tenant, AND that subject_id's own classroom_id agrees with this lesson's
-- classroom_id (a lesson can't be filed under a subject taught in a
-- different room) — a business-consistency rule that previously existed
-- only implicitly (nowhere, in fact; lessons had no cross-check at all).
create or replace function academic.check_lesson_consistency()
returns trigger
language plpgsql
as $$
declare
  v_creator_tenant_id     uuid;
  v_subject_tenant_id     uuid;
  v_subject_classroom_id  uuid;
begin
  select tenant_id into v_creator_tenant_id from identity.staff_profiles where id = new.created_by;
  if v_creator_tenant_id is null or v_creator_tenant_id <> new.tenant_id then
    raise exception 'created_by does not belong to the same tenant as this lesson'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The lesson author does not belong to your tenant.', 'human_message_ar', 'كاتب الدرس لا ينتمي إلى مؤسستك.')::text;
  end if;

  select tenant_id, classroom_id into v_subject_tenant_id, v_subject_classroom_id from academic.subjects where id = new.subject_id;
  if v_subject_tenant_id is null or v_subject_tenant_id <> new.tenant_id or v_subject_classroom_id <> new.classroom_id then
    raise exception 'subject_id/classroom_id/tenant_id are not mutually consistent for this lesson'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This subject does not belong to the specified classroom/tenant.', 'human_message_ar', 'هذه المادة لا تنتمي إلى هذا الفصل/المؤسسة.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_lessons_consistency
  before insert or update of subject_id, classroom_id, tenant_id, created_by on academic.lessons
  for each row execute function academic.check_lesson_consistency();

-- ---------------------------------------------------------------------------
-- academic.evaluations  (§3.17)
-- EPIC_2_ARCHITECTURE_REVIEW.md §14.5: unique (child_id, lesson_id) makes
-- submit_evaluation a natural upsert — one evaluation per child per lesson,
-- exempt from the mandatory idempotency-key convention (§14.3's own
-- "register_device_token"-style exception) and closing a data-integrity gap
-- where a double-tap could otherwise create duplicate evaluation rows.
-- ---------------------------------------------------------------------------
-- classroom_id added per EPIC_2_REVIEW.md H3 — same reasoning as
-- day_path_events above: without it, every teacher-scoping RLS policy had
-- to join through `children` rather than use a direct indexed equality.
create table academic.evaluations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  child_id           uuid not null references academic.children(id) on delete restrict,
  lesson_id          uuid not null references academic.lessons(id) on delete restrict,
  classroom_id       uuid not null references academic.classrooms(id) on delete restrict,
  understanding      smallint not null check (understanding between 1 and 5),
  participation      smallint not null check (participation between 1 and 5),
  behavior           smallint not null check (behavior between 1 and 5),
  homework           academic.homework_status not null,
  note               text null,
  note_ai_polished   boolean not null default false,
  created_by         uuid not null references identity.staff_profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index evaluations_child_lesson_key on academic.evaluations (child_id, lesson_id);
create index evaluations_child_idx on academic.evaluations (child_id, created_at desc);
create index evaluations_classroom_idx on academic.evaluations (classroom_id, created_at desc);
create index evaluations_tenant_idx on academic.evaluations (tenant_id);

create trigger trg_evaluations_updated_at
  before update on academic.evaluations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md C1/H2: submit_evaluation (migration 7) already
-- validated child/lesson/classroom consistency inside the RPC body, but
-- direct INSERT/UPDATE via PostgREST had no equivalent check — RLS's WITH
-- CHECK on evaluations verified child_id was in the caller's own classroom,
-- but never verified lesson_id or the new classroom_id column agreed with
-- it. This trigger makes the full consistency rule (child, lesson, and
-- classroom must all agree, and created_by must belong to the tenant) hold
-- regardless of write path.
-- ---------------------------------------------------------------------------
create or replace function academic.check_evaluation_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id      uuid;
  v_child_classroom_id   uuid;
  v_lesson_tenant_id     uuid;
  v_lesson_classroom_id  uuid;
  v_creator_tenant_id    uuid;
begin
  select tenant_id, classroom_id into v_child_tenant_id, v_child_classroom_id from academic.children where id = new.child_id and deleted_at is null;
  select tenant_id, classroom_id into v_lesson_tenant_id, v_lesson_classroom_id from academic.lessons where id = new.lesson_id;
  select tenant_id into v_creator_tenant_id from identity.staff_profiles where id = new.created_by;

  if v_child_tenant_id is null or v_lesson_tenant_id is null or v_creator_tenant_id is null then
    raise exception 'Child, lesson, or evaluator not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child, lesson, or evaluator not found.', 'human_message_ar', 'لم يتم العثور على الطفل أو الدرس أو المقيّم.')::text;
  end if;

  if v_child_tenant_id <> new.tenant_id or v_lesson_tenant_id <> new.tenant_id or v_creator_tenant_id <> new.tenant_id
     or v_child_classroom_id <> new.classroom_id or v_lesson_classroom_id <> new.classroom_id then
    raise exception 'child_id/lesson_id/classroom_id/tenant_id are not mutually consistent for this evaluation'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child, lesson, and classroom do not match.',
              'human_message_ar', 'الطفل والدرس والفصل غير متطابقين.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_evaluations_consistency
  before insert or update of child_id, lesson_id, classroom_id, tenant_id, created_by on academic.evaluations
  for each row execute function academic.check_evaluation_consistency();

-- ---------------------------------------------------------------------------
-- academic.concerns  (§3.18)
-- ---------------------------------------------------------------------------
create table academic.concerns (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenancy.tenants(id) on delete restrict,
  child_id      uuid not null references academic.children(id) on delete restrict,
  raised_by     uuid not null references identity.staff_profiles(id),
  category      academic.concern_category not null,
  priority      academic.concern_priority not null,
  message       text not null check (btrim(message) <> ''),
  status        academic.concern_status not null default 'open',
  resolved_at   timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index concerns_child_idx on academic.concerns (child_id, created_at desc);
create index concerns_tenant_status_idx on academic.concerns (tenant_id, status);
-- Fix for EPIC_2_REVIEW.md L5: concerns_select_teacher's `raised_by = auth.uid()`
-- filter had no dedicated index.
create index concerns_raised_by_idx on academic.concerns (raised_by);

create trigger trg_concerns_updated_at
  before update on academic.concerns
  for each row execute function public.set_updated_at();

-- Fix for EPIC_2_REVIEW.md H2 — same pattern as the other staff-reference triggers.
create or replace function academic.check_concern_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id  uuid;
  v_raiser_tenant_id uuid;
begin
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;
  select tenant_id into v_raiser_tenant_id from identity.staff_profiles where id = new.raised_by;

  if v_child_tenant_id is null or v_raiser_tenant_id is null or v_child_tenant_id <> new.tenant_id or v_raiser_tenant_id <> new.tenant_id then
    raise exception 'child_id/raised_by/tenant_id are not mutually consistent for this concern'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child and staff member do not both belong to your tenant.',
              'human_message_ar', 'هذا الطفل والموظف لا ينتميان لنفس المؤسسة.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_concerns_consistency
  before insert or update of child_id, raised_by, tenant_id on academic.concerns
  for each row execute function academic.check_concern_consistency();

comment on column academic.concerns.priority is
  'info/attention/urgent — a deliberately independent scale from identity.staff_feedback.severity (low/medium/high, migration 4). One is a child-welfare signal, the other a staff-performance signal; the similarity is coincidental, not a naming bug (EPIC_2_ARCHITECTURE_REVIEW.md §14.6).';
