-- ============================================================================
-- Epic 9 — Platform Operations & Admin Console
-- Migration 6: Realtime publication
-- Ref: BACKEND_ARCHITECTURE.md §15; BACKEND_EXECUTION_PLAN.md Epic 9 §10
--
-- platform:service_health (service_health_status UPDATE) and
-- platform:support_tickets (support_tickets INSERT, UPDATE) — both
-- Platform-Admin-only channels (§15's own matrix), matching the exact
-- per-table `alter publication supabase_realtime add table ...` pattern
-- established by Epic 7's own migration 5.
--
-- activity_log, tenant_billing_transactions, and jobs.scheduled_job_runs
-- are NOT added — §15's own matrix names only the two channels above for
-- this Epic; activity_log has no realtime requirement in §15, and neither
-- tenant_billing_transactions nor scheduled_job_runs appears in §15's
-- table at all.
-- ============================================================================

alter publication supabase_realtime add table platform.service_health_status;
alter publication supabase_realtime add table platform.support_tickets;
