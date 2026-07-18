# Epic 9 Architecture Decision: Platform Admin Read Path

Analysis only — no code, migration, or config change made. Determines which of the two read architectures `BACKEND_ARCHITECTURE.md` actually specifies for `platform`/`jobs` data, and whether the live Epic 9 deployment follows it.

---

## 1. Which option the architecture specifies

**Option A — direct PostgREST reads against `platform`/`jobs` tables under RLS — is what `BACKEND_ARCHITECTURE.md` specifies.**

Evidence, in descending order of directness:

1. **§12, Permission Matrix note (line ~697)**: *"Platform Admin never gets blanket R on tenant operational data... enforced by giving Platform Admin RLS bypass only on `platform.*` schema tables and the specific cross-tenant support views, not a global bypass role."* This is the architecture stating outright that **RLS bypass on `platform.*` tables** is the authorization mechanism for Platform Admin reads. "RLS bypass" is meaningless as a concept for an RPC-only design — a `SECURITY DEFINER` function owned by a `bypassrls` role (as every Epic 9 RPC already is) bypasses RLS unconditionally regardless of any policy; you don't need a *scoped* RLS bypass if the read never touches RLS-governed tables directly. The doc is describing per-role table-level policies as the actual enforcement boundary.

2. **§12.1, sub-role matrix footer**: *"Enforced the same way as every other role split in this document: an RLS policy branch keyed on `current_platform_admin_tier()`... not an application-only check."* Again: an RLS **policy branch** is the stated enforcement mechanism, not an RPC's internal `IF` logic.

3. **§14, API Contracts (line 768)**: *"Supabase's auto-generated PostgREST API + client SDK covers the majority of CRUD directly against tables/views under RLS — no bespoke REST layer is needed for straightforward CRUD."* RPC/Edge Function use is then scoped narrowly to three specific cases (§14.1): multi-table transactions, a controlled write outside RLS, and external-service calls. **Reading a single table's own rows is none of these three cases.**

4. **§14.2, the full RPC/Edge Function catalog** lists roughly 35 contracts across all 11 business domains (provisioning, academic, approvals, transport, safety, billing, communication, machine identities) — **every single one is a write or a multi-step transaction. Not one read/list RPC exists anywhere in the entire catalog**, for any table in any schema, not just `platform`. If `platform` were meant to be the one schema in the system read through bespoke RPCs, §14.2 would need to name those RPCs the same way it names every write RPC — it doesn't, because no such convention exists anywhere else to extend.

5. **§27 (Scheduled jobs)**: *"...a run-history table (`jobs.scheduled_job_runs`...) so failures are observable... this is what Platform Admin's 'system health' view partially surfaces."* A UI screen "surfacing" a table's rows, with no RPC named for it anywhere, is direct-read phrasing.

6. **§2.1 (schema table intro), line 957 (tenant billing)**: mentions *"a separate set of platform-only views that intentionally span tenants (`platform.v_tenant_billing_summary`, `platform.v_tenant_health_summary`) and are only reachable via the `platform_admin` role's RLS bypass grant."* Views + RLS bypass grant is, again, a direct-PostgREST-read design (a view is a PostgREST-queryable object, not an RPC).

**The one piece of counter-evidence** — §2.1's schema-list rationale (line 135): *"schema separation gives clean `GRANT` boundaries between the Supabase `service_role` (jobs schema, platform schema) and client-exposed schemas."* Read in isolation this sentence groups `platform` with `jobs` as non-client-exposed. But this is a one-line rationale for *why schemas are split at all* (grant hygiene, RLS-file-per-schema organization, `db diff` readability at scale) — a design-process justification, not a statement that `platform` has zero client SELECT surface. It sits in tension with the five points above, all of which are specific, load-bearing statements naming `platform.*` RLS policies as the actual read-authorization mechanism. Weighed against §12/§12.1's explicit "RLS policy branch is the enforcement mechanism" language and the total absence of any read-RPC convention anywhere in the document, **§2.1's phrasing is best read as being about default write-grant posture (protecting against unauthorized direct writes, which RLS + selective `SELECT`-only grants already handle safely) rather than a blanket prohibition on read exposure.** It should be treated as an internal documentation inconsistency to flag, not as overriding the specific, repeated, unambiguous statements elsewhere that RLS-gated direct reads are how Platform Admin sees this data.

`jobs` itself has no equivalent §12.1-style justification for client reads at all — only `jobs.scheduled_job_runs` has a client-facing role (Platform Admin, via §27's "system health view"); `jobs.background_job_queue` and `jobs.idempotency_keys` have no permission-matrix entry, no RLS policy for any human role, and no doc passage describing either as client-visible. They are correctly internal-only under either option.

**Conclusion: Option A, scoped specifically to `platform.*` (all 5 tables) and `jobs.scheduled_job_runs` only** — not a blanket exposure of the entire `jobs` schema.

---

## 2. Does Epic 9 currently follow that architecture?

**No — it implements half of Option A and completes neither option.**

What Epic 9 *did* build, matching Option A exactly:
- Per-role `SELECT` RLS policies on all 6 tables (`activity_log_select_manager`/`_reception`, `audit_log_select_manager_own_tenant`/`_platform_admin`, `service_health_status_select_platform_admin`, `support_tickets_select_manager`/`_platform_admin`, `tenant_billing_transactions_select_platform_admin`, `scheduled_job_runs_select_platform_admin`) — this is precisely the "RLS policy branch" mechanism §12/§12.1 describe.
- `FORCE ROW LEVEL SECURITY` on every table, so even a privileged connection can't bypass these policies by accident.

What Epic 9 *did not* complete, which Option A also requires:
- `platform` is **not** in `config.toml`'s `[api].schemas` list.
- `jobs` is **not** in `config.toml`'s `[api].schemas` list.
- `authenticated` has **no `USAGE` grant** on either schema (confirmed live: `has_schema_privilege('authenticated', 'platform', 'USAGE')` = `false`).
- No table-level `SELECT` grant to `authenticated` exists on any of the 5 `platform` tables or `jobs.scheduled_job_runs` (only `service_role` holds table grants, from the earlier infrastructure-hardening migration's schema-wide `GRANT USAGE`, which was scoped to `service_role` only).

PostgREST requires **all four gates** open for a read to succeed: (1) schema in `config.toml`'s exposed list, (2) schema `USAGE` grant, (3) table-level `SELECT` grant, (4) an RLS policy that evaluates to true for the row. Epic 9 built gate 4 correctly and left gates 1–3 closed. The result is not "Option B in practice" either — no read RPC was ever built as an alternative path. It is an **incomplete Option A**: the authorization logic is correct and deployed, but nothing can reach it.

This matches and confirms `EPIC_9_DEPLOYMENT_AUDIT.md`'s Blocker 1 finding from the prior audit, now explained architecturally rather than just observed structurally.

---

## 3. Since Option A is correct: exactly which schemas/grants are needed

Four changes close the gap — no RLS policy needs to change; the policies already match the target design.

1. **`config.toml` → `[api].schemas`**: add `"platform"` and `"jobs"` to the existing list (`public, tenancy, identity, academic, transport, safety, comms, approvals, billing, media, reports`).
2. **Schema `USAGE` grant**: `GRANT USAGE ON SCHEMA platform TO authenticated;` and `GRANT USAGE ON SCHEMA jobs TO authenticated;`.
3. **Table-level `SELECT` grants — scoped, not blanket**:
   - `GRANT SELECT ON platform.activity_log, platform.audit_log, platform.support_tickets, platform.service_health_status, platform.tenant_billing_transactions TO authenticated;`
   - `GRANT SELECT ON jobs.scheduled_job_runs TO authenticated;`
   - **Deliberately omit** `jobs.background_job_queue` and `jobs.idempotency_keys` from any `authenticated` grant — exposing the `jobs` schema in `config.toml` does not, by itself, make these two tables readable, since PostgREST also requires the table-level grant (step 3) and neither table has any RLS policy for a human role (§12 has no permission-matrix row for either). Leaving their grant absent keeps them a hard deny at the grant layer, on top of the existing RLS hard deny — defense in depth, matching the "internal-only, no legitimate direct caller" precedent already established for `safety.pickup_scan_rate_limits`/`platform.notification_outbox` in Epic 3.
4. **No RLS policy change** — the 9 existing `SELECT` policies across the 6 tables already implement exactly the per-role/per-tier boundary §12/§12.1/§13.6 specify. Opening gates 1–3 is sufficient; gate 4 is already correct.

This is a `config.toml` + `GRANT` change only — no migration is required for the grants (a plain SQL `GRANT` statement, run once, is not schema-shape-changing DDL in the same sense as a table/column/constraint change, though the team may still choose to land it as a migration for reproducibility). Not applied here per this task's explicit "do not modify code / do not create migrations" instruction.

---

## 4. If Option B were chosen instead (for completeness, not a recommendation)

Not architecturally supported by the evidence in §1, but since the alternative was posed: closing the same gap via Option B would require building 6 new read RPCs with no existing convention or precedent anywhere in `BACKEND_ARCHITECTURE.md`/`BACKEND_EXECUTION_PLAN.md` to model them on:

- `list_activity_log(p_cursor, p_limit)` — manager/reception, own tenant.
- `list_audit_log(p_cursor, p_limit, p_tenant_id?)` — manager (own tenant) / platform_admin (all, optional tenant filter).
- `list_support_tickets(p_cursor, p_limit, p_status?)` — manager (own tenant) / platform_admin (all).
- `get_service_health()` — platform_admin only.
- `list_tenant_billing_transactions(p_tenant_id, p_cursor, p_limit)` — platform_admin only.
- `list_scheduled_job_runs(p_job_name?, p_cursor, p_limit)` — platform_admin only.

Each would need to re-derive, in PL/pgSQL, the exact per-role/per-tier filtering the 9 RLS policies already express declaratively — duplicating logic that already exists and is already deployed, and diverging from every other domain in the system, none of which has an equivalent read-RPC layer. This option is listed only because it was asked for, not because the evidence supports it.

---

## 5. Summary

| Question | Answer |
|---|---|
| Which option does `BACKEND_ARCHITECTURE.md` specify? | **Option A** — direct PostgREST/RLS reads, matching the universal pattern used for every other schema in the system (§12, §12.1, §13.6, §14) |
| Does Epic 9 currently follow it? | **No** — RLS policies (the enforcement layer) are correctly built and deployed; PostgREST exposure and grants (the reachability layer) were never completed |
| What's missing, precisely? | `platform` + `jobs` in `config.toml`'s `[api].schemas`; `USAGE` grant on both schemas to `authenticated`; `SELECT` grant to `authenticated` on the 5 `platform` tables + `jobs.scheduled_job_runs` only (not `background_job_queue`/`idempotency_keys`) |

Stopping per instruction — no code, config, or migration change applied.
