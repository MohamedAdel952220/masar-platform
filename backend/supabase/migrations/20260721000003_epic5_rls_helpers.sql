-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 3: RLS helper functions
-- Ref: BACKEND_ARCHITECTURE.md §12, §13.1; EPIC_2_DEPLOYMENT_FIX.md
--
-- Returns uuid[] (never SETOF) from the first draft — the
-- EPIC_2_DEPLOYMENT_FIX.md lesson applied proactively, not discovered again.
-- current_guardian_child_ids() (Epic 2) is reused unmodified below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.current_guardian_classroom_ids() — the classroom(s) the calling
-- guardian's own children belong to. Lets events_select_guardian (migration
-- 4) use a direct `classroom_id = any(...)` equality check instead of a
-- subquery, matching §13.1's single-equality-check invariant from this
-- table's first policy (the lesson EPIC_2_REVIEW.md H3 retrofitted into
-- Epic 2, and EPIC_3_REVIEW.md M1 retrofitted into Epic 3 — applied here
-- from the start).
-- ---------------------------------------------------------------------------
create or replace function public.current_guardian_classroom_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select distinct c.classroom_id
    from academic.children c
    where c.id = any (public.current_guardian_child_ids())
      and c.deleted_at is null
  );
$$;

comment on function public.current_guardian_classroom_ids() is
  'Classroom IDs of the calling guardian''s own (non-withdrawn) children. Returns uuid[], not SETOF (EPIC_2_DEPLOYMENT_FIX.md). Empty array for non-guardian callers.';
