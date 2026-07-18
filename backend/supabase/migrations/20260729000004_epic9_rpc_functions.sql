-- ============================================================================
-- Epic 9 — Platform Operations & Admin Console
-- Migration 4: RPC functions
-- Ref: BACKEND_ARCHITECTURE.md §8, §12.1, §14.2, §16, §23, §24, §25.6
--
-- Every mutating RPC below accepts an optional trailing p_idempotency_key
-- and implements the exact input-hash envelope established by every frozen
-- Epic's own mutating RPCs (public.review_request, Epic 5; the Epic 8 fix
-- pass's own send_report_draft et al.) — applying EPIC_8_REVIEW.md H1's
-- lesson from the start rather than needing a later fix pass to add it.
--
-- platform.write_activity_log is the reusable population mechanism §24
-- names ("written by the same RPCs that perform the underlying action").
-- Only this Epic's own three new mutating RPCs below call it — no frozen
-- Epic 2-8 RPC was, or could be, modified to call it, since doing so would
-- require editing a frozen migration. See EPIC_9_COMPLETION_REPORT.md Known
-- Limitations for the explicit statement of this scope boundary.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- platform.write_activity_log — sole write path into platform.activity_log
-- (§24), mirroring public.write_audit_log's own shape (Epic 1) exactly.
-- ---------------------------------------------------------------------------
create or replace function platform.write_activity_log(
  p_tenant_id   uuid,
  p_actor_type  platform.activity_actor_type,
  p_actor_id    uuid,
  p_action      text,
  p_target_type text,
  p_target_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into platform.activity_log (tenant_id, actor_type, actor_id, action, target_type, target_id, metadata)
  values (p_tenant_id, p_actor_type, p_actor_id, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

comment on function platform.write_activity_log is
  'Sole write path into platform.activity_log (§24) — curated, RPC-populated, never a raw table-level trigger. Fix for EPIC_9_REVIEW.md C1: service_role only, NOT authenticated — this is an internal helper meant to be called exclusively from within another SECURITY DEFINER RPC (matching comms.enqueue_notification''s own grant shape, Epic 4), not a client-facing function. It performs a bare INSERT using every parameter exactly as supplied, with no internal check that p_tenant_id/p_actor_id match the caller''s own session — granting it to authenticated (the original, incorrect design, mirroring public.write_audit_log''s grant instead) would let any logged-in user of any role forge an activity_log entry for any tenant.';

revoke all on function platform.write_activity_log from public;
revoke all on function platform.write_activity_log from authenticated;
grant execute on function platform.write_activity_log to service_role;

-- ---------------------------------------------------------------------------
-- public.create_support_ticket — manager-only, tenant-scoped (§12: "Support
-- tickets | Manager: C, R (own tenant)"). No direct RLS INSERT exists
-- (migration 3) — this is the sole creation path.
-- ---------------------------------------------------------------------------
create or replace function public.create_support_ticket(
  p_subject          text,
  p_body             text,
  p_category         platform.support_ticket_category,
  p_severity         platform.support_ticket_severity,
  p_idempotency_key  uuid default null
)
returns platform.support_tickets
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id   uuid := public.current_tenant_id();
  v_row         platform.support_tickets;
  v_replay      jsonb;
  v_input_hash  text;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can create a support ticket'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can create a support ticket.', 'human_message_ar', 'فقط المدير يمكنه إنشاء تذكرة دعم.')::text;
  end if;

  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'subject is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Subject is required.', 'human_message_ar', 'الموضوع مطلوب.')::text;
  end if;

  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'body is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Description is required.', 'human_message_ar', 'الوصف مطلوب.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_subject, '') || '|' || coalesce(p_body, '') || '|' || coalesce(p_category::text, '') || '|' || coalesce(p_severity::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return jsonb_populate_record(null::platform.support_tickets, v_replay->'data');
    end if;
  end if;

  insert into platform.support_tickets (tenant_id, subject, body, category, severity, reported_by)
  values (v_tenant_id, btrim(p_subject), btrim(p_body), p_category, p_severity, auth.uid())
  returning * into v_row;

  perform platform.write_activity_log(
    v_tenant_id, 'staff', auth.uid(), 'support_ticket_created', 'support_tickets', v_row.id,
    jsonb_build_object('category', p_category, 'severity', p_severity)
  );

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'create_support_ticket', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.create_support_ticket is
  'Manager-only. Sole creation path for platform.support_tickets (§12). Writes platform.activity_log (§24). Idempotency-key envelope (§25.6).';

revoke all on function public.create_support_ticket from public;
grant execute on function public.create_support_ticket to authenticated;

-- ---------------------------------------------------------------------------
-- public.update_support_ticket — any Platform Admin tier (§12.1: "Support
-- tickets | CRUD, assign (all) | CRUD, assign (all) — no divergence").
-- Combines status transition and assignment into one call (mirrors
-- public.review_request's own combined-decision shape, Epic 5) rather than
-- two separate RPCs, since both are simple field updates with no distinct
-- atomicity concern between them.
-- ---------------------------------------------------------------------------
create or replace function public.update_support_ticket(
  p_ticket_id        uuid,
  p_status           platform.support_ticket_status default null,
  p_assigned_to      uuid default null,
  p_idempotency_key  uuid default null
)
returns platform.support_tickets
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_current          platform.support_tickets;
  v_row              platform.support_tickets;
  v_new_status       platform.support_ticket_status;
  v_new_resolved_at  timestamptz;
  v_assignee_exists  boolean;
  v_replay           jsonb;
  v_input_hash       text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a Platform Admin can update a support ticket'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a Platform Admin can update a support ticket.', 'human_message_ar', 'فقط مسؤول المنصة يمكنه تحديث تذكرة الدعم.')::text;
  end if;

  if p_status is null and p_assigned_to is null then
    raise exception 'At least one of status or assignedTo must be provided'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'At least one of status or assignedTo must be provided.', 'human_message_ar', 'يجب توفير الحالة أو المسؤول المُكلّف على الأقل.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_ticket_id::text, '') || '|' || coalesce(p_status::text, '') || '|' || coalesce(p_assigned_to::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return jsonb_populate_record(null::platform.support_tickets, v_replay->'data');
    end if;
  end if;

  -- Fix for EPIC_9_REVIEW.md H2: FOR UPDATE locks the row for the rest of
  -- this transaction — a concurrent second update_support_ticket call on
  -- the same row blocks here until this transaction commits, then re-reads
  -- the just-committed state instead of computing v_new_status/v_new_
  -- resolved_at and the notification decision below from stale data. The
  -- original implementation used a bare (non-locking) SELECT, which let two
  -- concurrent calls both compute their SET values from the same pre-lock
  -- snapshot — the second UPDATE (last-writer-wins, since it also had no
  -- status guard) could then silently discard the first caller's change,
  -- and both calls could independently decide "status changed" and each
  -- fire its own notification.
  select * into v_current from platform.support_tickets where id = p_ticket_id for update;
  if v_current.id is null then
    raise exception 'Support ticket not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Support ticket not found.', 'human_message_ar', 'لم يتم العثور على تذكرة الدعم.')::text;
  end if;

  if p_assigned_to is not null then
    select exists(select 1 from identity.platform_admins where id = p_assigned_to and deleted_at is null) into v_assignee_exists;
    if not v_assignee_exists then
      raise exception 'Assignee not found'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'The selected Platform Admin was not found.', 'human_message_ar', 'لم يتم العثور على مسؤول المنصة المحدد.')::text;
    end if;
  end if;

  v_new_status := coalesce(p_status, v_current.status);
  v_new_resolved_at := case
    when v_new_status = 'resolved' and v_current.status = 'resolved' then v_current.resolved_at
    when v_new_status = 'resolved' then now()
    else null
  end;

  update platform.support_tickets
  set status = v_new_status,
      assigned_to = coalesce(p_assigned_to, assigned_to),
      resolved_at = v_new_resolved_at
  where id = p_ticket_id
  returning * into v_row;

  perform public.write_audit_log(v_current.tenant_id, 'platform_admin', auth.uid(), 'support_ticket_updated', 'support_tickets', v_row.id);

  -- §16: "Support ticket status change -> Reporting manager, in_app/email, support".
  -- Fix for EPIC_9_REVIEW.md M1: filter deleted_at is null on the recipient
  -- before notifying — the original implementation skipped this check,
  -- unlike every other notification fan-out in this same Epic
  -- (run_tenant_billing_check, run_trial_expiry_sweep,
  -- run_attendance_non_marking_alert all already filter it), so a
  -- terminated reporting manager could still receive a queued notification.
  if p_status is not null and p_status <> v_current.status
     and exists (select 1 from identity.staff_profiles where id = v_current.reported_by and deleted_at is null) then
    perform comms.enqueue_notification(
      v_current.tenant_id, 'staff', v_current.reported_by, 'support', 'Support ticket update',
      'Your support ticket "' || v_current.subject || '" is now ' || v_new_status::text || '.',
      'app://support/' || v_row.id::text
    );
  end if;

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_current.tenant_id, auth.uid(), 'update_support_ticket', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.update_support_ticket is
  'Any Platform Admin tier (§12.1 — no owner/admin-vs-support divergence for this resource). Combines status transition + assignment. Audit log (§23), reporting-manager notification on status change (§16), idempotency-key envelope (§25.6).';

revoke all on function public.update_support_ticket from public;
grant execute on function public.update_support_ticket to authenticated;

-- ---------------------------------------------------------------------------
-- public.issue_tenant_billing_transaction — owner/admin tier only (§12.1:
-- "Tenant billing transactions | CRUD (issue refunds, adjust) [owner/admin]
-- | R only [support]"). Records an already-completed transaction (manual
-- bookkeeping by Masar ops) — mirrors mark_installment_paid_manual's own
-- "manual recording = immediately succeeded" precedent (Epic 6), since no
-- live platform-level payment gateway integration exists (§13's own "None
-- new" for Epic 9's external integrations). "adjust" (§8's own RPC-list
-- wording) is served by this same function: a correction is simply a new,
-- independently-issued transaction, standard ledger practice, not a
-- separate mutation of a historical row (§5: financial records are never
-- hard-deleted or retroactively rewritten).
-- ---------------------------------------------------------------------------
create or replace function public.issue_tenant_billing_transaction(
  p_tenant_id          uuid,
  p_amount             numeric,
  p_kind               platform.billing_transaction_kind,
  p_currency           text default 'EGP',
  p_provider_reference text default null,
  p_idempotency_key    uuid default null
)
returns platform.tenant_billing_transactions
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_row            platform.tenant_billing_transactions;
  v_tenant_exists  boolean;
  v_replay         jsonb;
  v_input_hash     text;
begin
  if not public.is_platform_admin_manager_tier() then
    raise exception 'Only an owner or admin tier Platform Admin can issue a tenant billing transaction'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only an owner or admin tier Platform Admin can issue a tenant billing transaction.', 'human_message_ar', 'فقط مسؤول المنصة (مالك أو مدير) يمكنه إصدار معاملة فوترة للمؤسسة.')::text;
  end if;

  if p_kind = 'refund' then
    raise exception 'Use refund_tenant_billing_transaction to record a refund'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Use the refund action to record a refund.', 'human_message_ar', 'استخدم إجراء الاسترداد لتسجيل عملية استرداد.')::text;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than zero'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Amount must be greater than zero.', 'human_message_ar', 'يجب أن يكون المبلغ أكبر من صفر.')::text;
  end if;

  select exists(select 1 from tenancy.tenants where id = p_tenant_id) into v_tenant_exists;
  if not v_tenant_exists then
    raise exception 'Tenant not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Tenant not found.', 'human_message_ar', 'لم يتم العثور على المؤسسة.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_tenant_id::text, '') || '|' || coalesce(p_amount::text, '') || '|' || coalesce(p_kind::text, '') || '|' || coalesce(p_currency, '') || '|' || coalesce(p_provider_reference, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return jsonb_populate_record(null::platform.tenant_billing_transactions, v_replay->'data');
    end if;
  end if;

  insert into platform.tenant_billing_transactions (tenant_id, amount, currency, kind, status, provider_reference, settled_at)
  values (p_tenant_id, p_amount, coalesce(nullif(btrim(p_currency), ''), 'EGP'), p_kind, 'succeeded', p_provider_reference, now())
  returning * into v_row;

  perform public.write_audit_log(p_tenant_id, 'platform_admin', auth.uid(), 'tenant_billing_transaction_issued', 'tenant_billing_transactions', v_row.id);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, p_tenant_id, auth.uid(), 'issue_tenant_billing_transaction', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.issue_tenant_billing_transaction is
  'Owner/admin Platform Admin tier only. Records an already-settled tenant-to-Masar transaction (manual bookkeeping, mirrors mark_installment_paid_manual''s precedent). Audit log (§23), idempotency-key envelope (§25.6).';

revoke all on function public.issue_tenant_billing_transaction from public;
grant execute on function public.issue_tenant_billing_transaction to authenticated;

-- ---------------------------------------------------------------------------
-- public.refund_tenant_billing_transaction — owner/admin tier only.
-- Transitions the original transaction to status='refunded' AND inserts an
-- independent kind='refund' row referencing it via tenant_id — mirrors
-- billing.refund_payment's own "the ledger keeps both the original and the
-- reversing entry" precedent (Epic 6), applied here since financial records
-- are never mutated-in-place beyond a terminal status flag (§5).
-- ---------------------------------------------------------------------------
create or replace function public.refund_tenant_billing_transaction(
  p_original_transaction_id  uuid,
  p_reason                   text default null,
  p_idempotency_key          uuid default null
)
returns platform.tenant_billing_transactions
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_original    platform.tenant_billing_transactions;
  v_row         platform.tenant_billing_transactions;
  v_replay      jsonb;
  v_input_hash  text;
begin
  if not public.is_platform_admin_manager_tier() then
    raise exception 'Only an owner or admin tier Platform Admin can refund a tenant billing transaction'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only an owner or admin tier Platform Admin can refund a tenant billing transaction.', 'human_message_ar', 'فقط مسؤول المنصة (مالك أو مدير) يمكنه استرداد معاملة فوترة المؤسسة.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_original_transaction_id::text, '') || '|' || coalesce(p_reason, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return jsonb_populate_record(null::platform.tenant_billing_transactions, v_replay->'data');
    end if;
  end if;

  -- Fix for EPIC_9_REVIEW.md H1: FOR UPDATE locks the row for the rest of
  -- this transaction — a concurrent second refund_tenant_billing_
  -- transaction call on the same row blocks here until this transaction
  -- commits or rolls back, then re-reads the ALREADY-refunded row and
  -- correctly hits the status<>'succeeded' check below instead of racing
  -- past it. The original implementation used a bare (non-locking) SELECT
  -- here, which let two concurrent calls both pass the status check before
  -- either committed.
  select * into v_original from platform.tenant_billing_transactions where id = p_original_transaction_id for update;
  if v_original.id is null then
    raise exception 'Tenant billing transaction not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Tenant billing transaction not found.', 'human_message_ar', 'لم يتم العثور على معاملة الفوترة.')::text;
  end if;

  if v_original.status <> 'succeeded' then
    raise exception 'Only a succeeded transaction can be refunded'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'Only a succeeded transaction can be refunded.', 'human_message_ar', 'يمكن استرداد المعاملات الناجحة فقط.')::text;
  end if;

  if v_original.kind = 'refund' then
    raise exception 'A refund cannot itself be refunded'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A refund cannot itself be refunded.', 'human_message_ar', 'لا يمكن استرداد عملية استرداد.')::text;
  end if;

  -- Fix for EPIC_9_REVIEW.md H1: the WITH CHECK-style status guard here is
  -- defense-in-depth on top of the FOR UPDATE lock above (the M1 pattern,
  -- matching billing.settle_payment_transaction's own guard this function's
  -- header comment already claimed, but previously didn't actually apply).
  update platform.tenant_billing_transactions
  set status = 'refunded'
  where id = p_original_transaction_id and status = 'succeeded';

  insert into platform.tenant_billing_transactions (tenant_id, amount, currency, kind, status, settled_at)
  values (v_original.tenant_id, v_original.amount, v_original.currency, 'refund', 'succeeded', now())
  returning * into v_row;

  perform public.write_audit_log(v_original.tenant_id, 'platform_admin', auth.uid(), 'tenant_billing_transaction_refunded', 'tenant_billing_transactions', v_row.id);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_original.tenant_id, auth.uid(), 'refund_tenant_billing_transaction', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.refund_tenant_billing_transaction is
  'Owner/admin Platform Admin tier only. Transitions the original transaction to refunded and inserts an independent kind=refund row (mirrors billing.refund_payment''s own precedent, Epic 6). Audit log (§23), idempotency-key envelope (§25.6).';

revoke all on function public.refund_tenant_billing_transaction from public;
grant execute on function public.refund_tenant_billing_transaction to authenticated;
