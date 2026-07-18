-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 6: RLS policies for every Epic 2 table
-- Ref: BACKEND_ARCHITECTURE.md §12, §13; EPIC_2_ARCHITECTURE_REVIEW.md §4
--
-- Convention (unchanged from Epic 1): FORCE ROW LEVEL SECURITY everywhere;
-- separate named policy per role/action rather than one combined OR clause,
-- matching Epic 1's staff_profiles/guardian_profiles/driver_profiles shape.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- academic.classrooms
-- Manager: CRUD, sees soft-deleted rows too (no deleted_at filter — needed
-- for reassignment/recovery screens, §8's manager-only "view deleted" tier).
-- Teacher: R own (current_staff_classroom_ids()). Guardian: R own child's
-- classroom.
--
-- Fix for EPIC_2_REVIEW.md L4: Reception previously had a full-row base-table
-- SELECT policy here (justified at the time as "classrooms carry no
-- sensitive PII"). For consistency with the children_reception_safe()
-- pattern — and so a future sensitive column on this table doesn't need a
-- retrofit — Reception's base-table policy is removed; access is now
-- exclusively through academic.classrooms_reception_safe() (migration 5),
-- which today returns the identical column set, so this is a pure
-- consistency fix with no loss of capability.
-- ---------------------------------------------------------------------------
alter table academic.classrooms enable row level security;
alter table academic.classrooms force row level security;

create policy classrooms_select_manager on academic.classrooms
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy classrooms_select_teacher on academic.classrooms
  for select
  using (deleted_at is null and public.current_role() = 'teacher' and id = any(public.current_staff_classroom_ids()));

create policy classrooms_select_guardian on academic.classrooms
  for select
  using (
    deleted_at is null
    and public.current_role() = 'guardian'
    and id in (select classroom_id from academic.children where deleted_at is null and id = any(public.current_guardian_child_ids()))
  );

create policy classrooms_insert_manager on academic.classrooms
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy classrooms_update_manager on academic.classrooms
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- academic.children
-- Manager: CRUD, sees soft-deleted (withdrawn) children too. Teacher: R own
-- classroom. Guardian: R own children.
-- Reception deliberately has NO policy on this base table — Reception's
-- "R (all, name/photo/parent only)" permission (§12) is column-narrowed and
-- served exclusively through academic.children_reception_safe() (migration
-- 5), never through a row-level policy on the full table, so a reception
-- session can never SELECT medical/financial/address columns even if a
-- future query bypassed the intended API surface (EPIC_2_ARCHITECTURE_REVIEW.md §14.3).
-- ---------------------------------------------------------------------------
alter table academic.children enable row level security;
alter table academic.children force row level security;

create policy children_select_manager on academic.children
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy children_select_teacher on academic.children
  for select
  using (deleted_at is null and public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

create policy children_select_guardian on academic.children
  for select
  using (deleted_at is null and public.current_role() = 'guardian' and id = any(public.current_guardian_child_ids()));

create policy children_insert_manager on academic.children
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy children_update_manager on academic.children
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- academic.child_guardian_links
-- Manager: CRUD (own tenant). Guardian: R own links only.
-- ---------------------------------------------------------------------------
alter table academic.child_guardian_links enable row level security;
alter table academic.child_guardian_links force row level security;

create policy child_guardian_links_select_manager on academic.child_guardian_links
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy child_guardian_links_select_guardian on academic.child_guardian_links
  for select
  using (guardian_id = auth.uid());

create policy child_guardian_links_insert_manager on academic.child_guardian_links
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy child_guardian_links_update_manager on academic.child_guardian_links
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy child_guardian_links_delete_manager on academic.child_guardian_links
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- academic.attendance_records
-- Guardian: R own child. Teacher: CU own classroom. Manager: R,CU (override).
-- ---------------------------------------------------------------------------
alter table academic.attendance_records enable row level security;
alter table academic.attendance_records force row level security;

create policy attendance_select_guardian on academic.attendance_records
  for select
  using (public.current_role() = 'guardian' and child_id = any(public.current_guardian_child_ids()));

create policy attendance_select_teacher on academic.attendance_records
  for select
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

create policy attendance_select_manager on academic.attendance_records
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy attendance_insert_teacher on academic.attendance_records
  for insert
  with check (public.current_role() = 'teacher' and tenant_id = public.current_tenant_id() and classroom_id = any(public.current_staff_classroom_ids()));

create policy attendance_insert_manager on academic.attendance_records
  for insert
  with check (public.current_role() = 'manager' and tenant_id = public.current_tenant_id());

create policy attendance_update_teacher on academic.attendance_records
  for update
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()))
  with check (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

create policy attendance_update_manager on academic.attendance_records
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- academic.subjects
-- Guardian: R (own child's classroom, implied — feeds Parent Academics).
-- Teacher: R own. Manager: CRUD.
-- ---------------------------------------------------------------------------
alter table academic.subjects enable row level security;
alter table academic.subjects force row level security;

create policy subjects_select_guardian on academic.subjects
  for select
  using (
    public.current_role() = 'guardian'
    and classroom_id in (select classroom_id from academic.children where deleted_at is null and id = any(public.current_guardian_child_ids()))
  );

create policy subjects_select_teacher on academic.subjects
  for select
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

create policy subjects_select_manager on academic.subjects
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy subjects_insert_manager on academic.subjects
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy subjects_update_manager on academic.subjects
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- academic.lessons
-- Guardian: R (own child's classroom). Teacher: CRU own classroom.
-- Manager: R only (§12: "Evaluations/Lessons | R (own child) | CRU (own
-- classroom) | – | R" — manager does not create/edit lessons).
-- ---------------------------------------------------------------------------
alter table academic.lessons enable row level security;
alter table academic.lessons force row level security;

create policy lessons_select_guardian on academic.lessons
  for select
  using (
    public.current_role() = 'guardian'
    and classroom_id in (select classroom_id from academic.children where deleted_at is null and id = any(public.current_guardian_child_ids()))
  );

create policy lessons_select_teacher on academic.lessons
  for select
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

create policy lessons_select_manager on academic.lessons
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy lessons_insert_teacher on academic.lessons
  for insert
  with check (public.current_role() = 'teacher' and tenant_id = public.current_tenant_id() and classroom_id = any(public.current_staff_classroom_ids()));

create policy lessons_update_teacher on academic.lessons
  for update
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()))
  with check (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

-- ---------------------------------------------------------------------------
-- academic.evaluations
-- Guardian: R own child. Teacher: CRU own classroom's children.
-- Manager: R only (same matrix row as lessons).
--
-- Fix for EPIC_2_REVIEW.md H3: teacher-scoping policies previously joined
-- through `children` via a nested subquery to determine classroom
-- membership, contradicting §13.1's "single equality check, never a
-- subquery" invariant. Now that `evaluations` carries its own `classroom_id`
-- (migration 3), these are direct equality checks like every other table's
-- teacher policy.
-- ---------------------------------------------------------------------------
alter table academic.evaluations enable row level security;
alter table academic.evaluations force row level security;

create policy evaluations_select_guardian on academic.evaluations
  for select
  using (public.current_role() = 'guardian' and child_id = any(public.current_guardian_child_ids()));

create policy evaluations_select_teacher on academic.evaluations
  for select
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

create policy evaluations_select_manager on academic.evaluations
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy evaluations_insert_teacher on academic.evaluations
  for insert
  with check (
    public.current_role() = 'teacher'
    and tenant_id = public.current_tenant_id()
    and classroom_id = any(public.current_staff_classroom_ids())
  );

create policy evaluations_update_teacher on academic.evaluations
  for update
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()))
  with check (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

-- ---------------------------------------------------------------------------
-- academic.concerns
-- Guardian: R own child. Teacher: C (own), R (own — raised_by = self).
-- Manager: CRUD.
-- ---------------------------------------------------------------------------
alter table academic.concerns enable row level security;
alter table academic.concerns force row level security;

create policy concerns_select_guardian on academic.concerns
  for select
  using (public.current_role() = 'guardian' and child_id = any(public.current_guardian_child_ids()));

create policy concerns_select_teacher on academic.concerns
  for select
  using (public.current_role() = 'teacher' and raised_by = auth.uid());

create policy concerns_select_manager on academic.concerns
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy concerns_insert_teacher on academic.concerns
  for insert
  with check (public.current_role() = 'teacher' and tenant_id = public.current_tenant_id() and raised_by = auth.uid());

create policy concerns_insert_manager on academic.concerns
  for insert
  with check (public.current_role() = 'manager' and tenant_id = public.current_tenant_id());

create policy concerns_update_manager on academic.concerns
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- academic.day_path_events
-- Guardian: R own child (current + history). Teacher: R own classroom.
-- Manager: R own tenant. Reception: C (system-generated via handover
-- actions) — per §12's matrix, teacher and manager do NOT get an insert
-- policy here in Epic 2 (their sources — bus/trip actions — are Epic 3;
-- reception's handover-confirmation write path is the only Epic 2 writer).
-- ---------------------------------------------------------------------------
alter table academic.day_path_events enable row level security;
alter table academic.day_path_events force row level security;

create policy day_path_events_select_guardian on academic.day_path_events
  for select
  using (public.current_role() = 'guardian' and child_id = any(public.current_guardian_child_ids()));

-- Fix for EPIC_2_REVIEW.md H3 — direct classroom_id equality, no subquery,
-- now that day_path_events carries its own classroom_id (migration 3).
create policy day_path_events_select_teacher on academic.day_path_events
  for select
  using (public.current_role() = 'teacher' and classroom_id = any(public.current_staff_classroom_ids()));

create policy day_path_events_select_manager on academic.day_path_events
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy day_path_events_insert_reception on academic.day_path_events
  for insert
  with check (public.current_role() = 'reception' and tenant_id = public.current_tenant_id() and source = 'reception');

-- ---------------------------------------------------------------------------
-- identity.staff_subjects — teacher: R own. Manager: CRUD (own tenant).
-- ---------------------------------------------------------------------------
alter table identity.staff_subjects enable row level security;
alter table identity.staff_subjects force row level security;

create policy staff_subjects_select_self on identity.staff_subjects
  for select
  using (staff_profile_id = auth.uid());

create policy staff_subjects_select_manager on identity.staff_subjects
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_subjects_insert_manager on identity.staff_subjects
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_subjects_update_manager on identity.staff_subjects
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_subjects_delete_manager on identity.staff_subjects
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- identity.staff_leave_records — teacher: R own. Manager: CRUD (own tenant).
-- ---------------------------------------------------------------------------
alter table identity.staff_leave_records enable row level security;
alter table identity.staff_leave_records force row level security;

create policy staff_leave_records_select_self on identity.staff_leave_records
  for select
  using (staff_profile_id = auth.uid());

create policy staff_leave_records_select_manager on identity.staff_leave_records
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_leave_records_insert_manager on identity.staff_leave_records
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_leave_records_update_manager on identity.staff_leave_records
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_leave_records_delete_manager on identity.staff_leave_records
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- identity.staff_feedback — teacher: R own (non-anonymous). Manager: CRUD.
-- ---------------------------------------------------------------------------
alter table identity.staff_feedback enable row level security;
alter table identity.staff_feedback force row level security;

create policy staff_feedback_select_self on identity.staff_feedback
  for select
  using (staff_profile_id = auth.uid());

create policy staff_feedback_select_manager on identity.staff_feedback
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_feedback_insert_manager on identity.staff_feedback
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_feedback_update_manager on identity.staff_feedback
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy staff_feedback_delete_manager on identity.staff_feedback
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');
