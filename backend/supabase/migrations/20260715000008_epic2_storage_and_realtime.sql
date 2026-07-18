-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 8: academic-attachments bucket shell + day_path realtime
-- Ref: BACKEND_ARCHITECTURE.md §15, §21; BACKEND_EXECUTION_PLAN.md Epic 2 §9-10
--      EPIC_2_ARCHITECTURE_REVIEW.md §7, §8
--
-- profile-photos (Epic 1 bucket) needs no new policy here — its tenant-prefix
-- policies already cover Epic 2's first real photo uploads (child/staff),
-- per the review's confirmation that Epic 1 pre-built this correctly.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('academic-attachments', 'academic-attachments', false, 20971520)  -- 20MB, exam papers/lesson attachments (first real use: Epic 5)
on conflict (id) do nothing;

create policy academic_attachments_read_own_tenant on storage.objects
  for select
  using (
    bucket_id = 'academic-attachments'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or public.is_platform_admin()
    )
  );

create policy academic_attachments_write_manager_teacher on storage.objects
  for insert
  with check (
    bucket_id = 'academic-attachments'
    and public.current_role() in ('manager', 'teacher')
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime — classroom:{id}:day_path (§15). Only the day_path_events table
-- is wired in Epic 2; every other Epic 2-adjacent channel (tenant:{id}:approvals,
-- tenant:{id}:activity, etc.) belongs to a later Epic's tables.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table academic.day_path_events;
