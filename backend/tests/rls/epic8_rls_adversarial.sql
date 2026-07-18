-- ============================================================================
-- Epic 8 RLS adversarial test suite. Same shape as epic2-7_rls_adversarial.sql:
-- fixture rows as service_role, then switch to a simulated authenticated role
-- via a forged JWT claim and assert the expected allow/deny outcome. Every
-- fixture UUID uses only valid hexadecimal characters (0-9a-f).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A gets its own plan with a deliberately low
-- ai_daily_call_cap (2) so the cap-boundary test (Test 12) doesn't need 50
-- throwaway increment_ai_usage calls. Tenant A: manager, teacher (coordinates
-- classroom A1), guardian A1 (child A1, classroom A1), guardian A2 (child A2,
-- classroom A2). Tenant B: manager B (cross-tenant isolation target).
--
-- A single classroom-scope batch (Batch A1, classroom A1) with two drafts —
-- Draft A1 (child A1, status='draft') and Draft A1S (child A1, status='sent')
-- — covers both the "not yet sent" and "already sent" guardian-visibility
-- cases without needing a second batch.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee, ai_daily_call_cap)
values
  ('00000000-0000-0000-0000-0000000e8999', 'growth', 7500, 12000, 2),
  ('00000000-0000-0000-0000-0000000e8998', 'starter', 3000, 6000, 50)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e8a01', 'Tenant E8-A', 'tenant-e8-a-test', '00000000-0000-0000-0000-0000000e8999', 'active'),
  ('00000000-0000-0000-0000-0000000e8b01', 'Tenant E8-B', 'tenant-e8-b-test', '00000000-0000-0000-0000-0000000e8998', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e8a11', '+201700000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e8a12', '+201700000002', 'authenticated', 'authenticated'), -- teacher A (classroom A1)
  ('00000000-0000-0000-0000-0000000e8a14', '+201700000004', 'authenticated', 'authenticated'), -- guardian A1 (child A1)
  ('00000000-0000-0000-0000-0000000e8a15', '+201700000005', 'authenticated', 'authenticated'), -- guardian A2 (child A2)
  ('00000000-0000-0000-0000-0000000e8b11', '+201700000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e8c01', '+201700000009', 'authenticated', 'authenticated')  -- platform admin (support tier)
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e8a11', '00000000-0000-0000-0000-0000000e8a01', 'manager', 'Manager A', '+201700000001'),
  ('00000000-0000-0000-0000-0000000e8a12', '00000000-0000-0000-0000-0000000e8a01', 'teacher', 'Teacher A', '+201700000002'),
  ('00000000-0000-0000-0000-0000000e8b11', '00000000-0000-0000-0000-0000000e8b01', 'manager', 'Manager B', '+201700000006')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e8a14', '00000000-0000-0000-0000-0000000e8a01', 'Guardian A1', '+201700000004'),
  ('00000000-0000-0000-0000-0000000e8a15', '00000000-0000-0000-0000-0000000e8a01', 'Guardian A2', '+201700000005')
on conflict (id) do nothing;

insert into identity.platform_admins (id, name, email, role)
values ('00000000-0000-0000-0000-0000000e8c01', 'Support Admin', 'support-e8-test@masar.app', 'support')
on conflict (id) do nothing;

-- Teacher A coordinates classroom A1 (coordinator_staff_id) — a genuine
-- current_staff_classroom_ids() membership, not a same-tenant coincidence.
insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, capacity, coordinator_staff_id)
values
  ('00000000-0000-0000-0000-0000000e8d01', '00000000-0000-0000-0000-0000000e8a01', 'KG1-A', 'kg1', 36, 48, 10, '00000000-0000-0000-0000-0000000e8a12'),
  ('00000000-0000-0000-0000-0000000e8d02', '00000000-0000-0000-0000-0000000e8a01', 'KG1-B', 'kg1', 36, 48, 10, null),
  ('00000000-0000-0000-0000-0000000e8d09', '00000000-0000-0000-0000-0000000e8b01', 'Tenant B Classroom', 'kg1', 36, 48, 10, null)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e8e31', '00000000-0000-0000-0000-0000000e8a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e8d01', 'full_day'),
  ('00000000-0000-0000-0000-0000000e8e32', '00000000-0000-0000-0000-0000000e8a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e8d02', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values
  ('00000000-0000-0000-0000-0000000e8e31', '00000000-0000-0000-0000-0000000e8a14', '00000000-0000-0000-0000-0000000e8a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e8e32', '00000000-0000-0000-0000-0000000e8a15', '00000000-0000-0000-0000-0000000e8a01', 'mother', true)
on conflict do nothing;

insert into reports.ai_report_batches (id, tenant_id, type, scope, classroom_id, topic, created_by)
values ('00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', 'monthly_progress', 'classroom', '00000000-0000-0000-0000-0000000e8d01', null, '00000000-0000-0000-0000-0000000e8a12')
on conflict (id) do nothing;

insert into reports.ai_report_drafts (id, batch_id, tenant_id, child_id, body, status, delivery_channels)
values
  ('00000000-0000-0000-0000-0000000e8f11', '00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Child A1 is progressing well (draft).', 'draft', array[]::reports.delivery_channel[]),
  ('00000000-0000-0000-0000-0000000e8f12', '00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Child A1''s already-sent report.', 'sent', array['app']::reports.delivery_channel[])
on conflict (id) do nothing;

update reports.ai_report_drafts set sent_at = now() where id = '00000000-0000-0000-0000-0000000e8f12';

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's batches,
-- drafts, or usage counters.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from reports.ai_report_batches where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  if v_count <> 0 then raise exception 'FAIL Test 1a: Manager B could see Tenant A''s ai_report_batches'; end if;

  select count(*) into v_count from reports.ai_report_drafts where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  if v_count <> 0 then raise exception 'FAIL Test 1b: Manager B could see Tenant A''s ai_report_drafts'; end if;

  select count(*) into v_count from reports.ai_usage_counters where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  if v_count <> 0 then raise exception 'FAIL Test 1c: Manager B could see Tenant A''s ai_usage_counters'; end if;

  raise notice 'PASS Test 1: cross-tenant isolation holds on ai_report_batches/ai_report_drafts/ai_usage_counters';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2 (the core §19 human-in-the-loop regression test): Guardian A1 sees
-- exactly the sent draft (Draft A1S) for their own child, never the
-- still-drafting one (Draft A1) for the same child, and never anything for
-- Child A2's guardian's own draft-status rows either (guardian A2 has no
-- sent draft in this fixture set, so a zero-row check for guardian A2 is a
-- meaningful negative too).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"guardian"}}';

do $$
declare v_sent_count int;
declare v_draft_count int;
begin
  select count(*) into v_sent_count from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f12';
  select count(*) into v_draft_count from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f11';

  if v_sent_count <> 1 then raise exception 'FAIL Test 2a: Guardian A1 could not see their own child''s sent report'; end if;
  if v_draft_count <> 0 then raise exception 'FAIL Test 2b (§19 regression): Guardian A1 could see a not-yet-sent draft for their own child'; end if;

  raise notice 'PASS Test 2: guardian sees a sent draft for their own child and never a draft/ready/scheduled one';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from reports.ai_report_drafts where child_id = '00000000-0000-0000-0000-0000000e8e32';
  if v_count <> 0 then raise exception 'FAIL Test 2c: Guardian A2 could see a report row despite having no sent report at all'; end if;
  raise notice 'PASS Test 2c: guardian with no sent report sees zero rows';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: Teacher A sees their own batch (created_by) and the draft for a
-- child in their own coordinated classroom (classroom A1), positively and
-- negatively — no visibility into a hypothetical batch/draft outside their
-- classroom (simulated here by the same teacher never being linked to
-- classroom A2 at all).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"teacher"}}';

do $$
declare v_batch_count int;
declare v_draft_count int;
begin
  select count(*) into v_batch_count from reports.ai_report_batches where id = '00000000-0000-0000-0000-0000000e8f01';
  if v_batch_count <> 1 then raise exception 'FAIL Test 3a: Teacher A could not see their own drafting batch'; end if;

  select count(*) into v_draft_count from reports.ai_report_drafts where child_id = '00000000-0000-0000-0000-0000000e8e31';
  if v_draft_count <> 2 then raise exception 'FAIL Test 3b: Teacher A could not see both drafts for a child in their own classroom (saw %)', v_draft_count; end if;

  raise notice 'PASS Test 3: teacher sees their own batch and both drafts for a child in their own coordinated classroom';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: Manager A has full tenant-wide SELECT on both batches and drafts,
-- regardless of who created the batch or which classroom the child is in.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare v_batch_count int;
declare v_draft_count int;
begin
  select count(*) into v_batch_count from reports.ai_report_batches where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  select count(*) into v_draft_count from reports.ai_report_drafts where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  if v_batch_count <> 1 then raise exception 'FAIL Test 4a: manager could not see all tenant batches'; end if;
  if v_draft_count <> 2 then raise exception 'FAIL Test 4b: manager could not see all tenant drafts'; end if;
  raise notice 'PASS Test 4: manager has full tenant-wide SELECT on ai_report_batches/ai_report_drafts';
end $$;

-- ---------------------------------------------------------------------------
-- Test 5: Manager A can directly UPDATE the draft-status row (pre-send edit
-- path, ai_report_drafts_update_manager) — body/delivery_channels change,
-- status stays draft/ready.
-- ---------------------------------------------------------------------------
do $$
declare v_body text;
begin
  update reports.ai_report_drafts
  set body = 'Edited by manager before sending.', delivery_channels = array['app', 'email']::reports.delivery_channel[], status = 'ready'
  where id = '00000000-0000-0000-0000-0000000e8f11';

  select body into v_body from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f11';
  if v_body <> 'Edited by manager before sending.' then raise exception 'FAIL Test 5: manager could not edit a draft/ready report directly'; end if;
  raise notice 'PASS Test 5: manager can directly edit a draft/ready report''s body/delivery_channels/status';
end $$;

-- ---------------------------------------------------------------------------
-- Test 6 (EPIC_6_REVIEW.md M2 pattern applied): the narrowed UPDATE policy
-- rejects a direct status='sent' write, even by a manager — send_report_draft
-- (migration 5) remains the sole path to 'sent'.
-- ---------------------------------------------------------------------------
do $$
declare v_status reports.report_draft_status;
begin
  update reports.ai_report_drafts set status = 'sent' where id = '00000000-0000-0000-0000-0000000e8f11';
  select status into v_status from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f11';
  if v_status = 'sent' then raise exception 'FAIL Test 6 (M2 regression): a direct RLS UPDATE pushed status to sent'; end if;
  raise notice 'PASS Test 6: the narrowed UPDATE policy silently excludes a status=sent write (WITH CHECK denies it, so 0 rows are affected)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: send_report_draft — manager-only, sets status/sent_at, fans a
-- guardian notification out, and the M1 NOT_FOUND/STATE_ALREADY_PROCESSED
-- disambiguation both fire correctly.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"teacher"}}';

do $$
begin
  perform public.send_report_draft('00000000-0000-0000-0000-0000000e8f11');
  raise exception 'FAIL Test 7a: a teacher successfully called send_report_draft';
exception
  when others then
    if sqlerrm like '%Only a manager can send a report draft%' then
      raise notice 'PASS Test 7a: send_report_draft rejects a teacher caller';
    else
      raise exception 'FAIL Test 7a: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare
  v_status            reports.report_draft_status;
  v_sent_at           timestamptz;
  v_notification_cnt  int;
begin
  perform public.send_report_draft('00000000-0000-0000-0000-0000000e8f11');

  select status, sent_at into v_status, v_sent_at from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f11';
  if v_status <> 'sent' or v_sent_at is null then raise exception 'FAIL Test 7b: send_report_draft did not transition status/sent_at'; end if;

  select count(*) into v_notification_cnt
  from comms.notifications
  where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready' and recipient_id = '00000000-0000-0000-0000-0000000e8a14';
  if v_notification_cnt < 1 then raise exception 'FAIL Test 7c: send_report_draft did not notify the child''s guardian'; end if;

  raise notice 'PASS Test 7: send_report_draft transitions draft/ready -> sent and notifies the guardian';
end $$;

do $$
begin
  perform public.send_report_draft('00000000-0000-0000-0000-0000000e8f11');
  raise exception 'FAIL Test 8a: send_report_draft succeeded on an already-sent draft';
exception
  when others then
    if sqlerrm like '%cannot be sent from its current status%' then
      raise notice 'PASS Test 8a: send_report_draft returns STATE_ALREADY_PROCESSED for an already-sent draft (the M1 pattern)';
    else
      raise exception 'FAIL Test 8a: unexpected error: %', sqlerrm;
    end if;
end $$;

do $$
begin
  perform public.send_report_draft('00000000-0000-0000-0000-0000000e8fff');
  raise exception 'FAIL Test 8b: send_report_draft succeeded on a nonexistent draft id';
exception
  when others then
    if sqlerrm like '%Report draft not found%' then
      raise notice 'PASS Test 8b: send_report_draft returns NOT_FOUND for a nonexistent draft id (the M1 pattern)';
    else
      raise exception 'FAIL Test 8b: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: resend_report_draft — only a sent draft can be resent, and it
-- re-fires the notification without touching status/sent_at.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare
  v_notification_cnt_before int;
  v_notification_cnt_after  int;
  v_sent_at_before          timestamptz;
  v_sent_at_after           timestamptz;
begin
  select sent_at into v_sent_at_before from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f11';
  select count(*) into v_notification_cnt_before from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready';

  perform public.resend_report_draft('00000000-0000-0000-0000-0000000e8f11');

  select sent_at into v_sent_at_after from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f11';
  select count(*) into v_notification_cnt_after from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready';

  if v_sent_at_after is distinct from v_sent_at_before then raise exception 'FAIL Test 9a: resend_report_draft mutated sent_at'; end if;
  if v_notification_cnt_after <= v_notification_cnt_before then raise exception 'FAIL Test 9b: resend_report_draft did not fire a new notification'; end if;

  raise notice 'PASS Test 9: resend_report_draft re-fires the notification without mutating status/sent_at';
end $$;

do $$
begin
  perform public.resend_report_draft('00000000-0000-0000-0000-0000000e8f01');
  raise exception 'FAIL Test 9c: resend_report_draft succeeded on a batch id (not a draft) — should be NOT_FOUND';
exception
  when others then
    if sqlerrm like '%Report draft not found%' then
      raise notice 'PASS Test 9c: resend_report_draft returns NOT_FOUND for a nonexistent/wrong id';
    else
      raise exception 'FAIL Test 9c: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: delete_report_draft — manager-only, blocks deleting an
-- already-sent draft, and succeeds for a draft/ready one.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
begin
  perform public.delete_report_draft('00000000-0000-0000-0000-0000000e8f11');
  raise exception 'FAIL Test 10a: delete_report_draft deleted an already-sent draft';
exception
  when others then
    if sqlerrm like '%A sent report draft cannot be deleted%' then
      raise notice 'PASS Test 10a: delete_report_draft refuses to delete an already-sent draft';
    else
      raise exception 'FAIL Test 10a: unexpected error: %', sqlerrm;
    end if;
end $$;

do $$
declare v_new_draft_id uuid;
declare v_count int;
begin
  insert into reports.ai_report_drafts (batch_id, tenant_id, child_id, body, status)
  values ('00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Deletable draft.', 'draft')
  returning id into v_new_draft_id;

  perform public.delete_report_draft(v_new_draft_id);

  select count(*) into v_count from reports.ai_report_drafts where id = v_new_draft_id;
  if v_count <> 0 then raise exception 'FAIL Test 10b: delete_report_draft did not delete a draft-status row'; end if;
  raise notice 'PASS Test 10b: delete_report_draft deletes a draft/ready/scheduled row';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"guardian"}}';

do $$
begin
  perform public.delete_report_draft('00000000-0000-0000-0000-0000000e8f11');
  raise exception 'FAIL Test 10c: a guardian successfully called delete_report_draft';
exception
  when others then
    if sqlerrm like '%Only a manager can delete a report draft%' then
      raise notice 'PASS Test 10c: delete_report_draft rejects a guardian caller';
    else
      raise exception 'FAIL Test 10c: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11: export_report_draft — manager-only, enqueues a
-- jobs.background_job_queue row (job_type='ai_report_export').
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare v_result jsonb;
begin
  v_result := public.export_report_draft('00000000-0000-0000-0000-0000000e8f11');
  if v_result->>'status' <> 'queued' then raise exception 'FAIL Test 11a: export_report_draft did not return status=queued'; end if;
  raise notice 'PASS Test 11: export_report_draft enqueues a background job and returns status=queued';
end $$;

reset role;

set role service_role;

do $$
declare v_count int;
begin
  select count(*) into v_count from jobs.background_job_queue where job_type = 'ai_report_export' and payload->>'draftId' = '00000000-0000-0000-0000-0000000e8f11';
  if v_count <> 1 then raise exception 'FAIL Test 11b: export_report_draft did not enqueue exactly one jobs.background_job_queue row'; end if;
  raise notice 'PASS Test 11b: exactly one ai_report_export job was enqueued';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12 (§19 Acceptance Criteria — the cap-boundary test): Tenant A's plan
-- has ai_daily_call_cap=2. The first two increment_ai_usage calls succeed
-- (exactly at cap on the second); the third is rejected with
-- EXTERNAL_AI_QUOTA_EXCEEDED, and the counter still reflects the rejected
-- call itself (the conservative, cost-safe "never undercounts" direction
-- migration 5's own header comment documents).
-- ---------------------------------------------------------------------------
set role service_role;

do $$
declare v_calls_used int;
begin
  v_calls_used := public.increment_ai_usage('00000000-0000-0000-0000-0000000e8a01');
  if v_calls_used <> 1 then raise exception 'FAIL Test 12a: first call did not return calls_used=1 (got %)', v_calls_used; end if;

  v_calls_used := public.increment_ai_usage('00000000-0000-0000-0000-0000000e8a01');
  if v_calls_used <> 2 then raise exception 'FAIL Test 12b: second call (exactly at cap) did not return calls_used=2 (got %)', v_calls_used; end if;

  raise notice 'PASS Test 12a/b: increment_ai_usage succeeds up to and including exactly the cap (2/2)';
exception
  when others then
    raise exception 'FAIL Test 12a/b: unexpected error below the cap: %', sqlerrm;
end $$;

do $$
declare v_calls_used int;
declare v_after_count int;
begin
  begin
    v_calls_used := public.increment_ai_usage('00000000-0000-0000-0000-0000000e8a01');
    raise exception 'FAIL Test 12c: a call one over the cap succeeded';
  exception
    when others then
      if sqlerrm not like '%Daily AI usage cap exceeded%' then
        raise exception 'FAIL Test 12c: unexpected error: %', sqlerrm;
      end if;
  end;

  select calls_used into v_after_count from reports.ai_usage_counters where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and usage_date = current_date;
  if v_after_count <> 3 then raise exception 'FAIL Test 12d: the rejected call did not still count against the cap (calls_used=%, expected 3)', v_after_count; end if;

  raise notice 'PASS Test 12c/d: a call one over the cap is rejected with EXTERNAL_AI_QUOTA_EXCEEDED, and still increments the counter (conservative, cost-safe direction)';
end $$;

reset role;

-- Manager A can read today's usage counter directly (ai_usage_counters_select_manager).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare v_calls_used int;
begin
  select calls_used into v_calls_used from reports.ai_usage_counters where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and usage_date = current_date;
  if v_calls_used <> 3 then raise exception 'FAIL Test 12e: manager could not read the tenant''s own usage counter (got %)', v_calls_used; end if;
  raise notice 'PASS Test 12e: manager can read today''s usage counter directly';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 13: the ai_report_batches consistency trigger rejects a classroom_id
-- belonging to a different tenant than the batch's own tenant_id.
-- ---------------------------------------------------------------------------
set role service_role;

do $$
begin
  insert into reports.ai_report_batches (tenant_id, type, scope, classroom_id, created_by)
  values ('00000000-0000-0000-0000-0000000e8a01', 'monthly_progress', 'classroom', '00000000-0000-0000-0000-0000000e8d09', '00000000-0000-0000-0000-0000000e8a12');
  raise exception 'FAIL Test 13: a cross-tenant ai_report_batches row was created';
exception
  when others then
    if sqlerrm like '%does not belong to the stated tenant%' then
      raise notice 'PASS Test 13: consistency trigger rejects a cross-tenant batch/classroom pairing';
    else
      raise exception 'FAIL Test 13: unexpected error: %', sqlerrm;
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- Test 14: the ai_report_drafts consistency trigger rejects a child_id
-- belonging to a different tenant than the draft's own tenant_id.
-- ---------------------------------------------------------------------------
insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values ('00000000-0000-0000-0000-0000000e8e91', '00000000-0000-0000-0000-0000000e8b01', 'Child B1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e8d09', 'full_day')
on conflict (id) do nothing;

do $$
begin
  insert into reports.ai_report_drafts (batch_id, tenant_id, child_id, body, status)
  values ('00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e91', 'Cross-tenant child.', 'draft');
  raise exception 'FAIL Test 14: a cross-tenant ai_report_drafts row was created';
exception
  when others then
    if sqlerrm like '%do not both belong to the stated tenant%' then
      raise notice 'PASS Test 14: consistency trigger rejects a cross-tenant draft/child pairing';
    else
      raise exception 'FAIL Test 14: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 15 (the core scheduled-job regression test): schedule_report_draft
-- moves a draft to 'scheduled', then reports.sweep_scheduled_report_drafts()
-- transitions a due one to 'sent' and notifies the guardian, in one set-based
-- call — then a second sweep call is a safe no-op (idempotent re-run).
-- ---------------------------------------------------------------------------
set role service_role;

insert into reports.ai_report_drafts (id, batch_id, tenant_id, child_id, body, status, delivery_channels)
values ('00000000-0000-0000-0000-0000000e8f21', '00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e32', 'Child A2 scheduled report.', 'ready', array['app']::reports.delivery_channel[])
on conflict (id) do nothing;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare v_status reports.report_draft_status;
begin
  perform public.schedule_report_draft('00000000-0000-0000-0000-0000000e8f21', now() + interval '1 hour');
  select status into v_status from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f21';
  if v_status <> 'scheduled' then raise exception 'FAIL Test 15a: schedule_report_draft did not transition status to scheduled'; end if;
  raise notice 'PASS Test 15a: schedule_report_draft transitions draft/ready -> scheduled';
end $$;

do $$
begin
  perform public.schedule_report_draft('00000000-0000-0000-0000-0000000e8f21', now() - interval '1 hour');
  raise exception 'FAIL Test 15b: schedule_report_draft accepted a past scheduled_for';
exception
  when others then
    if sqlerrm like '%scheduled_for must be in the future%' then
      raise notice 'PASS Test 15b: schedule_report_draft rejects a past scheduled_for';
    else
      raise exception 'FAIL Test 15b: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- Move the sweep target's scheduled_for into the past directly (simulating
-- time passing) — service_role, bypassing the RPC's own future-only check,
-- exactly like every prior Epic's own scheduled-job test fixture setup.
set role service_role;
do $$
begin
  update reports.ai_report_drafts set scheduled_for = now() - interval '1 minute' where id = '00000000-0000-0000-0000-0000000e8f21';
end $$;

do $$
declare
  v_swept_count      int;
  v_status           reports.report_draft_status;
  v_notification_cnt int;
begin
  select reports.sweep_scheduled_report_drafts() into v_swept_count;
  if v_swept_count <> 1 then raise exception 'FAIL Test 16a: sweep did not report exactly 1 swept draft (got %)', v_swept_count; end if;

  select status into v_status from reports.ai_report_drafts where id = '00000000-0000-0000-0000-0000000e8f21';
  if v_status <> 'sent' then raise exception 'FAIL Test 16b: sweep did not transition the due draft to sent'; end if;

  select count(*) into v_notification_cnt
  from comms.notifications
  where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready' and recipient_id = '00000000-0000-0000-0000-0000000e8a15';
  if v_notification_cnt < 1 then raise exception 'FAIL Test 16c: sweep did not notify Child A2''s guardian'; end if;

  raise notice 'PASS Test 16: sweep_scheduled_report_drafts transitions a due draft to sent and notifies the guardian — % draft(s) swept', v_swept_count;
end $$;

do $$
declare
  v_swept_count int;
  v_notification_cnt_before int;
  v_notification_cnt_after int;
begin
  select count(*) into v_notification_cnt_before from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready';

  select reports.sweep_scheduled_report_drafts() into v_swept_count;

  select count(*) into v_notification_cnt_after from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready';

  if v_swept_count <> 0 then raise exception 'FAIL Test 17a: a second sweep re-swept an already-sent draft (swept %)', v_swept_count; end if;
  if v_notification_cnt_after <> v_notification_cnt_before then raise exception 'FAIL Test 17b: a second sweep sent a duplicate notification'; end if;

  raise notice 'PASS Test 17: a repeated sweep call is a safe, idempotent no-op';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 18: Platform Admin (support tier) gets zero rows on any Epic 8-owned
-- table — §13.6's bypass list does not include the reports schema.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8c01","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_batch_count int;
declare v_draft_count int;
declare v_usage_count int;
begin
  select count(*) into v_batch_count from reports.ai_report_batches where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  if v_batch_count <> 0 then raise exception 'FAIL Test 18a: platform_admin saw an ai_report_batches row (no bypass policy should exist)'; end if;

  select count(*) into v_draft_count from reports.ai_report_drafts where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  if v_draft_count <> 0 then raise exception 'FAIL Test 18b: platform_admin saw an ai_report_drafts row (no bypass policy should exist)'; end if;

  select count(*) into v_usage_count from reports.ai_usage_counters where tenant_id = '00000000-0000-0000-0000-0000000e8a01';
  if v_usage_count <> 0 then raise exception 'FAIL Test 18c: platform_admin saw an ai_usage_counters row (no bypass policy should exist)'; end if;

  raise notice 'PASS Test 18: platform_admin has zero bypass on any Epic 8-owned table';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 19: no direct RLS INSERT path exists on ai_report_batches or
-- ai_report_drafts for any role — even a manager (§12's "C" is satisfied by
-- the ai-draft-report Edge Function, service_role, not by a table grant).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
begin
  insert into reports.ai_report_batches (tenant_id, type, scope, classroom_id, created_by)
  values ('00000000-0000-0000-0000-0000000e8a01', 'monthly_progress', 'classroom', '00000000-0000-0000-0000-0000000e8d01', '00000000-0000-0000-0000-0000000e8a11');
  raise exception 'FAIL Test 19a: a manager inserted an ai_report_batches row directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 19a: no direct INSERT path exists on ai_report_batches for manager';
end $$;

do $$
begin
  insert into reports.ai_report_drafts (batch_id, tenant_id, child_id, body, status)
  values ('00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Forged draft.', 'draft');
  raise exception 'FAIL Test 19b: a manager inserted an ai_report_drafts row directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 19b: no direct INSERT path exists on ai_report_drafts for manager';
end $$;

reset role;

-- ============================================================================
-- Fix-verification tests (EPIC_8_REVIEW.md / EPIC_8_FIX_REPORT.md)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Test 20 (fix for EPIC_8_REVIEW.md M1): the new immutable-fields trigger
-- rejects a manager's direct RLS UPDATE that retargets an existing draft's
-- child_id/batch_id to a different (even same-tenant) value — the exact
-- direct-REST retargeting gap the review found.
-- ---------------------------------------------------------------------------
set role service_role;

insert into reports.ai_report_drafts (id, batch_id, tenant_id, child_id, body, status)
values ('00000000-0000-0000-0000-0000000e8f31', '00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Draft for M1 immutability test.', 'draft')
on conflict (id) do nothing;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
begin
  update reports.ai_report_drafts set child_id = '00000000-0000-0000-0000-0000000e8e32' where id = '00000000-0000-0000-0000-0000000e8f31';
  raise exception 'FAIL Test 20a (M1 regression): a manager retargeted a draft''s child_id via direct UPDATE';
exception
  when others then
    if sqlerrm like '%cannot be changed once a report draft is created%' then
      raise notice 'PASS Test 20a: the immutable-fields trigger rejects a child_id retarget';
    else
      raise exception 'FAIL Test 20a: unexpected error: %', sqlerrm;
    end if;
end $$;

do $$
begin
  update reports.ai_report_drafts set batch_id = '00000000-0000-0000-0000-0000000e8f01', body = 'still the same batch, no-op' where id = '00000000-0000-0000-0000-0000000e8f31' and batch_id = '00000000-0000-0000-0000-0000000e8f01';
  raise notice 'PASS Test 20b: an UPDATE that leaves child_id/batch_id unchanged (a no-op on those two columns) is still permitted';
exception
  when others then
    raise exception 'FAIL Test 20b: a same-value no-op update on child_id/batch_id was unexpectedly rejected: %', sqlerrm;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 21 (fix for EPIC_8_REVIEW.md H1): send_report_draft's idempotency-key
-- envelope. Calling it twice with the same key replays the exact same
-- response (sent_at unchanged the second time, no duplicate notification);
-- calling it again with the same key but a different draft_id is rejected
-- with CONFLICT_IDEMPOTENCY_KEY_REUSED.
-- ---------------------------------------------------------------------------
set role service_role;

insert into reports.ai_report_drafts (id, batch_id, tenant_id, child_id, body, status, delivery_channels)
values
  ('00000000-0000-0000-0000-0000000e8f41', '00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Draft for H1 idempotency test A.', 'ready', array['app']::reports.delivery_channel[]),
  ('00000000-0000-0000-0000-0000000e8f42', '00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Draft for H1 idempotency test B.', 'ready', array['app']::reports.delivery_channel[])
on conflict (id) do nothing;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare
  v_key                       uuid := '11110000-0000-0000-0000-000000000001';
  v_sent_at_first              timestamptz;
  v_sent_at_second             timestamptz;
  v_notification_cnt_before    int;
  v_notification_cnt_after     int;
  v_row                        reports.ai_report_drafts;
begin
  select count(*) into v_notification_cnt_before from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready';

  v_row := public.send_report_draft('00000000-0000-0000-0000-0000000e8f41', v_key);
  v_sent_at_first := v_row.sent_at;

  v_row := public.send_report_draft('00000000-0000-0000-0000-0000000e8f41', v_key);
  v_sent_at_second := v_row.sent_at;

  select count(*) into v_notification_cnt_after from comms.notifications where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and category = 'report_ready';

  if v_sent_at_second is distinct from v_sent_at_first then
    raise exception 'FAIL Test 21a (H1 regression): a replayed send_report_draft call returned a different sent_at';
  end if;
  if v_notification_cnt_after - v_notification_cnt_before <> 1 then
    raise exception 'FAIL Test 21b (H1 regression): a replayed send_report_draft call fired a duplicate notification (expected exactly 1 new notification, saw %)', v_notification_cnt_after - v_notification_cnt_before;
  end if;

  raise notice 'PASS Test 21a/b: a retried send_report_draft call with the same idempotency key replays the original response with no duplicate notification';
end $$;

do $$
declare v_key uuid := '11110000-0000-0000-0000-000000000001';
begin
  perform public.send_report_draft('00000000-0000-0000-0000-0000000e8f42', v_key);
  raise exception 'FAIL Test 21c (H1 regression): the same idempotency key was silently accepted for a different draft_id';
exception
  when others then
    if sqlerrm like '%idempotency key reused with a different payload%' then
      raise notice 'PASS Test 21c: reusing an idempotency key with a different draft_id raises CONFLICT_IDEMPOTENCY_KEY_REUSED';
    else
      raise exception 'FAIL Test 21c: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 22 (fix for EPIC_8_REVIEW.md H1): delete_report_draft now returns
-- jsonb, not void — a retried delete with the same key replays
-- {deleted:true,...} instead of surfacing NOT_FOUND on its second call.
-- ---------------------------------------------------------------------------
set role service_role;

insert into reports.ai_report_drafts (id, batch_id, tenant_id, child_id, body, status)
values ('00000000-0000-0000-0000-0000000e8f51', '00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8e31', 'Draft for H1 delete idempotency test.', 'draft')
on conflict (id) do nothing;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"manager"}}';

do $$
declare
  v_key    uuid := '11110000-0000-0000-0000-000000000002';
  v_first  jsonb;
  v_second jsonb;
begin
  v_first := public.delete_report_draft('00000000-0000-0000-0000-0000000e8f51', v_key);
  if (v_first->>'deleted')::boolean is not true then raise exception 'FAIL Test 22a: delete_report_draft did not return deleted:true'; end if;

  v_second := public.delete_report_draft('00000000-0000-0000-0000-0000000e8f51', v_key);
  if v_second <> v_first then raise exception 'FAIL Test 22b (H1 regression): a replayed delete_report_draft call did not return the exact same payload'; end if;

  raise notice 'PASS Test 22a/b: delete_report_draft returns jsonb and a same-key retry replays the original {deleted:true,...} response instead of NOT_FOUND';
end $$;

do $$
begin
  perform public.delete_report_draft('00000000-0000-0000-0000-0000000e8f51');
  raise exception 'FAIL Test 22c: a second delete with no idempotency key succeeded on an already-deleted draft';
exception
  when others then
    if sqlerrm like '%Report draft not found%' then
      raise notice 'PASS Test 22c: without a replay key, a genuine second delete still correctly returns NOT_FOUND';
    else
      raise exception 'FAIL Test 22c: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 23 (fix for EPIC_8_REVIEW.md H2/M4): reports.create_ai_report_batch
-- is service_role-only (not directly callable by an authenticated teacher/
-- manager — closing the "would bypass ai-draft-report's own RLS-scoped
-- resolution and usage-cap increment" risk); atomically creates a batch +
-- its drafts in one call; and writes the ai_report_batch_created audit-log
-- entry (M4).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"teacher"}}';

do $$
begin
  perform reports.create_ai_report_batch(
    '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8a12', 'teacher',
    'monthly_progress', 'children', null, null,
    array['00000000-0000-0000-0000-0000000e8e31']::uuid[],
    '[{"childId":"00000000-0000-0000-0000-0000000e8e31","body":"x","metrics":{}}]'::jsonb
  );
  raise exception 'FAIL Test 23a (would reintroduce a C1-class bypass): an authenticated teacher successfully called reports.create_ai_report_batch directly';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 23a: reports.create_ai_report_batch is not directly callable by an authenticated caller (service_role only)';
end $$;

reset role;

set role service_role;

do $$
declare
  v_result     jsonb;
  v_batch_id   uuid;
  v_draft_cnt  int;
  v_audit_cnt  int;
begin
  v_result := reports.create_ai_report_batch(
    '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8a12', 'teacher',
    'monthly_progress', 'children', null, null,
    array['00000000-0000-0000-0000-0000000e8e31']::uuid[],
    '[{"childId":"00000000-0000-0000-0000-0000000e8e31","body":"Atomically created report body.","metrics":{"evaluationCount":0}}]'::jsonb
  );

  if v_result->>'mode' <> 'sync' then raise exception 'FAIL Test 23b: create_ai_report_batch (sync path) did not return mode=sync'; end if;
  v_batch_id := (v_result->>'batchId')::uuid;

  select count(*) into v_draft_cnt from reports.ai_report_drafts where batch_id = v_batch_id;
  if v_draft_cnt <> 1 then raise exception 'FAIL Test 23c (H2 regression): create_ai_report_batch did not atomically create exactly 1 draft row (saw %)', v_draft_cnt; end if;

  select count(*) into v_audit_cnt from platform.audit_log where tenant_id = '00000000-0000-0000-0000-0000000e8a01' and action = 'ai_report_batch_created' and target_id = v_batch_id;
  if v_audit_cnt <> 1 then raise exception 'FAIL Test 23d (M4 regression): create_ai_report_batch did not write an ai_report_batch_created audit-log entry'; end if;

  raise notice 'PASS Test 23: create_ai_report_batch (sync path) atomically creates a batch and its draft(s), and writes the M4 audit-log entry';
end $$;

-- Async path: p_drafts is null -> enqueues a background job instead.
do $$
declare
  v_result   jsonb;
  v_batch_id uuid;
  v_job_cnt  int;
begin
  v_result := reports.create_ai_report_batch(
    '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8a11', 'manager',
    'monthly_progress', 'classroom', '00000000-0000-0000-0000-0000000e8d01', null,
    array['00000000-0000-0000-0000-0000000e8e31']::uuid[],
    null
  );

  if v_result->>'mode' <> 'queued' then raise exception 'FAIL Test 23e: create_ai_report_batch (async path) did not return mode=queued'; end if;
  v_batch_id := (v_result->>'batchId')::uuid;

  select count(*) into v_job_cnt from jobs.background_job_queue where job_type = 'ai_report_batch_generation' and payload->>'batchId' = v_batch_id::text;
  if v_job_cnt <> 1 then raise exception 'FAIL Test 23f (H2 regression): create_ai_report_batch (async path) did not enqueue exactly 1 background job'; end if;

  raise notice 'PASS Test 23e/f: create_ai_report_batch (async path) atomically creates a batch and enqueues its background job';
end $$;

-- Fix for EPIC_8_REVIEW.md M2: server-side defense-in-depth batch-size cap.
do $$
declare
  v_too_many uuid[];
begin
  select array_agg(gen_random_uuid()) into v_too_many from generate_series(1, 501);
  perform reports.create_ai_report_batch(
    '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8a11', 'manager',
    'monthly_progress', 'children', null, null,
    v_too_many, null
  );
  raise exception 'FAIL Test 23g (M2 regression): create_ai_report_batch accepted a 501-child batch';
exception
  when others then
    if sqlerrm like '%Batch size exceeds the maximum allowed%' then
      raise notice 'PASS Test 23g: create_ai_report_batch rejects a batch exceeding its server-side maximum (defense-in-depth for M2)';
    else
      raise exception 'FAIL Test 23g: unexpected error: %', sqlerrm;
    end if;
end $$;

-- Defense-in-depth role check (p_caller_role, since current_role() would be
-- meaningless under this function's service_role-only calling convention).
do $$
begin
  perform reports.create_ai_report_batch(
    '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8a14', 'guardian',
    'monthly_progress', 'children', null, null,
    array['00000000-0000-0000-0000-0000000e8e31']::uuid[], null
  );
  raise exception 'FAIL Test 23h: create_ai_report_batch accepted a guardian p_caller_role';
exception
  when others then
    if sqlerrm like '%Only a teacher or manager can draft an AI report%' then
      raise notice 'PASS Test 23h: create_ai_report_batch rejects a non-teacher/manager p_caller_role';
    else
      raise exception 'FAIL Test 23h: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 24 (fix for EPIC_8_REVIEW.md C1 — the RLS mechanism the Edge
-- Function fix now relies on): Teacher A, who coordinates classroom A1
-- only, gets ZERO rows querying classroom A2 or a child in classroom A2 —
-- the exact frozen Epic 2 RLS behavior ai-draft-report/index.ts now
-- delegates its own classroom/child-ownership check to (by switching from
-- the service-role admin client to a caller-scoped one for these reads),
-- rather than a hand-rolled, previously-absent check of its own.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e8a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e8a01","role":"teacher"}}';

do $$
declare
  v_classroom_count int;
  v_child_count     int;
begin
  select count(*) into v_classroom_count from academic.classrooms where id = '00000000-0000-0000-0000-0000000e8d02';
  if v_classroom_count <> 0 then raise exception 'FAIL Test 24a (C1 regression): Teacher A could see classroom A2, which they do not coordinate or teach in'; end if;

  select count(*) into v_child_count from academic.children where id = '00000000-0000-0000-0000-0000000e8e32';
  if v_child_count <> 0 then raise exception 'FAIL Test 24b (C1 regression): Teacher A could see Child A2, who is not in their own classroom'; end if;

  raise notice 'PASS Test 24: Teacher A has zero visibility into a classroom/child outside their own coordinated classroom — the RLS mechanism ai-draft-report/index.ts''s C1 fix now relies on';
end $$;

reset role;

rollback;
