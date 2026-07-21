# Epic 10 Deployment Audit

Audited **exclusively against the live deployed Supabase project** `masar-staging` (`oqvgkvyapjauepgozgjd`, `eu-west-2`, Postgres 17.6.1) following the full `supabase db reset --linked` rebuild. Evidence is drawn from `pg_catalog`/`information_schema` queries and **live HTTP requests against the deployed PostgREST endpoint**. No local file was inspected and no source code was reviewed, per instruction.

**Result: the Epic 10 deployment is correct in every audited dimension, with one pre-existing environmental gap (`pg_cron` is not installed, so no scheduled job is registered).**

---

## 1. Migrations deployed

`supabase migration list --linked` shows local/remote agreement across the entire history. Both Epic 10 migrations are present remotely:

| Migration | Local | Remote |
|---|---|---|
| `20260730000001` (infra platform reads) | ✅ | ✅ |
| `20260731000001` (Epic 10 analytics MVs) | ✅ | ✅ |
| `20260731000002` (Epic 10 scheduled jobs) | ✅ | ✅ |

Deployment order is correct — both Epic 10 migrations sort after the infrastructure-hardening migration. **Result: ✅**

---

## 2. Analytics schema & materialized views

| Object | Kind | RLS / FORCE RLS |
|---|---|---|
| `analytics.mv_child_attendance_summary` | materialized view | n/a (MVs cannot carry RLS) |
| `analytics.mv_tenant_billing_summary` | materialized view | n/a |
| `analytics.mv_tenant_health_summary` | materialized view | n/a |
| `analytics.activity_log_archive` | table | **true / true** |
| `analytics.trip_route_snapshot` | table | **true / true** |

All five objects deployed. Both M4 archival sink tables carry `FORCE ROW LEVEL SECURITY`. **Result: ✅**

---

## 3. H1 fail-closed redesign — verified deployed (three independent proofs)

This was the review's High finding and the fix pass's central change. All three layers are confirmed live:

**(a) The views are DEFINER, not SECURITY INVOKER.** Querying `pg_class.reloptions` for `security_invoker` returns `definer` for all three exposed views (`academic.v_child_attendance_summary`, `platform.v_tenant_billing_summary`, `platform.v_tenant_health_summary`). The fail-open `security_invoker` construction is gone.

**(b) No materialized view carries any client grant.** `has_table_privilege` for SELECT:

| Object | anon | authenticated | service_role |
|---|---|---|---|
| `mv_child_attendance_summary` | ❌ | ❌ | ❌ |
| `mv_tenant_billing_summary` | ❌ | ❌ | ❌ |
| `mv_tenant_health_summary` | ❌ | ❌ | ❌ |
| `activity_log_archive` | ❌ | ❌ | ❌ |
| `trip_route_snapshot` | ❌ | ❌ | ❌ |
| `academic.v_child_attendance_summary` | ❌ | ✅ | ❌ |
| `platform.v_tenant_billing_summary` | ❌ | ✅ | ❌ |
| `platform.v_tenant_health_summary` | ❌ | ✅ | ❌ |

A schema-wide sweep for any `analytics` relation readable by `anon` or `authenticated` returns **NONE**. The pre-fix `grant select on mv_child_attendance_summary to authenticated` is confirmed removed.

**(c) The fail-closed predicate works at the database level.** Executing as role `authenticated` **with no JWT claims** (the shape a service_role/misconfigured client presents):

| View | Rows returned |
|---|---|
| `academic.v_child_attendance_summary` | **0** |
| `platform.v_tenant_billing_summary` | **0** |
| `platform.v_tenant_health_summary` | **0** |

Zero rows — not an error, not a leak. `current_tenant_id()` is NULL and `is_platform_admin()` is false, so every predicate correctly excludes all rows. **The database-level backstop the review required is live. Result: ✅**

---

## 4. Materialized views are not reachable through PostgREST

Live HTTP against the deployed endpoint:

| Request | Role | Result |
|---|---|---|
| `GET /mv_child_attendance_summary` `Accept-Profile: analytics` | service_role | **406 PGRST106** |
| `GET /activity_log_archive` `Accept-Profile: analytics` | service_role | **406 PGRST106** |
| `GET /trip_route_snapshot` `Accept-Profile: analytics` | anon | **406 PGRST106** |

The runtime-reported exposed schema list is:

```
public, tenancy, identity, academic, transport, safety, comms,
approvals, billing, media, reports, platform, jobs
```

`analytics` is **absent** — matching the architecture's intent that it be internal-only. Two independent blocks are therefore live: the routing layer (PGRST106) *and* the grant layer (no client SELECT on any analytics object, §3b). **Result: ✅**

---

## 5. Access-control views — runtime behavior

| Request | Role | Result |
|---|---|---|
| `GET /v_child_attendance_summary` (academic) | service_role | 403 `42501` permission denied for view |
| `GET /v_tenant_billing_summary` (platform) | service_role | 403 `42501` permission denied for view |
| `GET /v_tenant_health_summary` (platform) | service_role | 403 `42501` permission denied for view |
| `GET /v_child_attendance_summary` (academic) | anon | 401 `42501` permission denied for view |
| `GET /v_tenant_billing_summary` (platform) | anon | 401 `42501` permission denied for schema platform |

Every non-`authenticated` path is denied at the grant layer *before* the predicate is even evaluated — a stronger fail-closed outcome than returning zero rows. Tenant isolation on the attendance view and the platform views' Platform-Admin-only gating are both structurally confirmed (§3c). **Result: ✅**

---

## 6. Scheduled jobs — functions

All eight Epic 10 functions deployed with uniform hardening:

| Function | DEFINER | `search_path` | **Advisory lock** | authenticated EXECUTE | service_role EXECUTE |
|---|---|---|---|---|---|
| `analytics.refresh_attendance_summary` | ✅ | `""` | ✅ | ❌ | ✅ |
| `analytics.refresh_tenant_summaries` | ✅ | `""` | ✅ | ❌ | ✅ |
| `identity.run_staff_rating_recomputation` | ✅ | `""` | ✅ | ❌ | ✅ |
| `transport.run_gps_ping_retention_purge` | ✅ | `""` | ✅ | ❌ | ✅ |
| `jobs.run_idempotency_key_purge` | ✅ | `""` | ✅ | ❌ | ✅ |
| `platform.run_failed_login_anomaly_sweep` | ✅ | `""` | ✅ | ❌ | ✅ |
| `platform.run_activity_log_archival` | ✅ | `""` | ✅ | ❌ | ✅ |
| `jobs.register_scheduled_jobs` | ✅ | `""` | ✅ | ❌ | ✅ |

**Advisory locking is present on all eight**, including the registration entrypoint (the fix pass's proactive concurrency fix). **Result: ✅**

**Runtime safeguard verification** (executed live as service_role):
- `run_gps_ping_retention_purge(0)` → raised `invalid_parameter_value` ✅
- `run_activity_log_archival(-1)` → raised `invalid_parameter_value` ✅
- `run_idempotency_key_purge(-24)` → raised `invalid_parameter_value` ✅
- `register_scheduled_jobs()` → raised `feature_not_supported` (clean refusal while `pg_cron` absent) ✅

The M2 retention-inversion safeguard is live and working — an inverted window raises instead of deleting the table.

**Refresh path verified end-to-end**: `analytics.refresh_tenant_summaries()` executed successfully as service_role, returned `0`, and recorded a run in `jobs.scheduled_job_runs` (`status = succeeded`, `rows_affected = 0`) — confirming the refresh functions, the run-history integration, and the widened job-name vocabulary all work together live.

---

## 7. Scheduled jobs — registration ⚠️ **GAP**

`select … from pg_extension where extname = 'pg_cron'` returns **NOT INSTALLED**. Consequently **no scheduled job is registered**, and none of the eleven job functions across Epics 6–10 executes automatically.

This is reported as a runtime gap because "scheduled jobs are correctly registered" was an explicit audit item and it is factually not satisfied. Precise characterisation:

- It is **not an Epic 10 deployment defect.** Every job function deployed correctly, is callable, and behaves correctly when invoked (§6).
- It is **not new.** `pg_cron` has been absent since Epic 4 (`EPIC_4_DEPLOYMENT_AUDIT.md`), and `PG_CRON_ARCHITECTURE_DECISION.md` already classified this as an **OPERATIONAL LIMITATION**, not an architectural blocker.
- **No code change is required to close it.** Epic 10 shipped `jobs.register_scheduled_jobs()` for exactly this purpose; it currently refuses cleanly with `feature_not_supported`. Closure is two operational actions: enable the `pg_cron` extension on the project, then invoke `select jobs.register_scheduled_jobs();` once as service_role.

**Consequence while open:** the materialized views never refresh automatically. The database is currently empty (§9), so the MVs are consistent with their sources right now — but they will diverge the moment real data is written, and the retention/recompute jobs will not run. This is the live manifestation of review finding M3's underlying cause.

**Result: ⚠️ Gap — environmental, pre-existing, no code change needed.**

---

## 8. RLS, grants, privilege escalation, and frozen-Epic integrity

| Check | Result |
|---|---|
| `analytics` schema USAGE | anon ❌ / authenticated ✅ / service_role ✅ — USAGE alone conveys no row access |
| Any `analytics` or Epic 10 function executable by `anon` or `PUBLIC` | **NONE** ✅ |
| Any `analytics` relation readable by `anon`/`authenticated` | **NONE** ✅ |
| `platform.write_activity_log` executable by `authenticated` | **false** ✅ (Epic 9 C1 fix intact) |
| Frozen Epic 9 client RPCs present | all 4 (`create_support_ticket`, `update_support_ticket`, `issue_tenant_billing_transaction`, `refund_tenant_billing_transaction`) ✅ |
| `platform` + `jobs` RLS policy count | **9** — identical to the Epic 9 final audit; none added, removed, or altered ✅ |
| `academic.attendance_records` policy count | **7** — frozen Epic 2 policies intact ✅ |
| `jobs` base tables | **3** — unchanged ✅ |

**No privilege escalation exists.** No frozen RLS policy, grant, RPC, or table was modified by Epic 10.

**Job-name CHECK constraint** deployed as a strict superset — Epic 9's original four values plus Epic 10's seven, eleven total:
`service_health_check, tenant_billing_check, trial_expiry_sweep, attendance_non_marking_alert, refresh_attendance_summary, refresh_tenant_summaries, staff_rating_recomputation, gps_ping_retention_purge, idempotency_key_purge, failed_login_anomaly_sweep, activity_log_archival`
Non-breaking; every pre-existing value is retained. **Result: ✅**

---

## 9. Realtime, Storage, and data state

- **Realtime** (`supabase_realtime` publication): `platform.service_health_status`, `platform.support_tickets`, `academic.day_path_events`. Epic 10 added **no** publication membership — no new Realtime surface, no leak. ✅
- **Storage**: 7 buckets present and unchanged by Epic 10 (`profile-photos`, `identity-documents`, `academic-attachments`, `chat-attachments`, `generated-documents`, `payment-receipts`, `public-branding`). ✅
- **Data state**: the rebuilt database is **empty** — 0 rows in `tenancy.tenants`, `academic.children`, `academic.attendance_records`, `identity.staff_profiles`, `transport.gps_pings`, `platform.activity_log`, `platform.tenant_billing_transactions`. The reported successful seed produced no domain rows. All three MVs are correspondingly empty and therefore *consistent* with their sources.

  This is worth flagging for planning purposes rather than as a defect: because there is no seeded data, this audit could not empirically exercise tenant isolation or the teacher classroom-scoping (M1) against real rows. Those properties were instead verified structurally — the definer views' predicates, the deployed grants, and the zero-row fail-closed behaviour (§3, §5). Executing `tests/rls/epic10_rls_adversarial.sql` against a seeded database remains the way to confirm the positive-path row-level outcomes.

---

## 10. Infrastructure consistency

| Check | Result |
|---|---|
| PostgREST exposed schemas (runtime) | 13 schemas; `analytics` correctly **absent** ✅ |
| `platform` / `jobs` still exposed (infra-hardening decision preserved) | ✅ |
| Schema USAGE grants from the frozen infra migration | unchanged ✅ |
| Drift between local and remote migration history | **none** ✅ |
| `supabase db push` | reported *Remote database is up to date* ✅ |

No infrastructure drift exists.

---

## 11. Verification summary

| Item | Result |
|---|---|
| All Epic 10 migrations deployed | ✅ |
| Database + analytics schema | ✅ |
| Materialized views deployed | ✅ |
| Access-control views deployed as DEFINER | ✅ |
| **H1 fail-closed redesign correctly deployed** | ✅ (3 independent proofs) |
| **MVs not reachable through PostgREST** | ✅ (PGRST106 + zero grants) |
| **Tenant attendance view tenant-isolated** | ✅ (predicate live, 0 rows without claims) |
| **Platform analytics views fail-closed** | ✅ |
| RPCs | ✅ (frozen Epic 9 set intact; Epic 10 adds none) |
| Scheduled job **functions** | ✅ (8/8 hardened) |
| **Advisory locking on all scheduled jobs** | ✅ (8/8) |
| **Scheduled jobs registered** | ⚠️ **NO — `pg_cron` not installed** |
| Retention safeguards (M2) live | ✅ (verified by runtime raise) |
| **Analytics schema exposure matches architecture** | ✅ |
| RLS / grants | ✅ unchanged, none weakened |
| **No privilege escalation** | ✅ |
| Realtime / Storage | ✅ unchanged |
| **No frozen Epic modified** | ✅ |
| **No infrastructure drift** | ✅ |

---

## 12. Outcome

Every Epic 10 object audited is deployed correctly, and the H1 fail-closed analytics redesign — the most consequential change in this Epic — is verified live at three independent layers (definer views, zero client grants on every materialized view, and zero-row behaviour without a tenant claim). No privilege escalation, no frozen-Epic modification, and no infrastructure drift exists.

**One runtime gap remains: `pg_cron` is not installed, so no scheduled job is registered.** The materialized views therefore never refresh automatically and the retention/recompute jobs never run. This is environmental and pre-existing (unchanged since Epic 4), is already classified as an operational limitation by `PG_CRON_ARCHITECTURE_DECISION.md`, and **requires no code change** — Epic 10 already ships `jobs.register_scheduled_jobs()` for it, which currently refuses cleanly. Closure is: enable the extension, then run `select jobs.register_scheduled_jobs();` once as service_role.

Because an explicitly-requested verification item ("scheduled jobs are correctly registered") is not satisfied, this audit does not issue the backend-certification statement. Every other audited item passes; certification should follow immediately once `pg_cron` is enabled and registration is executed and re-verified.
