-- ============================================================================
-- Epic 6 — Billing & Payments
-- Migration 7: payment-receipts bucket + policies
-- Ref: BACKEND_ARCHITECTURE.md §15, §21; BACKEND_EXECUTION_PLAN.md Epic 6 §9-10
--
-- generated-documents (Epic 1 bucket) needs no new policy here — its
-- tenant-prefix read policy already covers this Epic's invoice PDFs
-- (confirmed live/correct in EPIC_4_DEPLOYMENT_AUDIT.md §1 for an identical
-- reuse case), and it is server-generated-only by design (no client write
-- policy exists or is needed — the generate-invoice-pdf Edge Function
-- writes via the service_role client).
--
-- No new Realtime channel — BACKEND_EXECUTION_PLAN.md Epic 6 §10: "None new
-- (payment status changes surface via the Epic 4 notification pipeline,
-- not a dedicated realtime channel)".
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('payment-receipts', 'payment-receipts', false, 20971520) -- 20MB, bank-transfer receipt uploads
on conflict (id) do nothing;

-- Path convention (§21): {tenant_id}/{guardian_id}/{filename} — a guardian
-- can only read/write inside their own subpath, mirroring the exact
-- convention EPIC_3_REVIEW.md H5 established for identity-documents'
-- guardian-uploaded pickup-pass photos. Manager gets tenant-wide read for
-- verify_payment's own reconciliation review, matching identity-documents'
-- manager-read-own-tenant precedent (Epic 1).
create policy payment_receipts_write_guardian on storage.objects
  for insert
  with check (
    bucket_id = 'payment-receipts'
    and public.current_role() = 'guardian'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy payment_receipts_read_guardian on storage.objects
  for select
  using (
    bucket_id = 'payment-receipts'
    and public.current_role() = 'guardian'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy payment_receipts_read_manager on storage.objects
  for select
  using (
    bucket_id = 'payment-receipts'
    and public.current_role() = 'manager'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
