-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 2: announcements, announcement_recipients
-- Ref: BACKEND_ARCHITECTURE.md §3.46-3.47, §12, §12.1
-- ============================================================================

create type comms.announcement_audience as enum ('all', 'parents', 'classroom', 'teachers', 'drivers');
create type comms.platform_announcement_audience as enum ('all_schools', 'plan_tier', 'overdue_accounts', 'trial_accounts');
create type comms.announcement_priority as enum ('normal', 'important', 'urgent');
create type comms.announcement_channel as enum ('push', 'whatsapp', 'sms', 'email', 'in_app');
create type comms.announcement_recipient_type as enum ('guardian', 'staff', 'driver', 'tenant');

-- ---------------------------------------------------------------------------
-- comms.announcements  (§3.46) — tenant_id nullable: null = platform-wide
-- (Platform Admin broadcast, §12.1), set = a single tenant's own broadcast
-- (Manager). `audience`/`platform_audience` are mutually exclusive per the
-- architecture doc's own note — enforced here with a CHECK rather than left
-- implicit, since this is exactly the kind of "two nullable columns that
-- should never both be set" shape that benefits from a DB-level guarantee.
-- ---------------------------------------------------------------------------
create table comms.announcements (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid null references tenancy.tenants(id) on delete restrict,
  created_by          uuid not null,
  audience            comms.announcement_audience null,
  platform_audience    comms.platform_announcement_audience null,
  classroom_id        uuid null references academic.classrooms(id) on delete restrict,
  title               text not null check (btrim(title) <> ''),
  body                text not null check (btrim(body) <> ''),
  priority            comms.announcement_priority not null default 'normal',
  channels            comms.announcement_channel[] not null default array['in_app']::comms.announcement_channel[],
  scheduled_for       timestamptz null,
  sent_at             timestamptz null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint announcements_audience_xor_platform_audience check (
    (tenant_id is not null and audience is not null and platform_audience is null)
    or (tenant_id is null and platform_audience is not null and audience is null)
  ),
  constraint announcements_classroom_requires_classroom_audience check (
    classroom_id is null or audience = 'classroom'
  ),
  -- Fix for EPIC_4_REVIEW.md H1: the constraint above only enforced the
  -- converse direction (classroom_id set => audience must be 'classroom').
  -- Nothing required classroom_id to actually BE set when audience =
  -- 'classroom' — broadcast_announcement's fan-out join
  -- (`ch.classroom_id = p_classroom_id`) never matches any row when
  -- p_classroom_id is null, so a caller omitting it got an announcement
  -- row with sent_at set (implying success) and zero delivered recipients,
  -- with no error anywhere. This is the missing direction, closing the gap
  -- at the DB layer; migration 6's RPC and the Zod schema also now check
  -- this explicitly (defense in depth, matching this codebase's own
  -- established convention of checking a business rule at more than one
  -- layer).
  constraint announcements_classroom_audience_requires_classroom check (
    audience is distinct from 'classroom' or classroom_id is not null
  )
);

create index announcements_tenant_idx on comms.announcements (tenant_id);
create index announcements_platform_idx on comms.announcements (platform_audience) where tenant_id is null;
create index announcements_scheduled_idx on comms.announcements (scheduled_for) where sent_at is null and scheduled_for is not null;

create trigger trg_announcements_updated_at
  before update on comms.announcements
  for each row execute function public.set_updated_at();

comment on table comms.announcements is
  'Manager (own tenant, audience) or Platform Admin owner/admin tier (platform-wide, platform_audience) broadcast (§3.46, §12.1). created_by has no single-table FK (staff_profiles.id or platform_admins.id) — same precedent as identity.service_accounts.issued_by (Epic 1).';

-- ---------------------------------------------------------------------------
-- Tenant-consistency trigger: classroom_id (when set) must belong to the
-- announcement's own tenant; created_by (when the announcement is
-- tenant-scoped) must belong to that tenant too. A platform-wide
-- announcement's created_by is checked against identity.platform_admins
-- instead, inside broadcast_announcement (migration 6) — no single trigger
-- can express "must be staff OR platform_admin depending on tenant_id" as
-- cleanly as the RPC's own branching logic, so the DB-level backstop here
-- covers the classroom/tenant relationship, the RPC covers actor identity.
-- ---------------------------------------------------------------------------
create or replace function comms.check_announcement_consistency()
returns trigger
language plpgsql
as $$
declare
  v_classroom_tenant_id uuid;
begin
  if new.classroom_id is not null then
    select tenant_id into v_classroom_tenant_id from academic.classrooms where id = new.classroom_id and deleted_at is null;
    if v_classroom_tenant_id is null or v_classroom_tenant_id <> new.tenant_id then
      raise exception 'classroom_id does not belong to the same tenant as this announcement'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This classroom does not belong to your tenant.', 'human_message_ar', 'هذا الفصل لا ينتمي إلى مؤسستك.')::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_announcements_consistency
  before insert or update of classroom_id, tenant_id on comms.announcements
  for each row execute function comms.check_announcement_consistency();

-- ---------------------------------------------------------------------------
-- comms.announcement_recipients  (§3.47) — fan-out table, populated by
-- broadcast_announcement (migration 6). recipient_id has no single-table FK
-- (guardian/staff/driver/tenant, polymorphic) — same precedent as
-- identity.service_accounts.issued_by.
-- ---------------------------------------------------------------------------
create table comms.announcement_recipients (
  announcement_id  uuid not null references comms.announcements(id) on delete cascade,
  recipient_type   comms.announcement_recipient_type not null,
  recipient_id     uuid not null,
  delivered_at     timestamptz null,
  read_at          timestamptz null,
  primary key (announcement_id, recipient_type, recipient_id)
);

create index announcement_recipients_recipient_idx on comms.announcement_recipients (recipient_type, recipient_id);

comment on table comms.announcement_recipients is
  'Fan-out table, populated by broadcast_announcement (§3.47). No tenant_id column — recipient rows for a tenant-wide announcement are already scoped via announcement_id -> announcements.tenant_id, and a platform-wide announcement''s recipients legitimately span every tenant, so a single tenant_id column would be either redundant or wrong depending on the parent row.';
