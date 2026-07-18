# Epic 8 Permission Investigation — `permission denied for schema reports` (42501)

Scope: a source-only investigation into the root cause of `EPIC_8_DEPLOYMENT_AUDIT_FINAL.md`'s finding that direct REST/RPC calls into the `reports` schema return Postgres error `42501 permission denied for schema reports`. Per instruction, this investigation reads and greps migration files only — **no SQL was executed, no live database was queried, and no file was modified.** All evidence below is either a direct grep/read result from the repository's own migration files, or established, general knowledge of Supabase's platform behavior, clearly labeled as such.

---

## Root cause

**Root cause: Supabase platform defaults, not a migration defect.**

No migration in this repository — Epic 1 through Epic 8, without exception — ever issues a schema-level privilege statement (`GRANT USAGE ON SCHEMA`, `GRANT ALL ON SCHEMA`, or `ALTER DEFAULT PRIVILEGES ... IN SCHEMA`) for *any* custom schema. Supabase's platform automatically sets up API-role privileges (`USAGE` on the schema, plus default `SELECT`/`INSERT`/etc. grants for future objects) only for the `public` schema at project creation; it does **not** do the same for any additional schema a project creates later, regardless of whether that schema is subsequently added to `[api] schemas`. Every one of this project's schemas — `tenancy`, `identity`, `platform`, `jobs` (Epic 1), `academic` (Epic 2), `transport`/`safety` (Epic 3), `comms` (Epic 4), `approvals` (Epic 5), `billing` (Epic 6), `media` (Epic 7), and `reports` (Epic 8) — was created with a bare `create schema if not exists <name>;` and never received a corresponding schema-level `GRANT`. `reports` is not a special case; it is the twelfth schema in this codebase to be created this way, and the first whose live-database behavior was actually tested against a real HTTP request after being added to the exposed-schemas list — which is why this gap was only discovered now, on Epic 8, rather than being found (and presumably fixed the same way) back at Epic 2 or Epic 6.

This was invisible until this point in the project's history for a specific, verifiable reason (see "Why this was never seen before Epic 8" below): every custom schema, for every prior Epic, was *also* never exposed via a successful `config push` until the same session that fixed Epic 8's `PGRST106` finding — so PostgREST rejected every direct request to any custom schema at the routing layer, before ever reaching the database's own permission check that would have surfaced this exact `42501` error. The schema-exposure fix didn't introduce this problem; it removed the earlier, broader block that had been masking it since Epic 1.

---

## Evidence

### 1. Whether any Epic 8 migration contains `GRANT USAGE ON SCHEMA reports`

```
grep -rin "grant usage on schema" backend/supabase/migrations/
→ No matches found (searched all 54 migration files, all Epics)

grep -rin "grant.*schema|alter default privileges|grant all on schema" backend/supabase/migrations/
→ No matches found
```

**No Epic 8 migration contains this statement.** `20260727000001_epic8_reports_schema.sql` (the migration that creates the `reports` schema) contains only:

```sql
create schema if not exists reports;
```

with two enum-creation statements and a set of `comment on type` statements following it — no `GRANT` of any kind, schema-level or otherwise.

### 2. Whether previous Epics granted `USAGE` on their own schemas

Every schema-creation statement in the repository, found via `grep -rn "create schema" backend/supabase/migrations/`:

| Migration | Schemas created |
|---|---|
| `20260714000001_epic1_schemas_and_extensions.sql` | `tenancy`, `identity`, `platform`, `jobs` |
| `20260715000001_epic2_academic_schema.sql` | `academic` |
| `20260717000001_epic3_transport_schema.sql` | `transport`, `safety` |
| `20260719000001_epic4_comms_schema_and_conversations.sql` | `comms` |
| `20260721000001_epic5_approvals_schema.sql` | `approvals` |
| `20260723000001_epic6_billing_schema.sql` | `billing` |
| `20260725000001_epic7_media_schema.sql` | `media` |
| `20260727000001_epic8_reports_schema.sql` | `reports` |

Full read of `20260714000001_epic1_schemas_and_extensions.sql` (Epic 1's own schema-bootstrap migration, reproduced in relevant part):

```sql
create schema if not exists tenancy;
create schema if not exists identity;
create schema if not exists platform;
create schema if not exists jobs;

comment on schema tenancy is 'Epic 1 — tenants, plans, provisioning workflow, phone registry.';
comment on schema identity is 'Epic 1 — staff/guardian/driver/platform_admin profiles, machine identities.';
comment on schema platform is 'Cross-cutting platform-operations tables. Epic 1 introduces audit_log only.';
comment on schema jobs is 'Cross-cutting job/queue tables. Epic 1 introduces idempotency_keys only.';
```

No `GRANT` statement follows. **Every other Epic's own schema-creation migration follows the identical shape** (confirmed via the same grep above returning zero matches project-wide) — a bare `create schema if not exists`, sometimes followed by a `comment on schema`, never by a privilege grant. This is a completely uniform convention across the whole codebase: **zero of the twelve schemas created across Epic 1–8 has ever had schema-level `USAGE` granted anywhere in migration history.** Epic 8 did not deviate from, weaken, or omit something the other Epics had — it followed the exact same (incomplete, in hindsight) pattern every prior Epic already established.

What *every* Epic's migrations do consistently instead is grant privileges at the **table** and **function** level only — e.g. `revoke all on function public.send_report_draft from public; grant execute on function public.send_report_draft to authenticated;` (Epic 8, migration 5) and equivalent per-function grants in every other Epic's own RPC-definition migrations. None of these lower-level grants substitute for the missing schema-level `USAGE`: in Postgres, a role needs `USAGE` on a schema before any object-level privilege inside that schema can be exercised via a schema-qualified reference — which is exactly the mechanism PostgREST uses when a client sets `Accept-Profile`/`Content-Profile` to a non-`public` schema.

### 3. Whether Supabase automatically grants schema `USAGE` for custom schemas

This is Supabase platform behavior, not something queryable from this repository's own files — stated here as documented/established platform knowledge, not verified via a live query in this investigation (per the "do not execute SQL" instruction):

- Supabase provisions the `anon`, `authenticated`, and `service_role` Postgres roles with `USAGE` on the `public` schema (and appropriate default privileges for objects created there) as part of its own project-bootstrapping process, which runs once, outside of and prior to any user-authored migration.
- Supabase does **not** perform the equivalent setup for any schema a project creates afterward. Adding a schema to `[api] schemas` (or the Dashboard's "Exposed schemas" setting) only changes what PostgREST is willing to *route requests to* — it is documented by Supabase itself as a separate step from granting the underlying Postgres role privileges, which remains the project owner's own responsibility via an explicit `GRANT USAGE ON SCHEMA ... TO anon, authenticated, service_role;` (and, typically, matching `ALTER DEFAULT PRIVILEGES` for future objects, or explicit per-object grants as this project already does).
- This directly matches this investigation's own migration-history evidence (§1–§2): every schema in this project needed that manual step and never received it, and it directly matches `EPIC_8_DEPLOYMENT_AUDIT_FINAL.md`'s live finding that the *same* `42501` error reproduces identically on `billing` (Epic 6, frozen, unrelated to Epic 8) — a schema that has been "deployed" the longest of any in this project and still lacks the grant.

### 4. Whether this is an incorrect assumption in the deployment audit

No. `EPIC_8_DEPLOYMENT_AUDIT_FINAL.md`'s diagnosis is accurate and is corroborated, not contradicted, by this investigation: it correctly identified `42501 permission denied for schema reports` as a distinct, Postgres-role-privilege-layer issue (separate from the `PGRST106` schema-exposure issue it had previously flagged and confirmed resolved), correctly traced which call paths are affected (direct `reports`-schema calls) versus unaffected (the five `public`-schema `SECURITY DEFINER` RPCs, which run under their owning role's privileges rather than the caller's), and correctly used the `billing`-schema control test to establish the issue is project-wide rather than Epic-8-specific. This investigation's only addition is the *migration-history* confirmation of *why* the grant is missing — it does not revise or correct anything the deployment audit concluded.

### Why this was never seen before Epic 8

`EPIC_8_DEPLOYMENT_AUDIT.md` (the first live audit) empirically tested `Accept-Profile: billing` against the live project *before* the `config.toml` fix was pushed, and it returned `406 PGRST106 — Only the following schemas are exposed: public, graphql_public` — proving that no custom schema, including Epic 6's `billing`, had ever been successfully exposed via `config push` before that point in this project's history. A request that never reaches the database at all (rejected at PostgREST's own routing layer) can never surface a database-level `42501` permission error. Once the exposure gap was fixed and pushed, requests to `reports` (and, by the same evidence, every other custom schema) began reaching Postgres for the first time — which is the first moment this pre-existing, always-latent missing-grant gap could possibly have been observed. It is not a regression caused by the exposure fix; it is a second, independent layer of the same underlying "schemas were never fully API-provisioned" condition, one layer beneath the one already fixed.

---

## Correct remediation

Grant `USAGE` on the `reports` schema (and, per this same evidence, on every other custom schema this project intends to expose — `tenancy`, `identity`, `academic`, `transport`, `safety`, `comms`, `approvals`, `billing`, `media` — since all twelve share the identical gap) to the Postgres roles PostgREST connects as:

```sql
grant usage on schema reports to anon, authenticated, service_role;
```

Notes on scope, for whoever applies this:

- **Which roles actually need it for Epic 8 specifically**: only `service_role` (used internally by `ai-draft-report`/`ai-polish-note`'s `admin.schema('reports')` calls) and, if any client-side code is ever expected to query `reports.*` tables directly under a logged-in user's own session, `authenticated`. `anon` has no legitimate reason to reach anything in `reports` — no RLS policy in this schema grants `anon` any access, and `FORCE ROW LEVEL SECURITY` is already set on all three tables, so granting `anon` schema `USAGE` alone would not expose any row (RLS still returns zero rows) — but including it matches the uniform three-role grant pattern this project already uses for every function-level grant elsewhere (e.g. `write_audit_log`, `idempotency_replay`), for consistency rather than necessity.
- **Where this belongs**: per this project's own established convention (each Epic's own migration file owns the privilege statements for the objects it creates), the natural home for this statement is a new, additive migration — this investigation does not create one, per this turn's explicit "do not generate any migration" instruction.
- **Whether the same fix is needed for Epic 1–7's schemas**: yes, per §2–§3 above — this is not an Epic-8-only gap. Remediating only `reports` would resolve Epic 8's own blocker but leave the identical, already-confirmed-live `42501` condition on `billing` (and, by the same unexamined-but-consistent pattern, every other custom schema) unresolved. Whether to fix all of them in the same change or scope this narrowly to Epic 8 is a decision for whoever authors the remediation, not this investigation.
