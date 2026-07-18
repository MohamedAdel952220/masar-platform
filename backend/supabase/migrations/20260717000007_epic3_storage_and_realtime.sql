-- ============================================================================
-- Epic 3 — Transport & Safety
-- Migration 7: storage policy addition + Realtime publication
-- Ref: BACKEND_ARCHITECTURE.md §15, §21; BACKEND_EXECUTION_PLAN.md Epic 3
--
-- No new storage bucket — pickup-pass ID photos reuse Epic 1's
-- identity-documents bucket (§21), per the execution plan's explicit note.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- identity-documents (Epic 1 bucket) previously granted read/write to
-- manager only. create_pickup_pass (migration 6) is guardian-only, and its
-- id_photo_object_id parameter implies the guardian uploads that photo
-- themselves before calling the RPC — Epic 1's bucket policies have no
-- guardian write path at all. This is a genuine additive gap-fill: a new
-- INSERT policy granting guardians write access. Epic 1's existing manager
-- read/write policies on this bucket are untouched — this is a purely
-- additive new policy alongside them.
--
-- Fix for EPIC_3_REVIEW.md H5: the original policy scoped only to the
-- tenant-prefix path segment (matching Epic 1's manager-only granularity),
-- which meant any guardian could read/overwrite ANY object anywhere in
-- their tenant's identity-documents folder — including another guardian's
-- uploaded photo, or a staff member's uploaded national ID scan — in a
-- bucket §21 explicitly designates "never public," the platform's tightest
-- access tier. Now requires a second path segment matching the guardian's
-- own auth.uid(), under a dedicated 'pickup-passes' prefix: the required
-- upload path convention is
-- `{tenant_id}/pickup-passes/{guardian_id}/{filename}`. A guardian can only
-- read/write inside their own subpath; they still cannot see or touch any
-- manager-uploaded staff document (a different path prefix entirely) or
-- another guardian's uploads.
-- ---------------------------------------------------------------------------
create policy identity_documents_write_guardian on storage.objects
  for insert
  with check (
    bucket_id = 'identity-documents'
    and public.current_role() = 'guardian'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and (storage.foldername(name))[2] = 'pickup-passes'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

-- Guardians also need to be able to read back the photo they themselves
-- uploaded (e.g. to display it on the pickup-pass detail screen) — scoped
-- to their own subpath only (EPIC_3_REVIEW.md H5), not the whole tenant
-- prefix.
create policy identity_documents_read_guardian on storage.objects
  for select
  using (
    bucket_id = 'identity-documents'
    and public.current_role() = 'guardian'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and (storage.foldername(name))[2] = 'pickup-passes'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime — trip:{trip_id}:position and trip:{trip_id}:status (§15), plus
-- full activation of classroom:{id}:day_path (already wired to
-- academic.day_path_events in Epic 2 migration 8) now that Epic 3's driver
-- actions are its first real write source via
-- academic.set_child_day_path_status.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table transport.gps_pings;
alter publication supabase_realtime add table transport.trips;
alter publication supabase_realtime add table transport.trip_child_status;
