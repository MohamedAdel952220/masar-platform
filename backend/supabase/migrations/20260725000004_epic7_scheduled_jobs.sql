-- ============================================================================
-- Epic 7 — Media & Camera Architecture
-- Migration 4: camera heartbeat sweep scheduled-job SQL function
-- Ref: BACKEND_ARCHITECTURE.md §17, §27, §16
--
-- Matches the "staged structurally, not registered" precedent established by
-- every prior Epic's own scheduled-job functions (EPIC_3_COMPLETION_REPORT.md's
-- GPS retention purge, EPIC_4_COMPLETION_REPORT.md's notification-dispatch
-- polling trigger, EPIC_6's four billing scheduled-job functions,
-- EPIC_6_COMPLETION_REPORT.md §11.6) — this function does not register an
-- actual pg_cron schedule entry itself: pg_cron is not installed in the
-- linked project (confirmed live in EPIC_4_DEPLOYMENT_AUDIT.md §1 through
-- EPIC_6_DEPLOYMENT_AUDIT_FINAL.md §2), so registering a schedule against an
-- extension that isn't installed would fail outright. The function itself is
-- fully correct and callable on-demand (by an operator, a test, or a future
-- pg_cron schedule/webhook) — only the actual schedule entry is out of scope,
-- consistent with every prior Epic's identical limitation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- media.sweep_camera_heartbeats — "Camera heartbeat sweep" (§27, §17: "a
-- scheduled job flips online=false for any camera whose last_heartbeat_at
-- exceeds a threshold (e.g., 3 missed intervals)"). Set-based (this task's
-- own "prefer set-based SQL over row-by-row operations" requirement, and the
-- EPIC_4_REVIEW.md H4 lesson already applied identically in every one of
-- Epic 6's own scheduled-job functions): one UPDATE...RETURNING flips every
-- stale camera in a single statement, one INSERT...SELECT fans the "camera
-- went offline" notification out to every affected tenant's managers in a
-- single statement — no per-camera loop.
--
-- Threshold: 3 minutes, matching §17's own "e.g., every 60s... 3 missed
-- intervals" example cadence.
--
-- Never touches admin_disabled (§3.33, §17, §27's own explicit callout) —
-- this function's UPDATE statement does not reference that column at all.
-- ---------------------------------------------------------------------------
create or replace function media.sweep_camera_heartbeats()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_count int;
begin
  with stale as (
    update media.cameras
    set online = false
    where online = true
      and deleted_at is null
      and (last_heartbeat_at is null or last_heartbeat_at < now() - interval '3 minutes')
    returning id, tenant_id, name
  ),
  notified as (
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select distinct s.tenant_id, 'staff', sp.id, 'system', 'Camera offline',
           s.name || ' has gone offline.',
           'app://cameras/' || s.id::text, 'attention'
    from stale s
    join identity.staff_profiles sp on sp.tenant_id = s.tenant_id and sp.role = 'manager' and sp.deleted_at is null
    returning 1
  )
  select count(*) into v_count from stale;

  return v_count;
end;
$$;

comment on function media.sweep_camera_heartbeats() is
  '"Camera heartbeat sweep" (§27). Set-based, cross-tenant. Flips online=false for any camera whose last_heartbeat_at exceeds 3 minutes; never touches admin_disabled. Fans "Camera offline" notifications out to every affected tenant''s managers (§16) in the same statement.';

revoke all on function media.sweep_camera_heartbeats from public;
grant execute on function media.sweep_camera_heartbeats to service_role;
