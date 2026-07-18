# Architecture Reconciliation Report: §12, §12.1, §13.6, §34

Analysis of `BACKEND_ARCHITECTURE.md` only. No code, migration, configuration, or deployment inspected or modified.

---

## 1. Section-by-section reading

### §12 — Permission Matrix

**Quote** (matrix note, following the "Activity log / Audit log / Service health" rows): *"Platform Admin **never** gets blanket R on tenant operational data (children's health notes, chat contents, evaluation details) — support access is limited to what's needed for billing/technical support (tickets, service health, tenant metadata, payment reconciliation), **enforced by giving Platform Admin RLS bypass only on `platform.*` schema tables and the specific cross-tenant support views**, not a global bypass role. This is a deliberate privacy boundary, not an oversight."*

**Intent**: this is a *scope-limiting* statement about the Platform Admin role's ceiling of access — it exists to rule out a global/superuser-style bypass, not to grant one. The mechanism it names for enforcing that ceiling is RLS ("RLS bypass only on `platform.*`"), and it draws the boundary at the schema level: `platform.*` and the dedicated cross-tenant views, nothing tenant-operational.

**Classification**: **Platform administration** (defines what the `platform_admin` role may see) expressed through a statement about **runtime implementation** (names RLS as the mechanism). Not about end-user application access (this is Platform Admin, not a tenant-facing role) and not directly about infrastructure/transport (it does not say *how* a request physically reaches this data — PostgREST, an Edge Function, or otherwise).

---

### §12.1 — Platform Admin sub-role matrix

**Quote** (footer, after the `owner`/`admin` vs. `support` tier table): *"Enforced the same way as every other role split in this document: **an RLS policy branch keyed on `current_platform_admin_tier()`** (a `SECURITY DEFINER` helper reading `platform_admins.role`, same pattern as §13.1), **not an application-only check**."*

**Intent**: this is the most specific and most consequential sentence in the four sections under review. It states, as an explicit design principle, that tier differentiation (`owner`/`admin` vs. `support`) must be expressed *declaratively inside an RLS policy*, and explicitly rules out the alternative of enforcing it as *application logic* (i.e., a hand-written `IF` check inside a function body). It also anchors this to §13.1's "same pattern as every other role split in this document" — i.e., this is not a platform-specific exception; it's the same mechanism used everywhere else in the system.

**Classification**: **Platform administration**, expressed as a **runtime implementation** requirement — and it is explicit and exclusionary about the mechanism: RLS policy, not application-layer authorization. This sentence is in direct tension with any design where the *only* way to reach this data is a `SECURITY DEFINER` function/Edge Function that re-implements tier logic in code (§14.3 confirms every RPC in this system does exactly that: *"Every RPC validates the caller's role/tenant inside the function body... never trusts that RLS alone is sufficient"* — i.e., RPCs are, by this document's own convention, application-only checks, the exact thing §12.1 says tier enforcement must *not* be).

---

### §13.6 — Platform Admin bypass scope

**Quote**: *"`platform_admin` role has RLS policies **only** added on: `tenants`, `tenant_billing_transactions`, `plan_catalog`, `plan_catalog_apps`, `support_tickets`, `service_health_status`, `audit_log` (all tenants), `announcements` (platform-scoped rows only), `service_accounts` (read-only, support context), and the dedicated cross-tenant support views. It has **no policy at all** (hence no access) on tenant operational tables like `children`, `messages`, `evaluations` — absence of a policy is a hard deny under RLS, which is the correct default for privacy. Within this bypass scope, write policies additionally branch on `current_platform_admin_tier()` per §12.1..."*

**Intent**: the detailed implementation of §12's boundary — an explicit, table-by-table enumeration of exactly where `platform_admin` gets an RLS policy at all, contrasted against tables where the *absence* of a policy is itself the security control. This is a table-level design document, not a summary.

**Classification**: **Platform administration**, **runtime implementation** (RLS policy enumeration). Same register as §12.1 — this section only makes sense as a description of a live, table-level RLS policy set that something actually queries against. It is the most granular, most specific of the four sections regarding *which platform.* tables* carry a human-role-reachable policy — a level of detail with no purpose if the answer to "how is `platform.*` ever queried" is "it isn't, everything goes through a service-role-executed function instead."

---

### §34 — Supabase Project Structure, "API exposure" bullet

**Quote**: *"**API exposure**: PostgREST auto-API is enabled on client-facing schemas (`academic`, `approvals`, `transport`, `safety`, `billing`, `comms`, `media` — read/write per RLS) and **disabled/excluded** on `platform`, `jobs`, and the machine-identity-relevant parts of `identity` (`service_accounts`) from the public API surface entirely (`db.schema` config), reachable only via `service_role`-executed Edge Functions/RPCs — an extra belt-and-suspenders layer beyond RLS for the most sensitive schemas."*

**Intent**: a project-provisioning checklist entry — part of a list that also covers Auth configuration, DNS/TLS, Storage, Realtime, and CORS. Its purpose is to state, at the infrastructure-configuration level, which schemas PostgREST's own request router will accept a client request against at all, independent of what RLS would otherwise decide once a request arrived.

**Classification**: **Infrastructure** — specifically, the PostgREST/`db.schema` routing-layer configuration for the Supabase project. This is the only one of the four sections that speaks to *transport/reachability* rather than *row-level authorization*. It groups `platform`/`jobs` with `service_accounts`, which is unambiguously **internal service access only** (machine identities, §13.7 — no human role ever reads `service_accounts` directly, confirmed by §12's own matrix showing only "R (support only)" for Staff/Driver accounts and no `service_accounts` row for any tenant-facing role at all).

---

## 2. Genuine contradiction, or different access paths?

**A genuine contradiction — not merely two descriptions of different paths to the same place.**

The test for "different access paths, not a contradiction" would be: does some *other* channel exist, named in the documents, through which a `platform_admin`'s own authenticated session could still reach the RLS policies §12/§12.1/§13.6 so carefully define, consistent with §34's exclusion of direct PostgREST access? That would require a **read RPC or read-oriented Edge Function** for `activity_log`, `audit_log`, `support_tickets`, `service_health_status`, `tenant_billing_transactions`, or `scheduled_job_runs` — the kind of wrapper `EPIC_9_ARCHITECTURE_DECISION.md` sketched under its "Option B" heading.

**No such RPC or Edge Function is named anywhere in `BACKEND_ARCHITECTURE.md` or `BACKEND_EXECUTION_PLAN.md`.** §14.2's full contract catalog — every RPC and Edge Function in the entire system, across all eleven business domains plus machine identities — contains zero read/list operations for any table in any schema, not just `platform`. Epic 9's own execution-plan entry (`BACKEND_EXECUTION_PLAN.md`, "Epic 9 — Platform Operations & Admin Console") lists, under "Edge Functions Required": *"None new beyond what already exists — this Epic is primarily **read-surface** and RPC work on top of already-live write paths"* — explicitly calling Epic 9 a "read-surface" Epic while naming **zero** new Edge Functions to serve that surface, and its "RPC Functions Required" section names only *write* RPCs (support ticket CRUD, billing transaction issue/refund). If §34's exclusion were the intended design, Epic 9's own execution-plan entry would need to name the read-serving Edge Functions/RPCs that make its own "read-surface" claim possible — it does not, anywhere.

This absence is decisive: it is not that two valid paths exist and the documents describe each from a different angle. It is that **§12/§12.1/§13.6 assume a path exists (direct RLS-gated access) that §34, read literally, forecloses — and no alternative path is ever documented to fill the resulting gap.** That is a contradiction, not a difference in framing.

---

## 3. The single correct architecture

Weighing the evidence:

1. **§14's systemic pattern.** *"Supabase's auto-generated PostgREST API + client SDK covers the majority of CRUD directly against tables/views under RLS — no bespoke REST layer is needed for straightforward CRUD."* (§14) This is stated as a property of the *whole system*, and the RPC catalog (§14.2) that follows it contains not one read operation, for any table, anywhere. `platform.*` would have to be the single, silent exception to this rule — and nothing marks it as an exception the way, say, `service_accounts` is explicitly marked (§13.7: *"RLS is not the authorization mechanism for this path"* — a clear, explicit callout that machine identities work differently. No equivalent callout exists for `platform.*`.).

2. **§12.1's explicit mechanism requirement.** *"An RLS policy branch... not an application-only check."* This is not merely descriptive; it is prescriptive and exclusionary. A design where `platform.*` reads are "reachable only via service_role-executed Edge Functions/RPCs" (§34) necessarily makes them application-only checks by this document's own §14.3 convention (*"Every RPC validates the caller's role/tenant inside the function body"*) — directly violating §12.1's stated requirement.

3. **Revision markers.** §12.1 and §13.8 both explicitly flag themselves as corrections to an earlier "v0 draft" (*"resolving the gap where the v0 draft's schema implied three tiers... but the permission matrix never differentiated them"*; *"This closes the gap in the v0 draft..."*). This is textual evidence that §12/§12.1's Platform Admin design was deliberately revisited and tightened at a later authorial pass. §34's API-exposure bullet carries no such marker — nothing indicates it was reconciled against the later, more detailed platform.* RLS design. It reads as an earlier, coarser generalization (schema separation → "internal schemas aren't client-exposed") that was never revisited once Epic 9's specific, human-role-facing RLS policies were designed in detail.

4. **Internal consistency of §34 itself.** §34 groups `platform`/`jobs` with `service_accounts` under one exclusion rule. `service_accounts` genuinely has no human-role RLS policy anywhere (§12's matrix: only "R (support only)" — itself served through `platform_admin`'s bypass scope, not a direct tenant-facing policy) and is explicitly, separately documented as bypassing RLS entirely for machine callers (§13.7). `jobs` is *almost* the same story — `background_job_queue`/`idempotency_keys` have no human-facing policy at all, consistent with exclusion. But `platform` is not: it carries 5 tables and 9 policies engineered specifically for `manager`, `reception`, and `platform_admin` (at both tiers) to read directly. Grouping `platform` with `service_accounts` overgeneralizes from "these schemas hold sensitive, mostly-internal data" to "therefore none of it should ever be client-reachable" — without accounting for the fact that some of `platform.*`'s tables were deliberately built with a human-role read surface that `service_accounts` was never given.

**The single correct architecture is Option A**: direct PostgREST reads against `platform.*` (activity_log, audit_log, service_health_status, support_tickets, tenant_billing_transactions) and `jobs.scheduled_job_runs`, gated by the RLS policies §12/§12.1/§13.6 specify — the same read model used by every other schema in the system. §34's "disabled/excluded on `platform`, `jobs`" clause is the incorrect, stale outlier; it correctly excludes `service_accounts` and the two purely-internal `jobs` tables (`background_job_queue`, `idempotency_keys` — which never had a human-facing RLS policy to begin with, so their exclusion from PostgREST doesn't contradict anything), but incorrectly over-extends that exclusion to the `platform` schema as a whole and to `jobs.scheduled_job_runs` specifically.

---

## 4. Resolution

**Authoritative requirement**: §12, §12.1, and §13.6, taken together with §14's systemic "PostgREST + RLS is the universal read path, RPC is reserved for writes" pattern and the complete absence of any documented read-RPC/Edge-Function anywhere in either document. These sections are more specific, more recently revised (per their own "correction from v0 draft" markers), and directly prescriptive about mechanism (§12.1's "not an application-only check"), whereas §34's exclusion clause is a single, unrevised, over-generalized line in a project-provisioning checklist that groups `platform` incorrectly with genuinely-internal-only schemas.

**Is the current live deployment correct?** Yes — for `platform.activity_log`, `platform.audit_log`, `platform.service_health_status`, `platform.support_tickets`, `platform.tenant_billing_transactions`, and `jobs.scheduled_job_runs`, the deployed state (schema exposure in `config.toml`, `authenticated` `USAGE`/`SELECT` grants, RLS policies and `FORCE ROW LEVEL SECURITY` unchanged) matches the authoritative sections' design exactly: RLS-policy-gated direct reads, reachable, with no write path opened and no RPC/Edge Function/policy touched. The deployment also correctly *withheld* any grant on `jobs.background_job_queue`/`jobs.idempotency_keys` — which is the right call under *either* reading of §34, since neither table has a human-facing policy regardless of which side of the contradiction is authoritative.

**Should the infrastructure-hardening migrations remain, or be reverted?** They should **remain**. `20260728000001_infra_schema_usage_grants.sql` and `20260730000001_infra_platform_reads_authenticated_grants.sql`, together with the `config.toml` schema-exposure change, implement exactly the access model §12/§12.1/§13.6 specify and that this reconciliation finds authoritative. Reverting them would restore the state audited as "Blocker 1" in `EPIC_9_DEPLOYMENT_AUDIT.md` — RLS policies that are correctly written but permanently unreachable by the roles they were built for — which is the actual defect, not the corrected state. §34's exclusion clause is the artifact that should be corrected (a documentation fix: narrowing its `platform`/`jobs` exclusion to name only `service_accounts` and the two genuinely-internal `jobs` tables), not the deployment.

---

## 5. Summary

| Section | Governs | Access path described | Authoritative for `platform.*` reads? |
|---|---|---|---|
| §12 | Platform administration | RLS-enforced scope ceiling | Yes |
| §12.1 | Platform administration | RLS policy branch, explicitly not an application-only check | Yes |
| §13.6 | Platform administration | Table-by-table RLS policy enumeration | Yes |
| §34 | Infrastructure (PostgREST routing) | Exclusion from public API, service-role-only | No — stale over-generalization, correct only for `service_accounts` and the two internal `jobs` tables |

**CURRENT DEPLOYMENT IS CORRECT**
