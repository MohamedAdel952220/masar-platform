-- ============================================================================
-- Epic 9 — Platform Operations & Admin Console
-- Migration 5: scheduled-job SQL functions
-- Ref: BACKEND_ARCHITECTURE.md §16, §27
--
-- Matches the "staged structurally, not registered" precedent established by
-- every prior Epic's own scheduled-job functions (media.sweep_camera_
-- heartbeats, Epic 7; reports.sweep_scheduled_report_drafts, Epic 8) —
-- pg_cron is not installed on the linked project (confirmed in
-- EPIC_7_DEPLOYMENT_AUDIT_FINAL.md §7 and unchanged since), so no actual
-- cron schedule entry is registered here; every function below is complete
-- and callable on-demand, service_role only.
--
-- Every function is set-based (no per-row loops) and wraps its own body in
-- an exception handler that records the run outcome to
-- jobs.scheduled_job_runs (via jobs.record_scheduled_job_run) before
-- re-raising, so a failed run is never silently lost (§27's own "failed-job
-- alert... this is what Platform Admin's system-health view partially
-- surfaces").
--
-- Fix-forward (EPIC_9_FIX_REPORT.md recurrence check — "race conditions" /
-- "double-processing" class, found proactively rather than named in
-- EPIC_9_REVIEW.md itself): each function now takes a session-scoped
-- advisory lock (pg_try_advisory_xact_lock, keyed on a hash of its own job
-- name) as its very first action and returns immediately, without recording
-- a run, if it can't acquire it — guarding against the same job function
-- being invoked twice concurrently (an overlapping cron fire, or a manual
-- on-demand call racing a scheduled one). This is the one class of
-- concurrency gap the WHERE-clause guards already used by run_tenant_
-- billing_check/run_trial_expiry_sweep and the NOT EXISTS guard already
-- used by run_attendance_non_marking_alert do not fully close on their own
-- (both are safe against a *second, later* run finding the same rows again,
-- but not against a *simultaneous* run interleaving before either commits).
-- No frozen table needed modification for this — pg_advisory_xact_lock is a
-- session/transaction-scoped primitive, not a schema object.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- jobs.record_scheduled_job_run — sole write path into
-- jobs.scheduled_job_runs (§3.53.2).
-- ---------------------------------------------------------------------------
create or replace function jobs.record_scheduled_job_run(
  p_job_name       text,
  p_started_at     timestamptz,
  p_status         jobs.scheduled_job_run_status,
  p_rows_affected  int default null,
  p_error          text default null
)
returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into jobs.scheduled_job_runs (job_name, started_at, finished_at, status, rows_affected, error)
  values (p_job_name, p_started_at, now(), p_status, p_rows_affected, p_error)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function jobs.record_scheduled_job_run is
  'Sole write path into jobs.scheduled_job_runs (§3.53.2, §27). Called by every scheduled-job function below at the end of its own run, success or failure.';

revoke all on function jobs.record_scheduled_job_run from public;
grant execute on function jobs.record_scheduled_job_run to service_role;

-- ---------------------------------------------------------------------------
-- platform.run_service_health_check — "Service health check | Every 1 min"
-- (§27). Epic 9 §7 explicitly names "no new Edge Functions" for this Epic,
-- so this stays a pure-SQL upsert rather than an HTTP-pinging Edge Function
-- — matching the same "stub the external boundary, document the extension
-- point" precedent already used for the LLM provider (Epic 8), payment
-- gateway (Epic 6), and media relay (Epic 7) stubs, since this sandboxed
-- delivery has no real deployed target for any of the 8 tracked services to
-- ping. Real reachability checks (via pg_net's net.http_get, already
-- installed since Epic 1) are a documented follow-up once each service's
-- actual health-check endpoint exists per environment — see
-- EPIC_9_COMPLETION_REPORT.md Known Limitations.
-- ---------------------------------------------------------------------------
create or replace function platform.run_service_health_check()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if not pg_try_advisory_xact_lock(hashtext('service_health_check')) then
    return 0;
  end if;

  insert into platform.service_health_status (service_code, status, uptime_pct, latency_ms, checked_at)
  values
    ('api_gateway',   'up', 100.00, 0, now()),
    ('parent_app',    'up', 100.00, 0, now()),
    ('teacher_app',   'up', 100.00, 0, now()),
    ('reception_qr',  'up', 100.00, 0, now()),
    ('driver_gps',    'up', 100.00, 0, now()),
    ('camera_relay',  'up', 100.00, 0, now()),
    ('notifications', 'up', 100.00, 0, now()),
    ('payments',      'up', 100.00, 0, now())
  on conflict (service_code) do update
    set status = excluded.status, uptime_pct = excluded.uptime_pct, latency_ms = excluded.latency_ms, checked_at = excluded.checked_at;

  get diagnostics v_count = row_count;
  perform jobs.record_scheduled_job_run('service_health_check', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('service_health_check', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function platform.run_service_health_check is
  '"Service health check" (§27). Stubbed reachability (all 8 tracked services always upserted as up) — see EPIC_9_COMPLETION_REPORT.md Known Limitations for the real-pinging extension point. Set-based single INSERT...ON CONFLICT, no per-service loop.';

revoke all on function platform.run_service_health_check from public;
grant execute on function platform.run_service_health_check to service_role;

-- ---------------------------------------------------------------------------
-- platform.run_tenant_billing_check — "Tenant billing check | Daily |
-- Recompute tenants.status (overdue/suspended) from
-- platform.tenant_billing_transactions; notify Platform Admin of
-- newly-overdue tenants" (§27). Overdue-detection rule (not otherwise
-- specified by §27 beyond this sentence): a tenant currently 'active' whose
-- most recent subscription_charge transaction has status='failed' is
-- flagged 'overdue'. Deliberately does NOT auto-transition to 'suspended' —
-- unlike the "stale manual-payment escalation" job's own named 48h SLA
-- (§27), no comparable threshold is specified for tenant-level suspension,
-- and suspending a tenant's entire service is a materially higher-stakes
-- action than flagging it overdue; that step remains a deliberate owner/
-- admin action via the existing, frozen tenants_update_platform_admin_
-- manager_tier RLS policy (Epic 1) rather than an automated one this job
-- would take on an unspecified timer.
-- ---------------------------------------------------------------------------
create or replace function platform.run_tenant_billing_check()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if not pg_try_advisory_xact_lock(hashtext('tenant_billing_check')) then
    return 0;
  end if;

  with latest_charge as (
    select distinct on (tenant_id) tenant_id, status
    from platform.tenant_billing_transactions
    where kind = 'subscription_charge'
    order by tenant_id, initiated_at desc
  ),
  newly_overdue as (
    update tenancy.tenants t
    set status = 'overdue'
    from latest_charge lc
    where t.id = lc.tenant_id
      and lc.status = 'failed'
      and t.status = 'active'
    returning t.id, t.name
  ),
  notified as (
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select null, 'platform_admin', pa.id, 'billing', 'Tenant overdue',
           no.name || ' is now overdue on billing.',
           'app://platform/schools/' || no.id::text, 'attention'
    from newly_overdue no
    cross join identity.platform_admins pa
    where pa.deleted_at is null
    returning 1
  )
  select count(*) into v_count from newly_overdue;

  perform jobs.record_scheduled_job_run('tenant_billing_check', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('tenant_billing_check', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function platform.run_tenant_billing_check is
  '"Tenant billing check" (§27). Flags a currently-active tenant overdue when its latest subscription_charge transaction failed; notifies every Platform Admin (set-based fan-out). Never auto-suspends — see this function''s own header comment.';

revoke all on function platform.run_tenant_billing_check from public;
grant execute on function platform.run_tenant_billing_check to service_role;

-- ---------------------------------------------------------------------------
-- platform.run_trial_expiry_sweep — "Trial expiry sweep | Daily | Flip
-- tenants.status from trial to overdue/prompt-to-upgrade at trial_ends_at,
-- notify Platform Admin" (§27).
-- ---------------------------------------------------------------------------
create or replace function platform.run_trial_expiry_sweep()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if not pg_try_advisory_xact_lock(hashtext('trial_expiry_sweep')) then
    return 0;
  end if;

  with expired as (
    update tenancy.tenants
    set status = 'overdue'
    where status = 'trial' and trial_ends_at is not null and trial_ends_at <= now()
    returning id, name
  ),
  notified as (
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select null, 'platform_admin', pa.id, 'billing', 'Trial expired',
           e.name || '''s trial period has ended.',
           'app://platform/schools/' || e.id::text, 'attention'
    from expired e
    cross join identity.platform_admins pa
    where pa.deleted_at is null
    returning 1
  )
  select count(*) into v_count from expired;

  perform jobs.record_scheduled_job_run('trial_expiry_sweep', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('trial_expiry_sweep', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function platform.run_trial_expiry_sweep is
  '"Trial expiry sweep" (§27). Flips trial -> overdue at trial_ends_at, set-based; notifies every Platform Admin.';

revoke all on function platform.run_trial_expiry_sweep from public;
grant execute on function platform.run_trial_expiry_sweep to service_role;

-- ---------------------------------------------------------------------------
-- platform.run_attendance_non_marking_alert — "Attendance non-marking alert
-- | Daily, mid-morning | Flag classrooms with no attendance marked yet,
-- notify Manager" (§27, cross-listed under Epic 9 §12's own "Scheduled Jobs
-- Involved"). Notification recipient is the tenant's own Manager, not
-- Platform Admin (§16's own routing) — Epic 9 owns *registering* this job
-- (it is one of the four named in its own execution-plan section), even
-- though its notification target differs from every other job in this
-- migration; see EPIC_9_COMPLETION_REPORT.md for this scope note restated.
-- Read-only against academic.classrooms/children/attendance_records (Epic
-- 2, frozen) — never writes to any of them.
--
-- Fix-forward (project-wide recurrence review — "double-processing"
-- defect class): unlike reports.sweep_scheduled_report_drafts (Epic 8),
-- whose own underlying rows transition state and so naturally stop
-- matching on a re-run, this job's own query has no state-owning row to
-- consume — a same-day re-run (manual re-invocation, or a hypothetical
-- double cron fire) would otherwise re-notify the same manager for the
-- same still-unmarked classroom every time. The NOT EXISTS guard below
-- makes the notification fan-out itself idempotent per (manager,
-- classroom, day), independent of how many times the function is called.
-- ---------------------------------------------------------------------------
create or replace function platform.run_attendance_non_marking_alert()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if not pg_try_advisory_xact_lock(hashtext('attendance_non_marking_alert')) then
    return 0;
  end if;

  with unmarked as (
    select distinct c.id as classroom_id, c.tenant_id, c.name
    from academic.classrooms c
    where c.deleted_at is null
      and exists (select 1 from academic.children ch where ch.classroom_id = c.id and ch.deleted_at is null)
      and not exists (select 1 from academic.attendance_records ar where ar.classroom_id = c.id and ar.date = current_date)
  ),
  notified as (
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select u.tenant_id, 'staff', sp.id, 'attendance', 'Attendance not marked',
           'Attendance has not been marked yet today for ' || u.name || '.',
           'app://attendance/' || u.classroom_id::text, 'attention'
    from unmarked u
    join identity.staff_profiles sp on sp.tenant_id = u.tenant_id and sp.role = 'manager' and sp.deleted_at is null
    where not exists (
      select 1 from comms.notifications n
      where n.recipient_id = sp.id
        and n.category = 'attendance'
        and n.deep_link = 'app://attendance/' || u.classroom_id::text
        and n.created_at::date = current_date
    )
    returning 1
  )
  select count(*) into v_count from unmarked;

  perform jobs.record_scheduled_job_run('attendance_non_marking_alert', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('attendance_non_marking_alert', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function platform.run_attendance_non_marking_alert is
  '"Attendance non-marking alert" (§27). Set-based: one CTE finds every classroom with live children and no attendance_records row for today, a second fans the notification out to every manager of the affected tenant. Read-only against Epic 2''s frozen tables.';

revoke all on function platform.run_attendance_non_marking_alert from public;
grant execute on function platform.run_attendance_non_marking_alert to service_role;
