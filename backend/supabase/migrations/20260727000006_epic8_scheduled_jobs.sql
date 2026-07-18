-- ============================================================================
-- Epic 8 — AI Report Architecture
-- Migration 6: AI report scheduled-dispatch scheduled-job SQL function
-- Ref: BACKEND_ARCHITECTURE.md §19, §27
--
-- Matches the "staged structurally, not registered" precedent established
-- by every prior Epic's own scheduled-job functions (most recently
-- media.sweep_camera_heartbeats, Epic 7) — this function does not register
-- an actual pg_cron schedule entry itself: pg_cron is not installed in the
-- linked project (confirmed live through EPIC_7_DEPLOYMENT_AUDIT_FINAL.md
-- §7), so registering a schedule against an extension that isn't installed
-- would fail outright. The function itself is fully correct and callable
-- on-demand — only the actual schedule entry is out of scope, consistent
-- with every prior Epic's identical limitation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reports.sweep_scheduled_report_drafts — "AI report scheduled dispatch"
-- (§27: "Every 5 min | Sweep ai_report_drafts where status='scheduled' AND
-- scheduled_for <= now(), transition to sent, trigger delivery"). Set-based
-- (this task's own "prefer set-based SQL over row-by-row operations"
-- requirement, and the EPIC_4_REVIEW.md H4 lesson already applied
-- identically in every Epic 6/7 scheduled-job function): one
-- UPDATE...RETURNING transitions every due draft in a single statement, one
-- INSERT...SELECT (reading from the same CTE) fans the guardian
-- notification out for every affected child in a single statement — no
-- per-draft loop.
--
-- §19 Acceptance Criteria: "A scheduled report's scheduled_for timestamp
-- reliably triggers delivery within the sweep interval, verified across the
-- boundary condition (exactly at sweep time)" — the WHERE clause's
-- `scheduled_for <= now()` (not `<`) is the direct implementation of that
-- boundary requirement: a draft scheduled for exactly the sweep's own
-- invocation instant is included, not skipped to the next cycle.
-- ---------------------------------------------------------------------------
create or replace function reports.sweep_scheduled_report_drafts()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_count int;
begin
  with due as (
    update reports.ai_report_drafts
    set status = 'sent', sent_at = now()
    where status = 'scheduled' and scheduled_for <= now()
    returning id, tenant_id, child_id
  ),
  notified as (
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select distinct d.tenant_id, 'guardian', cgl.guardian_id, 'report_ready', 'New report available',
           'A new report for your child is ready to view.',
           'app://reports/' || d.id::text, 'info'
    from due d
    join academic.child_guardian_links cgl on cgl.child_id = d.child_id
    join identity.guardian_profiles g on g.id = cgl.guardian_id and g.deleted_at is null
    returning 1
  )
  select count(*) into v_count from due;

  return v_count;
end;
$$;

comment on function reports.sweep_scheduled_report_drafts() is
  '"AI report scheduled dispatch" (§27). Set-based, cross-tenant. Transitions every due (scheduled_for <= now()) scheduled draft to sent and fans the guardian "report ready" notification out in the same statement (§16).';

revoke all on function reports.sweep_scheduled_report_drafts from public;
grant execute on function reports.sweep_scheduled_report_drafts to service_role;
