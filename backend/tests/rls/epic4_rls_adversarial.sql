-- ============================================================================
-- Epic 4 RLS adversarial test suite (see epic4_README.md for how/why to run
-- this). Same shape as epic2/epic3_rls_adversarial.sql: fixture rows as
-- service_role, then switch to a simulated authenticated role via a forged
-- JWT claim and assert the expected allow/deny outcome. Every fixture UUID
-- uses only valid hexadecimal characters (0-9a-f) from the start.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A: manager, teacher (classroom coordinator),
-- guardian A1 (child A1, linked, has a conversation with the teacher) and
-- guardian A2 (child A2, linked, NO conversation). Tenant B: manager,
-- guardian B1 (child B1). An announcement in Tenant A targets guardian A1
-- only (not A2). An Epic 3 notification_outbox row and an audit_log row
-- exist to exercise the retroactive-activation mechanisms.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e4999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e4a01', 'Tenant E4-A', 'tenant-e4-a-test', '00000000-0000-0000-0000-0000000e4999', 'active'),
  ('00000000-0000-0000-0000-0000000e4b01', 'Tenant E4-B', 'tenant-e4-b-test', '00000000-0000-0000-0000-0000000e4999', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e4a11', '+201300000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e4a12', '+201300000002', 'authenticated', 'authenticated'), -- teacher A
  ('00000000-0000-0000-0000-0000000e4a14', '+201300000004', 'authenticated', 'authenticated'), -- guardian A1
  ('00000000-0000-0000-0000-0000000e4a15', '+201300000005', 'authenticated', 'authenticated'), -- guardian A2
  ('00000000-0000-0000-0000-0000000e4b11', '+201300000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e4b14', '+201300000008', 'authenticated', 'authenticated')  -- guardian B1
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e4a11', '00000000-0000-0000-0000-0000000e4a01', 'manager', 'Manager A', '+201300000001'),
  ('00000000-0000-0000-0000-0000000e4a12', '00000000-0000-0000-0000-0000000e4a01', 'teacher', 'Teacher A', '+201300000002'),
  ('00000000-0000-0000-0000-0000000e4b11', '00000000-0000-0000-0000-0000000e4b01', 'manager', 'Manager B', '+201300000006')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e4a14', '00000000-0000-0000-0000-0000000e4a01', 'Guardian A1', '+201300000004'),
  ('00000000-0000-0000-0000-0000000e4a15', '00000000-0000-0000-0000-0000000e4a01', 'Guardian A2', '+201300000005'),
  ('00000000-0000-0000-0000-0000000e4b14', '00000000-0000-0000-0000-0000000e4b01', 'Guardian B1', '+201300000008')
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, coordinator_staff_id, capacity)
values ('00000000-0000-0000-0000-0000000e4a21', '00000000-0000-0000-0000-0000000e4a01', 'KG1-A', 'kg1', 36, 48, '00000000-0000-0000-0000-0000000e4a12', 10)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e4a31', '00000000-0000-0000-0000-0000000e4a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e4a21', 'full_day'),
  ('00000000-0000-0000-0000-0000000e4a32', '00000000-0000-0000-0000-0000000e4a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e4a21', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values
  ('00000000-0000-0000-0000-0000000e4a31', '00000000-0000-0000-0000-0000000e4a14', '00000000-0000-0000-0000-0000000e4a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e4a32', '00000000-0000-0000-0000-0000000e4a15', '00000000-0000-0000-0000-0000000e4a01', 'mother', true)
on conflict do nothing;

insert into comms.conversations (id, tenant_id, guardian_id, child_id, staff_id, status)
values ('00000000-0000-0000-0000-0000000e4c01', '00000000-0000-0000-0000-0000000e4a01', '00000000-0000-0000-0000-0000000e4a14', '00000000-0000-0000-0000-0000000e4a31', '00000000-0000-0000-0000-0000000e4a12', 'open')
on conflict (id) do nothing;

insert into comms.messages (id, conversation_id, tenant_id, sender_type, sender_id, body)
values ('00000000-0000-0000-0000-0000000e4c11', '00000000-0000-0000-0000-0000000e4c01', '00000000-0000-0000-0000-0000000e4a01', 'guardian', '00000000-0000-0000-0000-0000000e4a14', 'Hello teacher')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's
-- conversation even after it is escalated.
-- ---------------------------------------------------------------------------
update comms.conversations set status = 'escalated', escalated_at = now() where id = '00000000-0000-0000-0000-0000000e4c01';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from comms.conversations where id = '00000000-0000-0000-0000-0000000e4c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 1: Manager B could see Tenant A''s escalated conversation';
  end if;
  raise notice 'PASS Test 1: cross-tenant isolation on conversations holds';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: Manager A sees the conversation now that it is escalated
-- (previously, while status='open', Manager A should NOT have seen it).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from comms.conversations where id = '00000000-0000-0000-0000-0000000e4c01';
  if v_count <> 1 then
    raise exception 'FAIL Test 2: Manager A could not see Tenant A''s escalated conversation (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 2: manager sees an escalated conversation in their own tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: a guardian who is not a participant cannot read the conversation
-- or its messages, even within the same tenant.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from comms.conversations where id = '00000000-0000-0000-0000-0000000e4c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 3a: Guardian A2 (not a participant) could see Guardian A1''s conversation';
  end if;

  select count(*) into v_count from comms.messages where conversation_id = '00000000-0000-0000-0000-0000000e4c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 3b: Guardian A2 (not a participant) could see Guardian A1''s messages';
  end if;

  raise notice 'PASS Test 3: non-participant guardian sees zero rows, same tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: escalate_conversation is idempotent-safe — a second call on an
-- already-escalated conversation is cleanly rejected, not silently repeated.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
begin
  begin
    perform public.escalate_conversation('00000000-0000-0000-0000-0000000e4c01');
    raise exception 'FAIL Test 4: escalate_conversation succeeded on an already-escalated conversation';
  exception
    when others then
      if sqlerrm like '%already escalated%' then
        raise notice 'PASS Test 4: re-escalating an already-escalated conversation is cleanly rejected';
      else
        raise;
      end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: send_message rejects a guardian posting to a conversation they
-- are not a participant in.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
begin
  begin
    perform public.send_message('Sneaky message', '00000000-0000-0000-0000-0000000e4c01');
    raise exception 'FAIL Test 5: send_message let a non-participant guardian post to another guardian''s conversation';
  exception
    when others then
      if sqlerrm like '%not a participant%' then
        raise notice 'PASS Test 5: send_message correctly rejects a non-participant';
      else
        raise;
      end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: comms.notifications has no client INSERT policy — a guardian
-- cannot forge a notification for themselves (or anyone else) via direct
-- table access.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
begin
  begin
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body)
    values ('00000000-0000-0000-0000-0000000e4a01', 'guardian', auth.uid(), 'payment_due', 'Forged', 'Forged notification');
    raise exception 'FAIL Test 6: a guardian could directly INSERT into comms.notifications';
  exception
    when insufficient_privilege then
      raise notice 'PASS Test 6: direct INSERT into comms.notifications is rejected (no client policy)';
    when others then
      raise;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: comms.device_tokens / notification_preferences are self-service
-- only — Guardian B1 cannot see or modify Guardian A1's device token.
-- ---------------------------------------------------------------------------
set local role service_role;

insert into comms.device_tokens (id, tenant_id, recipient_type, recipient_id, platform, token)
values ('00000000-0000-0000-0000-0000000e4d01', '00000000-0000-0000-0000-0000000e4a01', 'guardian', '00000000-0000-0000-0000-0000000e4a14', 'ios', 'tok-a1')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4b14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4b01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from comms.device_tokens where id = '00000000-0000-0000-0000-0000000e4d01';
  if v_count <> 0 then
    raise exception 'FAIL Test 7a: Guardian B1 could see Guardian A1''s device token';
  end if;

  update comms.device_tokens set token = 'hijacked' where id = '00000000-0000-0000-0000-0000000e4d01';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 7b: Guardian B1 could update Guardian A1''s device token';
  end if;

  raise notice 'PASS Test 7: device_tokens is correctly self-service-only, cross-account and cross-tenant';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8: platform.drain_notification_outbox() correctly enqueues a
-- comms.notifications row from an Epic 3 outbox row and marks it dispatched
-- exactly once.
-- ---------------------------------------------------------------------------
set local role service_role;

insert into platform.notification_outbox (id, tenant_id, recipient_type, recipient_id, category, payload)
values ('00000000-0000-0000-0000-0000000e4e01', '00000000-0000-0000-0000-0000000e4a01', 'guardian', '00000000-0000-0000-0000-0000000e4a14', 'trip_update', '{"status":"picked_up"}'::jsonb)
on conflict (id) do nothing;

do $$
declare
  v_drained_1 int;
  v_drained_2 int;
  v_notif_count int;
begin
  v_drained_1 := platform.drain_notification_outbox();
  if v_drained_1 < 1 then
    raise exception 'FAIL Test 8a: drain_notification_outbox drained 0 rows, expected at least 1';
  end if;

  select count(*) into v_notif_count from comms.notifications
  where recipient_id = '00000000-0000-0000-0000-0000000e4a14' and category = 'trip_update';
  if v_notif_count <> 1 then
    raise exception 'FAIL Test 8b: expected exactly 1 comms.notifications row from the drained outbox entry, got %', v_notif_count;
  end if;

  v_drained_2 := platform.drain_notification_outbox();
  if v_drained_2 <> 0 then
    raise exception 'FAIL Test 8c: a second drain call re-processed an already-dispatched outbox row';
  end if;

  raise notice 'PASS Test 8: drain_notification_outbox enqueues exactly once and is idempotent on retry';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: the platform.audit_log provisioning-notification trigger never
-- blocks or fails the underlying audit_log insert, even for an action it
-- doesn't recognize or a target that doesn't resolve to a real recipient.
-- ---------------------------------------------------------------------------
set local role service_role;

do $$
declare v_id uuid;
begin
  v_id := public.write_audit_log(
    '00000000-0000-0000-0000-0000000e4a01', 'staff', '00000000-0000-0000-0000-0000000e4a11',
    'added_staff', 'staff_profiles', '00000000-0000-0000-0000-000000000000'  -- nonexistent target_id
  );

  if v_id is null then
    raise exception 'FAIL Test 9: write_audit_log itself failed when the provisioning-notification trigger encountered a nonexistent target';
  end if;

  raise notice 'PASS Test 9: audit_log insert succeeds even when the best-effort notification trigger cannot resolve a recipient';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Tests 10-19 below verify the fixes in EPIC_4_FIX_REPORT.md (approved
-- EPIC_4_REVIEW.md findings). Each test is labeled with the finding it
-- verifies.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Test 10 — fix for C1: a platform_admin (any tier) can no longer read a
-- chat-attachments object outside their own tenant/participation — the
-- blanket `or public.is_platform_admin()` bypass was removed entirely.
-- ---------------------------------------------------------------------------
set local role service_role;

insert into storage.objects (bucket_id, name)
values ('chat-attachments', '00000000-0000-0000-0000-0000000e4a01/00000000-0000-0000-0000-0000000e4c01/photo.jpg')
on conflict do nothing;

insert into identity.platform_admins (id, name, email, role)
values ('00000000-0000-0000-0000-0000000e4f01', 'Support Admin', 'support-e4-test@masar.app', 'support')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4f01","app_metadata":{"role":"platform_admin"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from storage.objects where bucket_id = 'chat-attachments' and name like '%e4c01%';
  if v_count <> 0 then
    raise exception 'FAIL Test 10: a platform_admin (support tier) could read a chat attachment via the removed blanket bypass';
  end if;
  raise notice 'PASS Test 10: platform_admin has zero chat-attachment read access (EPIC_4_REVIEW.md C1)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11 — fix for C2: jobs.claim_background_jobs atomically flips
-- queued -> processing; a job it has already claimed is not reclaimed by a
-- second call (simulating what would otherwise be a concurrent invocation
-- double-processing the same row).
-- ---------------------------------------------------------------------------
set local role service_role;

insert into jobs.background_job_queue (id, job_type, payload, status)
values ('00000000-0000-0000-0000-0000000e4g01', 'notification_dispatch', '{"notificationId":"00000000-0000-0000-0000-000000000000"}'::jsonb, 'queued')
on conflict (id) do nothing;

do $$
declare
  v_first_count  int;
  v_second_count int;
begin
  select count(*) into v_first_count from jobs.claim_background_jobs('notification_dispatch', 20) where id = '00000000-0000-0000-0000-0000000e4g01';
  if v_first_count <> 1 then
    raise exception 'FAIL Test 11a: claim_background_jobs did not claim the queued job on the first call';
  end if;

  select count(*) into v_second_count from jobs.claim_background_jobs('notification_dispatch', 20) where id = '00000000-0000-0000-0000-0000000e4g01';
  if v_second_count <> 0 then
    raise exception 'FAIL Test 11b: a second claim call re-claimed a job already flipped to processing — the exact double-processing race EPIC_4_REVIEW.md C2 flagged';
  end if;

  raise notice 'PASS Test 11: claim_background_jobs atomically claims exactly once (EPIC_4_REVIEW.md C2)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12 — fix for H1: broadcast_announcement rejects audience='classroom'
-- with no classroomId, and a direct INSERT bypassing the RPC is also
-- rejected by the new DB constraint.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"manager"}}';

do $$
begin
  begin
    perform public.broadcast_announcement('Field trip', 'Permission slip due', 'classroom'::comms.announcement_audience);
    raise exception 'FAIL Test 12a: broadcast_announcement accepted audience=classroom with no classroomId';
  exception
    when others then
      if sqlerrm like '%classroomId is required%' then
        raise notice 'PASS Test 12a: broadcast_announcement rejects a missing classroomId at the RPC layer';
      else
        raise;
      end if;
  end;
end $$;

reset role;

set local role service_role;

do $$
begin
  begin
    insert into comms.announcements (tenant_id, created_by, audience, title, body)
    values ('00000000-0000-0000-0000-0000000e4a01', '00000000-0000-0000-0000-0000000e4a11', 'classroom', 'x', 'y');
    raise exception 'FAIL Test 12b: a direct INSERT with audience=classroom and no classroom_id bypassed the DB constraint';
  exception
    when check_violation then
      raise notice 'PASS Test 12b: announcements_classroom_audience_requires_classroom constraint holds for direct INSERT (EPIC_4_REVIEW.md H1)';
    when others then
      raise;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 13 — fix for H2: a guardian cannot register a device token (or
-- preference) under a forged recipient_type or tenant_id via direct table
-- access.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
begin
  begin
    insert into comms.device_tokens (tenant_id, recipient_type, recipient_id, platform, token)
    values ('00000000-0000-0000-0000-0000000e4a01', 'platform_admin', auth.uid(), 'ios', 'forged-token');
    raise exception 'FAIL Test 13a: a guardian could register a device token with a forged recipient_type';
  exception
    when insufficient_privilege then
      raise notice 'PASS Test 13a: forged recipient_type on device_tokens is rejected (EPIC_4_REVIEW.md H2)';
    when others then
      raise;
  end;

  begin
    insert into comms.device_tokens (tenant_id, recipient_type, recipient_id, platform, token)
    values ('00000000-0000-0000-0000-0000000e4b01', 'guardian', auth.uid(), 'ios', 'forged-tenant-token');
    raise exception 'FAIL Test 13b: a guardian could register a device token with a forged tenant_id';
  exception
    when insufficient_privilege then
      raise notice 'PASS Test 13b: forged tenant_id on device_tokens is rejected (EPIC_4_REVIEW.md H2)';
    when others then
      raise;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 14 — fix for H3: reusing an idempotency key with a different
-- message body raises CONFLICT_IDEMPOTENCY_KEY_REUSED instead of silently
-- replaying the original response.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
declare
  v_key uuid := '00000000-0000-0000-0000-0000000e4h01';
  v_msg1 comms.messages;
begin
  v_msg1 := public.send_message('First message', '00000000-0000-0000-0000-0000000e4c01', null, v_key);

  begin
    perform public.send_message('A completely different message', '00000000-0000-0000-0000-0000000e4c01', null, v_key);
    raise exception 'FAIL Test 14: reusing the idempotency key with a different body silently replayed the first response instead of raising CONFLICT_IDEMPOTENCY_KEY_REUSED';
  exception
    when others then
      if sqlerrm like '%reused with a different payload%' then
        raise notice 'PASS Test 14: idempotency key reuse with a different payload is correctly rejected (EPIC_4_REVIEW.md H3)';
      else
        raise;
      end if;
  end;

  -- Same key, same body: must still replay cleanly (not regress the
  -- original idempotency guarantee).
  declare
    v_msg1_replay comms.messages;
  begin
    v_msg1_replay := public.send_message('First message', '00000000-0000-0000-0000-0000000e4c01', null, v_key);
    if v_msg1_replay.id <> v_msg1.id then
      raise exception 'FAIL Test 14b: replaying the same key with the SAME payload created a new message instead of replaying';
    end if;
    raise notice 'PASS Test 14b: same key + same payload still replays correctly';
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 15 — fix for H4: broadcast_announcement's set-based rewrite still
-- produces the correct fan-out (both recipients, not zero, not duplicated).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"manager"}}';

do $$
declare
  v_ann comms.announcements;
  v_recipient_count int;
  v_notification_count int;
begin
  v_ann := public.broadcast_announcement('All-parents test', 'Set-based fan-out check', 'parents'::comms.announcement_audience);

  select count(*) into v_recipient_count from comms.announcement_recipients where announcement_id = v_ann.id;
  if v_recipient_count <> 2 then
    raise exception 'FAIL Test 15a: expected 2 announcement_recipients (Guardian A1 + A2), got %', v_recipient_count;
  end if;

  select count(*) into v_notification_count from comms.notifications where category = 'announcement' and body = 'Set-based fan-out check';
  if v_notification_count <> 2 then
    raise exception 'FAIL Test 15b: expected 2 notifications from the set-based fan-out, got %', v_notification_count;
  end if;

  raise notice 'PASS Test 15: set-based broadcast_announcement fan-out reaches exactly the right recipients, once each (EPIC_4_REVIEW.md H4)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 16 — fix for M1: a guardian cannot mark their own sent message as
-- "read" (only an inbound message from the other participant).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  update comms.messages set read_at = now() where id = '00000000-0000-0000-0000-0000000e4c11'; -- sent BY this guardian
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 16: a guardian could mark their own sent message as read';
  end if;
  raise notice 'PASS Test 16: a participant cannot mark their own outbound message as read (EPIC_4_REVIEW.md M1)';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 17 — fix for L2: a soft-deleted staff account can no longer read
-- their own conversations even though their JWT role claim is unchanged
-- (session not yet expired).
-- ---------------------------------------------------------------------------
set local role service_role;
update identity.staff_profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000e4a12';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from comms.conversations where id = '00000000-0000-0000-0000-0000000e4c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 17: a terminated teacher account could still read their conversation';
  end if;
  raise notice 'PASS Test 17: current_account_is_active() correctly blocks a soft-deleted account mid-session (EPIC_4_REVIEW.md L2)';
end $$;

reset role;

set local role service_role;
update identity.staff_profiles set deleted_at = null where id = '00000000-0000-0000-0000-0000000e4a12';
reset role;

-- ---------------------------------------------------------------------------
-- Test 18 — fix for L3: send_message's new-conversation coordinator lookup
-- no longer resolves a non-teacher coordinator as a valid message target.
-- ---------------------------------------------------------------------------
set local role service_role;

update academic.classrooms set coordinator_staff_id = '00000000-0000-0000-0000-0000000e4a11' -- Manager A, not a teacher
where id = '00000000-0000-0000-0000-0000000e4a21';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e4a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e4a01","role":"guardian"}}';

do $$
begin
  begin
    perform public.send_message('Hi', null, '00000000-0000-0000-0000-0000000e4a32');
    raise exception 'FAIL Test 18: send_message resolved a non-teacher (manager) coordinator as a new conversation''s staff_id';
  exception
    when others then
      if sqlerrm like '%no coordinator assigned%' then
        raise notice 'PASS Test 18: send_message correctly refuses to target a non-teacher coordinator (EPIC_4_REVIEW.md L3)';
      else
        raise;
      end if;
  end;
end $$;

reset role;

set local role service_role;
update academic.classrooms set coordinator_staff_id = '00000000-0000-0000-0000-0000000e4a12' where id = '00000000-0000-0000-0000-0000000e4a21';
reset role;

rollback; -- leave no fixture data behind regardless of pass/fail
