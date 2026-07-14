-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 8: Storage bucket shells + Realtime publication
-- Ref: BACKEND_ARCHITECTURE.md §15, §21, §34; BACKEND_EXECUTION_PLAN.md Epic 1
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Storage buckets — shells only in Epic 1 (no uploads yet; first real use is
-- Epic 2 for profile-photos). Created now, with policies in place, per the
-- Epic 1 execution-plan spec, so later epics only add usage, not plumbing.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('public-branding',    'public-branding',    true,  5242880),    -- 5MB, tenant logos
  ('profile-photos',     'profile-photos',     false, 5242880),    -- 5MB
  ('identity-documents', 'identity-documents',false, 5242880),
  ('generated-documents','generated-documents',false, 20971520)    -- 20MB, invoice/report PDFs
on conflict (id) do nothing;

-- Path convention: every object is prefixed {tenant_id}/... (§21) — the
-- policies below key off the first path segment, which is what makes bucket
-- policies mirror the same tenant-isolation shape as table RLS.

-- public-branding: public read, manager-only write (own tenant prefix)
create policy public_branding_read_anyone on storage.objects
  for select
  using (bucket_id = 'public-branding');

create policy public_branding_write_manager on storage.objects
  for insert
  with check (
    bucket_id = 'public-branding'
    and public.current_role() = 'manager'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- profile-photos: tenant-scoped read for manager + platform_admin(support);
-- self and manager write. Fine-grained per-owner-type visibility (child vs
-- staff vs guardian photo) is layered on in the Epic that introduces each
-- owner table — Epic 1 only establishes the tenant-prefix boundary.
create policy profile_photos_read_own_tenant on storage.objects
  for select
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or public.is_platform_admin()
    )
  );

create policy profile_photos_write_manager on storage.objects
  for insert
  with check (
    bucket_id = 'profile-photos'
    and public.current_role() = 'manager'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- identity-documents: tightest access tier — manager only, own tenant, no
-- public read ever (§21: "never public").
create policy identity_documents_read_manager on storage.objects
  for select
  using (
    bucket_id = 'identity-documents'
    and public.current_role() = 'manager'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy identity_documents_write_manager on storage.objects
  for insert
  with check (
    bucket_id = 'identity-documents'
    and public.current_role() = 'manager'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- generated-documents: server-generated only (Edge Functions via
-- service_role) — client roles get read access to their own tenant's
-- generated files, never write.
create policy generated_documents_read_own_tenant on storage.objects
  for select
  using (
    bucket_id = 'generated-documents'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or public.is_platform_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime — only `platform:tenants` is wired in Epic 1 (tenant status
-- changes visible live to Platform Admin, §15). Every other channel in the
-- architecture's Realtime Event Matrix belongs to a later Epic's tables.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table tenancy.tenants;
