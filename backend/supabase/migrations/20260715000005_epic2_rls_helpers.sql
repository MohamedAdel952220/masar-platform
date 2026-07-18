-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 5: RLS helper functions
-- Ref: BACKEND_ARCHITECTURE.md §13.1; EPIC_2_ARCHITECTURE_REVIEW.md §4, §14.3, §14.4
--      EPIC_2_REVIEW.md M2, L1, L4
--
-- Epic 1 shipped current_tenant_id()/current_role()/current_platform_admin_tier()
-- etc. This migration adds the two helpers the execution plan calls out as
-- "first actually exercised with real data" in Epic 2, plus the reception
-- column-narrowing functions resolving EPIC_2_ARCHITECTURE_REVIEW.md §14.3.
--
-- Fix for EPIC_2_REVIEW.md L1: every SECURITY DEFINER function in this file
-- now pins `search_path = ''` (the current Supabase/Postgres security-linter
-- recommended hardening) rather than `search_path = public`. Every reference
-- inside these functions was already fully schema-qualified (academic.*,
-- identity.*, public.*, auth.*), so this is a pure hardening change with no
-- behavior difference — nothing here relied on an unqualified lookup.
--
-- Fix for EPIC_2_DEPLOYMENT_FIX.md (live deployment failure): PostgreSQL
-- rejects "set-returning functions ... in policy expressions" — a RETURNS
-- SETOF function can never be called directly inside a CREATE POLICY
-- USING/WITH CHECK clause, including nested inside a subquery's WHERE, which
-- is exactly how current_staff_classroom_ids()/current_guardian_child_ids()
-- were declared and used throughout migration 6. Both are now RETURNS
-- <type>[] (a genuine scalar array value) instead of RETURNS SETOF <type>,
-- via an ARRAY(...) wrapper around the same query body — the function's
-- external behavior (which ids it returns, in what circumstances) is
-- unchanged; only the return *type* changed, from a set to an array. Every
-- `= ANY(fn())` call site in migration 6 keeps working with ZERO textual
-- changes, since ANY() already accepts a plain array — that pattern was
-- always the array form, coincidentally spelled identically to the (invalid)
-- SRF form. See EPIC_2_DEPLOYMENT_FIX.md for the full root-cause analysis
-- and the two call sites (migration 7, PL/pgSQL bodies — not policies, so
-- not broken, but needing a small syntax adjustment since the return type
-- changed) that did need a one-line edit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- current_staff_classroom_ids() — a teacher's "own classroom(s)".
-- Union of two sources per EPIC_2_ARCHITECTURE_REVIEW.md §14.4: a classroom
-- the caller coordinates (classrooms.coordinator_staff_id) is a distinct
-- concept from a classroom they teach a subject in (subjects.teacher_staff_id)
-- — a teacher can be a coordinator of one room and only teach a subject in
-- another, and needs visibility into both for the permission matrix's
-- "R (own classroom)" promise to actually hold.
--
-- Fix for EPIC_2_REVIEW.md M2: the subject-teacher branch previously had no
-- `deleted_at` filter at all (academic.subjects has no such column) and
-- never joined back to classrooms to check ITS deleted_at — meaning a
-- teacher retained "assigned" access to a soft-deleted classroom via any
-- subject they'd ever taught there. Now joins to classrooms and filters
-- deleted_at is null on both branches.
-- ---------------------------------------------------------------------------
create or replace function public.current_staff_classroom_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select id from academic.classrooms
    where coordinator_staff_id = auth.uid() and deleted_at is null
    union
    select s.classroom_id
    from academic.subjects s
    join academic.classrooms c on c.id = s.classroom_id
    where s.teacher_staff_id = auth.uid() and c.deleted_at is null
  );
$$;

comment on function public.current_staff_classroom_ids() is
  'Classrooms the caller coordinates OR teaches a subject in (union of both sources, EPIC_2_ARCHITECTURE_REVIEW.md §14.4), excluding soft-deleted classrooms on both branches (EPIC_2_REVIEW.md M2). Returns uuid[], not SETOF — PostgreSQL disallows set-returning functions inside RLS policy expressions (EPIC_2_DEPLOYMENT_FIX.md); an empty array (not an empty set) for non-teacher callers, which ANY() correctly evaluates as "matches nothing."';

-- ---------------------------------------------------------------------------
-- current_guardian_child_ids() — a guardian's own children, via
-- child_guardian_links (the single hottest lookup on that table, §3.13).
-- ---------------------------------------------------------------------------
create or replace function public.current_guardian_child_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select child_id from academic.child_guardian_links
    where guardian_id = auth.uid()
  );
$$;

comment on function public.current_guardian_child_ids() is
  'Child IDs linked to the calling guardian. Returns uuid[], not SETOF, for the same RLS-compatibility reason as current_staff_classroom_ids() above (EPIC_2_DEPLOYMENT_FIX.md). Empty array for non-guardian callers (§13.1).';

-- ---------------------------------------------------------------------------
-- academic.children_reception_safe() — column-level narrowing for
-- Reception's "R (all, name/photo/parent only)" permission (§12), which
-- plain row-level RLS cannot express on its own (EPIC_2_ARCHITECTURE_REVIEW.md
-- §14.3, resolving the gap named in §28 "narrowing the query is a deliberate
-- additional control against over-fetching"). SECURITY DEFINER so it can
-- return a narrow column set from `children` without granting reception a
-- base-table SELECT policy that would otherwise expose every column
-- (medical notes, addresses, national IDs) at the row level.
-- ---------------------------------------------------------------------------
create or replace function academic.children_reception_safe()
returns table (
  id                uuid,
  tenant_id         uuid,
  name              text,
  name_ar           text,
  photo_object_id   uuid,
  classroom_id      uuid,
  father_name       text,
  father_phone      text,
  mother_name       text,
  mother_phone      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.tenant_id, c.name, c.name_ar, c.photo_object_id, c.classroom_id,
         c.father_name, c.father_phone, c.mother_name, c.mother_phone
  from academic.children c
  where c.tenant_id = public.current_tenant_id()
    and c.deleted_at is null
    and public.current_role() in ('reception', 'manager');
$$;

comment on function academic.children_reception_safe() is
  'Name/photo/parent-contact-only view of a tenant''s children, for Reception''s column-narrowed read (§12). Returns zero rows for any caller whose role is not reception or manager — this is a defense-in-depth check inside the function body, not solely reliance on who is granted EXECUTE (§28).';

revoke all on function academic.children_reception_safe from public;
grant execute on function academic.children_reception_safe to authenticated;

-- ---------------------------------------------------------------------------
-- academic.classrooms_reception_safe() — fix for EPIC_2_REVIEW.md L4.
-- classrooms carries no sensitive column today, so this function currently
-- exposes the same columns Reception's base-table policy already granted —
-- the fix here is establishing the SAME seam used for children, so that if
-- a sensitive column (e.g. internal notes) is ever added to classrooms in a
-- later Epic, Reception's access is already routed through a narrow
-- function rather than a full-row policy that would need to be retrofitted
-- under time pressure. Migration 6 removes reception's base-table policy on
-- classrooms and points it at this function instead.
-- ---------------------------------------------------------------------------
create or replace function academic.classrooms_reception_safe()
returns table (
  id          uuid,
  tenant_id   uuid,
  name        text,
  grade       academic.grade_level,
  capacity    int,
  color_tag   text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.tenant_id, c.name, c.grade, c.capacity, c.color_tag
  from academic.classrooms c
  where c.tenant_id = public.current_tenant_id()
    and c.deleted_at is null
    and public.current_role() in ('reception', 'manager');
$$;

comment on function academic.classrooms_reception_safe() is
  'Fix for EPIC_2_REVIEW.md L4 — establishes the same column-narrowing seam as children_reception_safe() for consistency, even though every column currently returned is non-sensitive.';

revoke all on function academic.classrooms_reception_safe from public;
grant execute on function academic.classrooms_reception_safe to authenticated;
