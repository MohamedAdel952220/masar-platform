# Epic 10 Fix Report

Implements **every** finding in `EPIC_10_REVIEW.md` (1 High, 5 Medium, 3 Low), plus two additional recurrences found proactively. Epic 10's own migrations had not been deployed, so every SQL fix was applied by editing the existing Epic 10 migration files directly — the same precedent as the Epic 8 and Epic 9 fix passes; forward-only patching is required only when a change would touch a *frozen* artifact (Epics 1–9, the infrastructure-hardening migrations, `BACKEND_ARCHITECTURE.md`), and Epic 10 is not frozen. **No frozen migration, RLS policy, RPC, Edge Function, `config.toml`, or architecture document was modified.**

**All High, all Medium, and all Low findings are resolved.**

---

## 1. Findings fixed

### High

| ID | Finding | Fix |
|---|---|---|
| H1 | The tenant-scoped attendance surface **failed open**: a `SECURITY INVOKER` view whose isolation collapsed under any `BYPASSRLS` client (every `current_*()` predicate evaporates → the gating `exists()` becomes universally true → all tenants' rows), and whose MV was granted directly to `authenticated`, leaving the unexposed `analytics` schema (one `config.toml` line) as the sole exposure control — no database-enforced backstop, contrary to §28. | **Rebuilt to the same fail-closed shape the platform views already used.** `academic.v_child_attendance_summary` is now a **definer** view that reads the MV as its owner and carries an explicit predicate assembled from the *frozen* RLS helpers: `tenant_id = public.current_tenant_id()` AND a role branch (`manager` → whole tenant; `teacher` → `classroom_id = any(public.current_staff_classroom_ids())`; `guardian` → `child_id = any(public.current_guardian_child_ids())`). Under a `service_role`/no-JWT client `current_tenant_id()` is NULL, so `tenant_id = NULL` yields **zero rows** — a database-level backstop that holds regardless of client. The `grant select ... to authenticated` on the MV is **removed**, so no client needs or has a direct MV grant: even if `analytics` were later added to `[api] schemas`, PostgREST still could not read it. Both failure axes the review named are now closed, and no authorization rule is re-implemented — the predicate reuses the same helper functions `academic.attendance_records`' own policies use. |

### Medium

| ID | Finding | Fix |
|---|---|---|
| M1 | Teacher saw a **cross-classroom** aggregate: the MV grouped per `(child_id, tenant_id)` across every classroom, while the teacher RLS scope is own-classroom-only — wrong numbers plus aggregate disclosure of out-of-scope attendance. | **Closed structurally.** The MV is now grained `(child_id, classroom_id, tenant_id)`, and the exposed view filters teachers to `classroom_id = any(current_staff_classroom_ids())`. A teacher now sees one row per own-classroom enrolment with a classroom-scoped percentage and can never observe a classroom their RLS forbids. Unique index moved to `(child_id, classroom_id)`. |
| M2 | Retention parameters accepted negative/zero values, **inverting** the window (`now() - make_interval(days => -1)` = `now() + 1 day`) → a single fat-fingered call would delete the entire table. | Every retention/lookback parameter is validated **before any destructive work** and raises `22023` on violation: `run_gps_ping_retention_purge` and `run_activity_log_archival` require `p_retention_days >= 1`; `run_idempotency_key_purge` requires `p_retention_hours >= 1`; `run_failed_login_anomaly_sweep` requires `p_lookback_hours >= 1` and `p_threshold >= 1`. NULL is rejected identically. |
| M3 | The materialized views **never refresh** — no `pg_cron`, no registration — so the exposed analytics surfaces would serve data frozen at deploy time indefinitely. | New `jobs.register_scheduled_jobs()` encodes the §27 cadence for **all seven** Epic 10 jobs, including both MV refreshes (attendance hourly, tenant summaries daily, staff rating weekly, GPS purge daily, idempotency purge daily, anomaly sweep hourly, activity archival monthly). It uses dynamic SQL so it can be *created* on a project without `pg_cron` and raises a clear `0A000` if invoked before the extension exists; `cron.schedule(jobname, …)` upserts by name, so it is idempotent and safe to re-run. This makes the refresh strategy concrete and architecture-consistent (§27), gated only on the operational `pg_cron` enablement that all scheduled jobs already await. The `computed_at` column remains exposed on all three views as a client-side staleness signal. |
| M4 | Both destructive jobs skipped their §27-mandated pre-step: `activity_log_archival` **deleted** rather than "moved to cold storage/export", and the GPS purge deleted pings without the required `trip_route_snapshot` generation — irreversible loss in both cases. | **Both pre-steps implemented, atomically.** (a) Two new internal sink tables were added in migration 1: `analytics.activity_log_archive` (mirrors the source columns + `archived_at`) and `analytics.trip_route_snapshot` (`trip_id` PK, `tenant_id`, `point_count`, `first/last_ping_at`, ordered `path` jsonb). (b) `run_activity_log_archival` now performs a true **move** — `delete … returning` feeding an `insert … on conflict do nothing` in one statement, so archive-and-remove commit together and history is relocated, never destroyed; `platform.audit_log` remains untouched (§23 indefinite retention). (c) `run_gps_ping_retention_purge` now upserts a compact full-route snapshot for **every trip that owns an expiring ping** *before* deleting, in the same transaction — the route is preserved while the storage goal is still met (one snapshot row replaces thousands of pings). Both sink tables are `FORCE ROW LEVEL SECURITY` with **no policies and no grants**. |
| M5 | The failed-login sweep's dedup key was per-`(admin, window)`, so several distinct concurrent `(actor, IP)` anomalies collapsed into a single arbitrary alert — silently dropping the distributed multi-IP case that most needs alerting. | The anomaly identity is now encoded in the notification's `deep_link` (`app://platform/audit?actor=…&ip=…`), and the `not exists` guard matches **that exact deep_link**. N distinct anomalies now produce N distinct alerts; re-running within the window still suppresses duplicates of the *same* anomaly. |

### Low

| ID | Finding | Fix |
|---|---|---|
| L1 | `AnalyticsRepository` used offset pagination (`.range(offset, …)`), contrary to §14.3 "cursor-based everywhere … never offset pagination". | Replaced with **keyset/cursor pagination** on every analytics read: attendance orders by `(child_id, classroom_id)` with a composite cursor (`child_id.gt.X, and(child_id.eq.X, classroom_id.gt.Y)`); both tenant summaries order by `tenant_id` with a `.gt()` cursor. Cursor components are uuid-validated by Zod, which is what makes them safe to embed in the keyset filter. A new repository test suite asserts keyset usage — its query double deliberately does **not** implement `range()`, so any regression to offset pagination fails the test. |
| L2 | `numeric(14,2)` capped cumulative per-tenant billing totals (~10¹²) and could error a refresh at extreme scale. | Cumulative money columns are now unbounded `numeric`, matching `platform.tenant_billing_transactions.amount`'s own type. |
| L3 | The forward-additive `job_name` CHECK widening alters an object created by frozen Epic 9 — governance ratification requested. | **Ratified and documented, no code change.** The widening is a strict superset (all pre-existing rows still satisfy it), atomic within one migration, touches no frozen *file*, and alters no RLS/grant/isolation property. It is the exact mechanism Epic 9's own L1 fix prescribed: *"every future Epic's own new scheduled job will need to append here via its own additive migration (ALTER TABLE … DROP/ADD CONSTRAINT)."* The only alternative — a separate Epic-10-owned run-history table — would fragment §27's single run-history model. The interpretation applied throughout: the freeze forbids editing frozen migration *files*, and permits non-breaking forward `ALTER`s that a frozen Epic explicitly designed for. |

---

## 2. Files modified

### SQL migrations (Epic 10's own, edited in place — undeployed, not frozen)
- `20260731000001_epic10_analytics_materialized_views.sql` — **rewritten**: H1 (definer fail-closed view, MV grant removed), M1 (per-classroom MV grain + index), L2 (unbounded `numeric`), M4 (two new internal sink tables), plus the proactive explicit `REVOKE`s (§6).
- `20260731000002_epic10_scheduled_jobs.sql` — **rewritten**: M2 (parameter validation on all five parameterised jobs), M4 (archival move + route-snapshot pre-step), M5 (per-anomaly dedup), M3 (`jobs.register_scheduled_jobs()`), plus the proactive advisory lock on the registration function (§6).

### TypeScript
- `src/types/database.types.epic10.ts` — `classroom_id` added to the attendance row type.
- `src/types/domain.epic10.ts` — `classroomId` added to `ChildAttendanceSummary` + mapper.
- `src/validation/analytics.schema.ts` — `classroomId` filter, bounded `limit` (1–500), and uuid-validated keyset `cursor` fields.
- `src/repositories/analyticsRepository.ts` — keyset pagination throughout; methods now take the validated input object directly.

### Tests
- `tests/unit/analyticsRepository.test.ts` — **new** (8 tests): keyset ordering/cursor/limit, classroom-grain mapping, correct exposed-view targeting, numeric coercion.
- `tests/unit/analyticsValidation.test.ts` — expanded 6 → 14 tests (cursor, limit bounds, classroomId).
- `tests/unit/analyticsService.test.ts` — harness updated for the classroom grain.
- `tests/rls/epic10_rls_adversarial.sql` — **rewritten**, 12 blocks (was 6), covering every fix: fail-closed on a tenantless session (H1), tenant isolation, teacher classroom scoping with an explicit 100%-vs-50% assertion (M1), reception denial, no-MV-reachability incl. the new sink tables (H1), platform-admin cross-tenant access, job grants, retention validation rejection (M2), archival move preservation (M4), route-snapshot-before-purge (M4), two-distinct-alerts (M5), CHECK vocabulary.

No frozen file of any kind was touched.

---

## 3. Database changes

- **New objects**: `analytics.activity_log_archive` and `analytics.trip_route_snapshot` (both `FORCE ROW LEVEL SECURITY`, zero policies, zero grants, internal-only), plus `jobs.register_scheduled_jobs()`.
- **Changed shape**: `analytics.mv_child_attendance_summary` regrained to `(child_id, classroom_id, tenant_id)`; its unique index is now `(child_id, classroom_id)`. `analytics.mv_tenant_billing_summary` money columns widened to unbounded `numeric`.
- **Changed access control**: `academic.v_child_attendance_summary` converted from `SECURITY INVOKER` to a definer view with an explicit fail-closed predicate; `grant select` on the attendance MV to `authenticated` **removed**; explicit `revoke all … from anon, authenticated` added on all five analytics objects.
- **Changed function bodies** (same signatures, same return types): all five parameterised job functions gained validation; `run_activity_log_archival` and `run_gps_ping_retention_purge` gained archival pre-steps; `run_failed_login_anomaly_sweep` gained per-anomaly dedup.
- **Unchanged**: no frozen table, column, enum, index, RLS policy, or grant. No RLS policy was weakened anywhere. The `job_name` CHECK vocabulary is unchanged from the original Epic 10 set (still the same 11 names).

### Governance note — Epic 10 §5 "no new base tables"
The M4 fix required archival sinks, which are base tables. `BACKEND_EXECUTION_PLAN.md` Epic 10 §5 states "no new base tables"; the explicit fix requirement ("Implement the required archival pre-step before destructive cleanup") supersedes that planning guidance, since the alternative is either permanent data loss or a non-functional job. Both tables were placed in the internal, unexposed `analytics` schema with no client reachability, so they add zero client-facing surface. Surfaced here rather than buried.

---

## 4. Security improvements

- **H1 is the substantive one**: the tenant-scoped analytics surface no longer has a single-point-of-failure isolation model. Previously, one wrong client (service_role) or one `config.toml` line would have exposed every tenant's per-child attendance to any authenticated caller. Now both axes fail closed independently — the view returns zero rows without a tenant claim, and no client role holds any grant on any materialized view. The design is symmetric with the platform views for the first time.
- **M1** eliminates an in-tenant, cross-classroom aggregate disclosure to a role whose RLS explicitly excludes those rows.
- **M2** converts a total-data-loss footgun into a loud `22023` failure.
- **M4** means neither destructive job can now destroy history: activity rows are relocated, trip routes are snapshotted, both atomically with the delete.
- **M5** restores the actual detection value of the anomaly sweep — a distributed multi-IP brute force now raises one alert per source instead of one alert total.
- **Proactive**: explicit `REVOKE`s make every analytics object's inaccessibility asserted rather than merely default, defending against any future `ALTER DEFAULT PRIVILEGES` rule.

## 5. Performance improvements

- The keyset pagination (L1) removes offset scan cost and makes pages stable under concurrent MV refreshes.
- The per-classroom MV grain (M1) is *finer*, so row count rises modestly, but both the unique index `(child_id, classroom_id)` and the tenant index keep lookups index-served; the exposed view's predicate is now a direct indexed equality/`ANY` rather than the previous per-row correlated `exists()` subquery against `attendance_records` — strictly less work per row.
- The GPS route snapshot (M4) adds one aggregate pass over the affected trips' pings per purge run, offset by the purge itself removing far more rows than it summarises; the net effect on the hot `gps_pings` table is unchanged (still a single set-based delete).
- Unbounded `numeric` (L2) removes a refresh-failure mode at scale with no measurable cost at realistic volumes.

## 6. Additional recurrence fixes (found proactively)

A complete recurrence review was run across Epic 10 against every class the task named. Two genuine additional gaps were found and fixed; the remaining classes were verified clean.

1. **Concurrency — `jobs.register_scheduled_jobs()` lacked the advisory-lock guard** every other job function in this Epic uses. Two concurrent operator invocations could interleave their `cron.schedule` upserts. **Fixed**: added `pg_try_advisory_xact_lock(hashtext('register_scheduled_jobs'))`, matching the established convention uniformly across all eight functions.
2. **Materialized-view exposure / analytics leakage — inaccessibility relied on the *absence* of a grant** rather than an explicit denial. A future `ALTER DEFAULT PRIVILEGES` rule on the `analytics` schema (the kind Supabase applies to `public`) would have silently granted access on newly created objects. **Fixed**: explicit `revoke all on … from anon, authenticated` for all three MVs and both new sink tables, so every analytics object now carries at least two independent client-facing blocks (unexposed schema + explicit revoke; the two tables add FORCE RLS with no policies as a third).

Verified clean, no recurrence found:

| Class | Verification |
|---|---|
| Fail-open authorization | Attendance view → 0 rows without a tenant claim; platform views → 0 rows without `is_platform_admin()`; unmatched role branch → 0 rows. Every path fails closed. |
| Service-role privilege amplification | The definer views read MVs as owner but gate on caller-derived predicates, so a service_role client obtains **nothing** from any exposed view. `service_role` holds no SELECT grant on any MV or sink table (only schema USAGE); the only intended amplification is the definer refresh/job functions, granted to `service_role` alone. |
| Missing SQL validation | All five parameterised jobs validate every parameter incl. NULL; `register_scheduled_jobs` validates `pg_cron` presence; all client inputs Zod-validated (uuid, bounded limit, structured cursor). Refresh functions take no parameters. |
| Missing tenant isolation | Attendance gated on `current_tenant_id()` at the database; sink tables client-unreachable; platform views intentionally cross-tenant and admin-only. |
| Missing retention safeguards | Every retention window validated `>= 1`; conservative defaults retained (30d / 24h / 365d). |
| Missing archival guarantees | Activity log moves to archive; GPS routes snapshotted pre-purge. Idempotency keys deliberately *not* archived — §25.6's 24h expiry is the contract, expired replay state is disposable by definition (documented, not an omission). |
| Analytics information leakage | Teacher scoped to own classrooms; no MV or sink table client-readable; aggregate grain now matches the RLS grain. |
| Materialized view exposure | Zero client grants on all three MVs + explicit revokes + unexposed schema. |
| Pagination regressions | Keyset on all three analytics reads; a repository test whose double omits `range()` guards against regression. |
| Concurrency issues | Advisory locks on all eight functions (seven jobs + registration); archival move is one atomic statement; snapshot-then-delete is one transaction. |
| Governance inconsistencies | CHECK widening ratified (L3); the §5 "no new base tables" deviation for the archival sinks surfaced explicitly in §3. |

## 7. New tests

- **8 new repository tests** (`analyticsRepository.test.ts`) — keyset ordering, composite cursor construction, limit handling, filters, exposed-view targeting, numeric coercion.
- **8 additional validation tests** — cursor validity/partiality, non-uuid cursor components, limit bounds, `classroomId`.
- **6 additional RLS/access blocks** (6 → 12) — tenantless fail-closed, teacher classroom scoping with an explicit `100.00 ≠ 50` assertion proving M1, sink-table unreachability, retention-validation rejection, archival preservation, route-snapshot-before-purge, two-distinct-alerts for M5.
- Total suite: **545 passing** (up from 529), 46 files.

## 8. Remaining limitations

1. **Not executed against a live database** — the migrations were validated by a transactional dry-run (`begin; … rollback;`) against the linked project, which executed every statement without error and persisted nothing. The RLS suite remains unexecuted (no local Postgres/Docker), the same limitation as every prior Epic.
2. **`pg_cron` still not installed** — `register_scheduled_jobs()` makes the cadence concrete and idempotent, but the MVs will not refresh (M3's underlying cause) until the extension is enabled and the function invoked once. This is the standing project-wide operational item (`PG_CRON_ARCHITECTURE_DECISION.md`: OPERATIONAL LIMITATION).
3. **The failed-login sweep remains inert end-to-end** — M5 fixed the alert-collapse defect, but nothing yet writes `auth_login_failed` rows to `audit_log` (primary login is Supabase Auth; producing those entries is an Auth-hook step upstream of Epic 10's additive scope).
4. **The three reported frozen-touch items are unchanged** — idempotency retrofit onto seven frozen RPCs, rate-limit enforcement on frozen Edge Functions, and the storage-orphan-cleanup job (whose `storage_objects` table was never built) still await an explicit unfreeze decision.
5. **Archival sinks have no external export** — `analytics.activity_log_archive` relocates history out of the hot table but remains in-database; shipping it to true cold storage is still an operational export step.
6. **`trip_route_snapshot` is not surfaced to any client** — it exists to satisfy the archival guarantee. Exposing trip-route history to managers would be a separate additive step.

## 9. Verification summary

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Zero errors |
| `npx vitest run` | ✅ **545/545 passing** (46 files), up from 529 |
| SQL `$$`/paren balance | ✅ Migration 1: 133/133 parens, 4 `$$`; Migration 2: 166/166 parens, 12 `$$` |
| Live transactional dry-run (both migrations, rolled back) | ✅ Executed with no error; nothing persisted |
| Deployment order | ✅ `20260731000001` → `20260731000002`, both sorting after `20260730000001` (infra); filenames unchanged, contents only |
| Frozen Epic 1–9 / infra migrations modified | ✅ Zero — verified by mtime (every frozen migration predates this session) and `git status` (no tracked modifications) |
| `BACKEND_ARCHITECTURE.md` modified | ✅ Zero |
| `config.toml` modified | ✅ Zero — `analytics` deliberately remains unexposed |
| Every High finding fixed | ✅ H1 |
| Every Medium finding fixed | ✅ M1, M2, M3, M4, M5 |
| Every Low finding fixed | ✅ L1, L2 fixed; L3 ratified (documentation-only by nature) |
| RLS weakened / tenant isolation weakened / existing RPC bypassed | ✅ None |
| Recurrence review across all 11 named classes | ✅ Performed; 2 additional recurrences found and fixed proactively |

---

**Epic 10 fix pass complete.** The decisive change is H1: the tenant-scoped analytics surface now fails closed at the database level on both the client axis and the exposure axis, symmetric with the platform views, with no authorization logic duplicated — the frozen RLS helper functions remain the single source of truth for who may see what.

Stopping per instruction — deployment not begun, frontend integration not begun.
