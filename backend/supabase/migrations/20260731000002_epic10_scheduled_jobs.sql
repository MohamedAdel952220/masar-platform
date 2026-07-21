-- ============================================================================
-- Epic 10 — Jobs, Performance & Production Hardening
-- Migration 2: remaining §27 scheduled-job SQL functions, the pg_cron
-- registration entrypoint, and the forward-additive widening of the
-- jobs.scheduled_job_runs job-name vocabulary.
--
-- Additive only. No frozen migration file is edited. Every function below is
-- NEW, set-based, SECURITY DEFINER + search_path pinned, advisory-locked
-- against concurrent duplicate invocation, and records its outcome to
-- jobs.scheduled_job_runs — the convention Epic 9 migration 5 established.
--
-- EPIC_10_REVIEW.md fix pass applied here:
--   * M2 — every retention interval parameter is validated (>= 1) before any
--     destructive work. A negative/zero argument previously INVERTED the
--     retention window (`now() - make_interval(days => -1)` = now() + 1 day),
--     which would have deleted the ENTIRE table. Now it raises.
--   * M4 — the two destructive jobs perform their §27-mandated archival
--     pre-step atomically, in the same transaction as the delete:
--       - activity_log_archival MOVES rows into analytics.activity_log_archive
--         (DELETE ... RETURNING -> INSERT) rather than merely pruning them.
--       - gps_ping_retention_purge GENERATES a compact per-trip route
--         snapshot into analytics.trip_route_snapshot for every trip that is
--         about to lose pings, BEFORE deleting them (§18/§27's
--         "after trip_route_snapshot generation" precondition).
--   * M5 — the failed-login sweep's notification dedup key is now
--     per-ANOMALY (the (actor, IP) pair is encoded in the deep_link) instead
--     of per-admin-per-window, so several distinct concurrent anomalies no
--     longer collapse into a single alert.
--   * M3 — jobs.register_scheduled_jobs() encodes the §27 cadence for every
--     Epic 10 job (including the two materialized-view refreshes) as a single
--     idempotent registration entrypoint, to be invoked once pg_cron is
--     enabled. This is what resolves the "MVs never refresh" gap.
--
-- FORWARD-ADDITIVE CHANGE TO AN EPIC-9-CREATED OBJECT (surfaced explicitly).
-- jobs.scheduled_job_runs.job_name's CHECK is dropped and re-added with a
-- strict SUPERSET of Epic 9's original four values. Epic 9's own L1 fix
-- prescribed exactly this: "every future Epic's own new scheduled job will
-- need to append here via its own additive migration (ALTER TABLE ...
-- DROP/ADD CONSTRAINT)". Non-breaking (all existing rows still satisfy it),
-- no RLS/grant/isolation impact, and the frozen file 20260729000002 is not
-- touched. Ratified in EPIC_10_FIX_REPORT.md (finding L3).
-- ============================================================================

alter table jobs.scheduled_job_runs
  drop constraint scheduled_job_runs_job_name_check;

alter table jobs.scheduled_job_runs
  add constraint scheduled_job_runs_job_name_check
  check (job_name in (
    -- Epic 9's original four (unchanged)
    'service_health_check',
    'tenant_billing_check',
    'trial_expiry_sweep',
    'attendance_non_marking_alert',
    -- Epic 10 migration 1's materialized-view refresh jobs
    'refresh_attendance_summary',
    'refresh_tenant_summaries',
    -- Epic 10 migration 2's remaining §27 jobs (below)
    'staff_rating_recomputation',
    'gps_ping_retention_purge',
    'idempotency_key_purge',
    'failed_login_anomaly_sweep',
    'activity_log_archival'
  ));

-- ---------------------------------------------------------------------------
-- identity.run_staff_rating_recomputation — "Staff rating recomputation |
-- Weekly | Recompute staff_profiles.rating from staff_feedback" (§27; §3.5
-- rating = numeric(2,1), "computed by scheduled job, not user-writable").
--
-- Rating formula (§27 names the inputs but not the arithmetic — documented
-- here as the authoritative rule). Per staff member each feedback row
-- contributes a severity weight (high=3, medium=2, low/null=1); commends add,
-- complaints subtract. With commend score c and complaint score p:
--   - no feedback (c+p = 0)  -> rating NULL ("not yet rated")
--   - otherwise ratio = (c - p)/(c + p) in [-1, 1], mapped linearly to
--     [0.0, 5.0]: rating = round((ratio + 1)/2 * 5, 1). All commends -> 5.0,
--     all complaints -> 0.0, balanced -> 2.5. Fits numeric(2,1).
-- Set-based single UPDATE; `is distinct from` skips no-op writes so the
-- updated_at trigger does not fire on unchanged rows. Non-deleted staff only.
-- ---------------------------------------------------------------------------
create or replace function identity.run_staff_rating_recomputation()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if not pg_try_advisory_xact_lock(hashtext('staff_rating_recomputation')) then
    return 0;
  end if;

  with agg as (
    select sf.staff_profile_id,
      coalesce(sum(case sf.severity when 'high' then 3 when 'medium' then 2 else 1 end)
               filter (where sf.kind = 'commend'), 0)   as c,
      coalesce(sum(case sf.severity when 'high' then 3 when 'medium' then 2 else 1 end)
               filter (where sf.kind = 'complaint'), 0) as p
    from identity.staff_feedback sf
    group by sf.staff_profile_id
  ),
  final as (
    select staff_profile_id,
      case when (c + p) = 0 then null
           else round(((c - p)::numeric / (c + p) + 1) / 2 * 5, 1)
      end as rating
    from agg
  ),
  updated as (
    update identity.staff_profiles s
    set rating = f.rating
    from final f
    where f.staff_profile_id = s.id
      and s.deleted_at is null
      and s.rating is distinct from f.rating
    returning 1
  )
  select count(*) into v_count from updated;

  perform jobs.record_scheduled_job_run('staff_rating_recomputation', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('staff_rating_recomputation', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function identity.run_staff_rating_recomputation is
  '"Staff rating recomputation" (§27). Set-based UPDATE of identity.staff_profiles.rating from identity.staff_feedback per the documented severity-weighted formula. service_role only.';

revoke all on function identity.run_staff_rating_recomputation from public;
grant execute on function identity.run_staff_rating_recomputation to service_role;

-- ---------------------------------------------------------------------------
-- transport.run_gps_ping_retention_purge — "GPS ping retention purge | Daily
-- | Delete gps_pings older than 30 days, AFTER trip_route_snapshot generation
-- for any completed trip missing one" (§27, §18).
--
-- M4 fix: the snapshot pre-step is now implemented. Every trip that owns at
-- least one expiring ping first gets a compact route snapshot upserted into
-- analytics.trip_route_snapshot (the full ordered path, not just the expiring
-- slice, so the snapshot always represents the whole route), and only then
-- are the expired raw pings deleted. Both happen in this one function, i.e.
-- one transaction — the snapshot can never be lost while the delete commits.
-- The storage goal is still met: one snapshot row replaces thousands of pings.
--
-- M2 fix: p_retention_days is validated before any destructive work.
-- ---------------------------------------------------------------------------
create or replace function transport.run_gps_ping_retention_purge(p_retention_days int default 30)
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_cutoff     timestamptz;
  v_count      int;
begin
  if p_retention_days is null or p_retention_days < 1 then
    raise exception 'p_retention_days must be >= 1 (got %) — a zero or negative retention window would invert the cutoff and delete every row', p_retention_days
      using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('gps_ping_retention_purge')) then
    return 0;
  end if;

  v_cutoff := now() - make_interval(days => p_retention_days);

  -- Archival pre-step: snapshot the full route of every trip losing pings.
  with expiring as (
    select distinct trip_id
    from transport.gps_pings
    where recorded_at < v_cutoff
  ),
  agg as (
    select g.trip_id,
           g.tenant_id,
           count(*)::int      as point_count,
           min(g.recorded_at) as first_ping_at,
           max(g.recorded_at) as last_ping_at,
           jsonb_agg(jsonb_build_array(g.lat, g.lng, g.recorded_at)
                     order by g.recorded_at) as path
    from transport.gps_pings g
    join expiring e on e.trip_id = g.trip_id
    group by g.trip_id, g.tenant_id
  )
  insert into analytics.trip_route_snapshot
    (trip_id, tenant_id, point_count, first_ping_at, last_ping_at, path, generated_at)
  select trip_id, tenant_id, point_count, first_ping_at, last_ping_at, path, now()
  from agg
  on conflict (trip_id) do update set
    tenant_id     = excluded.tenant_id,
    point_count   = excluded.point_count,
    first_ping_at = excluded.first_ping_at,
    last_ping_at  = excluded.last_ping_at,
    path          = excluded.path,
    generated_at  = excluded.generated_at;

  -- Destructive step, only now that the route is preserved.
  delete from transport.gps_pings where recorded_at < v_cutoff;

  get diagnostics v_count = row_count;
  perform jobs.record_scheduled_job_run('gps_ping_retention_purge', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('gps_ping_retention_purge', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function transport.run_gps_ping_retention_purge is
  '"GPS ping retention purge" (§27, §18). Upserts a compact analytics.trip_route_snapshot for every trip losing pings, THEN deletes pings older than p_retention_days (default 30, must be >= 1). Set-based, atomic. service_role only.';

revoke all on function transport.run_gps_ping_retention_purge from public;
grant execute on function transport.run_gps_ping_retention_purge to service_role;

-- ---------------------------------------------------------------------------
-- jobs.run_idempotency_key_purge — "Idempotency key purge | Daily | Delete
-- jobs.idempotency_keys rows older than 24h" (§27, §25.6). Set-based DELETE.
-- No archival pre-step: an expired idempotency key is by definition
-- disposable replay state (§25.6's 24h retention IS the contract), not
-- historical data. M2 fix: p_retention_hours validated.
-- ---------------------------------------------------------------------------
create or replace function jobs.run_idempotency_key_purge(p_retention_hours int default 24)
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if p_retention_hours is null or p_retention_hours < 1 then
    raise exception 'p_retention_hours must be >= 1 (got %) — a zero or negative retention window would invert the cutoff and delete every row', p_retention_hours
      using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('idempotency_key_purge')) then
    return 0;
  end if;

  delete from jobs.idempotency_keys
  where created_at < now() - make_interval(hours => p_retention_hours);

  get diagnostics v_count = row_count;
  perform jobs.record_scheduled_job_run('idempotency_key_purge', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('idempotency_key_purge', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function jobs.run_idempotency_key_purge is
  '"Idempotency key purge" (§27, §25.6). Deletes jobs.idempotency_keys older than p_retention_hours (default 24, must be >= 1). Set-based. service_role only.';

revoke all on function jobs.run_idempotency_key_purge from public;
grant execute on function jobs.run_idempotency_key_purge to service_role;

-- ---------------------------------------------------------------------------
-- platform.run_failed_login_anomaly_sweep — "Failed-login / session anomaly
-- sweep | Hourly | Review recent audit_log authentication-failure entries for
-- per-account/per-IP thresholds ... flag suspicious patterns for Manager/
-- Platform Admin review" (§27, §23, §28).
--
-- M5 fix: the dedup guard now keys on the SPECIFIC anomaly. The (actor, IP)
-- pair is encoded into the notification's deep_link, and the NOT EXISTS
-- matches that exact deep_link — so N distinct concurrent anomalies produce N
-- distinct alerts instead of collapsing into one (the previous guard matched
-- only (recipient, category, window), suppressing every anomaly after the
-- first and silently dropping the distributed multi-IP case that most needs
-- alerting). M2 fix: both parameters validated.
--
-- Still correct-but-inert until the Auth layer writes 'auth_login_failed'
-- audit rows — primary login is Supabase Auth, so producing those entries is
-- an Auth-hook operational step, tracked as a remaining limitation.
-- ---------------------------------------------------------------------------
create or replace function platform.run_failed_login_anomaly_sweep(
  p_lookback_hours int default 1,
  p_threshold      int default 5
)
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if p_lookback_hours is null or p_lookback_hours < 1 then
    raise exception 'p_lookback_hours must be >= 1 (got %)', p_lookback_hours using errcode = '22023';
  end if;
  if p_threshold is null or p_threshold < 1 then
    raise exception 'p_threshold must be >= 1 (got %)', p_threshold using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('failed_login_anomaly_sweep')) then
    return 0;
  end if;

  with failures as (
    select al.actor_id,
           al.ip_address,
           count(*) as cnt,
           'app://platform/audit?actor=' || coalesce(al.actor_id::text, 'unknown')
             || '&ip=' || coalesce(host(al.ip_address), 'unknown') as deep_link
    from platform.audit_log al
    where al.action = 'auth_login_failed'
      and al.occurred_at >= now() - make_interval(hours => p_lookback_hours)
    group by al.actor_id, al.ip_address
    having count(*) >= p_threshold
  ),
  notified as (
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select null, 'platform_admin', pa.id, 'security', 'Login anomaly detected',
           'Repeated login failures detected (' || f.cnt || ' in the last ' || p_lookback_hours
             || 'h) from ' || coalesce(host(f.ip_address), 'an unknown address') || '.',
           f.deep_link, 'attention'
    from failures f
    cross join identity.platform_admins pa
    where pa.deleted_at is null
      and not exists (
        select 1 from comms.notifications n
        where n.recipient_id = pa.id
          and n.category = 'security'
          and n.deep_link = f.deep_link
          and n.created_at >= now() - make_interval(hours => p_lookback_hours)
      )
    returning 1
  )
  select count(*) into v_count from failures;

  perform jobs.record_scheduled_job_run('failed_login_anomaly_sweep', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('failed_login_anomaly_sweep', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function platform.run_failed_login_anomaly_sweep is
  '"Failed-login / session anomaly sweep" (§27, §28). Flags (actor, IP) groups at/over threshold from platform.audit_log auth_login_failed entries; notifies every Platform Admin with a per-anomaly dedup key so concurrent distinct anomalies are not collapsed. Inert until the Auth layer writes auth_login_failed rows. service_role only.';

revoke all on function platform.run_failed_login_anomaly_sweep from public;
grant execute on function platform.run_failed_login_anomaly_sweep to service_role;

-- ---------------------------------------------------------------------------
-- platform.run_activity_log_archival — "Audit/activity log archival | Monthly
-- | Move activity_log rows older than the retention window to cold storage/
-- export, keep audit_log untouched (indefinite retention)" (§27, §29).
--
-- M4 fix: this now MOVES rows rather than deleting them. A single
-- `DELETE ... RETURNING` feeding an `INSERT` into analytics.activity_log_
-- archive makes the archive-then-remove pair atomic — history is never
-- destroyed, only relocated out of the hot table (§29's storage-cost goal).
-- platform.audit_log is never touched (§23 indefinite retention).
-- M2 fix: p_retention_days validated.
-- ---------------------------------------------------------------------------
create or replace function platform.run_activity_log_archival(p_retention_days int default 365)
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if p_retention_days is null or p_retention_days < 1 then
    raise exception 'p_retention_days must be >= 1 (got %) — a zero or negative retention window would invert the cutoff and archive every row', p_retention_days
      using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('activity_log_archival')) then
    return 0;
  end if;

  with moved as (
    delete from platform.activity_log
    where occurred_at < now() - make_interval(days => p_retention_days)
    returning id, tenant_id, actor_type, actor_id, action, target_type, target_id, metadata, occurred_at
  )
  insert into analytics.activity_log_archive
    (id, tenant_id, actor_type, actor_id, action, target_type, target_id, metadata, occurred_at)
  select id, tenant_id, actor_type, actor_id, action, target_type, target_id, metadata, occurred_at
  from moved
  on conflict (id) do nothing;

  get diagnostics v_count = row_count;
  perform jobs.record_scheduled_job_run('activity_log_archival', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('activity_log_archival', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function platform.run_activity_log_archival is
  '"Audit/activity log archival" (§27, §29). Atomically MOVES platform.activity_log rows older than p_retention_days (default 365, must be >= 1) into analytics.activity_log_archive; never touches platform.audit_log (§23). service_role only.';

revoke all on function platform.run_activity_log_archival from public;
grant execute on function platform.run_activity_log_archival to service_role;

-- ---------------------------------------------------------------------------
-- jobs.register_scheduled_jobs — M3 fix. Encodes the §27 cadence for every
-- Epic 10 job (including the two materialized-view refreshes, which is what
-- makes the analytics surfaces stop serving stale data) as one idempotent
-- registration entrypoint.
--
-- Uses dynamic SQL so this function can be CREATED on a project where pg_cron
-- is not yet installed (the body is not resolved until it runs); it raises a
-- clear error if invoked before the extension exists. cron.schedule(jobname,
-- schedule, command) upserts by name, so re-running is safe and idempotent.
-- Invoke once, as service_role, after pg_cron is enabled.
-- ---------------------------------------------------------------------------
create or replace function jobs.register_scheduled_jobs()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_count int := 0;
  v_job   record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not installed — enable the extension before registering scheduled jobs (§27)'
      using errcode = '0A000';
  end if;

  -- Recurrence fix (concurrency class): matches the advisory-lock convention
  -- every other job function in this Epic uses, so two concurrent operator
  -- invocations cannot interleave their cron.schedule upserts.
  if not pg_try_advisory_xact_lock(hashtext('register_scheduled_jobs')) then
    return 0;
  end if;

  for v_job in
    select * from (values
      ('masar_refresh_attendance_summary',   '0 * * * *',   'select analytics.refresh_attendance_summary();'),
      ('masar_refresh_tenant_summaries',     '15 1 * * *',  'select analytics.refresh_tenant_summaries();'),
      ('masar_staff_rating_recomputation',   '30 2 * * 0',  'select identity.run_staff_rating_recomputation();'),
      ('masar_gps_ping_retention_purge',     '0 3 * * *',   'select transport.run_gps_ping_retention_purge();'),
      ('masar_idempotency_key_purge',        '30 3 * * *',  'select jobs.run_idempotency_key_purge();'),
      ('masar_failed_login_anomaly_sweep',   '5 * * * *',   'select platform.run_failed_login_anomaly_sweep();'),
      ('masar_activity_log_archival',        '0 4 1 * *',   'select platform.run_activity_log_archival();')
    ) as t(job_name, schedule, command)
  loop
    execute format('select cron.schedule(%L, %L, %L)', v_job.job_name, v_job.schedule, v_job.command);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function jobs.register_scheduled_jobs is
  'M3 fix (§27): idempotent registration of every Epic 10 scheduled job — including the two materialized-view refreshes — on its §27 cadence. Raises if pg_cron is not installed. Invoke once as service_role after enabling the extension. service_role only.';

revoke all on function jobs.register_scheduled_jobs from public;
grant execute on function jobs.register_scheduled_jobs to service_role;
