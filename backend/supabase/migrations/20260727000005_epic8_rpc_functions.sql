-- ============================================================================
-- Epic 8 — AI Report Architecture
-- Migration 5: RPC functions
-- Ref: BACKEND_ARCHITECTURE.md §14.2, §16, §19, §23, §25.6
--
-- All five client-facing RPCs below are manager-only, matching §12's own
-- literal permission-matrix cell for AI Reports: "Teacher: C (own
-- students), R own" — no U, no D. Every status-transition/deletion/export
-- action is therefore an "update-like" capability the matrix reserves for
-- Manager ("CRUD (all)") alone; a teacher's own workflow is C (via
-- ai-draft-report) + R own (RLS, migration 4) only. This directly serves
-- §25's own named "content-quality/liability risk" mitigation — AI-authored
-- content about a specific child never reaches a parent without a second,
-- managerial decision point beyond the drafting teacher's own judgment.
--
-- reports.increment_ai_usage is the shared cap-enforcement seam both AI
-- Edge Functions call (service_role only) — a single committed mechanism,
-- not duplicated per-function logic (§3.20.1's own "single committed
-- mechanism" framing, and this task's own "avoid duplicate logic"
-- instruction).
--
-- Fix for EPIC_8_REVIEW.md H1: every one of the five client-facing RPCs
-- below now accepts an optional trailing p_idempotency_key uuid and
-- implements the exact input-hash envelope already established by every
-- frozen Epic's own mutating RPCs (public.review_request, Epic 5;
-- public.generate_invoice/verify_payment/refund_payment, Epic 6) —
-- §14.3/§25.6's universal convention, previously omitted here entirely. A
-- null key (the default) preserves the original no-idempotency behavior for
-- any caller that doesn't supply one, matching §14.3's own "not every
-- caller supplies a key... proceed without replay protection rather than
-- hard-failing" allowance.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reports.increment_ai_usage — atomic cap-check-and-increment (§3.20.1,
-- §19). Looks up the tenant's own plan cap internally so the whole
-- check+increment stays one atomic operation with no read-then-write race
-- window between "read the cap" and "increment the counter".
-- ---------------------------------------------------------------------------
create or replace function reports.increment_ai_usage(p_tenant_id uuid)
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_cap        int;
  v_calls_used int;
begin
  select pc.ai_daily_call_cap into v_cap
  from tenancy.tenants t
  join tenancy.plan_catalog pc on pc.id = t.plan_id
  where t.id = p_tenant_id;

  if v_cap is null then
    raise exception 'Tenant or plan not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Tenant or plan not found.', 'human_message_ar', 'لم يتم العثور على المؤسسة أو الخطة.')::text;
  end if;

  insert into reports.ai_usage_counters (tenant_id, usage_date, calls_used)
  values (p_tenant_id, current_date, 1)
  on conflict (tenant_id, usage_date) do update set calls_used = reports.ai_usage_counters.calls_used + 1
  returning calls_used into v_calls_used;

  -- §19 Acceptance Criteria: "A tenant that exceeds its daily AI-call cap
  -- receives a clean EXTERNAL_AI_QUOTA_EXCEEDED error, not a silent failure
  -- or an uncapped bill." The increment above already happened — matching
  -- §3.20.1's own literal wording ("atomically increments... and rejects
  -- the call... if the returned count exceeds") — so a rejected call still
  -- counts against the cap, which is the conservative, cost-safe direction
  -- (never undercounts, only ever over-counts by the rejected call itself).
  if v_calls_used > v_cap then
    raise exception 'Daily AI usage cap exceeded'
      using errcode = 'P0001',
            detail = json_build_object('code', 'EXTERNAL_AI_QUOTA_EXCEEDED', 'human_message_en', 'Your tenant has reached its daily AI usage limit. Please try again tomorrow.', 'human_message_ar', 'وصلت مؤسستك إلى الحد اليومي لاستخدام الذكاء الاصطناعي. برجاء المحاولة غدًا.')::text;
  end if;

  return v_calls_used;
end;
$$;

comment on function reports.increment_ai_usage is
  'Atomic cap-check-and-increment for the per-tenant daily AI-call counter (§3.20.1, §19). service_role only — called from ai-polish-note/ai-draft-report via the admin client, never directly by an authenticated end user.';

revoke all on function reports.increment_ai_usage from public;
grant execute on function reports.increment_ai_usage to service_role;

-- ---------------------------------------------------------------------------
-- public.send_report_draft — the sole path from draft/ready to sent (§19's
-- own named human-in-the-loop invariant). Manager-only.
-- ---------------------------------------------------------------------------
create or replace function public.send_report_draft(p_draft_id uuid, p_idempotency_key uuid default null)
returns reports.ai_report_drafts
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id   uuid := public.current_tenant_id();
  v_row         reports.ai_report_drafts;
  v_exists      boolean;
  v_channels    reports.delivery_channel[];
  v_replay      jsonb;
  v_input_hash  text;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can send a report draft'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can send a report draft.', 'human_message_ar', 'فقط المدير يمكنه إرسال مسودة التقرير.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_draft_id::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return jsonb_populate_record(null::reports.ai_report_drafts, v_replay->'data');
    end if;
  end if;

  select delivery_channels into v_channels from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id;
  if v_channels is null or array_length(v_channels, 1) is null then
    raise exception 'At least one delivery channel is required before sending'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'At least one delivery channel is required before sending.', 'human_message_ar', 'يلزم قناة توصيل واحدة على الأقل قبل الإرسال.')::text;
  end if;

  update reports.ai_report_drafts
  set status = 'sent', sent_at = now()
  where id = p_draft_id and tenant_id = v_tenant_id and status in ('draft', 'ready')
  returning * into v_row;

  if v_row.id is null then
    select exists(select 1 from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id) into v_exists;
    if not v_exists then
      raise exception 'Report draft not found'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Report draft not found.', 'human_message_ar', 'لم يتم العثور على مسودة التقرير.')::text;
    else
      raise exception 'This report draft cannot be sent from its current status'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This report draft cannot be sent from its current status.', 'human_message_ar', 'لا يمكن إرسال مسودة التقرير هذه من حالتها الحالية.')::text;
    end if;
  end if;

  -- §16: "AI report sent -> Target guardians, push/in_app/whatsapp/email,
  -- category=report_ready". Set-based fan-out to every non-deactivated
  -- guardian of this child (EPIC_5_REVIEW.md M2's "filter deleted_at"
  -- lesson applied).
  insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
  select v_tenant_id, 'guardian', cgl.guardian_id, 'report_ready', 'New report available',
         'A new report for your child is ready to view.',
         'app://reports/' || v_row.id::text, 'info'
  from academic.child_guardian_links cgl
  join identity.guardian_profiles g on g.id = cgl.guardian_id
  where cgl.child_id = v_row.child_id and g.deleted_at is null;

  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'report_draft_sent', 'ai_report_drafts', v_row.id);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'send_report_draft', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.send_report_draft is
  'Manager-only. Sole path from draft/ready to sent (§19). Atomic guarded UPDATE, NOT_FOUND/STATE_ALREADY_PROCESSED disambiguation (the M1 pattern), guardian notification fan-out (§16), audit log (§23). Idempotency-key envelope (EPIC_8_REVIEW.md H1) — a retry with the same key replays the original response instead of re-evaluating status.';

revoke all on function public.send_report_draft from public;
grant execute on function public.send_report_draft to authenticated;

-- ---------------------------------------------------------------------------
-- public.schedule_report_draft — the sole path from draft/ready to
-- scheduled. Delivery itself happens later, via
-- reports.sweep_scheduled_report_drafts (migration 6) — the human-in-the-
-- loop decision already happened here, at scheduling time (§19's own
-- explicit framing).
-- ---------------------------------------------------------------------------
create or replace function public.schedule_report_draft(p_draft_id uuid, p_scheduled_for timestamptz, p_idempotency_key uuid default null)
returns reports.ai_report_drafts
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id   uuid := public.current_tenant_id();
  v_row         reports.ai_report_drafts;
  v_exists      boolean;
  v_channels    reports.delivery_channel[];
  v_replay      jsonb;
  v_input_hash  text;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can schedule a report draft'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can schedule a report draft.', 'human_message_ar', 'فقط المدير يمكنه جدولة مسودة التقرير.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_draft_id::text, '') || '|' || coalesce(p_scheduled_for::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return jsonb_populate_record(null::reports.ai_report_drafts, v_replay->'data');
    end if;
  end if;

  if p_scheduled_for <= now() then
    raise exception 'scheduled_for must be in the future'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'scheduled_for must be in the future.', 'human_message_ar', 'يجب أن يكون وقت الجدولة في المستقبل.')::text;
  end if;

  select delivery_channels into v_channels from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id;
  if v_channels is null or array_length(v_channels, 1) is null then
    raise exception 'At least one delivery channel is required before scheduling'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'At least one delivery channel is required before scheduling.', 'human_message_ar', 'يلزم قناة توصيل واحدة على الأقل قبل الجدولة.')::text;
  end if;

  update reports.ai_report_drafts
  set status = 'scheduled', scheduled_for = p_scheduled_for
  where id = p_draft_id and tenant_id = v_tenant_id and status in ('draft', 'ready')
  returning * into v_row;

  if v_row.id is null then
    select exists(select 1 from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id) into v_exists;
    if not v_exists then
      raise exception 'Report draft not found'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Report draft not found.', 'human_message_ar', 'لم يتم العثور على مسودة التقرير.')::text;
    else
      raise exception 'This report draft cannot be scheduled from its current status'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This report draft cannot be scheduled from its current status.', 'human_message_ar', 'لا يمكن جدولة مسودة التقرير هذه من حالتها الحالية.')::text;
    end if;
  end if;

  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'report_draft_scheduled', 'ai_report_drafts', v_row.id);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'schedule_report_draft', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.schedule_report_draft is
  'Manager-only. Sole path from draft/ready to scheduled (§19). Delivery happens later via reports.sweep_scheduled_report_drafts (migration 6). Audit log (§23). Idempotency-key envelope (EPIC_8_REVIEW.md H1).';

revoke all on function public.schedule_report_draft from public;
grant execute on function public.schedule_report_draft to authenticated;

-- ---------------------------------------------------------------------------
-- public.resend_report_draft — re-fires the guardian notification for an
-- already-sent report (e.g. a parent says they never got the push
-- notification). Never changes status/sent_at.
-- ---------------------------------------------------------------------------
create or replace function public.resend_report_draft(p_draft_id uuid, p_idempotency_key uuid default null)
returns reports.ai_report_drafts
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id   uuid := public.current_tenant_id();
  v_row         reports.ai_report_drafts;
  v_replay      jsonb;
  v_input_hash  text;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can resend a report draft'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can resend a report draft.', 'human_message_ar', 'فقط المدير يمكنه إعادة إرسال مسودة التقرير.')::text;
  end if;

  -- Fix for EPIC_8_REVIEW.md H1: unlike send/schedule (guarded by an atomic
  -- status transition), resend is deliberately repeatable by design — a
  -- manager may legitimately click "Resend" more than once. The idempotency
  -- envelope here therefore guards specifically against an unintentional
  -- *duplicate* (the same client retry firing the same logical action
  -- twice), not against a deliberate second resend using a *different*
  -- idempotency key — exactly the distinction §25.6 draws between "same key,
  -- same payload" (replay) and a genuinely new logical action.
  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_draft_id::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return jsonb_populate_record(null::reports.ai_report_drafts, v_replay->'data');
    end if;
  end if;

  select * into v_row from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id;
  if v_row.id is null then
    raise exception 'Report draft not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Report draft not found.', 'human_message_ar', 'لم يتم العثور على مسودة التقرير.')::text;
  end if;

  if v_row.status <> 'sent' then
    raise exception 'Only a sent report draft can be resent'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Only a sent report draft can be resent.', 'human_message_ar', 'يمكن فقط إعادة إرسال مسودة تقرير مُرسلة بالفعل.')::text;
  end if;

  insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
  select v_tenant_id, 'guardian', cgl.guardian_id, 'report_ready', 'New report available',
         'A new report for your child is ready to view.',
         'app://reports/' || v_row.id::text, 'info'
  from academic.child_guardian_links cgl
  join identity.guardian_profiles g on g.id = cgl.guardian_id
  where cgl.child_id = v_row.child_id and g.deleted_at is null;

  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'report_draft_resent', 'ai_report_drafts', v_row.id);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'resend_report_draft', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.resend_report_draft is
  'Manager-only. Re-fires the guardian notification fan-out for an already-sent draft only. Never mutates status/sent_at. Audit log (§23). Idempotency-key envelope (EPIC_8_REVIEW.md H1) guards a same-key retry only — a fresh key still legitimately resends.';

revoke all on function public.resend_report_draft from public;
grant execute on function public.resend_report_draft to authenticated;

-- ---------------------------------------------------------------------------
-- public.delete_report_draft — hard delete, but never for an already-sent
-- draft (preserves delivered-report history, the same judgment call §8
-- applies to every other historical/transactional record in this system,
-- extended here even though reports.ai_report_drafts is not itself named in
-- §8's own table list).
-- ---------------------------------------------------------------------------
create or replace function public.delete_report_draft(p_draft_id uuid, p_idempotency_key uuid default null)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id   uuid := public.current_tenant_id();
  v_row         reports.ai_report_drafts;
  v_replay      jsonb;
  v_input_hash  text;
  v_result      jsonb;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can delete a report draft'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can delete a report draft.', 'human_message_ar', 'فقط المدير يمكنه حذف مسودة التقرير.')::text;
  end if;

  -- Fix for EPIC_8_REVIEW.md H1: return type changed from void to jsonb so a
  -- replayed call has a concrete response to store/return — matching
  -- §25.6's literal contract ("returns the same result the second time"),
  -- rather than the previous behavior where a retried delete surfaced
  -- NOT_FOUND on its second call, which is a different outcome than the
  -- first (a real, if minor, idempotency-contract violation on its own).
  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_draft_id::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return v_replay->'data';
    end if;
  end if;

  select * into v_row from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id;
  if v_row.id is null then
    raise exception 'Report draft not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Report draft not found.', 'human_message_ar', 'لم يتم العثور على مسودة التقرير.')::text;
  end if;

  if v_row.status = 'sent' then
    raise exception 'A sent report draft cannot be deleted'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A sent report draft cannot be deleted.', 'human_message_ar', 'لا يمكن حذف مسودة تقرير تم إرسالها بالفعل.')::text;
  end if;

  delete from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id;

  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'report_draft_deleted', 'ai_report_drafts', v_row.id);

  v_result := jsonb_build_object('deleted', true, 'draftId', v_row.id);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'delete_report_draft', jsonb_build_object('_inputHash', v_input_hash, 'data', v_result));
  end if;

  return v_result;
end;
$$;

comment on function public.delete_report_draft is
  'Manager-only. Hard-deletes a draft/ready/scheduled report — never a sent one (preserves delivered-report history). Audit log (§23). Returns jsonb (not void) and carries an idempotency-key envelope (EPIC_8_REVIEW.md H1) so a retried delete replays {deleted:true,...} instead of surfacing NOT_FOUND on its second call.';

revoke all on function public.delete_report_draft from public;
grant execute on function public.delete_report_draft to authenticated;

-- ---------------------------------------------------------------------------
-- public.export_report_draft — enqueues a background job to render the
-- report as a PDF into the generated-documents bucket (§9, §21), mirroring
-- billing.enqueue_invoice_pdf_job's own enqueue-and-defer pattern (Epic 6)
-- rather than rendering synchronously inline. No dedicated consumer Edge
-- Function exists yet for this job_type in this delivery — see
-- EPIC_8_COMPLETION_REPORT.md's Known Limitations, the same class of
-- deliberately-deferred consumer every prior Epic's own first background
-- job left for a later wiring pass (notification-dispatch, Epic 4;
-- generate-invoice-pdf, Epic 6).
-- ---------------------------------------------------------------------------
create or replace function public.export_report_draft(p_draft_id uuid, p_idempotency_key uuid default null)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id   uuid := public.current_tenant_id();
  v_row         reports.ai_report_drafts;
  v_job_id      uuid;
  v_replay      jsonb;
  v_input_hash  text;
  v_result      jsonb;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can export a report draft'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can export a report draft.', 'human_message_ar', 'فقط المدير يمكنه تصدير مسودة التقرير.')::text;
  end if;

  -- Fix for EPIC_8_REVIEW.md H1: without this, every retried export request
  -- enqueued a fresh, undeduplicated jobs.background_job_queue row.
  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_draft_id::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      return v_replay->'data';
    end if;
  end if;

  select * into v_row from reports.ai_report_drafts where id = p_draft_id and tenant_id = v_tenant_id;
  if v_row.id is null then
    raise exception 'Report draft not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Report draft not found.', 'human_message_ar', 'لم يتم العثور على مسودة التقرير.')::text;
  end if;

  insert into jobs.background_job_queue (job_type, payload)
  values ('ai_report_export', jsonb_build_object('draftId', v_row.id, 'tenantId', v_tenant_id))
  returning id into v_job_id;

  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'report_draft_export_requested', 'ai_report_drafts', v_row.id);

  v_result := jsonb_build_object('jobId', v_job_id, 'draftId', v_row.id, 'status', 'queued');

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'export_report_draft', jsonb_build_object('_inputHash', v_input_hash, 'data', v_result));
  end if;

  return v_result;
end;
$$;

comment on function public.export_report_draft is
  'Manager-only. Enqueues a jobs.background_job_queue row (job_type=ai_report_export) rather than rendering synchronously — mirrors billing.enqueue_invoice_pdf_job''s own enqueue-and-defer pattern. No status restriction: any existing draft, regardless of status, may be exported. Audit log (§23). Idempotency-key envelope (EPIC_8_REVIEW.md H1) prevents a retry from enqueuing a duplicate job.';

revoke all on function public.export_report_draft from public;
grant execute on function public.export_report_draft to authenticated;
