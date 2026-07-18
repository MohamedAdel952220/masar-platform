-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 8: storage bucket shell + Realtime publication
-- Ref: BACKEND_ARCHITECTURE.md §15, §21, §26; BACKEND_EXECUTION_PLAN.md Epic 4 §9-10
-- ============================================================================

-- ---------------------------------------------------------------------------
-- chat-attachments (§21: "Future chat file/image sharing... Private, signed
-- URL, conversation participants only") — schema/policy only per the
-- execution plan ("no upload UI yet unless frontend enables it"), same
-- "shell now, real usage later" precedent Epic 1 established for
-- profile-photos/identity-documents.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 20971520)  -- 20MB
on conflict (id) do nothing;

-- Path convention: {tenant_id}/{conversation_id}/{filename} — participant
-- access is verified by checking the caller is one of that conversation's
-- two named participants, not merely by tenant prefix (chat contents are
-- more sensitive than a tenant-wide bucket like profile-photos).
--
-- Fix for EPIC_4_REVIEW.md C1: the original policy had a trailing
-- `or public.is_platform_admin()` disjunct — an unconditional bypass true
-- for ALL three platform-admin tiers (owner/admin/support), granting
-- unrestricted cross-tenant read access to every chat attachment in the
-- system. BACKEND_ARCHITECTURE.md §12 states, verbatim: "Platform Admin
-- never gets blanket R on tenant operational data (children's health
-- notes, chat contents, evaluation details)... this is a deliberate
-- privacy boundary, not an oversight." Removed entirely, with no
-- replacement bypass — Platform Admin gets zero chat-attachment access in
-- this Epic, matching that stated boundary exactly. A future Epic (9,
-- when platform.support_tickets exists) can add a narrow, ticket-linked,
-- audited access path if a real support need arises — modeled the same
-- way every other Platform Admin exception in this codebase is modeled
-- (a dedicated RPC that checks an open, assigned ticket references the
-- resource, not a raw RLS bypass), not by reinstating this policy.
create policy chat_attachments_read_participant on storage.objects
  for select
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and exists (
      select 1 from comms.conversations c
      where c.id::text = (storage.foldername(name))[2]
        and (
          (public.current_role() = 'guardian' and c.guardian_id = auth.uid())
          or (public.current_role() = 'teacher' and c.staff_id = auth.uid())
          or (public.current_role() = 'manager' and c.tenant_id = public.current_tenant_id() and c.status = 'escalated')
        )
    )
  );

create policy chat_attachments_write_participant on storage.objects
  for insert
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and exists (
      select 1 from comms.conversations c
      where c.id::text = (storage.foldername(name))[2]
        and (
          (public.current_role() = 'guardian' and c.guardian_id = auth.uid())
          or (public.current_role() = 'teacher' and c.staff_id = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime — conversation:{id}:messages, user:{id}:notifications (§15,
-- BACKEND_EXECUTION_PLAN.md Epic 4 §10). RLS-scoped per the established
-- convention (§15 implementation note: "channels are scoped by RLS, not by
-- a separate authorization step").
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table comms.messages;
alter publication supabase_realtime add table comms.notifications;
