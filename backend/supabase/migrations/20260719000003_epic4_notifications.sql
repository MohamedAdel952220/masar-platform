-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 3: notifications, notification_deliveries, device_tokens,
--              notification_preferences
-- Ref: BACKEND_ARCHITECTURE.md §3.48-3.49.2, §4, §5, §6, §16
-- ============================================================================

create type comms.notification_recipient_type as enum ('guardian', 'staff', 'driver', 'platform_admin');
create type comms.notification_severity as enum ('info', 'attention', 'urgent');
create type comms.notification_channel as enum ('push', 'whatsapp', 'sms', 'email', 'in_app');
create type comms.notification_delivery_status as enum ('queued', 'sent', 'delivered', 'failed', 'skipped_by_preference');

-- ---------------------------------------------------------------------------
-- comms.notifications  (§3.48) — the in-app feed row. recipient_id has no
-- single-table FK across the four recipient_type profile tables (same
-- polymorphic precedent as identity.service_accounts.issued_by); tenant_id
-- is nullable only for platform_admin recipients (matching device_tokens'
-- identical nullability reasoning, §3.49.1).
-- ---------------------------------------------------------------------------
create table comms.notifications (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid null references tenancy.tenants(id) on delete restrict,
  recipient_type comms.notification_recipient_type not null,
  recipient_id   uuid not null,
  category       text not null check (btrim(category) <> ''),
  title          text not null check (btrim(title) <> ''),
  body           text not null check (btrim(body) <> ''),
  deep_link      text null,
  severity       comms.notification_severity not null default 'info',
  read_at        timestamptz null,
  created_at     timestamptz not null default now()
);

-- Fix-forward (EPIC_3_REVIEW.md M8 lesson applied proactively): the doc's
-- own §6 explicitly names this as "the hottest read path in every mobile
-- app's header" — indexed exactly as specified.
create index notifications_unread_idx on comms.notifications (recipient_id) where read_at is null;
create index notifications_recipient_feed_idx on comms.notifications (recipient_type, recipient_id, created_at desc);
create index notifications_tenant_idx on comms.notifications (tenant_id) where tenant_id is not null;

comment on table comms.notifications is
  'In-app notification feed row (§3.48, §16). tenant_id null only for platform_admin recipients. Never gated by notification_preferences (§16) — only the outbound channels in notification_deliveries are opt-out-able.';

-- ---------------------------------------------------------------------------
-- comms.notification_deliveries  (§3.49) — one row per (notification,
-- channel) delivery attempt, written by the notification-dispatch Edge
-- Function.
-- ---------------------------------------------------------------------------
create table comms.notification_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  notification_id     uuid not null references comms.notifications(id) on delete cascade,
  channel             comms.notification_channel not null,
  status              comms.notification_delivery_status not null default 'queued',
  provider_message_id text null,
  failed_reason       text null,
  sent_at             timestamptz null
);

create index notification_deliveries_notification_idx on comms.notification_deliveries (notification_id);
create index notification_deliveries_status_idx on comms.notification_deliveries (status) where status = 'queued';

comment on table comms.notification_deliveries is
  '§3.49 — skipped_by_preference is a terminal, non-error status distinguishing "we chose not to send this" from an actual delivery failure.';

-- ---------------------------------------------------------------------------
-- comms.device_tokens  (§3.49.1) — hard-deleted (not soft-deleted, §8), the
-- one deliberate exception to this codebase's blanket soft-delete
-- convention: "a device token has no historical value once dead." recipient_id
-- references auth.users(id) directly (not any specific profile table) so ON
-- DELETE CASCADE works uniformly across all four recipient types, each of
-- which is 1:1 with an auth.users row (§7 UUID Strategy) — matching §4's
-- documented "CASCADE — hard-deleted with no historical value" rule exactly.
-- ---------------------------------------------------------------------------
create type comms.device_platform as enum ('ios', 'android', 'web');

create table comms.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid null references tenancy.tenants(id) on delete restrict,
  recipient_type comms.notification_recipient_type not null,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  platform      comms.device_platform not null,
  token         text not null check (btrim(token) <> ''),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create unique index device_tokens_recipient_token_key on comms.device_tokens (recipient_type, recipient_id, token);
create index device_tokens_recipient_idx on comms.device_tokens (recipient_type, recipient_id);

comment on table comms.device_tokens is
  '§3.49.1 — hard-deleted with the owning auth.users row (ON DELETE CASCADE), and explicitly hard-deleted (not soft-deleted) on logout/stale-token cleanup (§8, §27) — the one deliberate exception to this codebase''s otherwise-universal soft-delete convention, since a device token has no historical/audit value once dead.';

-- ---------------------------------------------------------------------------
-- comms.notification_preferences  (§3.49.2) — same hard-delete-with-owner
-- reasoning and recipient_id shape as device_tokens.
-- ---------------------------------------------------------------------------
create table comms.notification_preferences (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid null references tenancy.tenants(id) on delete restrict,
  recipient_type comms.notification_recipient_type not null,
  recipient_id   uuid not null references auth.users(id) on delete cascade,
  category       text not null check (btrim(category) <> ''),
  channel        comms.notification_channel not null,
  enabled        boolean not null default true
);

create unique index notification_preferences_key on comms.notification_preferences (recipient_type, recipient_id, category, channel);
create index notification_preferences_recipient_idx on comms.notification_preferences (recipient_type, recipient_id);

comment on table comms.notification_preferences is
  '§3.49.2 — per-(category, channel) opt-out. in_app is never suppressed (§16); only push/whatsapp/sms/email are gated by this table, checked by notification-dispatch (migration 6/Edge Function) before writing a notification_deliveries row for a disabled pair.';
