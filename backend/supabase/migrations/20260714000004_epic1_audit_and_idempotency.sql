-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 4: platform.audit_log, jobs.idempotency_keys
-- Ref: BACKEND_ARCHITECTURE.md §3.51, §3.53.4, §23, §25.6, §35 Phase 0
-- "audit_log writes begin at Phase 0, not Phase 8" — the table is created now
-- even though its Platform Admin *viewing* UI is Epic 9.
-- ============================================================================

create type platform.audit_actor_type as enum ('platform_admin', 'staff', 'system');

create table platform.audit_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid null references tenancy.tenants(id) on delete restrict,  -- null = platform-scope action
  actor_type   platform.audit_actor_type not null,
  actor_id     uuid null,
  action       text not null,
  target_type  text not null,
  target_id    uuid null,
  ip_address   inet null,
  occurred_at  timestamptz not null default now()
);

create index audit_log_tenant_idx on platform.audit_log (tenant_id, occurred_at desc);
create index audit_log_actor_idx on platform.audit_log (actor_type, actor_id, occurred_at desc);

comment on table platform.audit_log is
  'Immutable, append-only security/compliance trail (§23). INSERT-only grants — see migration 20260714000006 RLS policies.';

-- idempotency_keys backs the general "every mutating RPC accepts an
-- idempotency key" convention (§2.2, §14.3, §25.6) — introduced in Epic 1
-- because provision-tenant / enroll-account flows need it from day one.
create table jobs.idempotency_keys (
  key                uuid primary key,
  tenant_id          uuid null references tenancy.tenants(id) on delete cascade,
  caller_id          uuid null,
  rpc_name           text not null,
  response_snapshot  jsonb not null,
  created_at         timestamptz not null default now()
);

create index idempotency_keys_created_idx on jobs.idempotency_keys (created_at);

comment on table jobs.idempotency_keys is
  'Replay ledger for idempotency-key-bearing RPCs. Purged by a scheduled job in Epic 10; 24h retention window is sufficient for realistic client retries (§25.6).';
