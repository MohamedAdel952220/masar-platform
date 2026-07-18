-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 7: RPC functions
-- Ref: BACKEND_ARCHITECTURE.md §2.2, §14.1, §14.2, §14.3, §25.1, §25.2
--      EPIC_2_ARCHITECTURE_REVIEW.md §6, §14.5, §14.7
--
-- Error codes reused from Epic 1's already-shipped taxonomy throughout this
-- file (VALIDATION_FAILED, VALIDATION_DUPLICATE_PHONE, STATE_ALREADY_PROCESSED,
-- NOT_FOUND, PERM_ROLE_DENIED, PERM_TENANT_MISMATCH, EXTERNAL_AUTH_ADMIN_FAILURE)
-- — Epic 1's errors.ts taxonomy is deliberately generic/prefix-based (§25.1)
-- and every Epic 2 error case fits an existing code, so this migration adds
-- no new error code and touches no Epic 1 file (Epic 1 is never modified).
--
-- activity_log is intentionally NOT written by any RPC in this file —
-- platform.activity_log does not exist until Epic 9 (EPIC_2_ARCHITECTURE_REVIEW.md
-- §14.7); these RPCs are additive-extendable via CREATE OR REPLACE once it does.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.enroll_child_row — service_role only. The DB half of the enroll-child
-- saga (§10.3 pattern, §25.3): the Edge Function performs the Auth Admin API
-- guardian-identity step, then calls this RPC for the transactional,
-- capacity-locked child insert. Never callable by an authenticated client
-- directly (see the execute grant at the bottom of this section) — capacity
-- checking here deliberately bypasses per-request RLS narrowing because the
-- Edge Function has already verified the caller is a manager of this tenant.
--
-- Capacity locking follows the standing §2.2/§5 convention: SELECT ... FOR
-- UPDATE on the parent capacity row (the classroom) before counting and
-- inserting, so two concurrent enrollments near a classroom's capacity limit
-- serialize instead of both passing the check and overbooking.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_child_row(
  p_tenant_id     uuid,
  p_classroom_id  uuid,
  p_child         jsonb,
  p_created_by    uuid
)
returns academic.children
language plpgsql
as $$
declare
  v_capacity       int;
  v_current_count  int;
  v_child          academic.children;
begin
  select capacity into v_capacity
  from academic.classrooms
  where id = p_classroom_id and tenant_id = p_tenant_id and deleted_at is null
  for update;

  if v_capacity is null then
    raise exception 'Classroom not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object(
              'code', 'NOT_FOUND',
              'human_message_en', 'Classroom not found.',
              'human_message_ar', 'لم يتم العثور على الفصل.'
            )::text;
  end if;

  select count(*) into v_current_count
  from academic.children
  where classroom_id = p_classroom_id and deleted_at is null;

  if v_current_count >= v_capacity then
    raise exception 'Classroom is at full capacity'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This classroom is at full capacity.',
              'human_message_ar', 'هذا الفصل ممتلئ بالكامل.'
            )::text;
  end if;

  insert into academic.children (
    tenant_id, name, name_ar, dob, gender, blood_type, allergies, notes,
    classroom_id, package, address_line, building, area, city,
    address_lat, address_lng,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    father_name, father_phone, father_job, father_national_id,
    mother_name, mother_phone, mother_job, mother_national_id,
    created_by
  )
  values (
    p_tenant_id,
    p_child->>'name',
    p_child->>'nameAr',
    (p_child->>'dob')::date,
    (p_child->>'gender')::academic.gender,
    p_child->>'bloodType',
    p_child->>'allergies',
    p_child->>'notes',
    p_classroom_id,
    (p_child->>'package')::academic.package_type,
    p_child->>'addressLine',
    p_child->>'building',
    p_child->>'area',
    p_child->>'city',
    nullif(p_child->>'addressLat', '')::numeric(9,6),
    nullif(p_child->>'addressLng', '')::numeric(9,6),
    p_child->>'emergencyContactName',
    p_child->>'emergencyContactPhone',
    p_child->>'emergencyContactRelation',
    p_child->>'fatherName',
    p_child->>'fatherPhone',
    p_child->>'fatherJob',
    p_child->>'fatherNationalId',
    p_child->>'motherName',
    p_child->>'motherPhone',
    p_child->>'motherJob',
    p_child->>'motherNationalId',
    p_created_by
  )
  returning * into v_child;

  return v_child;
end;
$$;

comment on function public.enroll_child_row is
  'DB half of the enroll-child saga (Edge Function performs the Auth Admin API guardian step first, §25.3). Capacity-locked per §2.2/§5. service_role only.';

revoke all on function public.enroll_child_row from public;
grant execute on function public.enroll_child_row to service_role;

-- ---------------------------------------------------------------------------
-- public.link_child_guardian — service_role only. Inserts a
-- child_guardian_links row; used both for a newly-provisioned guardian and
-- for the "link to existing guardian" sibling case (EPIC_2_ARCHITECTURE_REVIEW.md
-- §13, guardian identity collision risk).
-- ---------------------------------------------------------------------------
create or replace function public.link_child_guardian(
  p_child_id            uuid,
  p_guardian_id         uuid,
  p_tenant_id           uuid,
  p_relation            academic.guardian_relation,
  p_is_primary_contact  boolean default true
)
returns void
language sql
as $$
  insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
  values (p_child_id, p_guardian_id, p_tenant_id, p_relation, p_is_primary_contact)
  on conflict (child_id, guardian_id) do update
    set relation = excluded.relation, is_primary_contact = excluded.is_primary_contact;
$$;

revoke all on function public.link_child_guardian from public;
grant execute on function public.link_child_guardian to service_role;

-- ---------------------------------------------------------------------------
-- public.enroll_child_with_guardian — service_role only. Fix for
-- EPIC_2_REVIEW.md C3: the enroll-child Edge Function previously called
-- enroll_child_row and link_child_guardian as two SEPARATE RPC calls (two
-- separate transactions). A failure of the second call left an orphaned
-- child with no guardian link and no compensation; worse, because the
-- outer idempotency wrapper only stores a replay snapshot after the whole
-- saga succeeds, a client retry after that failure re-ran the entire saga
-- and created a SECOND, duplicate child row (children have no natural
-- uniqueness key).
--
-- This function performs the capacity-locked child insert AND the guardian
-- link insert in ONE call — i.e. one transaction — so they succeed or fail
-- together. enroll_child_row and link_child_guardian themselves are left
-- entirely unchanged and still independently callable (backward
-- compatibility) for any other caller that only needs one half of this.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_child_with_guardian(
  p_tenant_id           uuid,
  p_classroom_id        uuid,
  p_child               jsonb,
  p_created_by          uuid,
  p_guardian_id         uuid,
  p_relation            academic.guardian_relation,
  p_is_primary_contact  boolean default true
)
returns academic.children
language plpgsql
as $$
declare
  v_child academic.children;
begin
  v_child := public.enroll_child_row(p_tenant_id, p_classroom_id, p_child, p_created_by);
  perform public.link_child_guardian(v_child.id, p_guardian_id, p_tenant_id, p_relation, p_is_primary_contact);
  return v_child;
end;
$$;

comment on function public.enroll_child_with_guardian is
  'Fixes EPIC_2_REVIEW.md C3 — atomic (single-transaction) composition of enroll_child_row + link_child_guardian, called by the enroll-child Edge Function instead of two separate RPC calls. If link_child_guardian raises, the whole transaction (including the child insert) rolls back, so a retry never finds an orphaned child or creates a duplicate.';

revoke all on function public.enroll_child_with_guardian from public;
grant execute on function public.enroll_child_with_guardian to service_role;

-- ---------------------------------------------------------------------------
-- public.mark_attendance — teacher (own classroom) / manager (override,
-- own tenant). §14.2. Naturally idempotent via attendance_records' unique
-- (child_id, date) — repeat calls upsert rather than duplicate, so this RPC
-- is exempt from the mandatory idempotency-key convention (§14.3's own
-- "register_device_token"-style exception, EPIC_2_ARCHITECTURE_REVIEW.md §6).
--
-- p_records shape: jsonb array of {"childId": uuid, "present": boolean}
-- ---------------------------------------------------------------------------
create or replace function public.mark_attendance(
  p_classroom_id  uuid,
  p_date          date,
  p_records       jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_role         text := public.current_role();
  v_tenant_id    uuid := public.current_tenant_id();
  v_invalid_cnt  int;
  v_present_cnt  int;
  v_absent_cnt   int;
begin
  if v_role not in ('teacher', 'manager') then
    raise exception 'Only a teacher or manager can mark attendance'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'Only a teacher or manager can mark attendance.',
              'human_message_ar', 'فقط المعلّم أو المدير يمكنه تسجيل الحضور.'
            )::text;
  end if;

  if v_role = 'teacher' and p_classroom_id <> all (public.current_staff_classroom_ids()) then
    raise exception 'You are not assigned to this classroom'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'You are not assigned to this classroom.',
              'human_message_ar', 'أنت غير مُكلَّف بهذا الفصل.'
            )::text;
  end if;

  if not exists (select 1 from academic.classrooms where id = p_classroom_id and tenant_id = v_tenant_id and deleted_at is null) then
    raise exception 'Classroom not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object(
              'code', 'NOT_FOUND',
              'human_message_en', 'Classroom not found.',
              'human_message_ar', 'لم يتم العثور على الفصل.'
            )::text;
  end if;

  -- Fix for EPIC_2_REVIEW.md C2: previously NOTHING verified that a
  -- submitted childId actually belonged to p_classroom_id or even to the
  -- caller's own tenant — the bare FK on attendance_records.child_id only
  -- required the id to exist as SOME row in `children`, anywhere, in any
  -- tenant. This check runs before any write and rejects the whole batch
  -- (rather than silently skipping bad entries) if any childId doesn't
  -- belong to this classroom/tenant. academic.check_attendance_record_consistency()
  -- (migration 3) is the DB-level backstop if this check is ever bypassed.
  select count(*) into v_invalid_cnt
  from jsonb_array_elements(p_records) r
  left join academic.children c
    on c.id = (r->>'childId')::uuid
   and c.classroom_id = p_classroom_id
   and c.tenant_id = v_tenant_id
   and c.deleted_at is null
  where c.id is null;

  if v_invalid_cnt > 0 then
    raise exception 'One or more childId values are not enrolled in this classroom/tenant'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'One or more children are not enrolled in this classroom.',
              'human_message_ar', 'طفل أو أكثر غير مسجّل في هذا الفصل.'
            )::text;
  end if;

  -- Fix for EPIC_2_REVIEW.md L2: single set-based upsert instead of a
  -- per-record PL/pgSQL loop.
  insert into academic.attendance_records (tenant_id, child_id, classroom_id, date, present, marked_by)
  select v_tenant_id, (r->>'childId')::uuid, p_classroom_id, p_date, (r->>'present')::boolean, auth.uid()
  from jsonb_array_elements(p_records) r
  on conflict (child_id, date) do update
    set present = excluded.present, classroom_id = excluded.classroom_id, marked_by = excluded.marked_by, updated_at = now();

  select
    count(*) filter (where (r->>'present')::boolean),
    count(*) filter (where not (r->>'present')::boolean)
  into v_present_cnt, v_absent_cnt
  from jsonb_array_elements(p_records) r;

  return json_build_object(
    'classroomId', p_classroom_id,
    'date', p_date,
    'presentCount', v_present_cnt,
    'absentCount', v_absent_cnt,
    'total', v_present_cnt + v_absent_cnt
  );
end;
$$;

comment on function public.mark_attendance is
  'Upserts a classroom''s daily attendance in one set-based call (EPIC_2_REVIEW.md L2). Idempotency-exempt — natural upsert via attendance_records'' unique (child_id, date) (§14.3, EPIC_2_ARCHITECTURE_REVIEW.md §6). Validates every childId belongs to the target classroom/tenant before writing anything (EPIC_2_REVIEW.md C2).';

revoke all on function public.mark_attendance from public;
grant execute on function public.mark_attendance to authenticated;

-- ---------------------------------------------------------------------------
-- public.submit_evaluation — teacher only, own classroom's children.
-- Naturally idempotent via evaluations' unique (child_id, lesson_id)
-- (EPIC_2_ARCHITECTURE_REVIEW.md §14.5) — same idempotency-exemption
-- reasoning as mark_attendance above.
-- ---------------------------------------------------------------------------
create or replace function public.submit_evaluation(
  p_child_id       uuid,
  p_lesson_id      uuid,
  p_understanding  smallint,
  p_participation  smallint,
  p_behavior       smallint,
  p_homework       academic.homework_status,
  p_note           text default null
)
returns academic.evaluations
language plpgsql
as $$
declare
  v_lesson_classroom_id  uuid;
  v_child_classroom_id   uuid;
  v_tenant_id            uuid := public.current_tenant_id();
  v_row                  academic.evaluations;
begin
  if public.current_role() <> 'teacher' then
    raise exception 'Only a teacher can submit an evaluation'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'Only a teacher can submit an evaluation.',
              'human_message_ar', 'فقط المعلّم يمكنه تقديم تقييم.'
            )::text;
  end if;

  select classroom_id into v_lesson_classroom_id from academic.lessons where id = p_lesson_id;
  select classroom_id into v_child_classroom_id from academic.children where id = p_child_id and deleted_at is null;

  if v_lesson_classroom_id is null or v_child_classroom_id is null then
    raise exception 'Lesson or child not found'
      using errcode = 'P0002',
            detail = json_build_object(
              'code', 'NOT_FOUND',
              'human_message_en', 'Lesson or child not found.',
              'human_message_ar', 'لم يتم العثور على الدرس أو الطفل.'
            )::text;
  end if;

  if v_lesson_classroom_id <> v_child_classroom_id then
    raise exception 'This child is not enrolled in this lesson''s classroom'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child is not enrolled in this lesson''s classroom.',
              'human_message_ar', 'هذا الطفل غير مسجّل في فصل هذا الدرس.'
            )::text;
  end if;

  if v_lesson_classroom_id <> all (public.current_staff_classroom_ids()) then
    raise exception 'You are not assigned to this classroom'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'You are not assigned to this classroom.',
              'human_message_ar', 'أنت غير مُكلَّف بهذا الفصل.'
            )::text;
  end if;

  insert into academic.evaluations (tenant_id, child_id, lesson_id, understanding, participation, behavior, homework, note, created_by)
  values (v_tenant_id, p_child_id, p_lesson_id, p_understanding, p_participation, p_behavior, p_homework, p_note, auth.uid())
  on conflict (child_id, lesson_id) do update
    set understanding = excluded.understanding,
        participation = excluded.participation,
        behavior = excluded.behavior,
        homework = excluded.homework,
        note = excluded.note,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_evaluation from public;
grant execute on function public.submit_evaluation to authenticated;

-- ---------------------------------------------------------------------------
-- public.withdraw_child — manager only. Soft-deletes the child (§8:
-- soft-delete = withdrawal). The pickup-pass/bus-rider cascade described in
-- §14.2 does not apply yet — those tables don't exist until Epic 3
-- (EPIC_2_ARCHITECTURE_REVIEW.md §6, §12) — this function is written so
-- Epic 3 can extend it additively via CREATE OR REPLACE without touching
-- this Epic's callers.
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_child(
  p_child_id  uuid,
  p_reason    text default null
)
returns academic.children
language plpgsql
as $$
declare
  v_row academic.children;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can withdraw a child'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'Only a manager can withdraw a child.',
              'human_message_ar', 'فقط المدير يمكنه سحب طفل.'
            )::text;
  end if;

  update academic.children
  set deleted_at = now()
  where id = p_child_id and tenant_id = public.current_tenant_id() and deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Child not found or already withdrawn'
      using errcode = 'P0002',
            detail = json_build_object(
              'code', 'NOT_FOUND',
              'human_message_en', 'Child not found or already withdrawn.',
              'human_message_ar', 'لم يتم العثور على الطفل أو تم سحبه بالفعل.'
            )::text;
  end if;

  return v_row;
end;
$$;

revoke all on function public.withdraw_child from public;
grant execute on function public.withdraw_child to authenticated;

-- ---------------------------------------------------------------------------
-- public.suspend_child / public.reactivate_child — manager only. Toggles
-- membership_status; does not withdraw. membership_status's billing-gating
-- effect has no consumer until Epic 5 — this function correctly maintains
-- the column regardless (EPIC_2_ARCHITECTURE_REVIEW.md §12).
-- ---------------------------------------------------------------------------
-- Fix for EPIC_2_REVIEW.md M1: suspend_child/reactivate_child previously did
-- a separate SELECT-then-UPDATE with no row lock, so two concurrent calls
-- could both pass the "not already suspended"/"not currently suspended"
-- guard and both succeed, silently defeating the intended state-machine
-- rejection. Both functions now fold the state check into the UPDATE's own
-- WHERE clause (the same atomic pattern withdraw_child already used) — only
-- one of two concurrent calls can ever actually flip the row; the other's
-- UPDATE affects zero rows and a follow-up read (only reached on that
-- failure path) disambiguates "not found" from "already processed" for a
-- clean error message.
create or replace function public.suspend_child(
  p_child_id  uuid,
  p_reason    text default null
)
returns academic.children
language plpgsql
as $$
declare
  v_row     academic.children;
  v_exists  boolean;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can suspend a child''s membership'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'Only a manager can suspend a child''s membership.',
              'human_message_ar', 'فقط المدير يمكنه تعليق عضوية طفل.'
            )::text;
  end if;

  update academic.children
  set membership_status = 'suspended'
  where id = p_child_id
    and tenant_id = public.current_tenant_id()
    and deleted_at is null
    and membership_status <> 'suspended'
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select exists(
    select 1 from academic.children where id = p_child_id and tenant_id = public.current_tenant_id() and deleted_at is null
  ) into v_exists;

  if not v_exists then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  else
    raise exception 'This child''s membership is already suspended'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'STATE_ALREADY_PROCESSED',
              'human_message_en', 'This child''s membership is already suspended.',
              'human_message_ar', 'عضوية هذا الطفل معلّقة بالفعل.'
            )::text;
  end if;
end;
$$;

create or replace function public.reactivate_child(p_child_id uuid)
returns academic.children
language plpgsql
as $$
declare
  v_row     academic.children;
  v_exists  boolean;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can reactivate a child''s membership'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'PERM_ROLE_DENIED',
              'human_message_en', 'Only a manager can reactivate a child''s membership.',
              'human_message_ar', 'فقط المدير يمكنه إعادة تفعيل عضوية طفل.'
            )::text;
  end if;

  update academic.children
  set membership_status = 'active'
  where id = p_child_id
    and tenant_id = public.current_tenant_id()
    and deleted_at is null
    and membership_status = 'suspended'
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select exists(
    select 1 from academic.children where id = p_child_id and tenant_id = public.current_tenant_id() and deleted_at is null
  ) into v_exists;

  if not v_exists then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  else
    raise exception 'This child''s membership is not currently suspended'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'STATE_ALREADY_PROCESSED',
              'human_message_en', 'This child''s membership is not currently suspended.',
              'human_message_ar', 'عضوية هذا الطفل غير معلّقة حاليًا.'
            )::text;
  end if;
end;
$$;

revoke all on function public.suspend_child from public;
grant execute on function public.suspend_child to authenticated;
revoke all on function public.reactivate_child from public;
grant execute on function public.reactivate_child to authenticated;
