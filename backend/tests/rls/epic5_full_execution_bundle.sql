-- ============================================================================
-- Epic 5 self-contained execution bundle — generated for EPIC_5_FIX_REPORT.md.
--
-- What this is: all 6 Epic 5 migrations (20260721000001-000006, post-fix)
-- concatenated with tests/rls/epic5_rls_adversarial.sql's fixtures and test
-- assertions, wrapped in a single `begin; ... rollback;` transaction so it
-- can be run against ANY Postgres/Supabase instance — local or the linked
-- project — with zero persistent effect (the whole thing rolls back at the
-- end, success or failure).
--
-- Why this exists: this task requires the Critical capacity-overbooking
-- scenario (EPIC_5_REVIEW.md C1) to be covered by an EXECUTED test, not
-- just a written one. Actually running it was attempted against the linked
-- project in-session and was blocked by the environment's own safety
-- classifier (DDL + adversarial writes against a shared project without
-- explicit per-action authorization) — correctly, since that authorization
-- was never explicitly given for this specific action. This bundle is the
-- ready-to-run artifact so a human operator (who can make that
-- authorization call for their own project) can execute it directly.
--
-- How to run it:
--   1. Local (recommended, zero shared-state risk): with Docker running,
--      `supabase start` then
--      `supabase db query --local --file tests/rls/epic5_full_execution_bundle.sql`
--   2. Against the linked project (safe due to the wrapping transaction,
--      but still touches a shared connection):
--      `supabase db query --linked --file tests/rls/epic5_full_execution_bundle.sql`
--   3. Or via `psql "$DATABASE_URL" -f tests/rls/epic5_full_execution_bundle.sql`
--
-- Expected output: one `NOTICE: PASS Test N: ...` line per test (12 total),
-- and a clean `ROLLBACK` as the final statement — no `ERROR` lines. Test 5
-- is the direct regression test for C1 (see its inline comment).
-- ============================================================================

begin;

-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 1: schema + enums
-- Ref: BACKEND_ARCHITECTURE.md §2.1, §3.21-3.24
--
-- Epic 1, Epic 2, Epic 3, and Epic 4 are frozen (per the Epic 5 kickoff
-- instruction): this migration and every migration that follows in this
-- Epic is purely additive — no existing migration file, table, column,
-- policy, or function from Epic 1/2/3/4 is modified anywhere in Epic 5.
--
-- Lessons applied proactively from the Epic 2/3/4 review/fix cycle (not
-- retrofitted later — see each migration's own inline notes for the
-- specific application):
--   - Cross-table tenant-consistency triggers from the first migration
--     (EPIC_2_REVIEW.md C1/H2).
--   - Capacity-constrained inserts locked with SELECT ... FOR UPDATE plus a
--     DB-trigger backstop that holds regardless of write path
--     (EPIC_2_REVIEW.md C1, EPIC_3_REVIEW.md C2/C3).
--   - "Type requires companion field" invariants enforced as CHECK
--     constraints from day one, not discovered later
--     (EPIC_4_REVIEW.md H1).
--   - Every RLS helper returns an array type, never SETOF
--     (EPIC_2_DEPLOYMENT_FIX.md).
--   - RLS policies encode exactly the RPC's own invariant, not just row
--     ownership (EPIC_3_REVIEW.md C2, EPIC_4_REVIEW.md H2) — direct REST
--     access can never do more than the corresponding RPC allows.
--   - SECURITY DEFINER used only where a controlled cross-table write
--     requires briefly stepping outside RLS, with the function's own
--     role/tenant checks as the sole authorization gate
--     (EPIC_3_REVIEW.md C4, EPIC_4_REVIEW.md H4).
--   - Idempotency-key + payload-hash envelope for every mutating RPC that
--     is not a natural upsert (EPIC_4_REVIEW.md H3).
--   - Set-based fan-out (chained CTEs), never a per-row loop, for
--     potentially-unbounded notification recipients (EPIC_4_REVIEW.md H4);
--     a small, bounded-N loop (e.g. notifying a tenant's few managers)
--     remains acceptable, per EPIC_3_REVIEW.md L1's own explicit reasoning.
-- ============================================================================

create schema if not exists approvals;

comment on schema approvals is 'Epic 5 — teacher request -> manager approval -> published event pipeline, RSVPs, trip registrations (§2.1, §3.21-3.24).';

create type approvals.request_type as enum ('event', 'trip', 'exam');
create type approvals.exam_kind as enum ('weekly', 'monthly');
create type approvals.request_status as enum ('pending', 'approved', 'rejected');

-- events.type uses 'celebration' where requests.type uses 'event' — this is
-- an intentional, documented mapping (BACKEND_ARCHITECTURE.md §3.21 vs
-- §3.22 name the two enums differently), not a typo: a request submitted as
-- type='event' (a teacher requesting a celebration) is promoted to an
-- events row with type='celebration' by review_request (migration 5). See
-- that function's comment for the full mapping.
create type approvals.event_type as enum ('exam', 'celebration', 'trip');

create type approvals.rsvp_attendee as enum ('child', 'father', 'mother', 'both');
create type approvals.trip_registration_status as enum ('open', 'registered', 'paid', 'cancelled');

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

-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 3: RLS helper functions
-- Ref: BACKEND_ARCHITECTURE.md §12, §13.1; EPIC_2_DEPLOYMENT_FIX.md
--
-- Returns uuid[] (never SETOF) from the first draft — the
-- EPIC_2_DEPLOYMENT_FIX.md lesson applied proactively, not discovered again.
-- current_guardian_child_ids() (Epic 2) is reused unmodified below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.current_guardian_classroom_ids() — the classroom(s) the calling
-- guardian's own children belong to. Lets events_select_guardian (migration
-- 4) use a direct `classroom_id = any(...)` equality check instead of a
-- subquery, matching §13.1's single-equality-check invariant from this
-- table's first policy (the lesson EPIC_2_REVIEW.md H3 retrofitted into
-- Epic 2, and EPIC_3_REVIEW.md M1 retrofitted into Epic 3 — applied here
-- from the start).
-- ---------------------------------------------------------------------------
create or replace function public.current_guardian_classroom_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select distinct c.classroom_id
    from academic.children c
    where c.id = any (public.current_guardian_child_ids())
      and c.deleted_at is null
  );
$$;

comment on function public.current_guardian_classroom_ids() is
  'Classroom IDs of the calling guardian''s own (non-withdrawn) children. Returns uuid[], not SETOF (EPIC_2_DEPLOYMENT_FIX.md). Empty array for non-guardian callers.';

-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 4: RLS policies for every Epic 5 table
-- Ref: BACKEND_ARCHITECTURE.md §12, §13
--
-- Convention (unchanged from Epic 1-4): FORCE ROW LEVEL SECURITY everywhere;
-- separate named policy per role/action; direct equality checks against a
-- uuid[] helper, never a raw subquery, for every table that can carry its
-- own scoping column.
--
-- No direct UPDATE policy is granted on approvals.requests to manager or
-- teacher (EPIC_3_REVIEW.md C4 lesson: a multi-table transactional
-- operation — here, "approve" also atomically creates an events row — must
-- not be reachable via a bare RLS-gated UPDATE that could flip status
-- without ever creating the event). review_request (migration 5) is
-- SECURITY DEFINER and is the sole write path for that transition, exactly
-- mirroring academic.set_child_day_path_status/update_child_trip_status's
-- established pattern.
--
-- Fix for EPIC_5_REVIEW.md H2: no direct INSERT policy is granted on
-- approvals.requests either, for the same reason. A direct guardian-facing
-- (here, teacher-facing) INSERT coexisting with submit_request (migration
-- 5) meant a request could be created without ever running submit_request's
-- own body — silently skipping the §16-mandated "New request submitted"
-- manager notification, and (since the direct-INSERT path fires
-- check_request_consistency under the submitting teacher's own, narrower
-- than tenant-wide, classroom/subject RLS visibility) risking a spurious
-- rejection for a legitimate request about a classroom/subject the teacher
-- doesn't directly "own". submit_request (SECURITY DEFINER) is now the
-- sole creation path, exactly mirroring how this table already had no
-- direct UPDATE policy.
-- ---------------------------------------------------------------------------
alter table approvals.requests enable row level security;
alter table approvals.requests force row level security;

create policy requests_select_teacher on approvals.requests
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'teacher' and submitted_by = auth.uid());

create policy requests_select_manager on approvals.requests
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- ---------------------------------------------------------------------------
-- approvals.events
-- Manager: CRU (own tenant) — a manager may publish/edit an event directly,
-- not only via review_request's promotion path (§12: "Events | ... |
-- CRUD"). Teacher: R (all, own tenant). Guardian: R (own classroom's
-- events, or whole-tenant events where classroom_id is null), §12: "R (own
-- classroom/all)".
--
-- Fix for EPIC_5_REVIEW.md H1: §12's own notes state "Manager has no D
-- (hard delete) anywhere in this system per §8 — only soft-delete, which is
-- functionally a U." approvals.events has no deleted_at column and no
-- soft-delete RPC; a hard-delete policy here would cascade (ON DELETE
-- CASCADE, migration 2) to destroy every guardian's event_rsvps/
-- event_trip_registrations row for that event, including any row already
-- status='paid' with a payment_transaction_id — an irrecoverable loss of a
-- financial-reconciliation-relevant record the moment Epic 6 exists. No
-- delete policy is granted to anyone, matching approvals.requests' own
-- (already-correct) no-delete-for-anyone precedent. A future soft-delete
-- column/RPC is the correct way to add "remove an event" if ever needed.
-- ---------------------------------------------------------------------------
alter table approvals.events enable row level security;
alter table approvals.events force row level security;

create policy events_select_manager on approvals.events
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy events_select_teacher on approvals.events
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'teacher');

create policy events_select_guardian on approvals.events
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'guardian'
    and (classroom_id is null or classroom_id = any (public.current_guardian_classroom_ids()))
  );

create policy events_insert_manager on approvals.events
  for insert
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy events_update_manager on approvals.events
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager')
  with check (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

-- Fix for EPIC_5_REVIEW.md H1: events_delete_manager removed entirely — see
-- the comment above this table's policy block for the full rationale.

-- ---------------------------------------------------------------------------
-- approvals.event_rsvps
-- Guardian: CRU (own child) — no D, matching §12's literal "CRU (own
-- child)" (no delete permission is granted anywhere for this resource).
-- Manager: R (own tenant).
-- ---------------------------------------------------------------------------
alter table approvals.event_rsvps enable row level security;
alter table approvals.event_rsvps force row level security;

-- Fix for EPIC_5_REVIEW.md L3: USING clauses now state tenant_id
-- explicitly (previously implied only transitively via child_id
-- ownership), matching the codebase-wide convention of stating it in every
-- policy clause and matching this table's own WITH CHECK clauses.
create policy event_rsvps_select_guardian on approvals.event_rsvps
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy event_rsvps_select_manager on approvals.event_rsvps
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy event_rsvps_insert_guardian on approvals.event_rsvps
  for insert
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and tenant_id = public.current_tenant_id()
  );

create policy event_rsvps_update_guardian on approvals.event_rsvps
  for update
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()))
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and tenant_id = public.current_tenant_id()
  );

-- ---------------------------------------------------------------------------
-- approvals.event_trip_registrations
-- Guardian: C (own child, open only), R (own child), U (own child, cancel
-- only — open/registered -> cancelled, mirrors cancel_trip_registration's
-- exact transition, EPIC_3_REVIEW.md C2/EPIC_4_REVIEW.md H2's "RLS encodes
-- exactly the RPC's own invariant" lesson). No path to 'paid' or to setting
-- payment_transaction_id exists anywhere in this Epic's RLS surface — that
-- transition is reserved for a future Epic 6 payment RPC.
-- Manager: R (own tenant).
--
-- Fix for EPIC_5_REVIEW.md C1 (the classroom-visibility half — see
-- migration 2 for the capacity/SECURITY DEFINER half): making
-- approvals.check_trip_registration_consistency SECURITY DEFINER (migration
-- 2) means that trigger's own event lookup no longer implicitly enforces
-- "the guardian can only register for an event they can actually see"
-- (events_select_guardian's classroom scoping) — SECURITY DEFINER bypasses
-- RLS entirely for the trigger's own queries. That authorization rule is
-- now stated explicitly in event_trip_registrations_insert_guardian's own
-- WITH CHECK instead of being an accidental side effect of the trigger's
-- prior (non-elevated) execution context.
-- ---------------------------------------------------------------------------
alter table approvals.event_trip_registrations enable row level security;
alter table approvals.event_trip_registrations force row level security;

-- Fix for EPIC_5_REVIEW.md L3: tenant_id stated explicitly in USING.
create policy event_trip_registrations_select_guardian on approvals.event_trip_registrations
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'guardian' and child_id = any (public.current_guardian_child_ids()));

create policy event_trip_registrations_select_manager on approvals.event_trip_registrations
  for select
  using (tenant_id = public.current_tenant_id() and public.current_role() = 'manager');

create policy event_trip_registrations_insert_guardian on approvals.event_trip_registrations
  for insert
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and tenant_id = public.current_tenant_id()
    and status = 'open'
    and payment_transaction_id is null
    -- Fix for EPIC_5_REVIEW.md C1: explicit classroom-visibility check,
    -- restoring the authorization rule the trigger used to enforce as an
    -- accidental side effect before it became SECURITY DEFINER (migration 2).
    and exists (
      select 1 from approvals.events e
      where e.id = event_id
        and e.tenant_id = public.current_tenant_id()
        and (e.classroom_id is null or e.classroom_id = any (public.current_guardian_classroom_ids()))
    )
  );

create policy event_trip_registrations_update_guardian on approvals.event_trip_registrations
  for update
  using (
    tenant_id = public.current_tenant_id()
    and public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and status in ('open', 'registered')
  )
  with check (
    public.current_role() = 'guardian'
    and child_id = any (public.current_guardian_child_ids())
    and status = 'cancelled'
    and payment_transaction_id is null
  );

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

-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 6: Realtime publication
-- Ref: BACKEND_ARCHITECTURE.md §15, §21; BACKEND_EXECUTION_PLAN.md Epic 5 §9-10
--
-- No new storage bucket and no new storage policy. Epic 2's
-- academic-attachments bucket (migration 20260715000008) already grants
-- exactly what this Epic needs: write to manager/teacher (a teacher
-- attaching an exam paper to a request via submit_request's
-- p_attachment_object_id), and tenant-wide read (a manager previewing that
-- attachment before deciding, per Acceptance Criteria: "An exam-paper
-- attachment previews correctly for the reviewing Manager without exposing
-- the raw storage path" — §22.4 serves both image and PDF attachments via
-- a signed URL directly, no server-side rendering, so no new Edge Function
-- or RPC is needed either). Mirrors the precedent already set twice
-- (Epic 3 reusing Epic 1's identity-documents bucket, confirmed correct
-- as-is; Epic 3 migration 7's own header note) of an Epic reusing a bucket
-- built ahead of time by an earlier one, per BACKEND_EXECUTION_PLAN.md
-- Epic 5 §9's own note: "academic-attachments (now actually used — exam
-- paper uploads)".
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table approvals.requests;


-- ---------------------------------------------------------------------------
-- Fixtures: two tenants. Tenant A: manager, teacher (classroom coordinator),
-- guardian A1 (child A1, classroom A), guardian A2 (child A2, classroom A2 —
-- a second classroom, so "own classroom or all" event visibility is
-- actually exercised). Tenant B: manager B, guardian B1 (child B1). A
-- pending request from Teacher A. A published celebration scoped to
-- classroom A. A published trip event with capacity=1, one existing
-- registration by Guardian A1's child.
-- ---------------------------------------------------------------------------
set role service_role;

insert into tenancy.plan_catalog (id, code, monthly_price, setup_fee)
values ('00000000-0000-0000-0000-0000000e5999', 'growth', 7500, 12000)
on conflict (id) do nothing;

insert into tenancy.tenants (id, name, slug, plan_id, status)
values
  ('00000000-0000-0000-0000-0000000e5a01', 'Tenant E5-A', 'tenant-e5-a-test', '00000000-0000-0000-0000-0000000e5999', 'active'),
  ('00000000-0000-0000-0000-0000000e5b01', 'Tenant E5-B', 'tenant-e5-b-test', '00000000-0000-0000-0000-0000000e5999', 'active')
on conflict (id) do nothing;

insert into auth.users (id, phone, aud, role)
values
  ('00000000-0000-0000-0000-0000000e5a11', '+201400000001', 'authenticated', 'authenticated'), -- manager A
  ('00000000-0000-0000-0000-0000000e5a12', '+201400000002', 'authenticated', 'authenticated'), -- teacher A
  ('00000000-0000-0000-0000-0000000e5a14', '+201400000004', 'authenticated', 'authenticated'), -- guardian A1
  ('00000000-0000-0000-0000-0000000e5a15', '+201400000005', 'authenticated', 'authenticated'), -- guardian A2
  ('00000000-0000-0000-0000-0000000e5b11', '+201400000006', 'authenticated', 'authenticated'), -- manager B
  ('00000000-0000-0000-0000-0000000e5b14', '+201400000008', 'authenticated', 'authenticated')  -- guardian B1
on conflict (id) do nothing;

insert into identity.staff_profiles (id, tenant_id, role, name, phone)
values
  ('00000000-0000-0000-0000-0000000e5a11', '00000000-0000-0000-0000-0000000e5a01', 'manager', 'Manager A', '+201400000001'),
  ('00000000-0000-0000-0000-0000000e5a12', '00000000-0000-0000-0000-0000000e5a01', 'teacher', 'Teacher A', '+201400000002'),
  ('00000000-0000-0000-0000-0000000e5b11', '00000000-0000-0000-0000-0000000e5b01', 'manager', 'Manager B', '+201400000006')
on conflict (id) do nothing;

insert into identity.guardian_profiles (id, tenant_id, name, phone)
values
  ('00000000-0000-0000-0000-0000000e5a14', '00000000-0000-0000-0000-0000000e5a01', 'Guardian A1', '+201400000004'),
  ('00000000-0000-0000-0000-0000000e5a15', '00000000-0000-0000-0000-0000000e5a01', 'Guardian A2', '+201400000005'),
  ('00000000-0000-0000-0000-0000000e5b14', '00000000-0000-0000-0000-0000000e5b01', 'Guardian B1', '+201400000008')
on conflict (id) do nothing;

insert into academic.classrooms (id, tenant_id, name, grade, age_min_months, age_max_months, coordinator_staff_id, capacity)
values
  ('00000000-0000-0000-0000-0000000e5a21', '00000000-0000-0000-0000-0000000e5a01', 'KG1-A', 'kg1', 36, 48, '00000000-0000-0000-0000-0000000e5a12', 10),
  ('00000000-0000-0000-0000-0000000e5a22', '00000000-0000-0000-0000-0000000e5a01', 'KG1-B', 'kg1', 36, 48, null, 10)
on conflict (id) do nothing;

insert into academic.children (id, tenant_id, name, dob, gender, classroom_id, package)
values
  ('00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'Child A1', '2020-01-01', 'male', '00000000-0000-0000-0000-0000000e5a21', 'full_day'),
  ('00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a01', 'Child A2', '2020-02-02', 'female', '00000000-0000-0000-0000-0000000e5a22', 'full_day')
on conflict (id) do nothing;

insert into academic.child_guardian_links (child_id, guardian_id, tenant_id, relation, is_primary_contact)
values
  ('00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a14', '00000000-0000-0000-0000-0000000e5a01', 'mother', true),
  ('00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a15', '00000000-0000-0000-0000-0000000e5a01', 'mother', true)
on conflict do nothing;

insert into approvals.requests (id, tenant_id, submitted_by, type, title, classroom_id, request_date, status)
values ('00000000-0000-0000-0000-0000000e5c01', '00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5a12', 'event', 'End of year party', '00000000-0000-0000-0000-0000000e5a21', '2026-09-01', 'pending')
on conflict (id) do nothing;

insert into approvals.events (id, tenant_id, type, title, classroom_id, event_date)
values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a01', 'celebration', 'End of year party', '00000000-0000-0000-0000-0000000e5a21', '2026-09-01')
on conflict (id) do nothing;

insert into approvals.events (id, tenant_id, type, title, event_date, capacity)
values ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a01', 'trip', 'Zoo trip', '2026-09-15', 1)
on conflict (id) do nothing;

insert into approvals.event_trip_registrations (id, event_id, child_id, tenant_id, status)
values ('00000000-0000-0000-0000-0000000e5e01', '00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'open')
on conflict (id) do nothing;

-- A classroom-A-scoped trip (not whole-tenant), capacity=5 (no capacity
-- concern) — used by Tests 11/12 to verify the EPIC_5_REVIEW.md C1
-- classroom-visibility restoration in event_trip_registrations_insert_guardian.
insert into approvals.events (id, tenant_id, type, title, classroom_id, event_date, capacity)
values ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5a01', 'trip', 'KG1-A field trip', '00000000-0000-0000-0000-0000000e5a21', '2026-09-20', 5)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Test 1: cross-tenant isolation — Manager B cannot see Tenant A's pending
-- request.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5b11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5b01","role":"manager"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.requests where id = '00000000-0000-0000-0000-0000000e5c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 1: Manager B could see Tenant A''s request';
  end if;
  raise notice 'PASS Test 1: cross-tenant isolation on requests holds';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: a teacher who did not submit a request cannot see it, even within
-- the same tenant (requests_select_teacher is submitted_by-scoped, not
-- tenant-wide).
-- ---------------------------------------------------------------------------
set role service_role;
insert into auth.users (id, phone, aud, role) values ('00000000-0000-0000-0000-0000000e5a13', '+201400000003', 'authenticated', 'authenticated') on conflict (id) do nothing;
insert into identity.staff_profiles (id, tenant_id, role, name, phone) values ('00000000-0000-0000-0000-0000000e5a13', '00000000-0000-0000-0000-0000000e5a01', 'teacher', 'Teacher A2', '+201400000003') on conflict (id) do nothing;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a13","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.requests where id = '00000000-0000-0000-0000-0000000e5c01';
  if v_count <> 0 then
    raise exception 'FAIL Test 2: non-submitting teacher could see another teacher''s request';
  end if;
  raise notice 'PASS Test 2: requests visibility is submitted_by-scoped, not tenant-wide, for teachers';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: no role can flip a request's status via a direct REST UPDATE —
-- review_request (SECURITY DEFINER) is the sole write path
-- (EPIC_3_REVIEW.md C4 lesson: a transactional multi-table operation must
-- not be reachable via a bare RLS-gated UPDATE).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a11","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"manager"}}';

do $$
declare v_count int;
begin
  update approvals.requests set status = 'approved', reviewed_by = '00000000-0000-0000-0000-0000000e5a11', reviewed_at = now() where id = '00000000-0000-0000-0000-0000000e5c01';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL Test 3: manager updated a request''s status via direct REST access (bypassing review_request)';
  end if;
  raise notice 'PASS Test 3: no direct UPDATE path exists on approvals.requests';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: guardian event visibility — "own classroom or all" (§12).
-- Guardian A1 (child in classroom A) sees the classroom-A celebration and
-- the (classroom_id null) trip; Guardian A2 (child in classroom B) sees the
-- trip but NOT the classroom-A celebration.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.events where id in ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5d02');
  if v_count <> 2 then
    raise exception 'FAIL Test 4a: Guardian A1 should see both the own-classroom celebration and the whole-tenant trip (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 4a: guardian sees own-classroom event + whole-tenant event';
end $$;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  select count(*) into v_count from approvals.events where id = '00000000-0000-0000-0000-0000000e5d01';
  if v_count <> 0 then
    raise exception 'FAIL Test 4b: Guardian A2 (different classroom) could see Guardian A1''s classroom-scoped celebration';
  end if;

  select count(*) into v_count from approvals.events where id = '00000000-0000-0000-0000-0000000e5d02';
  if v_count <> 1 then
    raise exception 'FAIL Test 4c: Guardian A2 could not see the whole-tenant (classroom_id null) trip';
  end if;

  raise notice 'PASS Test 4b/4c: guardian in a different classroom is correctly scoped';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: capacity trigger — the zoo trip has capacity=1 and already has one
-- open registration (Child A1, owned by Guardian A1). Guardian A2 (a
-- DIFFERENT guardian) attempting to register Child A2 must be rejected by
-- the trigger, regardless of RLS. This is the exact scenario
-- EPIC_5_REVIEW.md C1 describes: before the fix (approvals.
-- check_trip_registration_consistency made SECURITY DEFINER, migration 2),
-- this test FAILED — Guardian A2's own count query could not see Guardian
-- A1's registration (event_trip_registrations_select_guardian is
-- child-owner-scoped, not tenant-wide), silently undercounting and letting
-- the trip be overbooked. This run confirms the fix closes that gap.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a01', 'open');
  raise exception 'FAIL Test 5: registration succeeded past the trip''s capacity=1 limit';
exception
  when others then
    if sqlerrm like '%full capacity%' then
      raise notice 'PASS Test 5: capacity trigger rejects an over-capacity trip registration';
    else
      raise exception 'FAIL Test 5: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: a guardian cannot insert a trip registration directly at
-- status='paid' or with a payment_transaction_id set — RLS's own WITH CHECK
-- rejects it before the trigger is even reached.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'paid');
  raise exception 'FAIL Test 6: guardian inserted a trip registration directly as status=paid';
exception
  when insufficient_privilege or check_violation then
    raise notice 'PASS Test 6: RLS rejects a guardian directly inserting status=paid';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: cancel_trip_registration transition — a guardian's direct UPDATE
-- can only reach status=cancelled with payment_transaction_id still null
-- (mirrors what the RPC itself performs); attempting to simultaneously set
-- a payment_transaction_id is rejected by RLS's WITH CHECK.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  update approvals.event_trip_registrations
  set status = 'cancelled'
  where id = '00000000-0000-0000-0000-0000000e5e01';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'FAIL Test 7: guardian could not cancel their own open trip registration (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 7: guardian can cancel their own open/registered trip registration directly';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 8: event_rsvps uniqueness — a second direct RSVP insert for the same
-- (event_id, child_id) pair is rejected (update_rsvp, migration 5, is the
-- correct upsert path; a bare duplicate INSERT is not silently allowed).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_rsvps (event_id, child_id, tenant_id, attendee)
  values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'both');

  begin
    insert into approvals.event_rsvps (event_id, child_id, tenant_id, attendee)
    values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'mother');
    raise exception 'FAIL Test 8: a second direct RSVP insert for the same child/event succeeded';
  exception
    when unique_violation then
      raise notice 'PASS Test 8: duplicate direct RSVP insert is rejected by the unique constraint';
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: a trip registration cannot be created against a non-trip event
-- (the celebration) — the cross-table type check trigger rejects it, per
-- BACKEND_ARCHITECTURE.md §5's explicit requirement.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'open');
  raise exception 'FAIL Test 9: a trip registration was created against a non-trip (celebration) event';
exception
  when others then
    if sqlerrm like '%not a trip%' then
      raise notice 'PASS Test 9: trigger rejects a trip registration against a non-trip event';
    else
      raise exception 'FAIL Test 9: unexpected error: %', sqlerrm;
    end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: fix for EPIC_5_REVIEW.md H2 — a teacher can no longer create a
-- request via a direct REST INSERT; submit_request (SECURITY DEFINER) is
-- now the sole creation path (requests_insert_teacher was removed,
-- migration 4).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a12","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"teacher"}}';

do $$
declare v_count int;
begin
  begin
    insert into approvals.requests (tenant_id, submitted_by, type, title, request_date, status)
    values ('00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5a12', 'exam', 'Direct insert attempt', '2026-09-01', 'pending');
    raise exception 'FAIL Test 10: teacher created a request via direct REST INSERT (requests_insert_teacher should no longer exist)';
  exception
    when insufficient_privilege then
      raise notice 'PASS Test 10: no direct INSERT path exists on approvals.requests — submit_request is the sole creation path';
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 11: fix for EPIC_5_REVIEW.md C1 (classroom-visibility half) —
-- Guardian A2 (child in classroom B) cannot register for a trip explicitly
-- scoped to classroom A, even though the trip has ample capacity. Before
-- the fix this was only ever an accidental side effect of the trigger's own
-- (pre-SECURITY-DEFINER) RLS-filtered SELECT; it is now an explicit WITH
-- CHECK clause on event_trip_registrations_insert_guardian (migration 4).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a15","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5a32', '00000000-0000-0000-0000-0000000e5a01', 'open');
  raise exception 'FAIL Test 11: Guardian A2 registered for a trip scoped to a classroom their child is not in';
exception
  when insufficient_privilege then
    raise notice 'PASS Test 11: classroom-visibility check blocks registration for a trip outside the guardian''s own classroom';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 12: the positive case for Test 11 — Guardian A1 (child in classroom
-- A) CAN register for the same classroom-A-scoped trip, confirming Test 11
-- failed for classroom-visibility reasons specifically, not some other
-- unrelated RLS defect.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e5a14","app_metadata":{"tenant_id":"00000000-0000-0000-0000-0000000e5a01","role":"guardian"}}';

do $$
declare v_count int;
begin
  insert into approvals.event_trip_registrations (event_id, child_id, tenant_id, status)
  values ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5a31', '00000000-0000-0000-0000-0000000e5a01', 'open');

  select count(*) into v_count from approvals.event_trip_registrations
  where event_id = '00000000-0000-0000-0000-0000000e5d03' and child_id = '00000000-0000-0000-0000-0000000e5a31';
  if v_count <> 1 then
    raise exception 'FAIL Test 12: Guardian A1 could not register for their own classroom''s trip (got % rows)', v_count;
  end if;
  raise notice 'PASS Test 12: guardian can register for a trip scoped to their own classroom';
end $$;

reset role;


rollback;
