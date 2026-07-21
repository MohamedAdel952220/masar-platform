# Epic 10 Review — Architecture, Security & Infrastructure

Independent production-grade review of Epic 10 (Jobs, Performance & Production Hardening), read directly from the migrations and TypeScript source, cross-checked against the live schema, `BACKEND_ARCHITECTURE.md`, `BACKEND_EXECUTION_PLAN.md`, the frozen Epics 1–9, and the infrastructure-hardening migrations. **No code was modified.** Findings are ranked most-severe first: **1 High, 5 Medium, 3 Low.**

The additive scope is largely sound — set-based jobs, advisory-lock concurrency guards, reuse of frozen helpers, no new base tables, no `config.toml` change, and a genuinely thoughtful attempt at the hard problem (materialized views can't carry RLS). The findings below are where that attempt has gaps a hardening Epic should not ship with, plus several data-loss and correctness risks in the retention jobs.

---

## H1 — Attendance analytics surface fails OPEN under RLS-bypass, with no database-enforced backstop

**Severity:** High

**Root cause.** `academic.v_child_attendance_summary` is a `SECURITY INVOKER` view whose only access control is the RLS of `academic.attendance_records`, reached through an `exists(...)` correlation (migration 1, lines 98–110). For this to isolate tenants, two independent preconditions must both hold at runtime: (a) the query must run under the *caller's* JWT-scoped `authenticated` client so RLS applies, and (b) the `analytics` schema must stay out of `config.toml`'s exposed list. When either fails, the view returns **all children of all tenants**:

- Under a `service_role` (or any `BYPASSRLS`) client, `security_invoker` runs the `exists(...)` as that role; every `current_role()`/`current_tenant_id()`/`current_staff_classroom_ids()`/`current_guardian_child_ids()` predicate in the frozen `attendance_records` policies evaporates, so the `exists()` is **always true** and every MV row passes. The view **fails open**.
- The underlying MV is directly granted to `authenticated` (`grant select on analytics.mv_child_attendance_summary to authenticated`, line 92 — a grant *required* by `security_invoker`). Its only protection is that `analytics` is absent from `config.toml`'s `[api] schemas`. A single accidental addition of `analytics` to that list — in a project whose last several tasks were *specifically about editing that exact list* to add `platform`/`jobs` — turns the MV into a cross-tenant-readable table for every authenticated user, with no second layer to stop it.

Contrast the two platform views (`v_tenant_billing_summary`, `v_tenant_health_summary`): they are *definer* views gated by `where public.is_platform_admin()`, and their MVs carry **no** `authenticated` grant. Under a `service_role`/no-JWT client, `is_platform_admin()` returns false → **0 rows**; they **fail closed**, and they are protected at both the routing layer *and* the grant layer. The `security_invoker` choice is precisely what gives the one tenant-scoped surface the weaker, fail-open posture.

**Risk.** Full cross-tenant disclosure of every child's attendance aggregates to any authenticated user (or any caller of the read path), triggered by either a wrong client in the composition root — which does not exist yet, so the wiring is unwritten and unverified — or one config line. There is no database-enforced backstop, which is the exact property §28 requires.

**Architecture reference.** §28 Security Model: *"RLS as the database-enforced backstop that holds even if an application-layer check is buggy"* and *"RLS is mandatory, not optional, on every table … so a future column addition can't accidentally leak."* §13 (tenant isolation is the outer RLS layer). The design has no such backstop for `analytics.mv_child_attendance_summary`.

**Recommended fix.** Give the tenant-scoped surface a fail-*closed* posture that does not depend on an unexposed schema. Options, in preference order: (1) do not grant the MV to `authenticated` at all — make `v_child_attendance_summary` a *definer* view that filters `tenant_id = public.current_tenant_id()` (fails closed: a no-JWT/service_role client has no tenant claim → `current_tenant_id()` null → 0 rows), and layer the finer guardian/teacher scoping via a join to the RLS-governed base table under a wrapping `security_invoker` view that itself holds no MV grant; or (2) keep `security_invoker` but additionally gate the view with an explicit `current_tenant_id()` predicate so a bypassing client still returns nothing; or (3) at minimum, add a CI assertion that `analytics` is never present in `[api] schemas` and document the service_role-client prohibition as a hard invariant of the composition root. The asymmetry with the (correct) platform views is the template to follow.

---

## M1 — Teacher sees a cross-classroom attendance aggregate that exceeds their RLS scope

**Severity:** Medium

**Root cause.** `analytics.mv_child_attendance_summary` aggregates `group by child_id, tenant_id` (migration 1, line 82) — i.e. a child's attendance across **all classrooms** they have ever been in. The exposed view gates visibility via `exists (select 1 from attendance_records ar where ar.child_id = m.child_id)` under the caller's RLS. The frozen teacher policy is `attendance_select_teacher: current_role='teacher' AND classroom_id = ANY(current_staff_classroom_ids())` (confirmed live) — a teacher may read attendance rows only for their *own* classrooms. But the `exists()` returns true if the child has *any* record in the teacher's classroom, while the columns returned (`total_days`, `present_days`, `attendance_pct`) are computed over **every** classroom that child attended, including ones the teacher's RLS forbids at the row level.

**Risk.** A teacher viewing a child currently in their classroom who previously attended a different classroom receives an `attendance_pct` that (a) is wrong for the teacher's actual scope (it is not "attendance in my classroom") and (b) discloses, in aggregate, attendance the teacher's RLS is designed to hide. Same-tenant, so not a cross-tenant breach, but a genuine scope-and-correctness defect on a role the service layer explicitly admits (`requireAttendanceReader` allows `teacher`).

**Architecture reference.** §12 Permission Matrix, "Attendance" row: teacher access is scoped to *own classroom* (`CU (own classroom)`), not the whole tenant. §29 intends the MV as a faithful aggregate of what each role may see.

**Recommended fix.** Either grain the MV by `(child_id, classroom_id)` and have the teacher-facing view sum only the caller's visible classroom slices (via a `security_invoker` join whose `attendance_records` RLS filters the summed rows, not just a gating `exists`), or restrict the teacher-facing surface to a classroom-scoped aggregate and keep the child-lifetime aggregate to guardian (own child) and manager (own tenant) only.

---

## M2 — Retention-job interval parameters accept negative/zero values that invert the window → total data loss

**Severity:** Medium

**Root cause.** `transport.run_gps_ping_retention_purge(p_retention_days int default 30)`, `jobs.run_idempotency_key_purge(p_retention_hours int default 24)`, and `platform.run_activity_log_archival(p_retention_days int default 365)` compute the cutoff as `now() - make_interval(days => p_retention_days)` with no lower-bound check on the parameter. A negative argument inverts the interval: `run_gps_ping_retention_purge(-1)` deletes `where recorded_at < now() + 1 day` — i.e. **every row, including current and future pings**. The same applies to the activity-log and idempotency purges.

**Risk.** A fat-fingered manual call or a mis-registered `cron.schedule('… run_gps_ping_retention_purge(-1)')` irreversibly wipes the entire `gps_pings` / `activity_log` / `idempotency_keys` table. Exposure is limited to `service_role`/operator callers (the functions are service_role-only), so it is not externally exploitable — but the blast radius is total, and a hardening Epic is exactly where such a guard belongs.

**Architecture reference.** §28 input-validation discipline; §2.2/§14.3 server-side validation-as-first-action convention (which the frozen RPCs already follow for their own inputs).

**Recommended fix.** Add a guard at the top of each retention function — `if p_retention_days < 1 then raise exception ... end if;` (and the hours equivalent) — so an inverted or zero window fails loudly instead of deleting everything.

---

## M3 — Materialized views never auto-refresh; the exposed analytics views serve stale/frozen data

**Severity:** Medium

**Root cause.** The three MVs are populated once at migration time (the `with no data` clause was removed, so `create materialized view` runs the aggregate against whatever exists at deploy — currently zero rows). Refresh happens only via `analytics.refresh_attendance_summary()` / `refresh_tenant_summaries()`, which are scheduled jobs — but `pg_cron` is not installed and no schedule is registered (acknowledged in the completion report). No refresh therefore ever runs automatically.

**Risk.** Every read of `v_child_attendance_summary` / `v_tenant_billing_summary` / `v_tenant_health_summary` returns data frozen at deploy time — in the current state, permanently empty, and after real data arrives, permanently stale until someone manually calls a refresh function. The §29 feature ("aggregates … refreshed by scheduled jobs, not computed live") is present in form but non-functional as a live analytic. This is a correctness/operational defect, not a security one.

**Architecture reference.** §29 Materialized views "refreshed by scheduled jobs (§27)"; §27's run-history/observability model. §27's own dependence on `pg_cron` (see `PG_CRON_ARCHITECTURE_DECISION.md`).

**Recommended fix.** Gate the analytics read surfaces behind the same `pg_cron` enablement the rest of §27 needs, and register `refresh_attendance_summary`/`refresh_tenant_summaries` on a cadence (§29 implies daily/near-real-time for the dashboard). Until `pg_cron` is enabled, document that these surfaces must not be consumed by a live UI, or expose a `computed_at` staleness signal to the client (the column exists — it is not surfaced as a freshness guard anywhere).

---

## M4 — "Archival" and GPS purge delete without the §27-mandated pre-step → irreversible loss / spec deviation

**Severity:** Medium

**Root cause.** Two retention jobs deviate from what §27 specifies:
- `platform.run_activity_log_archival` **deletes** old `activity_log` rows, but §27 says *"Move activity_log rows … to cold storage/export"*. There is no export sink, so the function only prunes — the "move" half is absent. It is named "archival" but performs deletion.
- `transport.run_gps_ping_retention_purge` deletes old `gps_pings`, but §27 requires *"after `trip_route_snapshot` generation for any completed trip missing one"*. No `trip_route_snapshot` table exists (confirmed live), so the pre-snapshot step is skipped and completed-trip routes are destroyed with no preserved summary.

Both are acknowledged as limitations in the completion report, but from a review standpoint they are latent data-loss risks the moment either job is scheduled.

**Risk.** Irreversible loss of operational history (activity log) and trip route reconstruction data, contrary to the retention intent §27 encodes. Conservative defaults (365d / 30d) and the fact that neither is yet cron-registered limit immediate exposure, but the functions are the finished artifact a future `cron.schedule` will point at.

**Architecture reference.** §27 (both job rows, verbatim preconditions); §29 activity_log "can be pruned" *vs.* §27 "move … to cold storage/export" — the export half is the distinction.

**Recommended fix.** Do not register either job until its precondition exists: wire an export sink before enabling activity-log deletion (or rename the function to reflect that it prunes, not archives), and build/confirm `trip_route_snapshot` generation before enabling the GPS purge. Consider a guard that refuses to purge a completed trip's pings if no route snapshot exists.

---

## M5 — Failed-login anomaly sweep under-reports concurrent anomalies and is end-to-end inert

**Severity:** Medium

**Root cause.** Two issues compound in `platform.run_failed_login_anomaly_sweep`:
1. The notification dedup guard keys on `(recipient_id, category='security', deep_link='app://platform/audit', created_at within window)` — i.e. **per-admin-per-window**, not per-admin-per-anomaly. When the `failures` CTE yields several distinct over-threshold `(actor, IP)` groups, the `insert ... select` fans out one row per (failure × admin), but the `not exists` suppresses all but the first per admin. The admin therefore receives exactly one notification describing one (join-order-arbitrary) anomaly, and the others are silently dropped until the next window.
2. The entire sweep reads `audit_log where action = 'auth_login_failed'`, but nothing in the system writes those rows (primary login is Supabase Auth; no hook writes failures to `audit_log`). The control is inert end-to-end.

**Risk.** A named brute-force/anomaly-detection control (§27, §28) that, even once its data source is wired, surfaces only one of several simultaneous attacks per hour per admin — the multi-IP distributed case (the one that most needs alerting) is the one most likely to be collapsed to a single generic alert. Until the Auth layer writes failures, the control detects nothing at all.

**Architecture reference.** §27 "Failed-login / session anomaly sweep"; §28 *"every failure is written to `audit_log` … and feeds the hourly session-anomaly sweep."*

**Recommended fix.** Make the dedup per-anomaly — include the `(actor_id, ip_address)` (or a hash of it) in the notification's `deep_link`/metadata so distinct anomalies produce distinct, non-suppressed alerts (or aggregate all current anomalies into a single notification body rather than dropping all but one). Separately, track the Auth-hook that writes `auth_login_failed` audit entries as a hard dependency before this control can be considered active (this half is upstream of Epic 10's additive scope).

---

## L1 — Analytics repository uses offset pagination, not cursor pagination

**Severity:** Low

**Root cause.** `AnalyticsRepository` paginates with `.range(offset, offset + limit - 1)` (offset-based). §14.3 mandates cursor-based pagination *"everywhere … never offset pagination."* This mirrors the frozen `ServiceHealthRepository`/`TenantBillingRepository` (inherited convention), so it is not new to Epic 10, but it is a standing deviation the hardening Epic did not correct on a surface it introduced.

**Risk.** Low — the analytics views are small per-tenant aggregates; offset pagination degrades only on very large result sets, which these are not. Consistency/scan-cost concern only.

**Architecture reference.** §14.3, §29 "Pagination discipline: cursor-based everywhere."

**Recommended fix.** Adopt a `(computed_at, tenant_id/child_id)` composite cursor if these surfaces ever back a paginated UI; otherwise document the offset choice as acceptable for bounded aggregates.

---

## L2 — Billing-summary money columns are `numeric(14,2)`, capping cumulative totals

**Severity:** Low

**Root cause.** `gross_succeeded_amount`/`refunded_amount`/`net_succeeded_amount` are cast to `numeric(14,2)` (migration 1, lines 128–131), capping at ~10¹² . These are *cumulative* per-tenant lifetime totals (no time bound in the aggregate), so a long-lived high-volume tenant could theoretically overflow and error the refresh.

**Risk.** Low — 10¹² EGP per tenant is far beyond realistic platform billing, and the failure mode is a refresh error (caught and recorded as `failed`), not silent corruption.

**Architecture reference.** §5 monetary-column conventions; §29 tenant billing summaries.

**Recommended fix.** Use unbounded `numeric` (matching `tenant_billing_transactions.amount`'s own type) for the cumulative sums, or widen the precision.

---

## L3 — Forward-additive CHECK widening modifies an Epic-9-created object (freeze-boundary ratification)

**Severity:** Low / Informational

**Root cause.** Migration 2 drops and re-adds `jobs.scheduled_job_runs_job_name_check` to widen the allowed job-name set. This alters an object created by frozen Epic 9. The completion report justifies it as the extension mechanism Epic 9's own L1 fix documented, and it is a strict non-breaking superset — but it is still a change to a frozen-Epic object under a stated freeze, and a strict reading of "do not modify Epic 9" could question it.

**Risk.** Minimal technically (non-breaking, atomic within one migration, no RLS/grant/isolation impact). The risk is governance: whether the freeze permits `ALTER`-ing a frozen-Epic object at all, versus only forbidding edits to frozen migration *files*.

**Architecture reference.** `EPIC_9_FIX_REPORT.md` L1 (prescribes this exact `ALTER TABLE … DROP/ADD CONSTRAINT` extension path); the Epic 10 freeze instruction.

**Recommended fix.** No code change — ratify (or reject) the interpretation that a non-breaking forward `ALTER` on a frozen-Epic object, pre-sanctioned by that Epic's own documentation, is permitted. If rejected, the alternative is a separate Epic-10-owned run-history table, which the completion report notes would violate §5's "no new base tables."

---

## What is correct (verified, not merely asserted)

- **Platform summary views fail closed** — definer views + `where public.is_platform_admin()` + no MV grant to `authenticated`; a non-admin or no-JWT caller gets 0 rows. Correct, and the template H1 should follow.
- **Scheduled-job concurrency** — all seven functions take `pg_try_advisory_xact_lock` as their first action; no scheduled-job-race recurrence.
- **Set-based, no row-by-row** — every job is a single `UPDATE`/`DELETE`/`INSERT…SELECT`/`REFRESH`; no loops.
- **SECURITY DEFINER hygiene** — every function is `security definer` + `set search_path = ''` + `revoke all … from public` + `grant execute … to service_role`; no internal-helper exposure, no misuse.
- **`deleted_at` filtering** — the health summary filters `deleted_at is null` on children/staff/cameras; the rating job filters non-deleted staff; the failed-login sweep filters non-deleted admins. Immutable tables (`attendance_records`, `tenant_billing_transactions`) correctly not filtered.
- **EXISTS-correlation performance** — `attendance_records` has a unique index on `(child_id, date)`, so the per-row `exists(child_id = …)` correlation is index-served; not a performance regression.
- **No new Realtime publication** — no realtime-leak surface introduced.
- **Notification shape** — `category='security'` (text), `severity='attention'`, `recipient_type='platform_admin'` all valid against the live catalog; the sweep's insert is runtime-safe (its issues are M5, not a runtime error).
- **No new base tables, no `config.toml` change, no frozen migration/RLS/RPC/Edge Function edited** — confirmed.
- **The three reported frozen-touch items** (idempotency retrofit, rate-limit enforcement, storage orphan cleanup) were correctly *reported rather than performed* — the review concurs these cannot be done additively and should await an explicit unfreeze.

---

## Summary

| ID | Severity | Finding |
|---|---|---|
| H1 | High | Attendance analytics surface fails open under RLS-bypass; no DB backstop (asymmetric with fail-closed platform views) |
| M1 | Medium | Teacher sees cross-classroom attendance aggregate exceeding their RLS scope |
| M2 | Medium | Retention params accept negative/zero → window inversion → total data loss |
| M3 | Medium | MVs never auto-refresh (no pg_cron); exposed views serve stale/frozen data |
| M4 | Medium | Activity-log "archival" and GPS purge delete without §27 pre-step → irreversible loss |
| M5 | Medium | Failed-login sweep under-reports concurrent anomalies; inert end-to-end |
| L1 | Low | Offset (not cursor) pagination in analytics repository (§14.3) |
| L2 | Low | `numeric(14,2)` caps cumulative billing totals |
| L3 | Low | Forward-additive CHECK widening alters a frozen-Epic object (ratify) |

The Epic's structural instincts are right — the MV-can't-carry-RLS problem was correctly identified, and the platform surfaces are done well. **H1 is the finding that matters most**: the one tenant-scoped surface was given the fail-open design while the cross-tenant platform surfaces were given the fail-closed one — the inverse of the risk. M2 and M4 are the data-loss risks worth closing before any of these jobs is `cron`-registered.

No changes made — review only, per instruction.
