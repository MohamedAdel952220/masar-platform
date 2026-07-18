-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 4: RLS policies for every Epic 5 table
-- Ref: BACKEND_ARCHITECTURE.md §12, §13
--
-- Convention (unchanged from Epic 1-4): FORCE ROW LEVEL SECURITY everywhere;
-- separate named policy per role/action; direct equality checks against a
-- uuid[] helper, never a raw subquery, for every table that can carry its
-- own scoping column.
--
-- No direct UPDATE policy is granted on approvals.requests to manager or
-- teacher (EPIC_3_REVIEW.md C4 lesson: a multi-table transactional
-- operation — here, "approve" also atomically creates an events row — must
-- not be reachable via a bare RLS-gated UPDATE that could flip status
-- without ever creating the event). review_request (migration 5) is
-- SECURITY DEFINER and is the sole write path for that transition, exactly
-- mirroring academic.set_child_day_path_status/update_child_trip_status's
-- established pattern.
--
-- Fix for EPIC_5_REVIEW.md H2: no direct INSERT policy is granted on
-- approvals.requests either, for the same reason. A direct guardian-facing
-- (here, teacher-facing) INSERT coexisting with submit_request (migration
-- 5) meant a request could be created without ever running submit_request's
-- own body — silently skipping the §16-mandated "New request submitted"
-- manager notification, and (since the direct-INSERT path fires
-- check_request_consistency under the submitting teacher's own, narrower
-- than tenant-wide, classroom/subject RLS visibility) risking a spurious
-- rejection for a legitimate request about a classroom/subject the teacher
-- doesn't directly "own". submit_request (SECURITY DEFINER) is now the
-- sole creation path, exactly mirroring how this table already had no
-- direct UPDATE policy.
-- ---------------------------------------------------------------------------
alter table approvals.requests enable row level security;
alter table approvals.requests force row level security;

create policy requests_select_teacher on approvals.requests
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'teacher' and submitted_by = auth.uid());

create policy requests_select_manager on approvals.requests
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- approvals.events
-- Manager: CRU (own tenant) — a manager may publish/edit an event directly,
-- not only via review_request's promotion path (§12: "Events | ... |
-- CRUD"). Teacher: R (all, own tenant). Guardian: R (own classroom's
-- events, or whole-tenant events where classroom_id is null), §12: "R (own
-- classroom/all)".
--
-- Fix for EPIC_5_REVIEW.md H1: §12's own notes state "Manager has no D
-- (hard delete) anywhere in this system per §8 — only soft-delete, which is
-- functionally a U." approvals.events has no deleted_at column and no
-- soft-delete RPC; a hard-delete policy here would cascade (ON DELETE
-- CASCADE, migration 2) to destroy every guardian's event_rsvps/
-- event_trip_registrations row for that event, including any row already
-- status='paid' with a payment_transaction_id — an irrecoverable loss of a
-- financial-reconciliation-relevant record the moment Epic 6 exists. No
-- delete policy is granted to anyone, matching approvals.requests' own
-- (already-correct) no-delete-for-anyone precedent. A future soft-delete
-- column/RPC is the correct way to add "remove an event" if ever needed.
-- ---------------------------------------------------------------------------
alter table approvals.events enable row level security;
alter table approvals.events force row level security;

create policy events_select_manager on approvals.events
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy events_select_teacher on approvals.events
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'teacher');

create policy events_select_guardian on approvals.events
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'guardian'
    and (classroom_id is null or classroom_id = any (public.current_guardian_classroom_ids()))
  );

create policy events_insert_manager on approvals.events
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy events_update_manager on approvals.events
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Fix for EPIC_5_REVIEW.md H1: events_delete_manager removed entirely — see
-- the comment above this table's policy block for the full rationale.

-- ---------------------------------------------------------------------------
-- approvals.event_rsvps
-- Guardian: CRU (own child) — no D, matching §12's literal "CRU (own
-- child)" (no delete permission is granted anywhere for this resource).
-- Manager: R (own tenant).
-- ---------------------------------------------------------------------------
alter table approvals.event_rsvps enable row level security;
alter table approvals.event_rsvps force row level security;

-- Fix for EPIC_5_REVIEW.md L3: USING clauses now state tenant_id
-- explicitly (previously implied only transitively via child_id
-- ownership), matching the codebase-wide convention of stating it in every
-- policy clause and matching this table's own WITH CHECK clauses.
create policy event_rsvps_select_guardian on approvals.event_rsvps
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy event_rsvps_select_manager on approvals.event_rsvps
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy event_rsvps_insert_guardian on approvals.event_rsvps
  for insert
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and tenant_id = public.current_tenant_id()
  );

create policy event_rsvps_update_guardian on approvals.event_rsvps
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()))
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and tenant_id = public.current_tenant_id()
  );

-- ---------------------------------------------------------------------------
-- approvals.event_trip_registrations
-- Guardian: C (own child, open only), R (own child), U (own child, cancel
-- only — open/registered -> cancelled, mirrors cancel_trip_registration's
-- exact transition, EPIC_3_REVIEW.md C2/EPIC_4_REVIEW.md H2's "RLS encodes
-- exactly the RPC's own invariant" lesson). No path to 'paid' or to setting
-- payment_transaction_id exists anywhere in this Epic's RLS surface — that
-- transition is reserved for a future Epic 6 payment RPC.
-- Manager: R (own tenant).
--
-- Fix for EPIC_5_REVIEW.md C1 (the classroom-visibility half — see
-- migration 2 for the capacity/SECURITY DEFINER half): making
-- approvals.check_trip_registration_consistency SECURITY DEFINER (migration
-- 2) means that trigger's own event lookup no longer implicitly enforces
-- "the guardian can only register for an event they can actually see"
-- (events_select_guardian's classroom scoping) — SECURITY DEFINER bypasses
-- RLS entirely for the trigger's own queries. That authorization rule is
-- now stated explicitly in event_trip_registrations_insert_guardian's own
-- WITH CHECK instead of being an accidental side effect of the trigger's
-- prior (non-elevated) execution context.
-- ---------------------------------------------------------------------------
alter table approvals.event_trip_registrations enable row level security;
alter table approvals.event_trip_registrations force row level security;

-- Fix for EPIC_5_REVIEW.md L3: tenant_id stated explicitly in USING.
create policy event_trip_registrations_select_guardian on approvals.event_trip_registrations
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy event_trip_registrations_select_manager on approvals.event_trip_registrations
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy event_trip_registrations_insert_guardian on approvals.event_trip_registrations
  for insert
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and tenant_id = public.current_tenant_id()
    and status = 'open'
    and payment_transaction_id is null
    -- Fix for EPIC_5_REVIEW.md C1: explicit classroom-visibility check,
    -- restoring the authorization rule the trigger used to enforce as an
    -- accidental side effect before it became SECURITY DEFINER (migration 2).
    and exists (
      select 1 from approvals.events e
      where e.id = event_id
        and e.tenant_id = public.current_tenant_id()
        and (e.classroom_id is null or e.classroom_id = any (public.current_guardian_classroom_ids()))
    )
  );

create policy event_trip_registrations_update_guardian on approvals.event_trip_registrations
  for update
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and status in ('open', 'registered')
  )
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and status = 'cancelled'
    and payment_transaction_id is null
  );
