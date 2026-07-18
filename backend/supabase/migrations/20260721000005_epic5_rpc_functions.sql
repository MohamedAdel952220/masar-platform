-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 5: RPC functions
-- Ref: BACKEND_ARCHITECTURE.md §14.2, §25.1, §25.2, §25.6; §16 Notification
--      Matrix ("Request approved/rejected", "Event published", "New
--      request submitted")
--
-- Error codes reused from Epic 1's already-shipped taxonomy throughout
-- (VALIDATION_FAILED, STATE_ALREADY_PROCESSED, NOT_FOUND, PERM_ROLE_DENIED,
-- PERM_TENANT_MISMATCH, CONFLICT_IDEMPOTENCY_KEY_REUSED) — no new error
-- code is added, no Epic 1 file is touched.
--
-- submit_request and review_request are SECURITY DEFINER solely to reach
-- comms.enqueue_notification (Epic 4, EXECUTE revoked from `authenticated`
-- — only callable via a nested call from another SECURITY DEFINER
-- function, EPIC_4_REVIEW.md's own established pattern). Each function's
-- own role/tenant checks remain the sole authorization gate for its own
-- writes, exactly mirroring update_child_trip_status/confirm_handover/
-- send_message/broadcast_announcement (Epic 3/4).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.submit_request — teacher only. Creates a pending request and
-- notifies the tenant's manager(s). Idempotency-key + payload-hash envelope
-- (EPIC_4_REVIEW.md H3: the frozen Epic 1 idempotency_replay/idempotency_store
-- helpers never compare payloads themselves, so the comparison is
-- implemented at this call site, wrapping the stored response in
-- {_inputHash, data}).
--
-- Manager notification uses a small, bounded-N loop (a tenant's manager
-- count is always small, typically 1-3) — the same "bounded N, loop is
-- fine" reasoning EPIC_3_REVIEW.md L1 explicitly established for
-- escalate_conversation's manager loop, not the unbounded-fan-out case
-- EPIC_4_REVIEW.md H4 required a set-based rewrite for.
-- ---------------------------------------------------------------------------
create or replace function public.submit_request(
  p_type                  approvals.request_type,
  p_title                 text,
  p_request_date          date,
  p_request_time          time default null,
  p_classroom_id          uuid default null,
  p_subject_id            uuid default null,
  p_exam_kind             approvals.exam_kind default null,
  p_note                  text default null,
  p_place                 text default null,
  p_price                 numeric default null,
  p_attachment_object_id  uuid default null,
  p_idempotency_key       uuid default null
)
returns approvals.requests
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id   uuid := public.current_tenant_id();
  v_row         approvals.requests;
  v_replay      jsonb;
  v_input_hash  text;
  v_manager     record;
begin
  if public.current_role() <> 'teacher' then
    raise exception 'Only a teacher can submit a request'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a teacher can submit a request.', 'human_message_ar', 'فقط المعلّم يمكنه تقديم طلب.')::text;
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'title is required'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Title is required.', 'human_message_ar', 'العنوان مطلوب.')::text;
  end if;

  if p_type = 'exam' and p_exam_kind is null then
    raise exception 'examKind is required for an exam request'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'An exam kind is required for an exam request.', 'human_message_ar', 'نوع الامتحان مطلوب لطلب الامتحان.')::text;
  end if;

  if p_idempotency_key is not null then
    -- Fix for EPIC_5_REVIEW.md M1: previously omitted p_request_time,
    -- p_note, p_exam_kind, and p_attachment_object_id — two calls sharing
    -- the same idempotency key but differing only in one of those fields
    -- hashed identically, so the second call would silently replay the
    -- first call's response instead of raising
    -- CONFLICT_IDEMPOTENCY_KEY_REUSED (§25.6). Every one of this
    -- function's own mutable parameters is now covered.
    v_input_hash := md5(
      coalesce(p_type::text, '') || '|' || coalesce(p_title, '') || '|' || coalesce(p_request_date::text, '') || '|' ||
      coalesce(p_request_time::text, '') || '|' ||
      coalesce(p_classroom_id::text, '') || '|' || coalesce(p_subject_id::text, '') || '|' ||
      coalesce(p_exam_kind::text, '') || '|' || coalesce(p_note, '') || '|' ||
      coalesce(p_place, '') || '|' || coalesce(p_price::text, '') || '|' || coalesce(p_attachment_object_id::text, '')
    );
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      select * into v_row from jsonb_populate_record(null::approvals.requests, v_replay->'data');
      return v_row;
    end if;
  end if;

  insert into approvals.requests (
    tenant_id, submitted_by, type, exam_kind, title, classroom_id, subject_id,
    request_date, request_time, note, place, price, attachment_object_id, status
  )
  values (
    v_tenant_id, auth.uid(), p_type, p_exam_kind, btrim(p_title), p_classroom_id, p_subject_id,
    p_request_date, p_request_time, p_note, p_place, p_price, p_attachment_object_id, 'pending'
  )
  returning * into v_row;

  -- §16: "New request submitted (awaiting review) -> Manager -> in_app, push".
  for v_manager in select id from identity.staff_profiles where tenant_id = v_tenant_id and role = 'manager' and deleted_at is null
  loop
    perform comms.enqueue_notification(
      v_tenant_id, 'staff', v_manager.id, 'approval',
      'New request submitted', btrim(p_title),
      'app://approvals/requests/' || v_row.id::text
    );
  end loop;

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'submit_request', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.submit_request is
  'Teacher-only. Creates a pending approvals.requests row and notifies the tenant''s manager(s) (§16). Idempotency-key + payload-hash envelope (§25.6, EPIC_4_REVIEW.md H3 pattern). SECURITY DEFINER to reach comms.enqueue_notification.';

revoke all on function public.submit_request from public;
grant execute on function public.submit_request to authenticated;

-- ---------------------------------------------------------------------------
-- public.review_request — manager only. Atomic UPDATE...WHERE (status =
-- 'pending' -> approved/rejected), the same M1 pattern
-- (EPIC_2_REVIEW.md M1, EPIC_3_REVIEW.md M3) used throughout this codebase
-- for check-then-transition races. On approval, promotes the request to an
-- approvals.events row in the same transaction (Acceptance Criteria: "the
-- promotion is transactional, never a half-created event on failure") and
-- fans out an "event published" notification to the relevant guardians via
-- a single set-based statement chain (EPIC_4_REVIEW.md H4: no per-row loop
-- for a potentially-unbounded audience). The submitting teacher is always
-- notified of the decision (§16: "Request approved/rejected").
--
-- request.type='event' maps to events.type='celebration' — the two enums
-- are deliberately named differently (BACKEND_ARCHITECTURE.md §3.21 vs
-- §3.22); 'trip'/'exam' map to themselves unchanged.
--
-- Idempotency-key + payload-hash envelope (EPIC_4_REVIEW.md H3 pattern) —
-- critical here specifically because a network retry after a successful
-- approval must never create a second event.
-- ---------------------------------------------------------------------------
create or replace function public.review_request(
  p_request_id        uuid,
  p_decision           approvals.request_status,
  p_rejection_reason    text default null,
  p_idempotency_key     uuid default null
)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id     uuid := public.current_tenant_id();
  v_request       approvals.requests;
  v_event         approvals.events;
  v_event_type    approvals.event_type;
  v_result        jsonb;
  v_replay        jsonb;
  v_input_hash    text;
  v_exists        boolean;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can review a request'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can review a request.', 'human_message_ar', 'فقط المدير يمكنه مراجعة الطلب.')::text;
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Decision must be approved or rejected.', 'human_message_ar', 'يجب أن يكون القرار بالموافقة أو الرفض.')::text;
  end if;

  -- Fix-forward application of EPIC_4_REVIEW.md H1's lesson (validate a
  -- "status requires companion field" invariant at the RPC layer too, not
  -- only the DB constraint, for a clean error instead of a raw
  -- constraint-violation): a rejection must carry a reason.
  if p_decision = 'rejected' and btrim(coalesce(p_rejection_reason, '')) = '' then
    raise exception 'rejectionReason is required when rejecting a request'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A rejection reason is required.', 'human_message_ar', 'سبب الرفض مطلوب.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_request_id::text, '') || '|' || coalesce(p_decision::text, '') || '|' || coalesce(p_rejection_reason, ''));
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

  update approvals.requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = case when p_decision = 'rejected' then btrim(p_rejection_reason) else null end
  where id = p_request_id and tenant_id = v_tenant_id and status = 'pending'
  returning * into v_request;

  if v_request.id is null then
    select exists(select 1 from approvals.requests where id = p_request_id and tenant_id = v_tenant_id) into v_exists;

    if not v_exists then
      raise exception 'Request not found for this tenant'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Request not found.', 'human_message_ar', 'لم يتم العثور على الطلب.')::text;
    else
      raise exception 'This request has already been reviewed'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This request has already been reviewed.', 'human_message_ar', 'تمت مراجعة هذا الطلب بالفعل.')::text;
    end if;
  end if;

  if p_decision = 'approved' then
    v_event_type := case v_request.type when 'event' then 'celebration' else v_request.type::text end::approvals.event_type;

    insert into approvals.events (tenant_id, source_request_id, type, title, description, classroom_id, event_date, event_time, place, price)
    values (v_tenant_id, v_request.id, v_event_type, v_request.title, v_request.note, v_request.classroom_id, v_request.request_date, v_request.request_time, v_request.place, v_request.price)
    returning * into v_event;

    -- §16: "Event published (new exam/celebration/trip) -> Classroom
    -- guardians -> push, in_app". Set-based fan-out (EPIC_4_REVIEW.md H4) —
    -- an event's audience (every guardian in a classroom, or the whole
    -- tenant when classroom_id is null) can be unbounded.
    --
    -- Fix for EPIC_5_REVIEW.md M2: previously joined identity.guardian_profiles
    -- only implicitly (via child_guardian_links.guardian_id) and never
    -- filtered out a soft-deleted/deactivated guardian account — this
    -- function's own manager-notification loop above already filters
    -- deleted_at is null; the guardian fan-out now does the same, matching
    -- the EPIC_4_REVIEW.md L2 "check deleted_at before notifying" lesson.
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select distinct v_tenant_id, 'guardian', cgl.guardian_id, 'event', v_event.title,
           left(coalesce(v_event.description, v_event.title), 500),
           'app://approvals/events/' || v_event.id::text, 'info'
    from academic.child_guardian_links cgl
    join academic.children c on c.id = cgl.child_id
    join identity.guardian_profiles g on g.id = cgl.guardian_id
    where c.tenant_id = v_tenant_id
      and c.deleted_at is null
      and g.deleted_at is null
      and (v_event.classroom_id is null or c.classroom_id = v_event.classroom_id);
  end if;

  -- §16: "Request approved/rejected -> Submitting teacher -> in_app, push",
  -- regardless of decision.
  perform comms.enqueue_notification(
    v_tenant_id, 'staff', v_request.submitted_by, 'approval',
    case p_decision when 'approved' then 'Request approved' else 'Request rejected' end,
    coalesce(v_request.rejection_reason, v_request.title),
    'app://approvals/requests/' || v_request.id::text
  );

  v_result := jsonb_build_object('request', to_jsonb(v_request), 'event', case when v_event.id is not null then to_jsonb(v_event) else null end);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'review_request', jsonb_build_object('_inputHash', v_input_hash, 'data', v_result));
  end if;

  return v_result;
end;
$$;

comment on function public.review_request is
  'Manager-only. Atomic UPDATE...WHERE (pending -> approved/rejected). On approval, transactionally promotes the request to approvals.events and set-based-fans-out an "event published" notification to the relevant guardians (EPIC_4_REVIEW.md H4). Always notifies the submitting teacher of the decision (§16). Idempotency-key + payload-hash envelope (§25.6). SECURITY DEFINER to reach comms.enqueue_notification.';

revoke all on function public.review_request from public;
grant execute on function public.review_request to authenticated;

-- ---------------------------------------------------------------------------
-- public.update_rsvp — guardian only, own child. Natural upsert on
-- (event_id, child_id) — no idempotency-key needed (§14.3's stated
-- exception: "everything except e.g. register_device_token, which is
-- already idempotent via its own unique constraint" — the same reasoning
-- applies here via event_rsvps_event_child_key, migration 2). Satisfies the
-- Test Scenario "Concurrent RSVP updates on the same registration
-- (double-tap) — must be idempotent, not duplicate" directly: a repeated
-- call with the same payload just re-applies the same values.
-- ---------------------------------------------------------------------------
create or replace function public.update_rsvp(
  p_event_id              uuid,
  p_child_id              uuid,
  p_attendee              approvals.rsvp_attendee,
  p_extra_guest_name      text default null,
  p_extra_guest_relation  text default null,
  p_contact_phone         text default null
)
returns approvals.event_rsvps
language plpgsql
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_row       approvals.event_rsvps;
begin
  if public.current_role() <> 'guardian' then
    raise exception 'Only a guardian can RSVP'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a guardian can RSVP.', 'human_message_ar', 'فقط ولي الأمر يمكنه تأكيد الحضور.')::text;
  end if;

  if p_child_id <> all (public.current_guardian_child_ids()) then
    raise exception 'This is not your child'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'This is not your child.', 'human_message_ar', 'هذا ليس طفلك.')::text;
  end if;

  insert into approvals.event_rsvps (event_id, child_id, tenant_id, attendee, extra_guest_name, extra_guest_relation, contact_phone, responded_at)
  values (p_event_id, p_child_id, v_tenant_id, p_attendee, p_extra_guest_name, p_extra_guest_relation, p_contact_phone, now())
  on conflict (event_id, child_id) do update
    set attendee = excluded.attendee,
        extra_guest_name = excluded.extra_guest_name,
        extra_guest_relation = excluded.extra_guest_relation,
        contact_phone = excluded.contact_phone,
        responded_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.update_rsvp is
  'Guardian-only, own child. Upsert on (event_id, child_id) — naturally idempotent under double-tap (§14.3), no idempotency-key parameter needed.';

revoke all on function public.update_rsvp from public;
grant execute on function public.update_rsvp to authenticated;

-- ---------------------------------------------------------------------------
-- public.cancel_trip_registration — guardian only, own child. Atomic
-- UPDATE...WHERE (open/registered -> cancelled), the same M1 pattern as
-- revoke_pickup_pass/unassign_bus_rider (Epic 3): a repeat call after
-- success finds no matching row and raises a clean, non-silent
-- STATE_ALREADY_PROCESSED rather than a race condition.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_trip_registration(p_registration_id uuid)
returns approvals.event_trip_registrations
language plpgsql
as $$
declare
  v_row     approvals.event_trip_registrations;
  v_exists  boolean;
begin
  if public.current_role() <> 'guardian' then
    raise exception 'Only a guardian can cancel a trip registration'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a guardian can cancel a trip registration.', 'human_message_ar', 'فقط ولي الأمر يمكنه إلغاء تسجيل الرحلة.')::text;
  end if;

  update approvals.event_trip_registrations
  set status = 'cancelled'
  where id = p_registration_id
    and child_id = any (public.current_guardian_child_ids())
    and status in ('open', 'registered')
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select exists(select 1 from approvals.event_trip_registrations where id = p_registration_id and child_id = any (public.current_guardian_child_ids())) into v_exists;

  if not v_exists then
    raise exception 'Trip registration not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Trip registration not found.', 'human_message_ar', 'لم يتم العثور على تسجيل الرحلة.')::text;
  else
    raise exception 'This trip registration cannot be cancelled (already cancelled, or already paid)'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This trip registration cannot be cancelled — it is already cancelled or already paid.', 'human_message_ar', 'لا يمكن إلغاء هذا التسجيل — تم إلغاؤه بالفعل أو تم دفعه بالفعل.')::text;
  end if;
end;
$$;

comment on function public.cancel_trip_registration is
  'Guardian-only, own child. Atomic UPDATE...WHERE (open/registered -> cancelled), same pattern as revoke_pickup_pass/unassign_bus_rider (Epic 3). A paid registration cannot be cancelled here — that flow is reserved for a future Epic 6 refund RPC.';

revoke all on function public.cancel_trip_registration from public;
grant execute on function public.cancel_trip_registration to authenticated;
