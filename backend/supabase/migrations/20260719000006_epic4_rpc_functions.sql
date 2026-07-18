-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 6: RPC functions + core notification-write seam
-- Ref: BACKEND_ARCHITECTURE.md §14.2, §16, §25.1, §25.2, §25.6, §26
--
-- Error codes reused from Epic 1's already-shipped, deliberately generic
-- taxonomy throughout this file — no new error code is added, no Epic 1 file
-- is touched.
--
-- Lesson applied proactively from EPIC_3_REVIEW.md C4 (found the hard way in
-- Epic 3, applied here from the first draft): comms.enqueue_notification is
-- the sole write path into comms.notifications and is granted to
-- service_role ONLY, never to `authenticated` — any RPC that needs to enqueue
-- a notification (send_message, escalate_conversation, broadcast_announcement
-- below) is itself SECURITY DEFINER, so its internal call succeeds via the
-- definer's own privileges without comms.enqueue_notification ever being
-- directly callable by an end-user role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- comms.enqueue_notification — sole write path into comms.notifications.
-- SECURITY DEFINER, service_role-only grant (see file header). The AFTER
-- INSERT trigger below is what actually implements §26's "Any INSERT into
-- notifications" background-job trigger — kept as a trigger (not inlined
-- here) so it fires for every insert into the table regardless of which
-- future caller performs it, not just this function.
-- ---------------------------------------------------------------------------
create or replace function comms.enqueue_notification(
  p_tenant_id      uuid,
  p_recipient_type comms.notification_recipient_type,
  p_recipient_id   uuid,
  p_category       text,
  p_title          text,
  p_body           text,
  p_deep_link      text default null,
  p_severity       comms.notification_severity default 'info'
)
returns comms.notifications
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_row comms.notifications;
begin
  insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
  values (p_tenant_id, p_recipient_type, p_recipient_id, p_category, p_title, p_body, p_deep_link, p_severity)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function comms.enqueue_notification is
  'Sole write path into comms.notifications (§26). SECURITY DEFINER, service_role-only grant — every RPC below that needs to enqueue a notification is itself SECURITY DEFINER (applying the EPIC_3_REVIEW.md C4 lesson from the start rather than discovering it again).';

revoke all on function comms.enqueue_notification from public;
revoke all on function comms.enqueue_notification from authenticated;
grant execute on function comms.enqueue_notification to service_role;

-- ---------------------------------------------------------------------------
-- comms.enqueue_dispatch_job — §26: "Any INSERT into notifications" enqueues
-- a background_job_queue entry for the notification-dispatch Edge Function
-- to pick up. A trigger, not inline logic inside enqueue_notification, so
-- the guarantee holds regardless of caller.
-- ---------------------------------------------------------------------------
create or replace function comms.enqueue_dispatch_job()
returns trigger
language plpgsql
as $$
begin
  insert into jobs.background_job_queue (job_type, payload)
  values ('notification_dispatch', jsonb_build_object('notificationId', new.id));

  return new;
end;
$$;

create trigger trg_notifications_enqueue_dispatch
  after insert on comms.notifications
  for each row execute function comms.enqueue_dispatch_job();

-- ---------------------------------------------------------------------------
-- public.send_message — guardian/teacher. Either posts to an existing
-- conversation (p_conversation_id) or opens a new one for p_child_id
-- (guardian only — resolves the target staff member via the child's
-- classroom coordinator, mirroring current_staff_classroom_ids()'s own
-- "coordinator is the default owner" convention from Epic 2).
--
-- Idempotency (§14.2/§25.6): send_message is NOT a natural upsert (every
-- call creates a new row) and IS named as needing idempotency-key handling
-- by §14.2's own text — implemented via Epic 1's existing
-- idempotency_replay/idempotency_store RPCs, called directly from this
-- RPC's own body (the same pattern the Deno withIdempotency helper wraps
-- for Edge Functions, applied here at the SQL layer since this is a plain
-- RPC, not an Edge Function).
--
-- SECURITY DEFINER (see file header) so it can call comms.enqueue_notification.
-- ---------------------------------------------------------------------------
create or replace function public.send_message(
  p_body               text,
  p_conversation_id    uuid default null,
  p_child_id           uuid default null,
  p_idempotency_key    uuid default null
)
returns comms.messages
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_role            text := public.current_role();
  v_tenant_id       uuid := public.current_tenant_id();
  v_conversation    comms.conversations;
  v_sender_type     comms.message_sender_type;
  v_row             comms.messages;
  v_replay          jsonb;
  v_input_hash      text;
  v_other_recipient_type comms.notification_recipient_type;
  v_other_recipient_id   uuid;
begin
  if v_role not in ('guardian', 'teacher') then
    raise exception 'Only a guardian or teacher can send a message'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a guardian or teacher can send a message.', 'human_message_ar', 'فقط ولي الأمر أو المعلّم يمكنه إرسال رسالة.')::text;
  end if;

  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'body is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Message body is required.', 'human_message_ar', 'نص الرسالة مطلوب.')::text;
  end if;

  -- Fix for EPIC_4_REVIEW.md H3: public.idempotency_replay/idempotency_store
  -- (Epic 1, frozen) never compare the current call's parameters against
  -- what was stored — a reused key always silently replays the ORIGINAL
  -- response regardless of whether this call's params differ, contradicting
  -- §25.6's explicit "different payload -> CONFLICT_IDEMPOTENCY_KEY_REUSED"
  -- contract. Since the Epic 1 helpers cannot be modified, the comparison is
  -- implemented here: a hash of this call's own normalized input is stored
  -- alongside the response (wrapped in one jsonb envelope, since
  -- idempotency_store's signature takes a single jsonb response), and
  -- compared against the replayed envelope's stored hash before ever
  -- returning a replayed value.
  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_body, '') || '|' || coalesce(p_conversation_id::text, '') || '|' || coalesce(p_child_id::text, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      select * into v_row from jsonb_populate_record(null::comms.messages, v_replay->'data');
      return v_row;
    end if;
  end if;

  v_sender_type := case v_role when 'guardian' then 'guardian' else 'staff' end;

  if p_conversation_id is not null then
    select * into v_conversation from comms.conversations where id = p_conversation_id and tenant_id = v_tenant_id;

    if v_conversation.id is null then
      raise exception 'Conversation not found for this tenant'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Conversation not found.', 'human_message_ar', 'لم يتم العثور على المحادثة.')::text;
    end if;

    if (v_role = 'guardian' and v_conversation.guardian_id <> auth.uid())
       or (v_role = 'teacher' and v_conversation.staff_id <> auth.uid()) then
      raise exception 'You are not a participant in this conversation'
        using errcode = 'P0001',
              detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'You are not a participant in this conversation.', 'human_message_ar', 'أنت لست طرفًا في هذه المحادثة.')::text;
    end if;
  else
    if v_role <> 'guardian' or p_child_id is null then
      raise exception 'A new conversation can only be started by a guardian, for a specific child'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A new conversation requires a childId and can only be started by a guardian.', 'human_message_ar', 'المحادثة الجديدة تتطلب معرّف الطفل ولا يمكن أن يبدأها إلا ولي الأمر.')::text;
    end if;

    if p_child_id <> all (public.current_guardian_child_ids()) then
      raise exception 'This is not your child'
        using errcode = 'P0001',
              detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'This is not your child.', 'human_message_ar', 'هذا ليس طفلك.')::text;
    end if;

    -- Fix for EPIC_4_REVIEW.md L3: previously accepted any
    -- coordinator_staff_id regardless of role — if a classroom's
    -- coordinator happened to be a manager/reception staff member (nothing
    -- in Epic 2 constrains that column's role), the conversation's staff_id
    -- would target a non-teacher whom the teacher-scoped RLS policies could
    -- never let read it. Now requires the coordinator to actually hold the
    -- 'teacher' role, matching who conversations_select_staff/
    -- messages_select_staff (migration 5) actually grant access to.
    insert into comms.conversations (tenant_id, guardian_id, child_id, staff_id, status)
    select v_tenant_id, auth.uid(), p_child_id, c.coordinator_staff_id, 'open'
    from academic.children ch
    join academic.classrooms c on c.id = ch.classroom_id
    join identity.staff_profiles sp on sp.id = c.coordinator_staff_id and sp.role = 'teacher' and sp.deleted_at is null
    where ch.id = p_child_id and ch.deleted_at is null and c.coordinator_staff_id is not null
    returning * into v_conversation;

    if v_conversation.id is null then
      raise exception 'This child''s classroom has no coordinator assigned to message'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'This child''s classroom has no coordinator assigned yet.', 'human_message_ar', 'لا يوجد منسّق لفصل هذا الطفل بعد.')::text;
    end if;
  end if;

  insert into comms.messages (conversation_id, tenant_id, sender_type, sender_id, body)
  values (v_conversation.id, v_tenant_id, v_sender_type, auth.uid(), btrim(p_body))
  returning * into v_row;

  -- Fix-forward (§16 "New chat message | Other participant"): notify
  -- whichever participant did NOT send this message.
  if v_sender_type = 'guardian' then
    v_other_recipient_type := 'staff';
    v_other_recipient_id := v_conversation.staff_id;
  else
    v_other_recipient_type := 'guardian';
    v_other_recipient_id := v_conversation.guardian_id;
  end if;

  perform comms.enqueue_notification(
    v_tenant_id, v_other_recipient_type, v_other_recipient_id, 'chat_message',
    'New message', left(btrim(p_body), 200), 'app://conversations/' || v_conversation.id::text
  );

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'send_message', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.send_message is
  'Posts to an existing conversation or opens a new one (guardian only, resolved via the child''s classroom coordinator). Idempotency-key supported per §14.2/§25.6 (send_message is explicitly not a natural upsert). SECURITY DEFINER to reach comms.enqueue_notification.';

revoke all on function public.send_message from public;
grant execute on function public.send_message to authenticated;

-- ---------------------------------------------------------------------------
-- public.escalate_conversation — guardian or teacher (own conversation
-- only), manager cannot self-escalate (§12 gives manager R-only on this
-- resource, escalation is guardian/teacher-initiated). Atomic UPDATE...WHERE
-- (M1-pattern, EPIC_2_REVIEW.md/EPIC_3_REVIEW.md M3) — naturally idempotent-
-- safe (a retry cleanly hits STATE_ALREADY_PROCESSED, no idempotency_key
-- needed, matching the established exemption for atomic state-transition
-- RPCs). Notifies every manager in the tenant (§16 "Chat escalated | Manager").
-- ---------------------------------------------------------------------------
create or replace function public.escalate_conversation(
  p_conversation_id  uuid,
  p_reason           text default null
)
returns comms.conversations
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_role      text := public.current_role();
  v_tenant_id uuid := public.current_tenant_id();
  v_row       comms.conversations;
  v_exists    boolean;
  v_manager   record;
begin
  if v_role not in ('guardian', 'teacher') then
    raise exception 'Only a guardian or teacher can escalate a conversation'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a guardian or teacher can escalate a conversation.', 'human_message_ar', 'فقط ولي الأمر أو المعلّم يمكنه تصعيد المحادثة.')::text;
  end if;

  update comms.conversations
  set status = 'escalated', escalated_at = now(), escalation_reason = p_reason
  where id = p_conversation_id
    and tenant_id = v_tenant_id
    and status <> 'escalated'
    and ((v_role = 'guardian' and guardian_id = auth.uid()) or (v_role = 'teacher' and staff_id = auth.uid()))
  returning * into v_row;

  if v_row.id is not null then
    insert into comms.messages (conversation_id, tenant_id, sender_type, sender_id, body)
    values (v_row.id, v_tenant_id, 'system', null, 'This conversation has been escalated to management.');

    for v_manager in select id from identity.staff_profiles where tenant_id = v_tenant_id and role = 'manager' and deleted_at is null
    loop
      perform comms.enqueue_notification(
        v_tenant_id, 'staff', v_manager.id, 'escalation',
        'Conversation escalated', coalesce(p_reason, 'A guardian/teacher conversation was escalated.'),
        'app://conversations/' || v_row.id::text, 'attention'
      );
    end loop;

    return v_row;
  end if;

  select exists(
    select 1 from comms.conversations
    where id = p_conversation_id and tenant_id = v_tenant_id
      and ((v_role = 'guardian' and guardian_id = auth.uid()) or (v_role = 'teacher' and staff_id = auth.uid()))
  ) into v_exists;

  if not v_exists then
    raise exception 'Conversation not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Conversation not found.', 'human_message_ar', 'لم يتم العثور على المحادثة.')::text;
  else
    raise exception 'This conversation is already escalated'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This conversation is already escalated.', 'human_message_ar', 'تم تصعيد هذه المحادثة بالفعل.')::text;
  end if;
end;
$$;

revoke all on function public.escalate_conversation from public;
grant execute on function public.escalate_conversation to authenticated;

-- ---------------------------------------------------------------------------
-- public.register_device_token — any authenticated role (self). Natural
-- upsert via device_tokens' own (recipient_type, recipient_id, token)
-- unique constraint — idempotency-key-exempt per §14.2's own named example.
-- ---------------------------------------------------------------------------
create or replace function public.register_device_token(
  p_platform  comms.device_platform,
  p_token     text
)
returns comms.device_tokens
language plpgsql
as $$
declare
  v_role text := public.current_role();
  v_recipient_type comms.notification_recipient_type;
  v_row comms.device_tokens;
begin
  v_recipient_type := case
    when v_role in ('teacher', 'reception', 'manager') then 'staff'
    when v_role in ('guardian', 'driver', 'platform_admin') then v_role::comms.notification_recipient_type
    else null
  end;

  if v_recipient_type is null then
    raise exception 'Unrecognized caller role'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Your account role cannot register a device token.', 'human_message_ar', 'لا يمكن لدور حسابك تسجيل رمز الجهاز.')::text;
  end if;

  if btrim(coalesce(p_token, '')) = '' then
    raise exception 'token is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A device token is required.', 'human_message_ar', 'رمز الجهاز مطلوب.')::text;
  end if;

  insert into comms.device_tokens (tenant_id, recipient_type, recipient_id, platform, token, last_seen_at)
  values (public.current_tenant_id(), v_recipient_type, auth.uid(), p_platform, p_token, now())
  on conflict (recipient_type, recipient_id, token) do update set last_seen_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_device_token from public;
grant execute on function public.register_device_token to authenticated;

-- ---------------------------------------------------------------------------
-- public.update_notification_preferences — any authenticated role (self).
-- Natural upsert via notification_preferences' own unique constraint —
-- idempotency-key-exempt, same reasoning as register_device_token.
-- ---------------------------------------------------------------------------
create or replace function public.update_notification_preferences(
  p_category  text,
  p_channel   comms.notification_channel,
  p_enabled   boolean
)
returns comms.notification_preferences
language plpgsql
as $$
declare
  v_role text := public.current_role();
  v_recipient_type comms.notification_recipient_type;
  v_row comms.notification_preferences;
begin
  v_recipient_type := case
    when v_role in ('teacher', 'reception', 'manager') then 'staff'
    when v_role in ('guardian', 'driver', 'platform_admin') then v_role::comms.notification_recipient_type
    else null
  end;

  if v_recipient_type is null then
    raise exception 'Unrecognized caller role'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Your account role cannot update notification preferences.', 'human_message_ar', 'لا يمكن لدور حسابك تحديث تفضيلات الإشعارات.')::text;
  end if;

  if btrim(coalesce(p_category, '')) = '' then
    raise exception 'category is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A notification category is required.', 'human_message_ar', 'فئة الإشعار مطلوبة.')::text;
  end if;

  insert into comms.notification_preferences (tenant_id, recipient_type, recipient_id, category, channel, enabled)
  values (public.current_tenant_id(), v_recipient_type, auth.uid(), p_category, p_channel, p_enabled)
  on conflict (recipient_type, recipient_id, category, channel) do update set enabled = excluded.enabled
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_notification_preferences from public;
grant execute on function public.update_notification_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- public.broadcast_announcement — manager (own tenant) or platform_admin
-- owner/admin tier (platform-wide, §12.1). Fans out to
-- comms.announcement_recipients and enqueues a comms.notifications row per
-- resolved recipient. Idempotency-key supported (not a natural upsert —
-- broadcasting twice would double-notify an entire audience, a real-world
-- consequence worth guarding against per §14.2/§25.6).
--
-- SECURITY DEFINER (file header) — also required here because
-- announcement_recipients has no client INSERT policy at all (migration 5):
-- only this function may populate it, closing off the possibility of a
-- guardian inserting themselves as a recipient of an announcement they were
-- never targeted for.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_announcement(
  p_title                  text,
  p_body                   text,
  p_audience               comms.announcement_audience default null,
  p_platform_audience      comms.platform_announcement_audience default null,
  p_classroom_id           uuid default null,
  p_priority               comms.announcement_priority default 'normal',
  p_channels               comms.announcement_channel[] default array['in_app']::comms.announcement_channel[],
  p_platform_plan_code     text default null,
  p_idempotency_key        uuid default null
)
returns comms.announcements
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_role         text := public.current_role();
  v_tenant_id    uuid := public.current_tenant_id();
  v_announcement comms.announcements;
  v_replay       jsonb;
  v_input_hash   text;
begin
  if btrim(coalesce(p_title, '')) = '' or btrim(coalesce(p_body, '')) = '' then
    raise exception 'title and body are required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Title and body are required.', 'human_message_ar', 'العنوان والنص مطلوبان.')::text;
  end if;

  -- Fix for EPIC_4_REVIEW.md H1: previously nothing checked that a
  -- classroom-targeted announcement actually carried a classroomId — the
  -- fan-out query's join predicate never matches when it's null, so the
  -- announcement was created (sent_at set, implying success) with zero
  -- recipients and no error. This is the RPC-layer half of a 3-layer fix
  -- (Zod schema, this check, and the new
  -- announcements_classroom_audience_requires_classroom DB constraint,
  -- migration 2) — checked here first so the caller gets a clean,
  -- immediate VALIDATION_FAILED instead of a raw constraint-violation error.
  if p_audience = 'classroom' and p_classroom_id is null then
    raise exception 'classroomId is required when audience is classroom'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A classroom must be selected for a classroom-targeted announcement.', 'human_message_ar', 'يجب اختيار فصل عند استهداف إعلان لفصل معيّن.')::text;
  end if;

  -- Fix for EPIC_4_REVIEW.md H3 — same input-hash-envelope technique as
  -- send_message above (see that function's comment for the full rationale).
  if p_idempotency_key is not null then
    v_input_hash := md5(
      coalesce(p_title, '') || '|' || coalesce(p_body, '') || '|' || coalesce(p_audience::text, '') || '|' ||
      coalesce(p_platform_audience::text, '') || '|' || coalesce(p_classroom_id::text, '') || '|' || coalesce(p_platform_plan_code, '')
    );
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      select * into v_announcement from jsonb_populate_record(null::comms.announcements, v_replay->'data');
      return v_announcement;
    end if;
  end if;

  if v_role = 'manager' then
    if p_audience is null then
      raise exception 'audience is required for a tenant-scoped announcement'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'An audience is required.', 'human_message_ar', 'الجمهور المستهدف مطلوب.')::text;
    end if;

    insert into comms.announcements (tenant_id, created_by, audience, classroom_id, title, body, priority, channels, sent_at)
    values (v_tenant_id, auth.uid(), p_audience, p_classroom_id, btrim(p_title), btrim(p_body), p_priority, p_channels, now())
    returning * into v_announcement;

    -- Fix for EPIC_4_REVIEW.md H4: rewritten from a per-recipient
    -- procedural loop (one enqueue_notification call + one trigger-fired
    -- background_job_queue insert PER recipient) to a single chained
    -- set-based statement — a large audience (e.g. "all parents" in a
    -- big tenant) previously performed hundreds of sequential writes
    -- inside one transaction. The write path is still exclusively reachable
    -- from within this SECURITY DEFINER function (the security property
    -- EPIC_3_REVIEW.md C4 established), just expressed as bulk statements
    -- instead of per-row function calls.
    with recipients as (
      select 'guardian'::comms.announcement_recipient_type as recipient_type, gp.id as recipient_id
      from identity.guardian_profiles gp
      where gp.tenant_id = v_tenant_id and gp.deleted_at is null and p_audience in ('all', 'parents')
      union
      select 'guardian'::comms.announcement_recipient_type, cgl.guardian_id
      from academic.child_guardian_links cgl
      join academic.children ch on ch.id = cgl.child_id
      where ch.classroom_id = p_classroom_id and ch.deleted_at is null and p_audience = 'classroom'
      union
      select 'staff'::comms.announcement_recipient_type, sp.id
      from identity.staff_profiles sp
      where sp.tenant_id = v_tenant_id and sp.deleted_at is null
        and (p_audience = 'all' or (p_audience = 'teachers' and sp.role = 'teacher'))
      union
      select 'driver'::comms.announcement_recipient_type, dp.id
      from identity.driver_profiles dp
      where dp.tenant_id = v_tenant_id and dp.deleted_at is null and p_audience in ('all', 'drivers')
    ),
    inserted_recipients as (
      insert into comms.announcement_recipients (announcement_id, recipient_type, recipient_id)
      select v_announcement.id, recipient_type, recipient_id from recipients
      on conflict do nothing
    ),
    inserted_notifications as (
      insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
      select
        v_tenant_id,
        (case recipient_type when 'guardian' then 'guardian' when 'staff' then 'staff' else 'driver' end)::comms.notification_recipient_type,
        recipient_id, 'announcement', v_announcement.title, left(v_announcement.body, 500),
        'app://announcements/' || v_announcement.id::text,
        case p_priority when 'urgent' then 'urgent' when 'important' then 'attention' else 'info' end
      from recipients
      returning id
    )
    insert into comms.notification_deliveries (notification_id, channel, status)
    select n.id, ch, 'queued'
    from inserted_notifications n
    cross join unnest(p_channels) as ch
    where ch <> 'in_app';

  elsif v_role = 'platform_admin' then
    if not public.is_platform_admin_manager_tier() then
      raise exception 'Only owner/admin tier can broadcast platform-wide'
        using errcode = 'P0001',
              detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only owner/admin tier can broadcast platform-wide.', 'human_message_ar', 'فقط فئة المالك/المسؤول يمكنها البث على مستوى المنصة.')::text;
    end if;

    if p_platform_audience is null then
      raise exception 'platformAudience is required for a platform-wide announcement'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A platform audience is required.', 'human_message_ar', 'جمهور المنصة المستهدف مطلوب.')::text;
    end if;

    insert into comms.announcements (tenant_id, created_by, platform_audience, title, body, priority, channels, sent_at)
    values (null, auth.uid(), p_platform_audience, btrim(p_title), btrim(p_body), p_priority, p_channels, now())
    returning * into v_announcement;

    -- Fix for EPIC_4_REVIEW.md H4 — same set-based rewrite for the
    -- platform-wide branch. A "tenant" has no auth identity of its own —
    -- notify that tenant's manager(s), the real humans who will see it.
    with target_tenants as (
      select t.id as tenant_id
      from tenancy.tenants t
      left join tenancy.plan_catalog pc on pc.id = t.plan_id
      where (p_platform_audience = 'all_schools')
         or (p_platform_audience = 'trial_accounts' and t.status = 'trial')
         or (p_platform_audience = 'overdue_accounts' and t.status = 'overdue')
         or (p_platform_audience = 'plan_tier' and pc.code = p_platform_plan_code)
    ),
    inserted_recipients as (
      insert into comms.announcement_recipients (announcement_id, recipient_type, recipient_id)
      select v_announcement.id, 'tenant', tenant_id from target_tenants
      on conflict do nothing
    )
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select tt.tenant_id, 'staff', sp.id, 'announcement', v_announcement.title, left(v_announcement.body, 500),
           'app://announcements/' || v_announcement.id::text,
           case p_priority when 'urgent' then 'urgent' when 'important' then 'attention' else 'info' end
    from target_tenants tt
    join identity.staff_profiles sp on sp.tenant_id = tt.tenant_id and sp.role = 'manager' and sp.deleted_at is null;

  else
    raise exception 'Only a manager or platform admin can broadcast an announcement'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager or platform admin can broadcast an announcement.', 'human_message_ar', 'فقط المدير أو مسؤول المنصة يمكنه بث إعلان.')::text;
  end if;

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'broadcast_announcement', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_announcement)));
  end if;

  return v_announcement;
end;
$$;

comment on function public.broadcast_announcement is
  'Manager (own tenant) or platform_admin owner/admin tier (platform-wide, §12.1). Fans out to announcement_recipients and enqueues one comms.notifications row per resolved recipient. Idempotency-key supported (§14.2/§25.6 — broadcasting twice would double-notify an entire audience). SECURITY DEFINER — announcement_recipients has no client INSERT policy at all (migration 5).';

revoke all on function public.broadcast_announcement from public;
grant execute on function public.broadcast_announcement to authenticated;
