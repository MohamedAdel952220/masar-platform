-- ============================================================================
-- Epic 7 — Media & Camera Architecture
-- Migration 2: media.cameras, media.camera_connections,
--              media.camera_classroom_links, media.camera_service_account_links
-- Ref: BACKEND_ARCHITECTURE.md §3.33, §3.34, §17, §2.2, §6, §8, §9
--
-- Fix for EPIC_7_REVIEW.md C1: ip_address/stream_protocol were originally
-- direct columns on media.cameras. §17 states, twice, that these two
-- values must "never be sent to client apps" — but media.cameras is also
-- required (§15's own Realtime Event Matrix) to be added to the
-- supabase_realtime publication guardians subscribe to for live online/
-- offline status, and Supabase Realtime's postgres_changes broadcasts the
-- FULL row (every column, sourced from the WAL) to any subscriber whose
-- RLS SELECT policy permits the row — it has no column-level filtering.
-- Since cameras_select_guardian (migration 3) correctly and necessarily
-- grants guardians row-level access to their own linked classroom's
-- cameras, every heartbeat-driven UPDATE on that row was broadcasting the
-- camera's real IP/protocol to every subscribed guardian automatically,
-- as ordinary use of the live-status feature — not a crafted attack. This
-- migration closes that gap the only way Postgres logical replication
-- allows: the two sensitive columns now live on a SEPARATE table
-- (media.camera_connections) that is never added to any Realtime
-- publication and has no guardian-reachable RLS policy at all (manager-only,
-- migration 3). media.cameras itself keeps every other column, stays in
-- the Realtime publication (migration 5), and is now safe to broadcast in
-- full. Since Epic 7 has not been deployed, this correction is made
-- directly in this migration rather than as a forward-only patch.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- media.cameras  (§3.33, minus ip_address/stream_protocol — see this
-- migration's own header comment, fix for EPIC_7_REVIEW.md C1)
--
-- online / admin_disabled are deliberately two independent booleans, not one
-- shared status column — this is the resolved v0-draft conflict §3.33/§17
-- both describe explicitly: `online` is written ONLY by the heartbeat path
-- (camera-heartbeat Edge Function on receipt, the heartbeat-sweep scheduled
-- job on a missed-heartbeat timeout — migration 4); `admin_disabled` is
-- written ONLY by a manager's own RLS UPDATE (migration 3). Neither write
-- path ever touches the other's column, so a manager's deliberate disable
-- can never be silently reverted by the next heartbeat/sweep cycle, and a
-- heartbeat resuming on a still-admin_disabled camera correctly stays
-- non-viewable (viewable iff online = true AND admin_disabled = false).
-- ---------------------------------------------------------------------------
create table media.cameras (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenancy.tenants(id) on delete restrict,
  name              text not null check (btrim(name) <> ''),
  zone              media.camera_zone not null,
  resolution        media.camera_resolution not null,
  has_audio         boolean not null default false,
  online            boolean not null default false,
  admin_disabled    boolean not null default false,
  last_heartbeat_at timestamptz null,
  added_at          date not null default current_date,
  deleted_at        timestamptz null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- §2.2/§6: tenant_id indexed on every tenant-scoped table (RLS baseline).
create index cameras_tenant_idx on media.cameras (tenant_id) where deleted_at is null;

-- §6: "is this camera actually viewable right now" — the exact predicate
-- fix EPIC_7_REVIEW.md H1 now actually applies at the Edge Function layer
-- (camera-stream-token checks online AND admin_disabled before minting a
-- token).
create index cameras_viewable_idx on media.cameras (tenant_id) where online = true and admin_disabled = false and deleted_at is null;

-- Heartbeat-sweep scheduled job's own scan predicate (migration 4) — only
-- cameras currently online can ever need to be flipped offline.
create index cameras_online_heartbeat_idx on media.cameras (last_heartbeat_at) where online = true;

comment on table media.cameras is
  'Camera registry (§3.33), minus ip_address/stream_protocol which now live on media.camera_connections (fix for EPIC_7_REVIEW.md C1 — see this migration''s own header comment). online (heartbeat-derived) and admin_disabled (manager-set) are independent booleans. Video transport itself is out of this table''s scope (§17).';

create trigger trg_cameras_updated_at
  before update on media.cameras
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- media.camera_connections — fix for EPIC_7_REVIEW.md C1. Holds exactly the
-- two raw on-prem connection fields §17 states must "never be sent to
-- client apps": ip_address, stream_protocol. One row per camera
-- (camera_id is both PK and FK — a strict 1:1, not a 1:many). No RLS
-- policy on this table is ever granted to guardian (migration 3,
-- manager-only), and this table is never added to supabase_realtime
-- (migration 5 only publishes media.cameras) — so there is no query path,
-- crafted or automatic, by which a non-manager role can ever reach these
-- two columns.
-- ---------------------------------------------------------------------------
create table media.camera_connections (
  camera_id       uuid primary key references media.cameras(id) on delete cascade,
  tenant_id       uuid not null references tenancy.tenants(id) on delete restrict,
  ip_address      inet not null,
  stream_protocol text not null check (btrim(stream_protocol) <> ''),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index camera_connections_tenant_idx on media.camera_connections (tenant_id);

-- Fix for EPIC_7_REVIEW.md L5: a partial unique index catching the common
-- data-entry mistake of registering two cameras with the same IP within one
-- tenant. Scoped to (tenant_id, ip_address) rather than a bare ip_address
-- uniqueness, since two different tenants' on-prem networks legitimately
-- reuse the same private IP ranges (§17 — cameras are on-prem RTSP
-- sources, most plausibly on private 10.x/192.168.x networks).
create unique index camera_connections_tenant_ip_key on media.camera_connections (tenant_id, ip_address);

comment on table media.camera_connections is
  'Raw camera connection details (ip_address, stream_protocol) — split out of media.cameras by the fix for EPIC_7_REVIEW.md C1 so this data can never reach a guardian via RLS or Realtime. Manager-only access (migration 3). One row per camera (1:1, camera_id is both PK and FK).';

create trigger trg_camera_connections_updated_at
  before update on media.camera_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- media.check_camera_connection_consistency — mirrors the established
-- consistency-trigger shape: the referenced camera must exist and belong
-- to the stated tenant.
-- ---------------------------------------------------------------------------
create or replace function media.check_camera_connection_consistency()
returns trigger
language plpgsql
as $$
declare
  v_camera_tenant_id uuid;
begin
  select tenant_id into v_camera_tenant_id from media.cameras where id = new.camera_id;
  if v_camera_tenant_id is null then
    raise exception 'Camera not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Camera not found.', 'human_message_ar', 'لم يتم العثور على الكاميرا.')::text;
  end if;

  if v_camera_tenant_id <> new.tenant_id then
    raise exception 'camera_id does not belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This camera does not belong to your tenant.', 'human_message_ar', 'هذه الكاميرا لا تنتمي إلى مؤسستك.')::text;
  end if;

  return new;
end;
$$;

comment on function media.check_camera_connection_consistency() is
  'Validates camera_id/tenant_id agreement on INSERT/UPDATE of media.camera_connections — fix for EPIC_7_REVIEW.md C1.';

create trigger trg_camera_connections_consistency
  before insert or update on media.camera_connections
  for each row execute function media.check_camera_connection_consistency();

-- ---------------------------------------------------------------------------
-- media.camera_classroom_links  (§3.34)
-- Composite PK (camera_id, classroom_id) — a camera with zone='common' and
-- no link row at all models "shared/unlinked" (§3.34's own explicit note),
-- rather than a nullable classroom_id column on cameras itself.
-- ---------------------------------------------------------------------------
create table media.camera_classroom_links (
  camera_id    uuid not null references media.cameras(id) on delete cascade,
  classroom_id uuid not null references academic.classrooms(id) on delete cascade,
  tenant_id    uuid not null references tenancy.tenants(id) on delete restrict,
  created_at   timestamptz not null default now(),
  primary key (camera_id, classroom_id)
);

-- §2.2/§6: tenant_id indexed on every tenant-scoped table, including pure
-- link/join tables (zero exceptions, §13.1).
create index camera_classroom_links_tenant_idx on media.camera_classroom_links (tenant_id);

-- §6: "Parent 'my classroom's cameras'" — the exact lookup direction
-- current_guardian_classroom_ids() driven RLS/RPC reads use.
create index camera_classroom_links_classroom_idx on media.camera_classroom_links (classroom_id);

comment on table media.camera_classroom_links is
  'Camera <-> classroom linkage (§3.34). No row = shared/unlinked camera (zone=common case). Carries tenant_id per §2.2 even though derivable via either parent, so every RLS policy on this table remains a single equality check (§13.1, zero exceptions).';

-- ---------------------------------------------------------------------------
-- media.check_camera_classroom_link_consistency — mirrors the established
-- link-table consistency-trigger shape (billing.check_fee_item_applicability_
-- consistency, Epic 6 migration 2; academic's own child_guardian_links
-- trigger, Epic 2): both referenced rows must exist, belong to the SAME
-- stated tenant, and that tenant must match the link row's own tenant_id.
-- ---------------------------------------------------------------------------
create or replace function media.check_camera_classroom_link_consistency()
returns trigger
language plpgsql
as $$
declare
  v_camera_tenant_id    uuid;
  v_classroom_tenant_id uuid;
begin
  select tenant_id into v_camera_tenant_id from media.cameras where id = new.camera_id and deleted_at is null;
  if v_camera_tenant_id is null then
    raise exception 'Camera not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Camera not found.', 'human_message_ar', 'لم يتم العثور على الكاميرا.')::text;
  end if;

  select tenant_id into v_classroom_tenant_id from academic.classrooms where id = new.classroom_id and deleted_at is null;
  if v_classroom_tenant_id is null then
    raise exception 'Classroom not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Classroom not found.', 'human_message_ar', 'لم يتم العثور على الفصل.')::text;
  end if;

  if v_camera_tenant_id <> new.tenant_id or v_classroom_tenant_id <> new.tenant_id then
    raise exception 'camera_id/classroom_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This camera and classroom do not both belong to your tenant.', 'human_message_ar', 'الكاميرا والفصل لا ينتميان لنفس المؤسسة.')::text;
  end if;

  return new;
end;
$$;

comment on function media.check_camera_classroom_link_consistency() is
  'Validates camera_id/classroom_id/tenant_id agreement on INSERT/UPDATE — the link-table consistency-trigger pattern established in Epic 2/6.';

create trigger trg_camera_classroom_links_consistency
  before insert or update on media.camera_classroom_links
  for each row execute function media.check_camera_classroom_link_consistency();

-- ---------------------------------------------------------------------------
-- media.camera_service_account_links — fix for EPIC_7_REVIEW.md H2. Binds a
-- specific identity.service_accounts row (purpose=camera_agent) to the
-- specific camera(s) it is authorized to send heartbeats for. Before this
-- fix, camera-heartbeat's only check was "does this key's tenant_id match
-- the requested camera's tenant_id" — meaning any leaked/compromised key
-- could forge a heartbeat (and, pre-C1-fix, an IP-broadcasting Realtime
-- event) for ANY camera in its tenant, not just the physical device it was
-- actually issued for. issue-service-account-key now requires at least one
-- camera_id for any purpose=camera_agent key (migration 6 RPC boundary is
-- not needed here — the Edge Function performs both inserts sequentially,
-- matching this codebase's own established multi-step, non-transactional
-- convention for lower-criticality auxiliary rows, see EPIC_7_FIX_REPORT.md).
-- identity.service_accounts itself is frozen Epic 1 — this table only
-- references it by id, adding no column to that table.
-- ---------------------------------------------------------------------------
create table media.camera_service_account_links (
  camera_id          uuid not null references media.cameras(id) on delete cascade,
  service_account_id uuid not null references identity.service_accounts(id) on delete cascade,
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  created_at         timestamptz not null default now(),
  primary key (camera_id, service_account_id)
);

create index camera_service_account_links_tenant_idx on media.camera_service_account_links (tenant_id);

-- camera-heartbeat's own lookup direction: "which cameras is THIS service
-- account authorized to heartbeat for" (fix for EPIC_7_REVIEW.md H2).
create index camera_service_account_links_account_idx on media.camera_service_account_links (service_account_id);

comment on table media.camera_service_account_links is
  'Binds a camera_agent service account to the specific camera(s) it may send heartbeats for — fix for EPIC_7_REVIEW.md H2 (camera impersonation within a tenant). A service account with zero rows here can never successfully heartbeat any camera.';

-- ---------------------------------------------------------------------------
-- media.check_camera_service_account_link_consistency — same shape as the
-- classroom-link trigger: both referenced rows must exist, belong to the
-- SAME stated tenant, and the linked service_accounts row must actually be
-- purpose='camera_agent' (an integration_other key has no business being
-- bound to a camera at all).
-- ---------------------------------------------------------------------------
create or replace function media.check_camera_service_account_link_consistency()
returns trigger
language plpgsql
as $$
declare
  v_camera_tenant_id  uuid;
  v_account_tenant_id uuid;
  v_account_purpose   identity.service_account_purpose;
begin
  select tenant_id into v_camera_tenant_id from media.cameras where id = new.camera_id and deleted_at is null;
  if v_camera_tenant_id is null then
    raise exception 'Camera not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Camera not found.', 'human_message_ar', 'لم يتم العثور على الكاميرا.')::text;
  end if;

  select tenant_id, purpose into v_account_tenant_id, v_account_purpose from identity.service_accounts where id = new.service_account_id;
  if v_account_tenant_id is null then
    raise exception 'Service account not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Service account not found.', 'human_message_ar', 'لم يتم العثور على حساب الخدمة.')::text;
  end if;

  if v_camera_tenant_id <> new.tenant_id or v_account_tenant_id <> new.tenant_id then
    raise exception 'camera_id/service_account_id do not both belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This camera and service account do not both belong to your tenant.', 'human_message_ar', 'الكاميرا وحساب الخدمة لا ينتميان لنفس المؤسسة.')::text;
  end if;

  if v_account_purpose <> 'camera_agent' then
    raise exception 'Only a camera_agent service account may be linked to a camera'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Only a camera_agent service account may be linked to a camera.', 'human_message_ar', 'فقط حساب خدمة من نوع camera_agent يمكن ربطه بكاميرا.')::text;
  end if;

  return new;
end;
$$;

comment on function media.check_camera_service_account_link_consistency() is
  'Validates camera_id/service_account_id/tenant_id agreement and purpose=camera_agent on INSERT/UPDATE — fix for EPIC_7_REVIEW.md H2.';

create trigger trg_camera_service_account_links_consistency
  before insert or update on media.camera_service_account_links
  for each row execute function media.check_camera_service_account_link_consistency();
