# Infrastructure Hardening: Platform Admin Read Access

New migration: `backend/supabase/migrations/20260730000001_infra_platform_reads_authenticated_grants.sql`. Additive only — no existing migration, RLS policy, RPC, or Edge Function was modified.

---

## 1. Root cause

`EPIC_9_ARCHITECTURE_DECISION.md` established that `BACKEND_ARCHITECTURE.md` specifies a single, platform-wide read architecture: **PostgREST + RLS for reads, RPCs reserved for writes/multi-table transactions** (§14.1's three RPC-use-cases exclude a plain single-table read; §14.2's ~35-contract catalog contains zero read RPCs anywhere in the system; §12/§12.1/§13.6 describe Platform Admin's own read access explicitly as "RLS bypass on `platform.*` schema tables" and "an RLS policy branch" — i.e., a direct-table-read design).

Epic 9 built the enforcement half of that design correctly: 9 `SELECT` RLS policies across 6 tables (`activity_log`, `audit_log`, `service_health_status`, `support_tickets`, `tenant_billing_transactions`, `jobs.scheduled_job_runs`), all under `FORCE ROW LEVEL SECURITY`. What it never built was the *reachability* half. PostgREST enforces access through four independent gates, all of which must be open for a `SELECT` to succeed: (1) the schema is listed in `config.toml`'s `[api] schemas`, (2) the querying role has schema-level `USAGE`, (3) the querying role has object-level `SELECT` on the specific table, (4) an RLS policy evaluates to true for the row. Epic 9 satisfied gate 4 only.

Gate 2 was closed by an earlier, separate, already-frozen migration: `20260728000001_infra_schema_usage_grants.sql` granted `authenticated` `USAGE` on exactly the ten schemas then listed in `[api] schemas` — and *deliberately excluded* `platform`/`jobs`, reasoning at the time (correctly, given what was known then) that granting `authenticated` `USAGE` on either "would serve no purpose," since no application code called `.schema('platform')` or `.schema('jobs')` as anything but `service_role`. `EPIC_9_ARCHITECTURE_DECISION.md` has since resolved that open question: `platform` reads are meant to be authenticated-reachable after all, for the specific tables that already carry a policy for a human role. This migration is the direct consequence of that resolved decision — it does not contradict the earlier migration's own reasoning, it acts on new information that migration didn't have.

Root cause, one sentence: **Epic 9 shipped the authorization layer (RLS) without the corresponding infrastructure-provisioning layer (schema `USAGE` + table `SELECT` grants) the architecture's PostgREST-based read model requires, because the grant layer is a project-wide, cross-schema concern that sits outside any single Epic's own migration scope** — the same category of gap the frozen `20260728000001` migration closed for `service_role`/the ten API-exposed schemas, now closed for `authenticated` on the two schemas that were correctly left out of that pass at the time.

---

## 2. Exact grants

```sql
grant usage on schema platform to authenticated;
grant usage on schema jobs     to authenticated;

grant select on platform.activity_log               to authenticated;
grant select on platform.audit_log                  to authenticated;
grant select on platform.service_health_status       to authenticated;
grant select on platform.support_tickets             to authenticated;
grant select on platform.tenant_billing_transactions to authenticated;

grant select on jobs.scheduled_job_runs to authenticated;
```

No grant of any kind is added for `jobs.background_job_queue` or `jobs.idempotency_keys`. No grant is added for `anon`. No grant is added for `service_role` (it already holds `USAGE` on both schemas from `20260728000001`, and bypasses RLS by Supabase's own platform design regardless of any table grant).

This is the complete list — nothing else is in the migration (verified: only these 8 statements plus comments; SQL is DDL-only, no function bodies, no `$$` blocks, parens balanced 12/12).

---

## 3. Security analysis

**What actually changes, mechanically.** Before this migration, an `authenticated` PostgREST request against any `platform.*` or `jobs.*` table failed at gate 2 (no schema `USAGE`) with a permission-denied error before Postgres ever evaluated an RLS policy. After this migration, gates 1–3 are open for exactly 6 tables, so a request now reaches gate 4 (RLS) — where the 9 policies Epic 9 already deployed decide, per-row, per-role, per-tenant, whether that specific caller sees that specific row. **The set of rows any given caller can see is defined entirely by the existing RLS policies, unchanged by this migration.** This migration cannot grant visibility into a single row that policy didn't already allow — it can only stop *rejecting the request before RLS gets asked*.

**Why gate-1 (`config.toml`) is out of scope here, and does not weaken this migration's guarantee.** `platform`/`jobs` are not yet in `[api] schemas`, so PostgREST's own routing layer (independent of the grants below it) still rejects any request to these schemas today with `PGRST106`, before the request reaches Postgres at all — the same "invisible until the routing layer is also fixed" behavior `20260728000001`'s own header comment documented for `reports`/`billing` earlier in this project. Landing the `config.toml` change was explicitly out of this task's requirements (grants only); until it lands, this migration is a correct, inert prerequisite — safe to deploy standalone, with zero behavioral change until the routing layer is separately opened.

**Per-boundary verification against the 5 stated requirements:**

- **`authenticated` only, nothing broader.** `anon` gets nothing — every one of the 6 tables' RLS policies requires `current_tenant_id()`, `current_role()`, `is_platform_admin()`, or `current_platform_admin_tier()`, all of which resolve from a Supabase Auth JWT that an anonymous session never carries; granting `anon` reachability here would only add attack surface for requests RLS would deny anyway, so it was correctly omitted. `service_role`'s access is unchanged (already broader, already granted, already RLS-bypassing by platform design).
- **Exactly the 6 named tables, not the whole `platform`/`jobs` schema.** `jobs.background_job_queue`/`jobs.idempotency_keys` receive no object-level grant. `authenticated` does gain schema-level `USAGE` on `jobs` (USAGE is necessarily schema-wide, not table-scoped — there is no finer-grained Postgres primitive), but `USAGE` alone confers zero row-visibility; it only permits *naming* an object in that schema, which then still needs its own object grant to do anything. Both excluded tables retain `FORCE ROW LEVEL SECURITY` with zero policies for any human role (confirmed live via `pg_policies`), so they are a hard deny at gate 4 even in the hypothetical where a future change mistakenly added a table grant — a second, independent layer of protection beyond this migration's own scoping discipline.
- **`FORCE ROW LEVEL SECURITY` preserved.** This migration contains no `ALTER TABLE ... [NO] FORCE ROW LEVEL SECURITY` statement of any kind — it is `GRANT` statements only, a strictly orthogonal Postgres privilege system from RLS. Every one of the 6 tables (and the 2 excluded ones) keeps exactly the `FORCE ROW LEVEL SECURITY` setting Epic 9's own migrations already established.
- **Every existing security boundary preserved.** No RLS policy touched (0 `CREATE`/`ALTER`/`DROP POLICY` statements). No RPC touched (0 `CREATE FUNCTION`/`GRANT EXECUTE` statements) — the C1 fix (`write_activity_log` restricted to `service_role`) and every other RPC-level grant from Epic 9's own migrations and `EPIC_9_FIX_REPORT.md` are untouched by a migration that contains no function-related statement at all. No Edge Function touched (this is a pure SQL migration; no `supabase/functions/` file exists in this change). `20260728000001` itself is untouched — a new, later-numbered, purely additive file, per this task's "do not modify any existing migration" constraint.
- **No write path opened.** Only `SELECT` is granted — no `INSERT`, `UPDATE`, or `DELETE` grant appears anywhere in this migration. Every write to these 6 tables continues to route exclusively through the `SECURITY DEFINER` RPCs Epic 9 already built (`create_support_ticket`, `update_support_ticket`, `issue_tenant_billing_transaction`, `refund_tenant_billing_transaction`, `platform.write_activity_log`) — none of which needed, or received, any change here.

**Net security posture change**: strictly additive read reachability, bounded to exactly the rows RLS already permits, for exactly the tables and role the architecture decision specified, with zero change to any write path, any RLS policy, or any other role's access.

---

## 4. Why this is infrastructure hardening, not an Epic 9 change

Epic 9's own migrations (`20260729000001`–`20260729000006`) are scoped to *that Epic's own schema objects*: creating the `platform`/`jobs` tables, enums, RLS policies, RPCs, scheduled jobs, and Realtime registration. A schema-level `GRANT` is not an Epic 9 object — it's a project-wide privilege that sits above any single Epic's migration boundary, exactly like the earlier `20260728000001` migration (which fixed the identical class of gap — missing schema `USAGE` — for `service_role` across *every* schema Epic 1 through 8 had created, not just one Epic's). That migration's own header explicitly frames itself as "not an Epic 8 change" for the same reason this one is not an Epic 9 change: the gap it closes was created by the cumulative absence of a project-wide provisioning step (a schema-level grant), not by a defect in any one Epic's own DDL. Both migrations are dated and named outside any Epic's own numbering (`infra_*` prefix, not `epicN_*`) specifically so this category of change stays visibly separate from Epic-scoped work, consistent with the precedent this task's own constraints ("do not modify any Epic") are protecting.

---

## 5. Why RLS remains the enforcement layer

Granting `USAGE`/`SELECT` changes *whether a request reaches the database's row-visibility logic at all* — it does not participate in *deciding what that logic returns*. The 9 `SELECT` policies Epic 9 deployed are unchanged, unremoved, and un-widened by this migration; they remain the only mechanism that decides, per row, whether a given `authenticated` caller (a `manager` scoped to `tenant_id = current_tenant_id()`, a `reception` role similarly scoped, a `platform_admin` gated by `is_platform_admin()`/`current_platform_admin_tier()`) sees that specific row. This migration's grants are a necessary but not sufficient condition for a read to succeed — RLS is the sufficient condition, exactly as `BACKEND_ARCHITECTURE.md` §12/§12.1/§13.6 specify ("RLS bypass only on `platform.*` schema tables," "an RLS policy branch... not an application-only check"). Before this migration, RLS was correct but unreachable; after it, RLS is correct and reachable — its role in the security model, and its content, are identical in both states.

---

## 6. Known follow-up (not applied — out of this task's scope)

`config.toml`'s `[api] schemas` list still does not include `platform` or `jobs`. Until that separate, non-migration change lands, PostgREST's own routing layer rejects every request to these schemas with `PGRST106` before Postgres is ever reached — this migration's grants are correct and inert until that happens, exactly as `20260728000001`'s own precedent already demonstrated for `reports`/`billing` earlier in this project. This was explicitly out of scope for the current task (grants only, no config change requested) and is noted here for visibility, not remediated.

Stopping per instruction — no further change made after creating the migration and this report.
