-- ============================================================================
-- Epic 7 — Media & Camera Architecture
-- Migration 3: RLS policies
-- Ref: BACKEND_ARCHITECTURE.md §12, §13.1-13.5, §17
--
-- Permission matrix (§12): Cameras | Guardian: R (own classroom's, stream
-- token only) | Teacher: – | Reception: – | Manager: CRUD (incl.
-- admin_disabled toggle) | Driver: – | Platform Admin: – . No policy at all
-- is added for teacher/reception/driver/platform_admin on any table below —
-- absence of a policy is a hard deny under RLS (§13.6's own stated default),
-- and platform_admin's bypass list (§13.6) does NOT include cameras/
-- camera_classroom_links/camera_connections/camera_service_account_links,
-- unlike service_accounts (read-only, support context) which already has
-- its own platform_admin policy from Epic 1.
--
-- reuses public.current_guardian_classroom_ids() (Epic 5, migration
-- 20260721000003) rather than inventing a new helper — same uuid[]-returning
-- shape (not SETOF, EPIC_2_DEPLOYMENT_FIX.md's lesson), avoids duplicate
-- logic per this task's own instruction.
-- ============================================================================

alter table media.cameras enable row level security;
alter table media.cameras force row level security;

-- Manager: full tenant-wide visibility including soft-deleted rows (no
-- deleted_at filter) — matches the established precedent (Epic 2's
-- classrooms_select_manager/children_select_manager) of a single,
-- unfiltered manager SELECT policy rather than two "active vs deleted"
-- policies.
create policy cameras_select_manager on media.cameras
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Guardian: only cameras linked to a classroom their own (non-withdrawn)
-- child belongs to, only non-soft-deleted cameras, AND only classrooms that
-- are themselves not soft-deleted (§17's "Access rule").
--
-- Fix for EPIC_7_REVIEW.md M4 (recurrence check): the frozen Epic 5 helper
-- public.current_guardian_classroom_ids() filters soft-deleted CHILDREN but
-- never joins to academic.classrooms to also filter a soft-deleted
-- CLASSROOM itself — a latent gap in that helper's own original,
-- lower-stakes context (event visibility). This Epic reuses the helper for
-- a materially higher-stakes decision (camera-viewing/stream-token
-- authorization), so this policy adds its own explicit
-- `academic.classrooms ... deleted_at is null` check as defense-in-depth,
-- independent of the shared helper — the identical fix applied to
-- camera-stream-token/index.ts and camera_classroom_links_select_guardian
-- below. The frozen helper itself is correctly left unmodified.
create policy cameras_select_guardian on media.cameras
  for select
  using (
    deleted_at is null
    and public.current_role() = 'guardian'
    and exists (
      select 1
      from media.camera_classroom_links ccl
      join academic.classrooms c on c.id = ccl.classroom_id and c.deleted_at is null
      where ccl.camera_id = cameras.id
        and ccl.classroom_id = any (public.current_guardian_classroom_ids())
    )
  );

create policy cameras_insert_manager on media.cameras
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Manager UPDATE covers every field a Dashboard CRUD screen needs,
-- including the admin_disabled toggle (§12's own explicit callout) and
-- deleted_at soft-delete (§8) — "Manager has no D (hard delete)... only
-- soft-delete, which is functionally a U" (§12 footnote) is satisfied by
-- this single UPDATE policy, exactly as it already is for every other
-- soft-deletable table in this codebase. No DELETE policy exists on this
-- table for any role.
create policy cameras_update_manager on media.cameras
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- media.camera_connections — fix for EPIC_7_REVIEW.md C1. Manager-only,
-- both directions (SELECT and UPDATE/INSERT) — no guardian policy exists
-- at all, and this table is never added to supabase_realtime (migration 5).
-- INSERT happens only via public.create_camera (migration 6), which runs
-- as the invoking manager (SECURITY INVOKER) and is therefore still
-- gated by camera_connections_insert_manager below, not by an elevated
-- bypass.
-- ---------------------------------------------------------------------------
alter table media.camera_connections enable row level security;
alter table media.camera_connections force row level security;

create policy camera_connections_select_manager on media.camera_connections
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy camera_connections_insert_manager on media.camera_connections
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy camera_connections_update_manager on media.camera_connections
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

alter table media.camera_classroom_links enable row level security;
alter table media.camera_classroom_links force row level security;

create policy camera_classroom_links_select_manager on media.camera_classroom_links
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Fix for EPIC_7_REVIEW.md M4 (recurrence check) — same explicit
-- classroom-deleted_at check as cameras_select_guardian above, so a
-- guardian's direct read of the link table itself (not just of cameras)
-- also excludes soft-deleted classrooms.
create policy camera_classroom_links_select_guardian on media.camera_classroom_links
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'guardian'
    and classroom_id = any (public.current_guardian_classroom_ids())
    and exists (select 1 from academic.classrooms c where c.id = camera_classroom_links.classroom_id and c.deleted_at is null)
  );

create policy camera_classroom_links_insert_manager on media.camera_classroom_links
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- A pure link/junction row (no historical or financial significance, no
-- deleted_at column) — unlinking a camera from a classroom is a genuine
-- hard delete of the LINK row itself, not of the camera or classroom row,
-- exactly mirroring academic.child_guardian_links_delete_manager's own
-- precedent (Epic 2) for the identical class of table.
create policy camera_classroom_links_delete_manager on media.camera_classroom_links
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- media.camera_service_account_links — fix for EPIC_7_REVIEW.md H2.
-- Manager-only, both directions — no guardian or machine-caller policy
-- (machine callers never carry a JWT and are authorized entirely in
-- application code per §13.7, exactly like identity.service_accounts
-- itself).
-- ---------------------------------------------------------------------------
alter table media.camera_service_account_links enable row level security;
alter table media.camera_service_account_links force row level security;

create policy camera_service_account_links_select_manager on media.camera_service_account_links
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy camera_service_account_links_insert_manager on media.camera_service_account_links
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- A pure link row — unbinding a service account from a camera (e.g. when
-- reassigning an on-prem agent to a different device) is a genuine hard
-- delete of the LINK row itself, mirroring camera_classroom_links_delete_
-- manager's own precedent immediately above.
create policy camera_service_account_links_delete_manager on media.camera_service_account_links
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');
