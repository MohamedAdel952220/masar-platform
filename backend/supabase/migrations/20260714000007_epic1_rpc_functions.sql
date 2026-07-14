-- ============================================================================
-- Epic 1 — Foundation & Platform Bootstrap
-- Migration 7: RPC functions backing provisioning, audit logging, idempotency
-- Ref: BACKEND_ARCHITECTURE.md §14.1, §14.3, §23, §25.6
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.write_audit_log — the ONLY way any row ever lands in
-- platform.audit_log (there is no direct INSERT policy for any role, §23).
-- SECURITY DEFINER so a manager-scoped caller can still write an
-- audit-worthy event about their own tenant without needing table-level
-- INSERT rights.
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_tenant_id   uuid,
  p_actor_type  platform.audit_actor_type,
  p_actor_id    uuid,
  p_action      text,
  p_target_type text,
  p_target_id   uuid default null,
  p_ip_address  inet default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into platform.audit_log (tenant_id, actor_type, actor_id, action, target_type, target_id, ip_address)
  values (p_tenant_id, p_actor_type, p_actor_id, p_action, p_target_type, p_target_id, p_ip_address)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.write_audit_log is
  'Sole write path into platform.audit_log — enforces the immutable/append-only rule at the API surface, not just via missing policies (§23).';

revoke all on function public.write_audit_log from public;
grant execute on function public.write_audit_log to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- public.advance_tenant_provisioning — resumable step tracker for
-- provision-tenant (§3.1.1). Idempotent by construction: re-calling with the
-- same or an earlier step is a no-op beyond updating last_error/updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.advance_tenant_provisioning(
  p_tenant_id uuid,
  p_step      tenancy.provisioning_step,
  p_error     text default null
)
returns tenancy.tenant_provisioning_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row tenancy.tenant_provisioning_state;
begin
  insert into tenancy.tenant_provisioning_state (tenant_id, step, last_error)
  values (p_tenant_id, p_step, p_error)
  on conflict (tenant_id)
  do update set step = excluded.step, last_error = excluded.last_error, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.advance_tenant_provisioning from public;
grant execute on function public.advance_tenant_provisioning to service_role;

-- ---------------------------------------------------------------------------
-- public.idempotency_replay — first call inside any idempotency-key-bearing
-- RPC/Edge Function (§2.2, §14.3, §25.6). Returns the prior response if the
-- key was already seen, else NULL (meaning: proceed and call idempotency_store).
-- ---------------------------------------------------------------------------
create or replace function public.idempotency_replay(p_key uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select response_snapshot from jobs.idempotency_keys where key = p_key;
$$;

revoke all on function public.idempotency_replay from public;
grant execute on function public.idempotency_replay to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- public.idempotency_store — records the response for a given idempotency
-- key once the underlying operation has actually executed.
-- ---------------------------------------------------------------------------
create or replace function public.idempotency_store(
  p_key       uuid,
  p_tenant_id uuid,
  p_caller_id uuid,
  p_rpc_name  text,
  p_response  jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into jobs.idempotency_keys (key, tenant_id, caller_id, rpc_name, response_snapshot)
  values (p_key, p_tenant_id, p_caller_id, p_rpc_name, p_response)
  on conflict (key) do nothing;
$$;

revoke all on function public.idempotency_store from public;
grant execute on function public.idempotency_store to authenticated, service_role;
