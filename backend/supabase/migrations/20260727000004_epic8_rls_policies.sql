-- ============================================================================
-- Epic 8 — AI Report Architecture
-- Migration 4: RLS policies
-- Ref: BACKEND_ARCHITECTURE.md §12, §13.1-13.5, §19
--
-- Permission matrix (§12): AI Reports | Guardian: R (own child, sent only)
-- | Teacher: C (own students), R own | Reception: – | Manager: CRUD (all)
-- | Driver: – | Platform Admin: – . No policy at all is added for
-- reception/driver/platform_admin — absence of a policy is a hard deny
-- under RLS (§13.6), and platform_admin's bypass list (§13.6) does not
-- include the reports schema.
--
-- No INSERT policy exists on ai_report_batches or ai_report_drafts for any
-- role — both are created exclusively by the ai-draft-report Edge Function
-- (service_role), mirroring the established "no direct RLS write path
-- alongside a correctness-critical Edge Function" lesson (EPIC_5_REVIEW.md
-- H2, EPIC_6_REVIEW.md H1/H2). Teacher's "C" in the matrix is satisfied by
-- that Edge Function accepting a teacher-authenticated caller, not by a
-- table-level INSERT grant.
--
-- No DELETE policy exists on ai_report_drafts for any role — deletion is
-- exclusively via reports.delete_report_draft (migration 5), which
-- additionally enforces "never delete an already-sent report" (a rule a
-- bare RLS DELETE policy cannot express). No UPDATE policy exists for
-- teacher at all — reviewing/editing a teacher-authored draft happens as
-- part of the same send_report_draft/schedule_report_draft RPC call
-- (migration 5's own p_body parameter), never as a separate raw UPDATE —
-- see migration 5's header comment for the full reasoning. Manager's own
-- UPDATE policy is narrowed to status IN ('draft','ready') only, mirroring
-- EPIC_6_REVIEW.md M2's "narrow the RLS UPDATE policy to exclude the
-- RPC-owned terminal states" pattern exactly, so status can never reach
-- scheduled/sent via a bare UPDATE regardless of caller.
-- ============================================================================

alter table reports.ai_report_batches enable row level security;
alter table reports.ai_report_batches force row level security;

create policy ai_report_batches_select_manager on reports.ai_report_batches
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Teacher: their own drafting requests only (matches "R own" — a batch is
-- an action record of who requested it, not a per-child resource with its
-- own classroom-based ownership the way a draft itself has).
create policy ai_report_batches_select_teacher on reports.ai_report_batches
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'teacher' and created_by = auth.uid());

alter table reports.ai_report_drafts enable row level security;
alter table reports.ai_report_drafts force row level security;

create policy ai_report_drafts_select_manager on reports.ai_report_drafts
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Teacher: "R own" — own students, i.e. the child's classroom is one the
-- teacher teaches/coordinates (current_staff_classroom_ids(), Epic 2),
-- regardless of which staff member actually authored the batch — matches
-- the identical ownership convention already established for
-- evaluations/attendance/lessons (Epic 2), not narrowed to "only batches I
-- personally created" the way ai_report_batches' own policy above is.
create policy ai_report_drafts_select_teacher on reports.ai_report_drafts
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'teacher'
    and exists (
      select 1 from academic.children c
      where c.id = ai_report_drafts.child_id
        and c.classroom_id = any (public.current_staff_classroom_ids())
        and c.deleted_at is null
    )
  );

-- Guardian: "R (own child, sent only)" — the direct regression surface for
-- §19's "no AI-drafted report ever reaches sent status without an explicit
-- staff action" invariant: a guardian can never see a draft/ready/scheduled
-- row at all, only ever a fully-sent one.
create policy ai_report_drafts_select_guardian on reports.ai_report_drafts
  for select
  using (
    status = 'sent'
    and public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
  );

-- Fix-pattern applied from the start (EPIC_6_REVIEW.md M2): status can
-- never be pushed to 'scheduled'/'sent' via this policy — only
-- 'draft'/'ready' are reachable, so the RPCs in migration 5 remain the sole
-- path to either terminal-ish state.
create policy ai_report_drafts_update_manager on reports.ai_report_drafts
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status in ('draft', 'ready'))
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status in ('draft', 'ready'));

alter table reports.ai_usage_counters enable row level security;
alter table reports.ai_usage_counters force row level security;

-- Manager: read-only visibility into the tenant's own daily AI usage (a
-- Dashboard "AI usage today" indicator) — no INSERT/UPDATE policy for any
-- role; the counter is mutated exclusively via reports.increment_ai_usage
-- (migration 5, service_role-called from both AI Edge Functions).
create policy ai_usage_counters_select_manager on reports.ai_usage_counters
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');
