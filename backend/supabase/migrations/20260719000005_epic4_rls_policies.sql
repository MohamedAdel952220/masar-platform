-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 5: RLS policies for every Epic 4 table
-- Ref: BACKEND_ARCHITECTURE.md §12, §12.1, §13
--
-- Convention (unchanged from Epic 1/2/3): FORCE ROW LEVEL SECURITY
-- everywhere; separate named policy per role/action; direct equality checks
-- wherever a table carries its own scoping column.
--
-- Deliberate, EPIC_3_REVIEW.md-C2-lesson-informed scoping decisions applied
-- from the start (not retrofitted): comms.conversations gets NO client
-- UPDATE policy at all (escalate_conversation, migration 6, is SECURITY
-- DEFINER and is the only status-transition path — an unused broad grant is
-- exactly the "RLS bypasses RPC invariants" shape that Epic review found
-- repeatedly). comms.announcement_recipients and comms.notifications get NO
-- client INSERT policy — both are populated exclusively by SECURITY DEFINER
-- RPCs/helpers (migration 6), never by a client claiming to be a recipient
-- of their own choosing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.current_account_is_active() — fix for EPIC_4_REVIEW.md L2: none of
-- this Epic's RLS policies checked whether the caller's OWN profile row is
-- soft-deleted, reintroducing the pre-fix version of EPIC_3_REVIEW.md L2
-- (current_driver_bus_ids() not checking driver_profiles.deleted_at) across
-- an entirely new table set. A JWT role claim can outlive the profile row
-- it represents for the remainder of the session (~1h, §10.5) — this
-- helper closes that window for every Epic 4 policy that reads/writes
-- account-sensitive data, applied here as one reusable, additive function
-- rather than one-off checks per policy (so future Epics only need to call
-- it, not rediscover the lesson).
-- ---------------------------------------------------------------------------
create or replace function public.current_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_role()
    when 'guardian' then exists(select 1 from identity.guardian_profiles where id = auth.uid() and deleted_at is null)
    when 'teacher' then exists(select 1 from identity.staff_profiles where id = auth.uid() and deleted_at is null)
    when 'reception' then exists(select 1 from identity.staff_profiles where id = auth.uid() and deleted_at is null)
    when 'manager' then exists(select 1 from identity.staff_profiles where id = auth.uid() and deleted_at is null)
    when 'driver' then exists(select 1 from identity.driver_profiles where id = auth.uid() and deleted_at is null)
    when 'platform_admin' then exists(select 1 from identity.platform_admins where id = auth.uid() and deleted_at is null)
    else false
  end;
$$;

comment on function public.current_account_is_active() is
  'Fix for EPIC_4_REVIEW.md L2 — true only if the caller''s own profile row (matching their JWT role claim) is not soft-deleted. Applied to Epic 4''s account-sensitive read/write policies below.';

-- ---------------------------------------------------------------------------
-- public.current_notification_recipient_type() — fix for EPIC_4_REVIEW.md
-- H2: device_tokens_insert_own/update_own and notification_preferences_
-- insert_own/update_own previously validated only `recipient_id = auth.uid()`
-- — recipient_type (and tenant_id) were entirely caller-controlled, letting
-- a direct-REST client (bypassing register_device_token/
-- update_notification_preferences) claim an arbitrary recipient_type (e.g.
-- a guardian inserting recipient_type='platform_admin' against their own
-- recipient_id), corrupting notification-dispatch's profile-table
-- resolution. Same defect shape as EPIC_3_REVIEW.md C2 ("RLS doesn't
-- encode the RPC's own invariant"). This helper computes the SAME
-- role->recipient_type mapping the two RPCs already compute server-side,
-- so the RLS layer can enforce it too, independent of write path.
-- ---------------------------------------------------------------------------
create or replace function public.current_notification_recipient_type()
returns comms.notification_recipient_type
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_role()
    when 'teacher' then 'staff'
    when 'reception' then 'staff'
    when 'manager' then 'staff'
    when 'guardian' then 'guardian'
    when 'driver' then 'driver'
    when 'platform_admin' then 'platform_admin'
    else null
  end::comms.notification_recipient_type;
$$;

comment on function public.current_notification_recipient_type() is
  'Fix for EPIC_4_REVIEW.md H2 — the same role->recipient_type mapping register_device_token/update_notification_preferences compute server-side, exposed so RLS can enforce it too.';

-- ---------------------------------------------------------------------------
-- comms.conversations
-- Guardian: R (own), C (own — send_message may create one). Teacher: R (own),
-- C. Manager: R (escalated only, own tenant). No UPDATE policy for anyone —
-- see file header.
-- ---------------------------------------------------------------------------
alter table comms.conversations enable row level security;
alter table comms.conversations force row level security;

create policy conversations_select_guardian on comms.conversations
  for select
  using (public.current_role() = 'guardian' and guardian_id = auth.uid() and public.current_account_is_active());

create policy conversations_select_staff on comms.conversations
  for select
  using (public.current_role() = 'teacher' and staff_id = auth.uid() and public.current_account_is_active());

create policy conversations_select_manager on comms.conversations
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager' and status = 'escalated');

create policy conversations_insert_guardian on comms.conversations
  for insert
  with check (public.current_role() = 'guardian' and guardian_id = auth.uid() and tenant_id = public.current_tenant_id());

create policy conversations_insert_staff on comms.conversations
  for insert
  with check (public.current_role() = 'teacher' and staff_id = auth.uid() and tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------------
-- comms.messages
-- Guardian/teacher: CR (own conversation), U (mark own-inbound messages as
-- read — scoped narrowly: USING requires not-yet-read, WITH CHECK requires
-- now-read, same C2-lesson pattern as EPIC_3_FIX_REPORT.md's
-- pickup_scan_events fix, so this policy can never be used to edit body/
-- sender_id). Manager: R (own tenant, escalated conversations only).
-- ---------------------------------------------------------------------------
alter table comms.messages enable row level security;
alter table comms.messages force row level security;

create policy messages_select_guardian on comms.messages
  for select
  using (
    public.current_role() = 'guardian'
    and public.current_account_is_active()
    and conversation_id in (select id from comms.conversations where guardian_id = auth.uid())
  );

create policy messages_select_staff on comms.messages
  for select
  using (
    public.current_role() = 'teacher'
    and public.current_account_is_active()
    and conversation_id in (select id from comms.conversations where staff_id = auth.uid())
  );

create policy messages_select_manager on comms.messages
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'manager'
    and conversation_id in (select id from comms.conversations where status = 'escalated' and tenant_id = public.current_tenant_id())
  );

create policy messages_insert_guardian on comms.messages
  for insert
  with check (
    public.current_role() = 'guardian'
    and sender_type = 'guardian'
    and sender_id = auth.uid()
    and conversation_id in (select id from comms.conversations where guardian_id = auth.uid())
  );

create policy messages_insert_staff on comms.messages
  for insert
  with check (
    public.current_role() = 'teacher'
    and sender_type = 'staff'
    and sender_id = auth.uid()
    and conversation_id in (select id from comms.conversations where staff_id = auth.uid())
  );

-- Fix for EPIC_4_REVIEW.md M1: previously didn't exclude the caller's own
-- sent messages, so a participant could mark their own outbound message as
-- "read" — since read_at is a single shared column (§3.45 has no per-
-- recipient read-receipt table), this corrupted the read-receipt semantics
-- a chat UI would reasonably build on it. Now requires sender_id IS
-- DISTINCT FROM auth.uid() (null-safe — a sender_id of NULL, i.e.
-- sender_type='system', is also correctly excludable/includable by this
-- comparison) — a participant can only ever mark an INBOUND message as read.
create policy messages_update_guardian on comms.messages
  for update
  using (
    public.current_role() = 'guardian'
    and read_at is null
    and sender_id is distinct from auth.uid()
    and conversation_id in (select id from comms.conversations where guardian_id = auth.uid())
  )
  with check (
    public.current_role() = 'guardian'
    and read_at is not null
    and conversation_id in (select id from comms.conversations where guardian_id = auth.uid())
  );

create policy messages_update_staff on comms.messages
  for update
  using (
    public.current_role() = 'teacher'
    and read_at is null
    and sender_id is distinct from auth.uid()
    and conversation_id in (select id from comms.conversations where staff_id = auth.uid())
  )
  with check (
    public.current_role() = 'teacher'
    and read_at is not null
    and conversation_id in (select id from comms.conversations where staff_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- comms.announcements
-- Guardian/teacher/driver: R (targeted, via announcement_recipients).
-- Manager: CRUD (own tenant). Platform Admin owner/admin: CRUD (platform-
-- wide); support: R only (§12.1).
-- ---------------------------------------------------------------------------
alter table comms.announcements enable row level security;
alter table comms.announcements force row level security;

create policy announcements_select_guardian on comms.announcements
  for select
  using (
    public.current_role() = 'guardian'
    and public.current_account_is_active()
    and id in (select announcement_id from comms.announcement_recipients where recipient_type = 'guardian' and recipient_id = auth.uid())
  );

create policy announcements_select_staff on comms.announcements
  for select
  using (
    public.current_role() in ('teacher', 'reception')
    and public.current_account_is_active()
    and id in (select announcement_id from comms.announcement_recipients where recipient_type = 'staff' and recipient_id = auth.uid())
  );

create policy announcements_select_driver on comms.announcements
  for select
  using (
    public.current_role() = 'driver'
    and public.current_account_is_active()
    and id in (select announcement_id from comms.announcement_recipients where recipient_type = 'driver' and recipient_id = auth.uid())
  );

create policy announcements_select_manager on comms.announcements
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy announcements_select_platform_admin on comms.announcements
  for select
  using (tenant_id is null and public.is_platform_admin());

create policy announcements_insert_manager on comms.announcements
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy announcements_insert_platform_admin on comms.announcements
  for insert
  with check (tenant_id is null and public.is_platform_admin_manager_tier());

create policy announcements_update_manager on comms.announcements
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy announcements_update_platform_admin on comms.announcements
  for update
  using (tenant_id is null and public.is_platform_admin_manager_tier())
  with check (tenant_id is null and public.is_platform_admin_manager_tier());

create policy announcements_delete_manager on comms.announcements
  for delete
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy announcements_delete_platform_admin on comms.announcements
  for delete
  using (tenant_id is null and public.is_platform_admin_manager_tier());

-- ---------------------------------------------------------------------------
-- comms.announcement_recipients
-- No INSERT policy for any client role — populated exclusively by
-- broadcast_announcement (SECURITY DEFINER, migration 6). Recipients can R,U
-- (mark read) their own row; manager/platform_admin can R their own
-- announcements' recipients (delivery-report visibility).
-- ---------------------------------------------------------------------------
alter table comms.announcement_recipients enable row level security;
alter table comms.announcement_recipients force row level security;

create policy announcement_recipients_select_own on comms.announcement_recipients
  for select
  using (
    public.current_account_is_active()
    and (
      (recipient_type = 'guardian' and public.current_role() = 'guardian' and recipient_id = auth.uid())
      or (recipient_type = 'staff' and public.current_role() in ('teacher', 'reception') and recipient_id = auth.uid())
      or (recipient_type = 'driver' and public.current_role() = 'driver' and recipient_id = auth.uid())
    )
  );

create policy announcement_recipients_select_manager on comms.announcement_recipients
  for select
  using (
    public.current_role() = 'manager'
    and announcement_id in (select id from comms.announcements where tenant_id = public.current_tenant_id())
  );

create policy announcement_recipients_select_platform_admin on comms.announcement_recipients
  for select
  using (public.is_platform_admin() and announcement_id in (select id from comms.announcements where tenant_id is null));

create policy announcement_recipients_update_own on comms.announcement_recipients
  for update
  using (
    read_at is null
    and (
      (recipient_type = 'guardian' and public.current_role() = 'guardian' and recipient_id = auth.uid())
      or (recipient_type = 'staff' and public.current_role() in ('teacher', 'reception') and recipient_id = auth.uid())
      or (recipient_type = 'driver' and public.current_role() = 'driver' and recipient_id = auth.uid())
    )
  )
  with check (
    read_at is not null
    and (
      (recipient_type = 'guardian' and public.current_role() = 'guardian' and recipient_id = auth.uid())
      or (recipient_type = 'staff' and public.current_role() in ('teacher', 'reception') and recipient_id = auth.uid())
      or (recipient_type = 'driver' and public.current_role() = 'driver' and recipient_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- comms.notifications
-- No INSERT policy for any client role — populated exclusively by
-- comms.enqueue_notification (SECURITY DEFINER, migration 6). Every role: R,
-- U (own, mark read) — §12's uniform "R, U (own, mark read)" row.
-- ---------------------------------------------------------------------------
alter table comms.notifications enable row level security;
alter table comms.notifications force row level security;

create policy notifications_select_own on comms.notifications
  for select
  using (
    public.current_account_is_active()
    and (
      (recipient_type = 'guardian' and public.current_role() = 'guardian' and recipient_id = auth.uid())
      or (recipient_type = 'staff' and public.current_role() in ('teacher', 'reception', 'manager') and recipient_id = auth.uid())
      or (recipient_type = 'driver' and public.current_role() = 'driver' and recipient_id = auth.uid())
      or (recipient_type = 'platform_admin' and public.is_platform_admin() and recipient_id = auth.uid())
    )
  );

create policy notifications_update_own on comms.notifications
  for update
  using (
    read_at is null
    and (
      (recipient_type = 'guardian' and public.current_role() = 'guardian' and recipient_id = auth.uid())
      or (recipient_type = 'staff' and public.current_role() in ('teacher', 'reception', 'manager') and recipient_id = auth.uid())
      or (recipient_type = 'driver' and public.current_role() = 'driver' and recipient_id = auth.uid())
      or (recipient_type = 'platform_admin' and public.is_platform_admin() and recipient_id = auth.uid())
    )
  )
  with check (
    read_at is not null
    and (
      (recipient_type = 'guardian' and public.current_role() = 'guardian' and recipient_id = auth.uid())
      or (recipient_type = 'staff' and public.current_role() in ('teacher', 'reception', 'manager') and recipient_id = auth.uid())
      or (recipient_type = 'driver' and public.current_role() = 'driver' and recipient_id = auth.uid())
      or (recipient_type = 'platform_admin' and public.is_platform_admin() and recipient_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- comms.notification_deliveries — no policy for any client role. Not in
-- §12's permission matrix at all (an operational/delivery-tracking detail,
-- not a user-facing resource) — service_role (notification-dispatch Edge
-- Function) only, same precedent as jobs.idempotency_keys.
-- ---------------------------------------------------------------------------
alter table comms.notification_deliveries enable row level security;
alter table comms.notification_deliveries force row level security;

-- ---------------------------------------------------------------------------
-- comms.device_tokens — CRUD (own, self-service) for every role.
--
-- Fix for EPIC_4_REVIEW.md H2: insert/update now also require
-- recipient_type to match the caller's own role-derived value, and
-- tenant_id to match current_tenant_id() (or be null, for platform_admin) —
-- closing the gap where only recipient_id was ever validated.
-- ---------------------------------------------------------------------------
alter table comms.device_tokens enable row level security;
alter table comms.device_tokens force row level security;

create policy device_tokens_select_own on comms.device_tokens
  for select
  using (recipient_id = auth.uid());

create policy device_tokens_insert_own on comms.device_tokens
  for insert
  with check (
    recipient_id = auth.uid()
    and recipient_type = public.current_notification_recipient_type()
    and tenant_id is not distinct from public.current_tenant_id()
  );

create policy device_tokens_update_own on comms.device_tokens
  for update
  using (recipient_id = auth.uid())
  with check (
    recipient_id = auth.uid()
    and recipient_type = public.current_notification_recipient_type()
    and tenant_id is not distinct from public.current_tenant_id()
  );

create policy device_tokens_delete_own on comms.device_tokens
  for delete
  using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- comms.notification_preferences — CRUD (own) for every role.
--
-- Fix for EPIC_4_REVIEW.md H2 — same shape as device_tokens above.
-- ---------------------------------------------------------------------------
alter table comms.notification_preferences enable row level security;
alter table comms.notification_preferences force row level security;

create policy notification_preferences_select_own on comms.notification_preferences
  for select
  using (recipient_id = auth.uid());

create policy notification_preferences_insert_own on comms.notification_preferences
  for insert
  with check (
    recipient_id = auth.uid()
    and recipient_type = public.current_notification_recipient_type()
    and tenant_id is not distinct from public.current_tenant_id()
  );

create policy notification_preferences_update_own on comms.notification_preferences
  for update
  using (recipient_id = auth.uid())
  with check (
    recipient_id = auth.uid()
    and recipient_type = public.current_notification_recipient_type()
    and tenant_id is not distinct from public.current_tenant_id()
  );

create policy notification_preferences_delete_own on comms.notification_preferences
  for delete
  using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- jobs.background_job_queue — no policy for any client role, service_role
-- only (same precedent as jobs.idempotency_keys, Epic 1).
-- ---------------------------------------------------------------------------
alter table jobs.background_job_queue enable row level security;
alter table jobs.background_job_queue force row level security;
