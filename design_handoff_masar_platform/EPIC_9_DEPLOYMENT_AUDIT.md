# Epic 9 Deployment Audit

Audited directly against the linked live Supabase project **masar-staging** (`oqvgkvyapjauepgozgjd`, `eu-west-2`, Postgres 17.6.1) via `supabase db query --linked`, querying `information_schema`/`pg_catalog` only. No source file (`.sql` migration, `.ts` route/repository) was read as evidence — every claim below is backed by a live catalog query against the deployed database, cross-checked against `BACKEND_ARCHITECTURE.md`, `BACKEND_EXECUTION_PLAN.md`, and `EPIC_9_FIX_REPORT.md`.

---

## 1. Migration deployment status

`supabase migration list --linked`: all 6 Epic 9 migrations (`20260729000001`–`20260729000006`) present with **identical timestamps** on both `local` and `remote` — no drift, no missing, no out-of-order entries. This also confirms the `scheduled_job_runs_job_name_check` duplicate-constraint fix (applied directly to `20260729000002` earlier this session) deployed cleanly: the live table carries exactly one constraint of that name (§4).

**Result: ✅ Clean.**

---

## 2. Tables

Live `information_schema.tables` for `platform`/`jobs`:

| Schema | Table | Origin |
|---|---|---|
| `platform` | `activity_log`, `audit_log`, `service_health_status`, `support_tickets`, `tenant_billing_transactions` | Epic 9 |
| `platform` | `notification_outbox` | Pre-existing (Epic 3 `H2` fix, drained by Epic 4) — **not** an Epic 9 object |
| `jobs` | `scheduled_job_runs` | Epic 9 |
| `jobs` | `background_job_queue`, `idempotency_keys` | Pre-existing (Epic 4) — **not** Epic 9 objects |

All 6 tables named in `EPIC_9_FIX_REPORT.md` and `BACKEND_EXECUTION_PLAN.md`'s Epic 9 "Database Tables Involved" list are present. No unexplained table.

**Result: ✅ Matches spec exactly.**

---

## 3. Enums

| Schema | Enum | Live labels |
|---|---|---|
| `jobs` | `scheduled_job_run_status` | `running, succeeded, failed` |
| `platform` | `activity_actor_type` | `staff, guardian, driver, system` |
| `platform` | `audit_actor_type` | `platform_admin, staff, system` |
| `platform` | `billing_transaction_kind` | `subscription_charge, setup_fee, refund` |
| `platform` | `billing_transaction_status` | `initiated, succeeded, failed, refunded` |
| `platform` | `service_status` | `up, degraded, down` |
| `platform` | `support_ticket_category` | `technical, how_to, request, billing` |
| `platform` | `support_ticket_severity` | `high, med, low` |
| `platform` | `support_ticket_status` | `open, in_progress, resolved` |

(`jobs.background_job_status` also present — pre-existing Epic 4 enum, unrelated to Epic 9.)

**Result: ✅ All match documented shape.**

---

## 4. Constraints

All primary keys, foreign keys, and `CHECK` constraints for the 6 Epic 9 tables verified live via `pg_constraint`. Notably:

- `jobs.scheduled_job_runs`: exactly **one** `scheduled_job_runs_job_name_check` (`job_name = ANY (...)`) and exactly one `scheduled_job_runs_finished_at_check` — confirms the earlier same-session fix (removing the redundant inline `check (btrim(job_name) <> '')`) deployed without the naming collision recurring.
- `platform.tenant_billing_transactions_currency_format_check` (`currency ~ '^[A-Z]{3}$'`, M2 fix) — present.
- `platform.support_tickets_resolved_at_check` (`(status = 'resolved') = (resolved_at IS NOT NULL)`) — present.
- `platform.tenant_billing_transactions_settled_at_check` — present.
- `platform.tenant_billing_transactions_amount_check` (`amount > 0`) — matches `BACKEND_ARCHITECTURE.md` §5's amount-positivity rule.
- `platform.service_health_status_uptime_pct_check` (`0–100`), `..._latency_ms_check` (`>= 0`) — present.
- Non-empty text checks on `activity_log.action`/`target_type`, `support_tickets.subject`/`body` — present.
- All 5 `tenant_id` FKs → `tenancy.tenants(id) ON DELETE RESTRICT` — matches §5's FK-behavior table exactly (financial/historical records, never cascade).
- `support_tickets.assigned_to` → `identity.platform_admins(id) RESTRICT`, `support_tickets.reported_by` → `identity.staff_profiles(id) RESTRICT` — present.

**Result: ✅ All match `EPIC_9_FIX_REPORT.md` and `BACKEND_ARCHITECTURE.md`. No orphaned or missing constraint.**

---

## 5. Foreign keys

Covered in §4 — all 6 FKs present, correct target, correct `ON DELETE` behavior, no dangling reference.

**Result: ✅**

---

## 6. Indexes

Live index set matches `EPIC_9_COMPLETION_REPORT.md` §5's named list exactly, plus each table's PK:

`activity_log_tenant_occurred_idx`, `audit_log_tenant_idx`, `audit_log_actor_idx`, `support_tickets_status_severity_idx`, `support_tickets_tenant_idx`, `support_tickets_assigned_to_idx` (partial, `WHERE assigned_to IS NOT NULL`), `tenant_billing_transactions_tenant_idx`, `tenant_billing_transactions_status_idx`, `tenant_billing_transactions_provider_ref_key` (partial unique), `service_health_status_service_code_key` (unique, matches §5's "service_code unique" rule), `scheduled_job_runs_job_name_idx`, `scheduled_job_runs_status_idx`.

**Result: ✅ All present, all correctly shaped (btree, partial-where, and unique variants match documented intent).**

---

## 7. Triggers

| Trigger | Table | Timing/Event | Function |
|---|---|---|---|
| `trg_support_tickets_consistency` | `platform.support_tickets` | `BEFORE INSERT`, `BEFORE UPDATE` | `platform.check_support_ticket_consistency()` |

This is the tenant/reported_by mutual-consistency trigger added during Epic 9's own original recurrence review (`EPIC_9_COMPLETION_REPORT.md` §recurrence). Present and correctly fired on both `INSERT` and `UPDATE`.

(`trg_audit_log_notify_provisioning` also fires on `platform.audit_log` — pre-existing Epic 4 trigger, unrelated to Epic 9.)

**Result: ✅**

---

## 8. RLS policies

All 6 Epic 9 tables have `relrowsecurity = true` **and** `relforcerowsecurity = true` (`FORCE ROW LEVEL SECURITY`). Live policy set:

| Table | Policy | Cmd | Qual |
|---|---|---|---|
| `activity_log` | `activity_log_select_manager` | SELECT | `tenant_id = current_tenant_id() AND current_role() = 'manager'` |
| `activity_log` | `activity_log_select_reception` | SELECT | same, `role = 'reception'` |
| `audit_log` | `audit_log_select_manager_own_tenant` | SELECT | own tenant, manager |
| `audit_log` | `audit_log_select_platform_admin` | SELECT | `is_platform_admin()` |
| `service_health_status` | `service_health_status_select_platform_admin` | SELECT | `is_platform_admin()` |
| `support_tickets` | `support_tickets_select_manager` | SELECT | own tenant, manager |
| `support_tickets` | `support_tickets_select_platform_admin` | SELECT | `is_platform_admin()` |
| `tenant_billing_transactions` | `tenant_billing_transactions_select_platform_admin` | SELECT | `is_platform_admin()` |
| `jobs.scheduled_job_runs` | `scheduled_job_runs_select_platform_admin` | SELECT | `is_platform_admin()` |

**No `INSERT`/`UPDATE`/`DELETE` policy exists on any of the 6 tables** — matches the documented "no direct RLS write path alongside a correctness-critical RPC" design (`EPIC_9_COMPLETION_REPORT.md` §12, citing the `EPIC_5_REVIEW.md`/`EPIC_6_REVIEW.md`/`EPIC_8_REVIEW.md` precedent). All writes route exclusively through the `SECURITY DEFINER` RPCs in §10.

**Result: ✅ Policy shape matches spec.** (Reachability of these SELECT policies is a separate question — see §12, Blocker 1.)

---

## 9. Helper / internal functions

| Function | Schema | `SECURITY DEFINER` | `search_path` | Owner | `EXECUTE` grant |
|---|---|---|---|---|---|
| `write_activity_log` | `platform` | ✅ | `''` | `postgres` | **`service_role` only** |
| `record_scheduled_job_run` | `jobs` | ✅ | `''` | `postgres` | `service_role` only |
| `run_service_health_check` | `platform` | ✅ | `''` | `postgres` | `service_role` only |
| `run_tenant_billing_check` | `platform` | ✅ | `''` | `postgres` | `service_role` only |
| `run_trial_expiry_sweep` | `platform` | ✅ | `''` | `postgres` | `service_role` only |
| `run_attendance_non_marking_alert` | `platform` | ✅ | `''` | `postgres` | `service_role` only |

**C1 fix (`EPIC_9_FIX_REPORT.md`) confirmed live**: `write_activity_log`'s `EXECUTE` privilege is `false` for both `anon` and `authenticated`, `true` only for `service_role` — the forgeable-activity-log-entry path is closed in the deployed database, not just in the migration source.

All four scheduled-job functions confirmed via `pg_get_functiondef` to contain `pg_try_advisory_xact_lock(...)` as their concurrency guard (the proactive fix-report recurrence fix) — present in all four live bodies, not just three.

**Result: ✅ All helper functions match fix-report state exactly.**

---

## 10. RPCs (client-invocable)

Four Epic 9 public RPCs, all in `public` (PostgREST-exposed) schema, all `SECURITY DEFINER`, `search_path = ''`, granted `EXECUTE` to `authenticated` (internal role checks enforce the real authorization boundary):

- `public.create_support_ticket(p_subject, p_body, p_category, p_severity, p_idempotency_key)`
- `public.update_support_ticket(p_ticket_id, p_status, p_assigned_to, p_idempotency_key)`
- `public.issue_tenant_billing_transaction(p_tenant_id, p_amount, p_kind, p_currency, p_provider_reference, p_idempotency_key)`
- `public.refund_tenant_billing_transaction(p_original_transaction_id, p_reason, p_idempotency_key)`

**H1 fix confirmed live** (`pg_get_functiondef` inspection of `refund_tenant_billing_transaction`): initial read is `select * into v_original ... for update`; the terminal `update` carries `and status = 'succeeded'` as a second guard. The fix-report's own explanatory comments are present verbatim in the deployed function body, confirming this is the fixed version, not a stale pre-fix deploy.

**H2 + M1 fix confirmed live** (`update_support_ticket`): initial read is `select * into v_current ... for update`; the reporting-manager notification condition includes `and exists (select 1 from identity.staff_profiles where id = v_current.reported_by and deleted_at is null)`.

Idempotency envelope (`public.idempotency_replay`/`public.idempotency_store`) present in both functions, matching §25.6's generalized-idempotency requirement.

**Result: ✅ All four RPCs deployed with the post-fix-report bodies, not a stale pre-fix version.**

---

## 11. Scheduled jobs

The 4 job functions (`run_service_health_check`, `run_tenant_billing_check`, `run_trial_expiry_sweep`, `run_attendance_non_marking_alert`) and their run-history sink (`jobs.record_scheduled_job_run` → `jobs.scheduled_job_runs`) are correctly deployed, correctly guarded (§9), and match `BACKEND_ARCHITECTURE.md` §27's cadence table in name and intent.

**Blocker found**: `select * from cron.job` fails with `relation "cron.job" does not exist` — **the `pg_cron` extension is not installed on this project.** No cron schedule invokes any of these four functions (or any other scheduled job in the system, including Epic 6/7/8's own jobs). This is a **pre-existing gap that predates Epic 9** (already flagged live in `EPIC_4_DEPLOYMENT_AUDIT.md`: "`pg_cron` available but not installed") — Epic 9 does not regress it, but Epic 9's own four jobs inherit it: none will run automatically in this environment until `pg_cron` is installed and each job is registered via `cron.schedule(...)`.

All 6 Epic 9 tables and `jobs.scheduled_job_runs` currently hold **0 rows** — consistent with zero cron-triggered executions to date, not a seeding or write-path failure (§10's RPCs write correctly, confirmed by inspection of their bodies).

**Result: ⚠️ Functions correctly deployed and guarded; no automatic invocation exists in this environment (`pg_cron` not installed).**

---

## 12. Realtime configuration

`pg_publication_tables` for `supabase_realtime`, filtered to `platform`/`jobs`:

- `platform.service_health_status`
- `platform.support_tickets`

Matches `EPIC_9_COMPLETION_REPORT.md` §15's own stated scope ("`platform:service_health`, `platform:support_tickets`" — migration 6) exactly. **However**, `BACKEND_ARCHITECTURE.md` §15's channel table also specifies a third channel, `tenant:{id}:activity` (`activity_log` INSERT, "Dashboard — Any logged action"), which is **not** in the live publication and was never added by any Epic 9 migration. This narrowing from 3 documented channels to 2 was never called out as a deliberate scope decision or known limitation in `EPIC_9_COMPLETION_REPORT.md`, `EPIC_9_REVIEW.md`, or `EPIC_9_FIX_REPORT.md` — it is a **silent deviation** from `BACKEND_ARCHITECTURE.md`, not an acknowledged one.

**Result: ⚠️ Deployed scope matches the completion report's own narrower claim, but that claim itself silently diverges from `BACKEND_ARCHITECTURE.md` §15 with no recorded rationale.** (In practice this has limited independent impact — see Blocker 1 below: `activity_log` has no client-facing read path at all yet, with or without a Realtime channel.)

---

## 13. Platform Operations / support ticket / activity log / tenant billing architecture — cross-cutting check

Checked schema/API-level reachability for every read path implied by `BACKEND_ARCHITECTURE.md`'s Platform Admin screens (Overview, Support, System Health, Audit) and the Dashboard's tenant activity feed:

- `config.toml`'s `[api].schemas` = `["public", "tenancy", "identity", "academic", "transport", "safety", "comms", "approvals", "billing", "media", "reports"]` — **`platform` and `jobs` are correctly absent** (by design: internal-only schemas, no direct client access).
- Live `pg_namespace` USAGE grants confirm `authenticated`/`anon` have **no** `USAGE` on `platform` or `jobs` (only `service_role` does) — correct, matches the write-only-via-RPC design.
- Searched `public` schema for any read/list wrapper function (`*activity_log*`, `*audit_log*`, `*support_ticket*`, `*tenant_billing*`, `*service_health*`, `*scheduled_job*`): only the 4 write RPCs from §10 and the pre-existing `public.write_audit_log` exist. **No read/list RPC exists for any of the 6 Epic 9 tables.**

### Blocker 1 (Critical): No client-reachable read path for 4 of 6 Epic 9 tables

`activity_log`, `audit_log`, `service_health_status`, and `jobs.scheduled_job_runs` each have live `SELECT` RLS policies (§8), but **nothing can reach them**: their schema isn't PostgREST-exposed, there's no `USAGE` grant for `authenticated`, and no `public`-schema RPC wraps a read. A manager or Platform Admin client has no way to fetch rows from these tables today — the policies are correctly written but functionally dead code from any client's perspective. `support_tickets` and `tenant_billing_transactions` are partially affected too: an individual row comes back as the return value of its own mutating RPC (`create_support_ticket`, `issue_tenant_billing_transaction`, etc.), but there is **no way to list/browse/paginate** either table (no ticket list, no billing history) since the same schema-exposure gap applies to any `SELECT ... FROM platform.support_tickets` a client might otherwise issue.

This is not a new problem Epic 9 introduced — `EPIC_3_DEPLOYMENT_AUDIT.md` §2 flagged the identical gap (`platform` schema absent from `config.toml`, `audit_log`'s RLS policies unreachable via REST) and explicitly recommended a decision **"before Epic 9 (`platform` schema's own Epic) relies on this being resolved one way or the other."** Epic 9 is that Epic, and it added 6 more `SELECT` policies on top of the same unresolved gap without closing it or flagging it as a known limitation in `EPIC_9_COMPLETION_REPORT.md`, `EPIC_9_REVIEW.md`, or `EPIC_9_FIX_REPORT.md`.

**Practical impact**: the Platform Admin Overview/Support/System-Health/Audit screens and the Dashboard's tenant activity feed, as specified in `BACKEND_ARCHITECTURE.md`, cannot fetch data against this deployment as it stands. Creating/updating a ticket or issuing/refunding a billing transaction works (the RPC returns the affected row directly); listing, browsing, or re-loading that data on a page refresh does not.

**Recommended resolution** (not applied — out of scope for this audit): either (a) add `platform` to `config.toml`'s exposed `schemas` list with the existing `FORCE ROW LEVEL SECURITY` policies as the access boundary, or (b) add `public`-schema read/list RPCs (`list_support_tickets`, `list_activity_log`, `get_service_health`, `list_scheduled_job_runs`, etc.) mirroring the write RPCs already built. This decision affects `jobs`/`platform` schema design broadly, not just Epic 9, and should be made deliberately rather than patched ad hoc.

---

## 14. Verification summary

| Check | Result |
|---|---|
| Migrations (all 6, local vs. remote) | ✅ Clean, no drift |
| Tables (6/6) | ✅ |
| Enums (9/9) | ✅ |
| Constraints (PK/FK/CHECK) | ✅, includes confirmed single occurrence of `scheduled_job_runs_job_name_check` |
| Foreign keys | ✅ |
| Indexes | ✅ |
| Triggers | ✅ |
| RLS policies (shape/force) | ✅ |
| Helper functions (grants, `search_path`, C1 fix) | ✅ |
| RPCs (H1/H2/M1 fixes confirmed in live function bodies) | ✅ |
| Scheduled jobs (functions + advisory locks) | ✅ deployed / ⚠️ `pg_cron` not installed, none run automatically |
| Realtime | ⚠️ matches completion report's stated scope, which itself silently narrows `BACKEND_ARCHITECTURE.md` §15 |
| Platform Ops / support ticket / activity log / tenant billing read-reachability | ❌ **Blocker 1** — no client-reachable read path for `activity_log`, `audit_log`, `service_health_status`, `jobs.scheduled_job_runs`; listing/browsing also unreachable for `support_tickets`/`tenant_billing_transactions` |

---

## 15. Deployment blockers

1. **Critical — No read path for 4 of 6 Epic 9 tables** (§13, Blocker 1). Live RLS `SELECT` policies exist but are unreachable by any client (schema not PostgREST-exposed, no `USAGE` grant, no read RPC). Pre-existing gap (flagged in `EPIC_3_DEPLOYMENT_AUDIT.md`), never closed, now directly blocking Epic 9's own Platform Admin read surfaces.
2. **Operational — `pg_cron` not installed** (§11). Epic 9's four scheduled-job functions are correctly built and guarded but have no automatic trigger in this environment. Pre-existing (Epic 4), not an Epic 9 regression, but must be resolved for Epic 9's own jobs to ever run without a manual/external invocation.

Neither blocker stems from Epic 9's own SQL correctness — every table, constraint, index, trigger, RLS policy, function, and fix-report remediation deployed exactly as designed. Both blockers are pre-existing platform-level gaps (schema exposure strategy, `pg_cron` installation) that Epic 9 is the first Epic to be materially blocked by.
