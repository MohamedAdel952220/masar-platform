# Runbook: Disaster-Recovery Restore Drill

Owner: Platform Ops (Masar). Cadence: **quarterly** (§31). Status: **procedure defined, first drill not yet executed** — Epic 10 delivers this runbook; running it against a production-scale synthetic dataset is the operational step tracked in the Epic 10 Production Checklist (§28) and Definition of Done (§21).

This runbook is the operational half of Epic 10's DR deliverable. It is documentation, not executable backend code — DR is a Supabase-project + infrastructure activity, not a migration or function.

---

## Targets (from BACKEND_ARCHITECTURE.md §31)

| Metric | Target | How met |
|---|---|---|
| RPO (max data loss) | **≤ 5 minutes** | PITR continuous WAL archiving (production tier) |
| RTO (max downtime) | **≤ 4 hours** | Full-project PITR restore |
| Secondary recovery path | Daily logical backups retained **35 days** | Independent of PITR (protects against a PITR-affecting infra issue) |

Both figures are **to be validated, not assumed** — that is the entire point of the drill.

## Preconditions

- Production runs on a Supabase tier with **PITR enabled** (§34 "point-in-time recovery enabled on production"). Verify in the project dashboard before relying on this runbook.
- A **staging** project exists to restore *into* (never restore over production during a drill).
- A production-scale **synthetic** dataset (not real tenant data) is available to seed the source, so the drill exercises realistic data volume (§19 "against a realistic data volume, not an empty database").

## Drill procedure

1. **Record the baseline.** Capture row counts for the highest-volume tables (`transport.gps_pings`, `comms.messages`, `comms.notifications`, `platform.activity_log`, `platform.audit_log`) and a checksum of a known fixed slice (e.g. one tenant's `tenancy.tenants` + `academic.children`).
2. **Note a recovery point.** Record `now()` as `T_target`; then apply a marker write (insert a sentinel `platform.activity_log` row) and record `T_after_marker`.
3. **Trigger a PITR restore** of the source project to `T_target` into the staging target, via the Supabase dashboard/CLI restore flow. Start a stopwatch — this measures RTO.
4. **On restore completion**, stop the stopwatch (RTO figure). Verify:
   - Baseline row counts match to within the WAL window (RPO check — the sentinel written *after* `T_target` must be ABSENT, confirming the restore point is correct).
   - The fixed-slice checksum matches.
   - RLS still enforces (`set role authenticated` + a forged manager JWT sees only own-tenant rows — reuse `tests/rls/*_adversarial.sql` fixtures).
   - The `analytics.*` materialized views can be refreshed post-restore (`select analytics.refresh_tenant_summaries();` as service_role) — MVs are not WAL-replicated content-identical across a restore in all cases, so a post-restore refresh is part of recovery.
5. **Record actual RPO/RTO achieved** vs. target. If either exceeds target, file a follow-up before GA sign-off.
6. **Validate the secondary path** at least once: restore from a daily logical backup (not PITR) and confirm the same integrity checks — this proves the independent recovery path works.

## Out of DR scope (per §31)

- Media relay, payment gateway, WhatsApp/SMS provider — stateless integrations against Masar's own DB, not systems Masar backs up.
- Storage bucket objects — covered by Supabase's own object redundancy.

## Records

Log each drill's date, operator, achieved RPO, achieved RTO, and any deviations here (append-only):

| Date | Operator | RPO achieved | RTO achieved | Notes |
|---|---|---|---|---|
| _(pending first drill)_ | | | | |
