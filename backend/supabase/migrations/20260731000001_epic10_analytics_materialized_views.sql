-- ============================================================================
-- Epic 10 — Jobs, Performance & Production Hardening
-- Migration 1: analytics materialized views (§29) + their access-controlled
-- exposed read views (§2.1) + the internal archival sink tables the retention
-- jobs (migration 2) move data into before deleting it.
--
-- Additive only. No frozen migration, table, RLS policy, RPC, or Edge
-- Function is modified. Epic 10's own (undeployed) migration files are edited
-- in place — the same precedent as the Epic 8/9 fix passes.
--
-- SECURITY MODEL FOR MATERIALIZED VIEWS (rewritten in the EPIC_10_FIX_REPORT
-- fix pass to close H1/M1). Postgres materialized views cannot carry RLS.
-- The ORIGINAL Epic 10 design exposed the tenant-scoped attendance MV through
-- a SECURITY INVOKER view and GRANTed the MV to `authenticated` — which
-- EPIC_10_REVIEW.md H1 correctly found FAILS OPEN: under a service_role/
-- BYPASSRLS client the invoker's RLS predicates vanish and every tenant's
-- rows leak, and the MV's only exposure protection was the unexposed schema
-- (one config line from a cross-tenant breach). This migration replaces that
-- with the SAME fail-CLOSED structure the two platform views already use:
--
--   * NO materialized view is granted to `authenticated`. Every exposed read
--     surface is a plain (definer) view that reads its MV as the view's owner
--     (postgres). A client therefore never needs — and never gets — a direct
--     grant on any MV, so even if `analytics` were mistakenly added to
--     config.toml's exposed schemas, PostgREST still could not SELECT the MV
--     (no grant). Two independent backstops (unexposed schema + no grant).
--   * Each exposed view carries its OWN fail-closed access predicate built
--     from the SAME frozen helper functions the base-table RLS uses — never a
--     re-implemented rule:
--       - academic.v_child_attendance_summary filters
--           tenant_id = public.current_tenant_id()  AND  role-appropriate
--           scoping (manager: whole tenant; teacher: own classrooms only —
--           closing M1; guardian: own children). Under a service_role/no-JWT
--           client, current_tenant_id() is NULL, so `tenant_id = NULL` yields
--           ZERO rows — fail closed, a database-level backstop that holds
--           regardless of which client is used.
--       - platform.v_tenant_billing_summary / v_tenant_health_summary gate on
--           public.is_platform_admin() (all-or-nothing cross-tenant, §2.1),
--           unchanged — already fail-closed.
--
-- M1 (teacher cross-classroom aggregate) is closed structurally: the
-- attendance MV is now grained by (child_id, classroom_id, tenant_id), so a
-- teacher sees only per-classroom rows for their OWN classrooms and never an
-- aggregate spanning classrooms their RLS forbids.
--
-- Refresh happens via the two SECURITY DEFINER functions at the end, never on
-- the read path (§29). Registration for a schedule is in migration 2's
-- jobs.register_scheduled_jobs() (activated once pg_cron is enabled).
-- ============================================================================

create schema if not exists analytics;

-- analytics is internal-only and NOT in config.toml's [api] schemas. Only
-- USAGE is granted (so the definer views, owned by postgres, can resolve
-- object names); NO materialized view or archive table below is granted to
-- anon/authenticated, so none is client-reachable even if the schema were
-- later exposed.
grant usage on schema analytics to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- MV 1: per-child, per-classroom attendance percentage (§2.2, §29). Grained
-- by classroom so the teacher-facing view is scoped to the teacher's own
-- classrooms (M1). Reads only frozen academic.attendance_records (Epic 2).
-- ---------------------------------------------------------------------------
create materialized view analytics.mv_child_attendance_summary as
select
  ar.child_id,
  ar.classroom_id,
  ar.tenant_id,
  count(*)::int                                        as total_days,
  count(*) filter (where ar.present)::int              as present_days,
  round((count(*) filter (where ar.present))::numeric
        / nullif(count(*), 0) * 100, 2)                as attendance_pct,
  now()                                                as computed_at
from academic.attendance_records ar
group by ar.child_id, ar.classroom_id, ar.tenant_id;

-- Unique index on the full grain (enables future REFRESH ... CONCURRENTLY).
create unique index mv_child_attendance_summary_pk_idx
  on analytics.mv_child_attendance_summary (child_id, classroom_id);
create index mv_child_attendance_summary_tenant_idx
  on analytics.mv_child_attendance_summary (tenant_id);

-- NO grant to authenticated on the MV — the definer view below reads it as
-- owner. This is the H1 fix: the MV is unreachable by any client via any path.

-- Exposed read surface: a DEFINER view (default) with an explicit fail-closed
-- predicate reusing the frozen RLS helper functions. Not SECURITY INVOKER —
-- so it does not require (and does not get) a client grant on the MV, and it
-- fails closed (zero rows) under a service_role/no-JWT client because
-- current_tenant_id() is NULL there.
create view academic.v_child_attendance_summary as
select
  m.child_id,
  m.classroom_id,
  m.tenant_id,
  m.total_days,
  m.present_days,
  m.attendance_pct,
  m.computed_at
from analytics.mv_child_attendance_summary m
where m.tenant_id = public.current_tenant_id()
  and (
        public.current_role() = 'manager'
    or (public.current_role() = 'teacher'  and m.classroom_id = any (public.current_staff_classroom_ids()))
    or (public.current_role() = 'guardian' and m.child_id     = any (public.current_guardian_child_ids()))
  );

comment on view academic.v_child_attendance_summary is
  'Exposed, fail-closed read surface over analytics.mv_child_attendance_summary (§29). Definer view: reads the MV as owner (no client MV grant) and gates on public.current_tenant_id() + role helpers — the same predicates academic.attendance_records RLS uses. Zero rows under a no-tenant (service_role) client. Grained per classroom so a teacher never sees a cross-classroom aggregate (M1).';

grant select on academic.v_child_attendance_summary to authenticated;

-- ---------------------------------------------------------------------------
-- MV 2: per-tenant billing summary (§2.1, §29). Cross-tenant, Platform-Admin-
-- only. L2 fix: cumulative money columns are unbounded `numeric` (matching
-- platform.tenant_billing_transactions.amount), not numeric(14,2).
-- ---------------------------------------------------------------------------
create materialized view analytics.mv_tenant_billing_summary as
select
  t.id                                                                          as tenant_id,
  t.name                                                                        as tenant_name,
  t.status                                                                      as tenant_status,
  count(tx.id) filter (where tx.status = 'succeeded' and tx.kind <> 'refund')::int as succeeded_charge_count,
  coalesce(sum(tx.amount) filter (where tx.status = 'succeeded' and tx.kind <> 'refund'), 0)::numeric as gross_succeeded_amount,
  coalesce(sum(tx.amount) filter (where tx.status = 'succeeded' and tx.kind = 'refund'), 0)::numeric  as refunded_amount,
  (coalesce(sum(tx.amount) filter (where tx.status = 'succeeded' and tx.kind <> 'refund'), 0)
   - coalesce(sum(tx.amount) filter (where tx.status = 'succeeded' and tx.kind = 'refund'), 0))::numeric as net_succeeded_amount,
  count(tx.id) filter (where tx.status = 'failed')::int                          as failed_charge_count,
  max(tx.initiated_at)                                                          as last_transaction_at,
  now()                                                                          as computed_at
from tenancy.tenants t
left join platform.tenant_billing_transactions tx on tx.tenant_id = t.id
group by t.id, t.name, t.status;

create unique index mv_tenant_billing_summary_tenant_idx
  on analytics.mv_tenant_billing_summary (tenant_id);

create view platform.v_tenant_billing_summary as
select * from analytics.mv_tenant_billing_summary
where public.is_platform_admin();

comment on view platform.v_tenant_billing_summary is
  'Cross-tenant billing summary (§2.1, §29). Platform-Admin-only via public.is_platform_admin() — fail-closed. Reads the MV as definer owner; the MV carries no client grant.';

grant select on platform.v_tenant_billing_summary to authenticated;

-- ---------------------------------------------------------------------------
-- MV 3: per-tenant operational health summary (§2.1, §29). Cross-tenant,
-- Platform-Admin-only. Unchanged shape from the original implementation.
-- ---------------------------------------------------------------------------
create materialized view analytics.mv_tenant_health_summary as
select
  t.id     as tenant_id,
  t.name   as tenant_name,
  t.status as tenant_status,
  (select count(*) from academic.children c
     where c.tenant_id = t.id and c.deleted_at is null)::int                    as active_children,
  (select count(*) from identity.staff_profiles s
     where s.tenant_id = t.id and s.deleted_at is null)::int                    as active_staff,
  (select count(*) from media.cameras cam
     where cam.tenant_id = t.id and cam.deleted_at is null)::int               as cameras_total,
  (select count(*) from media.cameras cam
     where cam.tenant_id = t.id and cam.deleted_at is null
       and cam.online and not cam.admin_disabled)::int                         as cameras_viewable,
  (select count(*) from platform.support_tickets st
     where st.tenant_id = t.id and st.status <> 'resolved')::int               as open_support_tickets,
  now() as computed_at
from tenancy.tenants t;

create unique index mv_tenant_health_summary_tenant_idx
  on analytics.mv_tenant_health_summary (tenant_id);

create view platform.v_tenant_health_summary as
select * from analytics.mv_tenant_health_summary
where public.is_platform_admin();

comment on view platform.v_tenant_health_summary is
  'Cross-tenant operational health summary (§2.1, §29). Platform-Admin-only via public.is_platform_admin() — fail-closed. Reads the MV as definer owner; the MV carries no client grant.';

grant select on platform.v_tenant_health_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Archival sink tables (M4). Internal to the analytics schema, FORCE ROW
-- LEVEL SECURITY with NO policies and NO client grant — a hard deny to every
-- client, writable only by the migration-2 definer retention jobs. These give
-- the "move to cold storage / generate a snapshot BEFORE destructive delete"
-- guarantee §27 requires but the original jobs skipped.
-- ---------------------------------------------------------------------------

-- Cold-storage sink for platform.activity_log rows the archival job moves out
-- (mirrors the source columns; audit_log is never archived — §23 indefinite).
create table analytics.activity_log_archive (
  id           uuid not null,
  tenant_id    uuid not null,
  actor_type   platform.activity_actor_type not null,
  actor_id     uuid null,
  action       text not null,
  target_type  text not null,
  target_id    uuid null,
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null,
  archived_at  timestamptz not null default now(),
  primary key (id)
);

alter table analytics.activity_log_archive enable row level security;
alter table analytics.activity_log_archive force row level security;

create index activity_log_archive_tenant_occurred_idx
  on analytics.activity_log_archive (tenant_id, occurred_at desc);

-- Compact per-trip route snapshot generated from transport.gps_pings BEFORE
-- the retention purge deletes the raw high-volume pings (§18, §27). One row
-- per trip replaces thousands of ping rows — the storage goal is met while
-- the route is preserved (the archival guarantee the GPS purge lacked).
create table analytics.trip_route_snapshot (
  trip_id        uuid not null,
  tenant_id      uuid not null,
  point_count    int not null check (point_count >= 0),
  first_ping_at  timestamptz null,
  last_ping_at   timestamptz null,
  path           jsonb not null default '[]'::jsonb,
  generated_at   timestamptz not null default now(),
  primary key (trip_id)
);

alter table analytics.trip_route_snapshot enable row level security;
alter table analytics.trip_route_snapshot force row level security;

create index trip_route_snapshot_tenant_idx
  on analytics.trip_route_snapshot (tenant_id);

-- ---------------------------------------------------------------------------
-- Recurrence fix (materialized-view exposure / analytics-leakage class):
-- every analytics object's inaccessibility is asserted EXPLICITLY rather than
-- relying on the mere absence of a GRANT. This defends against any present or
-- future ALTER DEFAULT PRIVILEGES rule that might otherwise auto-grant on
-- newly created objects in this schema. Combined with the unexposed schema and
-- (for the two tables) FORCE ROW LEVEL SECURITY with no policies, every
-- analytics object now has at least two independent client-facing blocks.
-- ---------------------------------------------------------------------------
revoke all on analytics.mv_child_attendance_summary from anon, authenticated;
revoke all on analytics.mv_tenant_billing_summary   from anon, authenticated;
revoke all on analytics.mv_tenant_health_summary    from anon, authenticated;
revoke all on analytics.activity_log_archive        from anon, authenticated;
revoke all on analytics.trip_route_snapshot         from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Refresh functions. SECURITY DEFINER (owned by postgres — may REFRESH the
-- MVs), search_path pinned, advisory-locked, record to jobs.scheduled_job_
-- runs. Plain (non-CONCURRENT) REFRESH — CONCURRENTLY cannot run in a
-- function's transaction block; the unique indexes above make a top-level
-- CONCURRENT refresh available to an operator if refresh-lock contention ever
-- appears (§Performance).
-- ---------------------------------------------------------------------------
create or replace function analytics.refresh_attendance_summary()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if not pg_try_advisory_xact_lock(hashtext('refresh_attendance_summary')) then
    return 0;
  end if;

  refresh materialized view analytics.mv_child_attendance_summary;

  select count(*) into v_count from analytics.mv_child_attendance_summary;
  perform jobs.record_scheduled_job_run('refresh_attendance_summary', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('refresh_attendance_summary', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function analytics.refresh_attendance_summary is
  'Refreshes analytics.mv_child_attendance_summary (§29). Advisory-locked, records to jobs.scheduled_job_runs. service_role only.';

revoke all on function analytics.refresh_attendance_summary from public;
grant execute on function analytics.refresh_attendance_summary to service_role;

create or replace function analytics.refresh_tenant_summaries()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_count      int;
begin
  if not pg_try_advisory_xact_lock(hashtext('refresh_tenant_summaries')) then
    return 0;
  end if;

  refresh materialized view analytics.mv_tenant_billing_summary;
  refresh materialized view analytics.mv_tenant_health_summary;

  select count(*) into v_count from analytics.mv_tenant_health_summary;
  perform jobs.record_scheduled_job_run('refresh_tenant_summaries', v_started_at, 'succeeded', v_count, null);
  return v_count;
exception
  when others then
    perform jobs.record_scheduled_job_run('refresh_tenant_summaries', v_started_at, 'failed', null, sqlerrm);
    raise;
end;
$$;

comment on function analytics.refresh_tenant_summaries is
  'Refreshes analytics.mv_tenant_billing_summary + mv_tenant_health_summary (§29). Advisory-locked, records to jobs.scheduled_job_runs. service_role only.';

revoke all on function analytics.refresh_tenant_summaries from public;
grant execute on function analytics.refresh_tenant_summaries to service_role;
