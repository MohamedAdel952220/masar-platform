-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 2: requests, events, event_rsvps, event_trip_registrations
-- Ref: BACKEND_ARCHITECTURE.md §3.21-3.24, §4, §5, §6
-- ============================================================================

-- ---------------------------------------------------------------------------
-- approvals.requests  (§3.21) — teacher-submitted, manager-reviewed.
-- attachment_object_id is a bare nullable uuid with no FK yet, matching the
-- established Epic 1/2/3 precedent (identity.staff_profiles.photo_object_id,
-- safety.pickup_passes.id_photo_object_id): "FK to media.storage_objects,
-- added when that schema exists (Epic 7)".
-- ---------------------------------------------------------------------------
create table approvals.requests (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenancy.tenants(id) on delete restrict,
  submitted_by          uuid not null references identity.staff_profiles(id) on delete restrict,
  type                  approvals.request_type not null,
  exam_kind             approvals.exam_kind null,
  title                 text not null check (btrim(title) <> ''),
  classroom_id          uuid null references academic.classrooms(id) on delete restrict,
  subject_id            uuid null references academic.subjects(id) on delete restrict,
  request_date          date not null,
  request_time          time null,
  note                  text null,
  place                 text null,
  price                 numeric(10,2) null check (price is null or price >= 0),
  attachment_object_id  uuid null, -- FK to media.storage_objects, added when that schema exists (Epic 7)
  status                approvals.request_status not null default 'pending',
  reviewed_by           uuid null references identity.staff_profiles(id) on delete restrict,
  reviewed_at           timestamptz null,
  rejection_reason      text null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Fix-forward application of EPIC_4_REVIEW.md H1's lesson ("type requires
  -- companion field" enforced as a DB constraint from day one): exam_kind
  -- only makes sense for an exam-type request; place/price only make sense
  -- for a trip-type request (§3.21's own field annotations: "place text
  -- nullable (trips), price numeric nullable (trips)").
  constraint requests_exam_kind_requires_exam check (exam_kind is null or type = 'exam'),
  constraint requests_trip_fields_require_trip check (type = 'trip' or (place is null and price is null)),
  -- A reviewed request must carry who/when reviewed it; a rejected request
  -- must carry a reason (Test Scenario: "Reject with reason -> verify
  -- teacher sees the reason, not a generic denial").
  constraint requests_review_fields_consistency check (status = 'pending' or (reviewed_by is not null and reviewed_at is not null)),
  constraint requests_rejection_requires_reason check (status <> 'rejected' or rejection_reason is not null)
);

create index requests_tenant_idx on approvals.requests (tenant_id);
create index requests_pending_idx on approvals.requests (tenant_id) where status = 'pending';
create index requests_submitted_by_idx on approvals.requests (submitted_by);

create trigger trg_requests_updated_at
  before update on approvals.requests
  for each row execute function public.set_updated_at();

comment on table approvals.requests is
  'Teacher-submitted request (event/trip/exam), reviewed by a manager (§14.2 submit_request/review_request, migration 5). On approval, review_request promotes this row to an approvals.events row (source_request_id).';

-- Tenant-consistency trigger (EPIC_2_REVIEW.md H2 lesson, applied from the
-- first migration): classroom_id/subject_id/submitted_by/reviewed_by, when
-- set, must all belong to this row's own tenant.
create or replace function approvals.check_request_consistency()
returns trigger
language plpgsql
as $$
declare
  v_classroom_tenant_id uuid;
  v_subject_tenant_id   uuid;
  v_submitter_tenant_id uuid;
  v_reviewer_tenant_id  uuid;
begin
  if new.classroom_id is not null then
    select tenant_id into v_classroom_tenant_id from academic.classrooms where id = new.classroom_id and deleted_at is null;
    if v_classroom_tenant_id is null or v_classroom_tenant_id <> new.tenant_id then
      raise exception 'classroom_id does not belong to the same tenant as this request'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This classroom does not belong to your tenant.', 'human_message_ar', 'هذا الفصل لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  if new.subject_id is not null then
    select tenant_id into v_subject_tenant_id from academic.subjects where id = new.subject_id;
    if v_subject_tenant_id is null or v_subject_tenant_id <> new.tenant_id then
      raise exception 'subject_id does not belong to the same tenant as this request'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This subject does not belong to your tenant.', 'human_message_ar', 'هذه المادة لا تنتمي إلى مؤسستك.')::text;
    end if;
  end if;

  select tenant_id into v_submitter_tenant_id from identity.staff_profiles where id = new.submitted_by;
  if v_submitter_tenant_id is null or v_submitter_tenant_id <> new.tenant_id then
    raise exception 'submitted_by does not belong to the same tenant as this request'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The submitting staff member does not belong to your tenant.', 'human_message_ar', 'الموظف المُقدِّم لا ينتمي إلى مؤسستك.')::text;
  end if;

  if new.reviewed_by is not null then
    select tenant_id into v_reviewer_tenant_id from identity.staff_profiles where id = new.reviewed_by;
    if v_reviewer_tenant_id is null or v_reviewer_tenant_id <> new.tenant_id then
      raise exception 'reviewed_by does not belong to the same tenant as this request'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The reviewing staff member does not belong to your tenant.', 'human_message_ar', 'الموظف المراجِع لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_requests_consistency
  before insert or update on approvals.requests
  for each row execute function approvals.check_request_consistency();

-- ---------------------------------------------------------------------------
-- approvals.events  (§3.22) — published, guardian-visible calendar entries.
-- source_request_id is nullable: a manager may publish an event directly
-- (§12: "Events | ... | CRUD" for manager) without a prior teacher request.
-- ---------------------------------------------------------------------------
create table approvals.events (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  source_request_id  uuid null references approvals.requests(id) on delete set null,
  type               approvals.event_type not null,
  title              text not null check (btrim(title) <> ''),
  description        text null,
  classroom_id       uuid null references academic.classrooms(id) on delete restrict,
  event_date         date not null,
  event_time         time null,
  place              text null,
  price              numeric(10,2) null check (price is null or price >= 0),
  capacity           int null check (capacity is null or capacity > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index events_tenant_idx on approvals.events (tenant_id);
create index events_classroom_idx on approvals.events (tenant_id, classroom_id);
create index events_date_idx on approvals.events (tenant_id, event_date);

create trigger trg_events_updated_at
  before update on approvals.events
  for each row execute function public.set_updated_at();

comment on table approvals.events is
  'Published exam/celebration/trip. classroom_id null = whole-tenant event (visible to every guardian in the tenant, §13.1). capacity null = unlimited (only trip-type registrations are capacity-enforced, migration 3''s trigger).';

create or replace function approvals.check_event_consistency()
returns trigger
language plpgsql
as $$
declare
  v_classroom_tenant_id uuid;
  v_request_tenant_id   uuid;
begin
  if new.classroom_id is not null then
    select tenant_id into v_classroom_tenant_id from academic.classrooms where id = new.classroom_id and deleted_at is null;
    if v_classroom_tenant_id is null or v_classroom_tenant_id <> new.tenant_id then
      raise exception 'classroom_id does not belong to the same tenant as this event'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This classroom does not belong to your tenant.', 'human_message_ar', 'هذا الفصل لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  if new.source_request_id is not null then
    select tenant_id into v_request_tenant_id from approvals.requests where id = new.source_request_id;
    if v_request_tenant_id is null or v_request_tenant_id <> new.tenant_id then
      raise exception 'source_request_id does not belong to the same tenant as this event'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This request does not belong to your tenant.', 'human_message_ar', 'هذا الطلب لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_events_consistency
  before insert or update on approvals.events
  for each row execute function approvals.check_event_consistency();

-- ---------------------------------------------------------------------------
-- approvals.event_rsvps  (§3.23) — guardian headcount confirmation for a
-- celebration/exam-type event. No capacity concern (RSVP is a headcount
-- signal, not a competed-for slot — unlike trip registrations below), so no
-- locking trigger is needed beyond ordinary tenant/child consistency.
-- Unique (event_id, child_id): one RSVP per child per event — the same row
-- update_rsvp (migration 5) upserts into, making a guardian's double-tap
-- naturally idempotent (Test Scenario: "must be idempotent, not duplicate").
-- ---------------------------------------------------------------------------
create table approvals.event_rsvps (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references approvals.events(id) on delete cascade,
  child_id              uuid not null references academic.children(id) on delete restrict,
  tenant_id             uuid not null references tenancy.tenants(id) on delete restrict,
  attendee              approvals.rsvp_attendee not null,
  extra_guest_name      text null,
  extra_guest_relation  text null,
  contact_phone         text null check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  responded_at          timestamptz not null default now()
);

create unique index event_rsvps_event_child_key on approvals.event_rsvps (event_id, child_id);
create index event_rsvps_tenant_idx on approvals.event_rsvps (tenant_id);
create index event_rsvps_child_idx on approvals.event_rsvps (child_id);

create or replace function approvals.check_event_rsvp_consistency()
returns trigger
language plpgsql
as $$
declare
  v_event_tenant_id uuid;
  v_child_tenant_id uuid;
begin
  select tenant_id into v_event_tenant_id from approvals.events where id = new.event_id;
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;

  if v_event_tenant_id is null then
    raise exception 'Event not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Event not found.', 'human_message_ar', 'لم يتم العثور على الفعالية.')::text;
  end if;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_event_tenant_id <> new.tenant_id or v_child_tenant_id <> new.tenant_id then
    raise exception 'event_id/child_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This event and child do not both belong to your tenant.', 'human_message_ar', 'هذه الفعالية والطفل لا ينتميان لنفس المؤسسة.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_event_rsvps_consistency
  before insert or update on approvals.event_rsvps
  for each row execute function approvals.check_event_rsvp_consistency();

-- ---------------------------------------------------------------------------
-- approvals.event_trip_registrations  (§3.24) — guardian trip registration,
-- capacity-constrained and payment-gated. payment_transaction_id is a bare
-- nullable uuid with no FK yet, matching the established precedent: "FK to
-- billing.payment_transactions, added when that schema exists (Epic 6)".
--
-- Unique (event_id, child_id): one registration per child per trip event.
-- status='paid' <=> payment_transaction_id is not null is enforced by a
-- trigger (migration 3, not a plain CHECK) per BACKEND_ARCHITECTURE.md §5's
-- explicit instruction ("enforced via trigger (§3.24)") — a trigger also
-- lets the violation raise this codebase's standard bilingual
-- VALIDATION_FAILED shape instead of a raw constraint-violation error.
-- ---------------------------------------------------------------------------
create table approvals.event_trip_registrations (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references approvals.events(id) on delete cascade,
  child_id                uuid not null references academic.children(id) on delete restrict,
  tenant_id               uuid not null references tenancy.tenants(id) on delete restrict,
  status                  approvals.trip_registration_status not null default 'open',
  payment_transaction_id  uuid null, -- FK to billing.payment_transactions, added when that schema exists (Epic 6)
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index event_trip_registrations_event_child_key on approvals.event_trip_registrations (event_id, child_id);
create index event_trip_registrations_tenant_idx on approvals.event_trip_registrations (tenant_id);
create index event_trip_registrations_child_idx on approvals.event_trip_registrations (child_id);
-- Capacity-count hot path (migration 3's trigger runs this same shape of
-- query on every insert/update): only non-cancelled registrations count
-- against capacity.
create index event_trip_registrations_active_idx on approvals.event_trip_registrations (event_id) where status in ('open', 'registered', 'paid');

create trigger trg_event_trip_registrations_updated_at
  before update on approvals.event_trip_registrations
  for each row execute function public.set_updated_at();

comment on table approvals.event_trip_registrations is
  'Guardian trip registration. status=paid requires payment_transaction_id (trigger-enforced below, per §3.24/§5) — Epic 6 (billing) is the only future writer of that transition; v1 client access (migration 4 RLS) can only reach open->cancelled.';

-- ---------------------------------------------------------------------------
-- Combined consistency + capacity + payment-status trigger, mirroring
-- transport.check_bus_rider_consistency (Epic 3) in shape, but NOT in
-- security context — see EPIC_5_REVIEW.md C1.
--
-- Fix for EPIC_5_REVIEW.md C1: trip-registration creation has no wrapping
-- RPC (it goes through a direct guardian INSERT under RLS, migration 4),
-- unlike transport.bus_riders' capacity-checked inserts, which are
-- exclusively manager-initiated and therefore always run under a
-- tenant-wide-visible SELECT policy. This trigger's own capacity-count
-- query previously ran under the CALLING GUARDIAN's own row-level security
-- context (event_trip_registrations_select_guardian is scoped to
-- child_id = any(current_guardian_child_ids())) — meaning two different
-- guardians registering for the same trip could never see each other's row
-- when counting, silently undercounting and bypassing capacity entirely.
-- Marking this function SECURITY DEFINER (with the hardened empty
-- search_path, matching every other SECURITY DEFINER function in this
-- codebase) makes its internal queries see every registration for the
-- event regardless of which guardian's write triggered it, restoring the
-- same correctness guarantee transport.check_bus_rider_consistency actually
-- has.
--
-- Side effect of that fix, found and closed while implementing it: this
-- trigger's initial `select ... from approvals.events where id = new.event_id`
-- was previously ALSO an implicit authorization backstop — under the
-- guardian's own (non-elevated) context, an event outside the guardian's
-- own classroom-visibility (events_select_guardian, migration 4) would
-- simply not be found, correctly blocking registration for an event the
-- guardian can't even see. Making this trigger SECURITY DEFINER removes
-- that implicit backstop (the trigger's own SELECT no longer goes through
-- RLS at all). The same authorization rule is now stated EXPLICITLY instead
-- of relying on it as an accidental side effect: migration 4's
-- event_trip_registrations_insert_guardian WITH CHECK gains its own
-- classroom-visibility check. This is the correct layering going forward —
-- RLS is the sole authority for "who may do this," this trigger is the sole
-- authority for "is this internally consistent / at capacity."
-- ---------------------------------------------------------------------------
create or replace function approvals.check_trip_registration_consistency()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_event_tenant_id  uuid;
  v_event_type       approvals.event_type;
  v_capacity         int;
  v_child_tenant_id  uuid;
  v_current_count    int;
begin
  select tenant_id, type, capacity into v_event_tenant_id, v_event_type, v_capacity
  from approvals.events
  where id = new.event_id
  for update;

  if v_event_tenant_id is null then
    raise exception 'Event not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Event not found.', 'human_message_ar', 'لم يتم العثور على الفعالية.')::text;
  end if;

  if v_event_type <> 'trip' then
    raise exception 'This event is not a trip'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Trip registrations can only be created for a trip-type event.', 'human_message_ar', 'لا يمكن التسجيل إلا في فعالية من نوع رحلة.')::text;
  end if;

  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;

  if v_child_tenant_id is null then
    raise exception 'Child not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if v_event_tenant_id <> new.tenant_id or v_child_tenant_id <> new.tenant_id then
    raise exception 'event_id/child_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This event and child do not both belong to your tenant.', 'human_message_ar', 'هذه الفعالية والطفل لا ينتميان لنفس المؤسسة.')::text;
  end if;

  -- §3.24/§5: status='paid' <=> payment_transaction_id is not null, both
  -- directions, so the enum and the FK can never drift apart.
  if new.status = 'paid' and new.payment_transaction_id is null then
    raise exception 'A paid registration must have a payment_transaction_id'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'A paid registration must be linked to a payment transaction.', 'human_message_ar', 'يجب ربط التسجيل المدفوع بمعاملة دفع.')::text;
  end if;

  if new.status <> 'paid' and new.payment_transaction_id is not null then
    raise exception 'Only a paid registration may carry a payment_transaction_id'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Only a paid registration may be linked to a payment transaction.', 'human_message_ar', 'لا يمكن ربط معاملة دفع إلا بتسجيل مدفوع.')::text;
  end if;

  -- Capacity check: only on insert of a non-cancelled row, or an update
  -- that (re)activates a previously-cancelled row — mirrors
  -- transport.check_bus_rider_consistency's exact "only count on activating
  -- transitions" shape.
  if v_capacity is not null
     and new.status in ('open', 'registered', 'paid')
     and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from new.status)) then
    select count(*) into v_current_count
    from approvals.event_trip_registrations
    where event_id = new.event_id and status in ('open', 'registered', 'paid') and id <> new.id;

    if v_current_count >= v_capacity then
      raise exception 'This trip is at full capacity'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This trip is at full capacity.', 'human_message_ar', 'هذه الرحلة ممتلئة بالكامل.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_event_trip_registrations_consistency
  before insert or update on approvals.event_trip_registrations
  for each row execute function approvals.check_trip_registration_consistency();

comment on function approvals.check_trip_registration_consistency() is
  'Tenant consistency + events.type=trip cross-table check (§5) + capacity lock (§14.3) + status/payment_transaction_id invariant (§3.24), all in one BEFORE trigger. SECURITY DEFINER (EPIC_5_REVIEW.md C1 fix) so its own capacity-count query sees every registration for the event regardless of which guardian''s write triggered it — the corresponding classroom-visibility authorization check moved to an explicit RLS WITH CHECK clause (migration 4) since SECURITY DEFINER no longer provides it as a side effect.';
