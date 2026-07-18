-- ============================================================================
-- Epic 8 — AI Report Architecture — Fix pass migration
-- Migration 7: reports.create_ai_report_batch (fix for EPIC_8_REVIEW.md H2)
-- Ref: BACKEND_ARCHITECTURE.md §19, §25.3; EPIC_7_REVIEW.md C1's
--      create_camera atomicity precedent
--
-- EPIC_8_REVIEW.md H2: ai-draft-report/index.ts previously performed the
-- ai_report_batches INSERT and the subsequent ai_report_drafts bulk INSERT
-- (or jobs.background_job_queue INSERT, for the async path) as two/three
-- separate, independently-committing REST round-trips. A crash, timeout, or
-- dropped connection between them left an orphaned ai_report_batches row
-- with zero drafts and no error surfaced to anyone. This RPC folds both
-- steps into one PL/pgSQL function body — one Postgres transaction — so the
-- whole sequence commits or rolls back atomically, mirroring the exact
-- precedent Epic 7's own create_camera RPC set for a two-table write that
-- previously had the same gap (EPIC_7_REVIEW.md C1).
--
-- Deliberately NOT folded in: reports.increment_ai_usage. That call remains
-- a separate step in ai-draft-report/index.ts, preserving its own
-- independently-committed, deliberately conservative "a rejected call still
-- counts against the cap" semantics (migration 5's own documented design).
-- Folding it into this same transaction would mean a downstream failure in
-- THIS function unwinds the usage-counter increment too, silently reverting
-- that already-accepted cost-accounting behavior. The residual "usage
-- counted, but this RPC then fails" edge case is accepted under the exact
-- same conservative, cost-safe reasoning migration 5 already documents for
-- the cap-rejection case, not a newly introduced gap.
--
-- service_role only — this is an internal building block called exclusively
-- from ai-draft-report/index.ts via the admin client, exactly like
-- reports.increment_ai_usage. It is NOT granted to `authenticated`: unlike
-- increment_ai_usage (which needs no caller-identity context beyond its
-- p_tenant_id parameter), this function's own INSERTs bypass RLS entirely
-- (SECURITY DEFINER) and trust p_tenant_id/p_caller_id/p_caller_role as
-- given — granting it to authenticated would let any teacher/manager call it
-- directly, skipping ai-draft-report's own RLS-scoped classroom/child
-- resolution (EPIC_8_REVIEW.md C1's fix) and the usage-cap increment
-- entirely. Trusting an explicitly-parameterized, service_role-only RPC
-- mirrors reports.increment_ai_usage's own established pattern rather than
-- duplicating the classroom-ownership check a second time inside this
-- function (EPIC_7_REVIEW.md M1's "avoid duplicated, independently
-- maintained authorization logic" lesson, applied here by choosing the
-- single-authority-layer design instead).
-- ============================================================================

create or replace function reports.create_ai_report_batch(
  p_tenant_id     uuid,
  p_caller_id     uuid,
  p_caller_role   text,
  p_type          reports.report_type,
  p_scope         reports.report_scope,
  p_classroom_id  uuid,
  p_topic         text,
  p_child_ids     uuid[],
  p_drafts        jsonb -- null for the async/background-job path; a jsonb array of {"childId":uuid,"body":text,"metrics":jsonb} for the sync path
)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_batch_id        uuid;
  v_job_id          uuid;
  v_result          jsonb;
  -- Fix for EPIC_8_REVIEW.md M2, defense-in-depth: ai-draft-report/index.ts
  -- already enforces this same cap before ever calling this RPC — this is
  -- the second, independent layer (matches the codebase's established
  -- "RLS/RPC re-checks what the Edge Function already checked" convention,
  -- §28), not the sole enforcement point.
  v_max_batch_size  constant int := 500;
begin
  if p_caller_role not in ('teacher', 'manager') then
    raise exception 'Only a teacher or manager can draft an AI report'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a teacher or manager can draft an AI report.', 'human_message_ar', 'فقط المعلم أو المدير يمكنه صياغة تقرير بالذكاء الاصطناعي.')::text;
  end if;

  if p_child_ids is null or array_length(p_child_ids, 1) is null then
    raise exception 'At least one child is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'At least one child is required.', 'human_message_ar', 'يلزم طفل واحد على الأقل.')::text;
  end if;

  if array_length(p_child_ids, 1) > v_max_batch_size then
    raise exception 'Batch size exceeds the maximum allowed'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', format('A single AI report batch cannot exceed %s children.', v_max_batch_size), 'human_message_ar', format('لا يمكن أن تتجاوز دفعة تقارير الذكاء الاصطناعي الواحدة %s طفلاً.', v_max_batch_size))::text;
  end if;

  insert into reports.ai_report_batches (tenant_id, type, scope, classroom_id, topic, created_by)
  values (p_tenant_id, p_type, p_scope, p_classroom_id, p_topic, p_caller_id)
  returning id into v_batch_id;

  if p_drafts is not null then
    insert into reports.ai_report_drafts (batch_id, tenant_id, child_id, body, metrics)
    select v_batch_id, p_tenant_id, (d->>'childId')::uuid, d->>'body', coalesce(d->'metrics', '{}'::jsonb)
    from jsonb_array_elements(p_drafts) as d;

    v_result := jsonb_build_object('batchId', v_batch_id, 'mode', 'sync');
  else
    insert into jobs.background_job_queue (job_type, payload)
    values (
      'ai_report_batch_generation',
      jsonb_build_object('batchId', v_batch_id, 'tenantId', p_tenant_id, 'type', p_type, 'topic', p_topic, 'childIds', to_jsonb(p_child_ids))
    )
    returning id into v_job_id;

    v_result := jsonb_build_object('batchId', v_batch_id, 'mode', 'queued', 'jobId', v_job_id, 'childCount', array_length(p_child_ids, 1));
  end if;

  -- Fix for EPIC_8_REVIEW.md M4: neither AI Edge Function previously wrote
  -- an audit-log entry for its own primary action. This is the "AI report
  -- batch created" event — who requested AI-generated content, for which
  -- batch, and when.
  perform public.write_audit_log(p_tenant_id, 'staff', p_caller_id, 'ai_report_batch_created', 'ai_report_batches', v_batch_id);

  return v_result;
end;
$$;

comment on function reports.create_ai_report_batch is
  'Fix for EPIC_8_REVIEW.md H2. Atomically creates an ai_report_batches row plus either its ai_report_drafts rows (sync path) or a jobs.background_job_queue row (async path) in one transaction, closing the orphaned-batch/partial-write gap the previous multi-step Edge Function sequence had. service_role only — trusts p_tenant_id/p_caller_id/p_caller_role from its caller (ai-draft-report/index.ts), which has already performed RLS-scoped classroom/child resolution (EPIC_8_REVIEW.md C1''s fix) and the usage-cap increment before calling this function. Also writes the ai_report_batch_created audit-log entry (EPIC_8_REVIEW.md M4) and defends-in-depth against an oversized batch (EPIC_8_REVIEW.md M2).';

revoke all on function reports.create_ai_report_batch from public;
grant execute on function reports.create_ai_report_batch to service_role;
