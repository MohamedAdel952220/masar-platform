-- ============================================================================
-- Epic 3 — Transport & Safety
-- Migration 3: pickup_passes, pickup_scan_events
-- Ref: BACKEND_ARCHITECTURE.md §3.31, §3.32, §4, §5, §6, §13.4
-- ============================================================================

create type safety.pickup_person_relation as enum (
  'father', 'mother', 'uncle', 'aunt', 'grandfather', 'grandmother', 'sibling', 'driver', 'other'
);
create type safety.pickup_pass_status as enum ('active', 'expired', 'revoked');
create type safety.pickup_scan_result as enum ('valid', 'invalid_expired', 'invalid_unknown', 'invalid_revoked');

-- ---------------------------------------------------------------------------
-- safety.pickup_passes  (§3.31) — qr_token is a high-entropy opaque bearer
-- token (§13.4), never guessable/enumerable; created_by is the guardian who
-- generated the pass.
-- ---------------------------------------------------------------------------
create table safety.pickup_passes (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  child_id            uuid not null references academic.children(id) on delete cascade,
  created_by          uuid not null references identity.guardian_profiles(id) on delete restrict,
  person_name         text not null check (btrim(person_name) <> ''),
  relation            safety.pickup_person_relation not null,
  id_photo_object_id  uuid null,
  qr_token            text not null,
  status              safety.pickup_pass_status not null default 'active',
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index pickup_passes_qr_token_key on safety.pickup_passes (qr_token);
create index pickup_passes_tenant_idx on safety.pickup_passes (tenant_id);
create index pickup_passes_child_idx on safety.pickup_passes (child_id);

create trigger trg_pickup_passes_updated_at
  before update on safety.pickup_passes
  for each row execute function public.set_updated_at();

comment on table safety.pickup_passes is
  'Guardian-issued authorization for a named person to collect a child (§3.31). qr_token is looked up by exact match only (§13.4) — reception''s RLS SELECT is tenant-scoped, not token-scoped; browsing-prevention is a deliberate two-layer control (DB allows tenant-wide SELECT, the application only ever queries by exact token) documented in EPIC_3_COMPLETION_REPORT.md.';

create or replace function safety.check_pickup_pass_consistency()
returns trigger
language plpgsql
as $$
declare
  v_child_tenant_id     uuid;
  v_guardian_tenant_id  uuid;
begin
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;
  select tenant_id into v_guardian_tenant_id from identity.guardian_profiles where id = new.created_by;

  if v_child_tenant_id is null or v_guardian_tenant_id is null
     or v_child_tenant_id <> new.tenant_id or v_guardian_tenant_id <> new.tenant_id then
    raise exception 'child_id/created_by do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'VALIDATION_FAILED',
              'human_message_en', 'This child and guardian do not both belong to your tenant.',
              'human_message_ar', 'هذا الطفل وولي الأمر لا ينتميان لنفس المؤسسة.'
            )::text;
  end if;

  return new;
end;
$$;

create trigger trg_pickup_passes_consistency
  before insert or update of child_id, created_by, tenant_id on safety.pickup_passes
  for each row execute function safety.check_pickup_pass_consistency();

-- ---------------------------------------------------------------------------
-- safety.pickup_scan_events  (§3.32) — logged for every scan, including
-- invalid/unmatched ones (§3.32: "logged anyway for security review").
-- pickup_pass_id is nullable (an unmatched token has no pass to reference)
-- and ON DELETE SET NULL, so a pass can never be hard-deleted out from under
-- its own audit trail — though in practice passes are never hard-deleted.
-- ---------------------------------------------------------------------------
create table safety.pickup_scan_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenancy.tenants(id) on delete restrict,
  pickup_pass_id      uuid null references safety.pickup_passes(id) on delete set null,
  scanned_by          uuid not null references identity.staff_profiles(id) on delete restrict,
  result              safety.pickup_scan_result not null,
  handover_confirmed  boolean not null default false,
  scanned_at          timestamptz not null default now()
);

create index pickup_scan_events_tenant_idx on safety.pickup_scan_events (tenant_id, scanned_at desc);
create index pickup_scan_events_pass_idx on safety.pickup_scan_events (pickup_pass_id);

comment on table safety.pickup_scan_events is
  'One row per scan attempt at the gate, valid or not (§3.32). No updated_at — handover_confirmed is set exactly once by confirm_handover (migration 6) via an atomic UPDATE...WHERE, not editable afterward.';

create or replace function safety.check_pickup_scan_event_consistency()
returns trigger
language plpgsql
as $$
declare
  v_pass_tenant_id     uuid;
  v_scanner_tenant_id  uuid;
begin
  select tenant_id into v_scanner_tenant_id from identity.staff_profiles where id = new.scanned_by and deleted_at is null;

  if v_scanner_tenant_id is null or v_scanner_tenant_id <> new.tenant_id then
    raise exception 'scanned_by does not belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The scanning staff member does not belong to your tenant.', 'human_message_ar', 'الموظف الذي قام بالمسح لا ينتمي إلى مؤسستك.')::text;
  end if;

  if new.pickup_pass_id is not null then
    select tenant_id into v_pass_tenant_id from safety.pickup_passes where id = new.pickup_pass_id;
    if v_pass_tenant_id is null or v_pass_tenant_id <> new.tenant_id then
      raise exception 'pickup_pass_id does not belong to the stated tenant'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This pickup pass does not belong to your tenant.', 'human_message_ar', 'تصريح الاستلام هذا لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_pickup_scan_events_consistency
  before insert on safety.pickup_scan_events
  for each row execute function safety.check_pickup_scan_event_consistency();

-- ---------------------------------------------------------------------------
-- safety.pickup_scan_rate_limits — fix for EPIC_3_REVIEW.md C5:
-- BACKEND_ARCHITECTURE.md §27 explicitly names scan_pickup_pass as requiring
-- "per-caller rate limits... via a small Postgres table or Upstash-style
-- external store" — scan_pickup_pass is a bare RPC (matching
-- BACKEND_EXECUTION_PLAN.md §7/§8, which lists no Edge Function for it), so
-- this is that "small Postgres table," checked/updated inside the RPC body
-- itself (migration 6) rather than at an Edge Function layer that doesn't
-- exist for this function. One row per scanning staff member; a fixed
-- 60-second window, reset on the read that discovers it has elapsed.
-- ---------------------------------------------------------------------------
create table safety.pickup_scan_rate_limits (
  scanned_by          uuid primary key references identity.staff_profiles(id) on delete cascade,
  window_started_at   timestamptz not null default now(),
  attempt_count        int not null default 0
);

comment on table safety.pickup_scan_rate_limits is
  'Fix for EPIC_3_REVIEW.md C5 — per-reception-account sliding/fixed-window scan-attempt counter, enforced inside scan_pickup_pass (migration 6). Not itself exposed to any role via RLS (no policy is defined on it — service-role/function-internal use only, via the SECURITY DEFINER scan_pickup_pass).';

alter table safety.pickup_scan_rate_limits enable row level security;
alter table safety.pickup_scan_rate_limits force row level security;
-- Deliberately zero policies: this table has no legitimate direct caller —
-- absence of a policy is a hard deny under RLS (§13.3), which is correct
-- here since only scan_pickup_pass (SECURITY DEFINER, migration 6) ever
-- touches it.

-- ---------------------------------------------------------------------------
-- platform.notification_outbox — fix for EPIC_3_REVIEW.md H2:
-- BACKEND_EXECUTION_PLAN.md Epic 3 §11/§25 explicitly requires writing an
-- in-app notification row "from day one" for trip/handover events even
-- though push/WhatsApp *delivery* correctly stays stubbed until Epic 4
-- ("so nothing is silently lost once Epic 4 activates delivery"). The full
-- `comms.notifications`/`comms.notification_deliveries` schema
-- (BACKEND_ARCHITECTURE.md §3.48-49) is explicitly Epic 4's own module
-- (BACKEND_ARCHITECTURE.md line 1259) — building it now would mean
-- starting Epic 4's schema, which this delivery must not do. This table is
-- a deliberately minimal, additive, Epic-3-owned holding area in the
-- already-existing `platform` schema (Epic 1) that captures the same
-- information losslessly: when Epic 4 lands and creates the real `comms`
-- schema, a forward migration can drain this table into it with zero data
-- loss, satisfying the execution plan's "nothing is silently lost"
-- requirement without pre-building Epic 4's richer channel/preference
-- model here.
-- ---------------------------------------------------------------------------
create table platform.notification_outbox (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenancy.tenants(id) on delete restrict,
  recipient_type  text not null check (recipient_type in ('guardian', 'staff', 'driver')),
  recipient_id    uuid not null,
  category        text not null,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  dispatched_at   timestamptz null
);

create index notification_outbox_tenant_idx on platform.notification_outbox (tenant_id, created_at desc);
create index notification_outbox_undispatched_idx on platform.notification_outbox (created_at) where dispatched_at is null;

comment on table platform.notification_outbox is
  'Fix for EPIC_3_REVIEW.md H2 — minimal in-app-notification holding table, written by update_child_trip_status/confirm_handover (migration 6). Not the final comms.notifications design (Epic 4, BACKEND_ARCHITECTURE.md §3.48) — a lossless forward-compatible placeholder per BACKEND_EXECUTION_PLAN.md''s explicit "from day one" requirement, deliberately minimal so Epic 4 is not started here.';

alter table platform.notification_outbox enable row level security;
alter table platform.notification_outbox force row level security;
-- Deliberately zero policies (hard deny, §13.3) — written only via the
-- SECURITY DEFINER RPCs that already bypass RLS for their other writes
-- (update_child_trip_status, confirm_handover, migration 6); read only by
-- a future Epic 4 dispatch job running as service_role. No role has any
-- legitimate reason to query this table directly today.
