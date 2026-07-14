# Epic 1 Deployment & Validation Guide

**Purpose:** Take the Epic 1 codebase in `backend/` (already implemented — see `EPIC_1_COMPLETION_REPORT.md`) and validate it end-to-end against a **real, provisioned Supabase project**. This document is procedure only — no code, no schema, no feature changes. Nothing in `backend/` should be edited while following this guide; if a step reveals a real defect, stop and report it rather than patching in place.
**Scope:** Epic 1 only (Foundation & Platform Bootstrap). Do not apply anything from Epic 2 onward.
**Audience:** Whoever holds Supabase project-owner credentials and runs the actual deployment — this guide assumes zero prior context beyond having read `EPIC_1_COMPLETION_REPORT.md`.

---

## 1. Complete Supabase setup guide

### 1.1 Prerequisites
- A Supabase account with permission to create a new project (or access to an existing empty one reserved for this).
- Node.js ≥ 18 and npm (already required by `backend/package.json`).
- The Supabase CLI (installed per §1.3 below — do not assume it's globally present).
- For **local validation first** (strongly recommended before touching a real project): Docker Desktop running, since `supabase start` requires it.
- `psql` (or any Postgres client capable of running a `.sql` file) for the RLS adversarial suite — the Supabase CLI's bundled `db` commands cover migrations, but the RLS test script in `backend/tests/rls/` is run directly against the database connection string.

### 1.2 Create the Supabase project
1. In the Supabase dashboard, create a **new project** named `masar-staging` (this guide validates against staging first; production is a separate, later project per §16 — never validate directly against a production-labeled project).
2. Choose a region closest to the primary user base (Egypt-based, per `BACKEND_ARCHITECTURE.md` §31/§34) — pick the nearest available region at creation time; this cannot be changed later without migrating the whole project.
3. Record the project's **Project Reference ID**, **Project URL**, **anon key**, and **service_role key** from Project Settings → API. Treat the service_role key as a secret from the moment it's copied.
4. Enable **Point-in-Time Recovery** if the plan tier supports it (Project Settings → Database → Backups) — matches the backup posture `BACKEND_ARCHITECTURE.md` §31 requires, even for staging, so the procedure is exercised before production needs it.

### 1.3 Install and authenticate the CLI
```bash
npm install -g supabase
supabase --version        # confirm install
supabase login             # opens a browser for auth
```

### 1.4 Link the local `backend/` directory to the project
```bash
cd backend
supabase link --project-ref YOUR_PROJECT_REF
```
This does not push anything yet — it only associates the local `supabase/` folder with the remote project so subsequent `supabase db push` / `supabase functions deploy` commands know their target.

---

## 2. Required environment variables

| Variable | Where it's used | Source | Sensitivity |
|---|---|---|---|
| `SUPABASE_URL` | Edge Functions, `backend/src` Node code, `scripts/seed-dev-data.mjs`, frontend shim (`ui_kits/_shared/supabaseClient.epic1.js` via `window.__MASAR_ENV__`) | Project Settings → API → Project URL | Public — safe in client bundles |
| `SUPABASE_ANON_KEY` | Frontend/client-side auth calls | Project Settings → API → `anon` `public` key | Public — safe in client bundles |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (`_shared/supabaseAdmin.ts`), seed script | Project Settings → API → `service_role` key | **Secret** — server/Edge Function only, never in any client bundle, never committed |
| `MASAR_ENV` | Structured logging / audit context tagging | Set manually per environment (`local` / `staging` / `production`) | Non-sensitive |
| `ACTIVATION_LINK_BASE_URL` | `_shared/activation.ts` stub link generation | Set manually (`https://app.masar.app/activate` default) | Non-sensitive |
| `ALLOWED_ORIGINS` | Edge Function CORS (`_shared/cors.ts`) | Comma-separated list of the six portals' actual origins once hosted; `*` only acceptable for local dev | Non-sensitive but security-relevant — never leave as `*` past local validation |

### Setup steps
```bash
cd backend
cp .env.example .env.local
# Fill in .env.local with the values from §1.2 — this file is Node/local-tooling
# use (seed script, any ad-hoc scripts). It is already gitignored.
```

For deployed Edge Functions, secrets are set on the **project**, not read from `.env.local` (which never leaves your machine):
```bash
supabase secrets set ACTIVATION_LINK_BASE_URL=https://app.masar.app/activate
supabase secrets set ALLOWED_ORIGINS=https://dashboard.masar.app,https://parent.masar.app,https://teacher.masar.app,https://reception.masar.app,https://driver.masar.app,https://platform.masar.app
```
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are injected automatically into every deployed Edge Function by the platform — do **not** manually set these as secrets; doing so can shadow the platform-managed values and cause confusing failures.

---

## 3. Project configuration

`backend/supabase/config.toml` already encodes Epic 1's required configuration. Before deploying, verify it matches intent on the actual project dashboard (the CLI applies most of this on `supabase link`/`db push`, but Auth-specific settings below are dashboard-only for a hosted project):

| Setting | Where | Expected value | Why |
|---|---|---|---|
| API exposed schemas | Project Settings → API → Exposed schemas | `public`, `tenancy`, `identity` | Matches `config.toml [api] schemas` — `platform` and `jobs` must **not** be exposed (§34: belt-and-suspenders beyond RLS) |
| Phone auth provider | Authentication → Providers → Phone | Enabled | Primary login factor for all tenant-side roles (§10.1) |
| Phone signup | Authentication → Providers → Phone | **Disabled** (`enable_signup = false`) | Accounts are provisioned server-side only via `provision-tenant`/`add-staff`-style flows, never public self-signup (§10.3) |
| Email provider (for Platform Admin) | Authentication → Providers → Email | Enabled, signup disabled | Platform admins are invite-only, never self-registered |
| MFA — TOTP | Authentication → MFA | Enrollment + verification enabled | Required for `platform_admin` role (§28) |
| JWT expiry | Authentication → Settings | 3600s (1h) | Matches §10.5 |
| Refresh token rotation | Authentication → Settings | Enabled | Matches `config.toml [auth]` |
| Realtime | Database → Replication | `tenancy.tenants` present in `supabase_realtime` publication | Applied by migration 8 — verify it actually landed (see §12) |
| Storage | Storage | 4 buckets present (§8 below) | Applied by migration 8 |

---

## 4. CLI commands (reference list)

```bash
# --- one-time setup ---
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# --- local validation loop (repeat freely, Docker required) ---
supabase start                     # boots local Postgres/Auth/Storage/Realtime
supabase db reset                  # drops local DB, re-applies all migrations + seed.sql
supabase status                    # prints local URLs/keys for .env.local

# --- pushing to the real (staging) project ---
supabase db push                   # applies any migrations not yet on the remote project
supabase db push --dry-run         # preview what WOULD be applied — run this first

# --- Edge Functions ---
supabase functions deploy provision-tenant
supabase functions deploy suspend-staff-account
supabase functions deploy reactivate-staff-account
supabase functions deploy revoke-sessions
supabase functions deploy regenerate-activation-link
supabase functions list            # confirm all 5 are live

# --- secrets ---
supabase secrets list
supabase secrets set KEY=value

# --- logs / debugging ---
supabase functions logs provision-tenant --project-ref YOUR_PROJECT_REF

# --- teardown (local only — never run against a real project) ---
supabase stop
```

---

## 5. Migration execution order

Migrations are timestamp-ordered and **must be applied in this exact sequence** (the CLI does this automatically via `supabase db push`/`db reset`, but the dependency order is documented here because several later migrations reference objects the earlier ones create — applying out of order will fail):

| # | File | Depends on | Creates |
|---|---|---|---|
| 1 | `20260714000001_epic1_schemas_and_extensions.sql` | — | `tenancy`/`identity`/`platform`/`jobs` schemas, `pgcrypto`/`pg_net`, `set_updated_at()` |
| 2 | `20260714000002_epic1_tenancy_tables.sql` | 1 | `tenancy.*` tables + enums |
| 3 | `20260714000003_epic1_identity_tables.sql` | 1, 2 (FKs to `tenancy.tenants`) | `identity.*` tables + enums |
| 4 | `20260714000004_epic1_audit_and_idempotency.sql` | 1, 2 (FK to `tenancy.tenants`) | `platform.audit_log`, `jobs.idempotency_keys` |
| 5 | `20260714000005_epic1_rls_helpers.sql` | 3 (reads `identity.platform_admins`) | `current_tenant_id()`, `current_role()`, `current_platform_admin_tier()`, etc. |
| 6 | `20260714000006_epic1_rls_policies.sql` | 2, 3, 4, 5 (policies call the helpers, target every table) | RLS enabled/forced + all policies |
| 7 | `20260714000007_epic1_rpc_functions.sql` | 3, 4 (writes to `platform.audit_log`, `tenancy.tenant_provisioning_state`) | `write_audit_log`, `advance_tenant_provisioning`, idempotency RPCs |
| 8 | `20260714000008_epic1_storage_and_realtime.sql` | 5 (policies call the RLS helpers) | Storage buckets + policies, realtime publication |

**Do not skip, reorder, or squash these.** Run:
```bash
supabase db push --dry-run   # review the plan
supabase db push             # apply
```

---

## 6. Seed execution order

1. **`supabase/seed.sql`** — reference data only (`plan_catalog`, `plan_catalog_apps`). Applied automatically by `supabase db reset` locally. Against a real project, apply explicitly:
   ```bash
   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f supabase/seed.sql   # local
   # or, for a linked remote project:
   psql "postgresql://postgres:[DB-PASSWORD]@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" -f supabase/seed.sql
   ```
   Must run **after** migration 2 (needs `tenancy.plan_catalog` to exist) — in practice, after all 8 migrations since that's the only supported apply order.

2. **`scripts/seed-dev-data.mjs`** — demo tenant + platform admin + manager account, **staging/local only, never production**. Requires `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in the environment and the `provision-tenant` Edge Function already deployed (§7). Run only after step 1 and after Edge Functions are live:
   ```bash
   node scripts/seed-dev-data.mjs
   ```
   This creates real `auth.users` rows via the Admin API (never raw SQL inserts, per §10.3) — running it twice against the same project will fail on duplicate email/slug, which is expected and safe (not idempotent by design, since it's a one-time demo-data convenience script, not a production data path).

---

## 7. Edge Function deployment order

Functions have no cross-dependencies on each other, but deploy `provision-tenant` first since every other validation step (manual QA, seed script) needs a tenant + manager to exist before suspend/reactivate/revoke/regenerate can be exercised meaningfully:

```bash
supabase functions deploy provision-tenant
supabase functions deploy suspend-staff-account
supabase functions deploy reactivate-staff-account
supabase functions deploy revoke-sessions
supabase functions deploy regenerate-activation-link
supabase functions list        # confirm ACTIVE status on all 5
```

All five must be deployed **after** migrations 1–8 (they call RPCs and query tables that must already exist) and **after** secrets are set (§2) — a function deployed before its secrets are configured will fail at invocation time with a missing-env error, not at deploy time, so don't skip straight to testing without confirming `supabase secrets list` first.

---

## 8. Storage bucket creation order

Buckets are created by migration 8 (`insert into storage.buckets ...`), **not** a manual dashboard step — do not create them by hand first, or the migration's `on conflict (id) do nothing` will silently skip re-applying policies correctly if the bucket was created with different settings (e.g., wrong `public` flag).

Order (as applied by the migration, all in one transaction):
1. `public-branding` (public read)
2. `profile-photos` (private, tenant-scoped)
3. `identity-documents` (private, manager-only, tightest tier)
4. `generated-documents` (private, tenant-scoped read, server-write only)

**Verification:** Storage → Buckets in the dashboard should show exactly these 4, matching the `public`/private flags in the table above. If a bucket is missing, migration 8 did not complete — check `supabase db push` output for errors before re-running (re-running is safe; every statement is `on conflict do nothing` or idempotent).

---

## 9. Verification checklist

Run in order; each item should be a pass/fail with no ambiguity. Stop and investigate on the first failure rather than continuing past it.

- [ ] `supabase db push --dry-run` shows all 8 migrations, zero errors
- [ ] `supabase db push` completes with no errors
- [ ] `select schema_name from information_schema.schemata where schema_name in ('tenancy','identity','platform','jobs');` returns all 4
- [ ] `select count(*) from information_schema.tables where table_schema in ('tenancy','identity') ;` returns the expected table count (12 tables total across both schemas plus `platform.audit_log` and `jobs.idempotency_keys` — confirm via `\dt tenancy.*`, `\dt identity.*`, `\dt platform.*`, `\dt jobs.*` in `psql`)
- [ ] `supabase/seed.sql` applied — `select count(*) from tenancy.plan_catalog;` returns `3`; `select count(*) from tenancy.plan_catalog_apps;` returns `11`
- [ ] All 5 Edge Functions show `ACTIVE` in `supabase functions list`
- [ ] `supabase secrets list` shows `ACTIVATION_LINK_BASE_URL` and `ALLOWED_ORIGINS` set
- [ ] 4 storage buckets exist with correct public/private flags (§8)
- [ ] `select * from pg_publication_tables where pubname = 'supabase_realtime';` includes `tenancy.tenants`
- [ ] `node scripts/seed-dev-data.mjs` completes successfully and prints a tenant ID + manager account
- [ ] `npm run typecheck` and `npm test` still pass locally (regression check — confirms nothing about the deployed environment required code changes; if it did, that's a signal Epic 1 code has a real defect, not that this guide's steps are wrong)

---

## 10. RLS verification checklist

Primary tool: `backend/tests/rls/epic1_rls_adversarial.sql`. Run it now that a real database exists (this was explicitly deferred in `EPIC_1_COMPLETION_REPORT.md` for lack of an environment):

```bash
psql "postgresql://postgres:[DB-PASSWORD]@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" \
  -f backend/tests/rls/epic1_rls_adversarial.sql
```

Expect 8 `PASS` notices and a clean exit (the script wraps everything in `begin`/`rollback`, so it leaves no fixture data behind whether it passes or fails). A single `FAIL ...` line or an unhandled Postgres exception means stop — do not proceed to manual QA until every assertion passes.

Additional manual spot-checks beyond the scripted suite:
- [ ] As an anonymous (unauthenticated) client, confirm every Epic 1 table returns zero rows / a permission error — RLS should never expose data pre-auth.
- [ ] As a `manager` of Tenant A, confirm the Supabase client SDK's `select * from staff_profiles` returns **only** Tenant A rows even with no explicit `.eq('tenant_id', ...)` filter in the query — this is the RLS baseline doing its job silently, and it's worth confirming from the client side, not just via raw SQL role-switching.
- [ ] Confirm a `support`-tier platform admin **can** read `tenancy.tenants` (their read access must not be over-restricted) but **cannot** update/suspend one — both directions matter, not just the deny case.
- [ ] Confirm `tenancy.tenant_provisioning_state` and `tenancy.tenant_phone_registry` are completely inaccessible via the PostgREST API (`GET /rest/v1/tenant_provisioning_state` with any authenticated token should 401/403/empty) — these are `service_role`-only by design with zero policies.
- [ ] Confirm direct `POST /rest/v1/audit_log` (attempting to bypass `write_audit_log`) fails for every role, including `manager`.

---

## 11. Authentication verification checklist

- [ ] Phone provider enabled, signup disabled (§3) — attempting `supabase.auth.signUp({ phone })` from a client should fail; accounts only come from `provision-tenant`/future add-staff flows.
- [ ] Email provider enabled for Platform Admin, signup disabled.
- [ ] Run `node scripts/seed-dev-data.mjs` → confirm in the dashboard (Authentication → Users) that:
  - [ ] One user exists with `app_metadata.role = "platform_admin"` and a matching `identity.platform_admins` row (`role = 'owner'`).
  - [ ] One user exists with `app_metadata.role = "manager"` and `app_metadata.tenant_id` matching the seeded tenant's ID, with a matching `identity.staff_profiles` row.
  - [ ] **Neither user has a password set** — confirm via the dashboard that the account requires a magic-link/OTP-style first sign-in, not a pre-set password (this is the C7 no-plaintext-credential guarantee, now checked against a real Auth backend instead of just unit tests).
- [ ] Call `suspend-staff-account` for the seeded manager (as a manager caller — you'll need a second staff account or platform_admin token to invoke it against the manager, since a manager can't suspend themselves via this exact function per its own-tenant-manager-caller restriction; use a raw authenticated `service_role` call for this specific verification step if no second manager exists yet) → confirm:
  - [ ] `identity.staff_profiles.employment_status` flips to `terminated`
  - [ ] The manager's existing session (if one was active) is invalidated — test by holding a valid access token before suspension, then confirming it's rejected on the next authenticated request after suspension
  - [ ] A corresponding `platform.audit_log` row appears with `action = 'suspended_staff_account'`
- [ ] Call `reactivate-staff-account` → confirm `employment_status` returns to `active` and a second audit row appears.
- [ ] Call `revoke-sessions` independently of suspension → confirm a currently-valid session is invalidated without any `employment_status` change.
- [ ] Call `regenerate-activation-link` → confirm the Edge Function logs (`supabase functions logs regenerate-activation-link`) show the stubbed activation URL being generated (this is expected to be a stub per Epic 1 scope — do not treat "no real WhatsApp/SMS sent" as a failure; that's Epic 4).
- [ ] MFA: enroll a TOTP factor on the seeded platform admin account and confirm it's enforced on next login.

---

## 12. Realtime verification checklist

- [ ] Confirm `tenancy.tenants` is in the `supabase_realtime` publication (§9).
- [ ] Using the Supabase JS client (or the dashboard's Realtime inspector), subscribe to `postgres_changes` on `tenancy.tenants` filtered to `UPDATE` events.
- [ ] Trigger a status change (e.g., call the suspend-tenant path if available, or directly `update tenancy.tenants set status = 'active' where id = ...` as `service_role` for this test) and confirm the subscribed client receives the event in real time.
- [ ] Confirm a client authenticated as a `manager` of Tenant A does **not** receive realtime events for Tenant B's tenant row (RLS applies to realtime subscriptions automatically per §13.5 — verify it actually does, don't just trust the architecture doc).
- [ ] Confirm no other table is broadcasting realtime events yet (`select * from pg_publication_tables where pubname='supabase_realtime';` should show exactly one row, `tenancy.tenants`) — anything else present means a later-Epic table got wired in prematurely, which should not happen from Epic 1's migrations.

---

## 13. Manual QA checklist

End-to-end walkthroughs using real HTTP calls (curl, Postman, or the Supabase client) against the deployed project — not unit tests, not local mocks.

**Tenant provisioning**
- [ ] Call `provision-tenant` as a seeded `owner`-tier platform admin with a valid payload → 201, tenant + manager returned, no password anywhere in the response.
- [ ] Repeat the exact same call with the same idempotency key header (`x-idempotency-key`) → confirm the second call returns the identical cached response rather than creating a second tenant (`select count(*) from tenancy.tenants where slug = '...'` should still be 1).
- [ ] Call `provision-tenant` with a duplicate slug → expect `409 VALIDATION_DUPLICATE_SLUG`.
- [ ] Call `provision-tenant` as a `support`-tier platform admin → expect `403 PERM_ROLE_DENIED`.
- [ ] Call `provision-tenant` with a malformed phone (e.g., missing `+`) → expect `422 VALIDATION_FAILED` with both `message_en` and `message_ar` populated.
- [ ] Call `provision-tenant` with no `Authorization` header → expect `401 AUTH_MISSING_TOKEN`.

**Staff account lifecycle**
- [ ] As the seeded manager, add a second staff member directly via `identity.staff_profiles` insert through the client SDK (RLS should allow this for `manager` role — this exercises the RLS INSERT policy, not a dedicated Edge Function, since `add-staff` itself is Epic 2 scope) — confirm it succeeds and the row's `tenant_id` matches the caller's tenant even if a different `tenant_id` was attempted in the payload (§13.2 forgery check, live this time).
- [ ] Suspend that staff member, confirm they can no longer authenticate a **new** session (attempt `signInWithPassword`/OTP flow post-suspension and expect failure) while an already-issued token is also rejected (session revocation, not just future-login blocking).
- [ ] Reactivate and confirm login works again.

**Cross-tenant negative tests**
- [ ] As Tenant A's manager, attempt to read/update/suspend a Tenant B staff member's ID directly → expect denial at every layer (RLS blocks the read needed to even find the row; the Edge Function's own tenant check is the second layer if the row were somehow visible).

**Bilingual error UX**
- [ ] Trigger at least one error from each taxonomy prefix (`AUTH_*`, `PERM_*`, `VALIDATION_*`, `STATE_*`) and confirm every response body has both `message_en` and `message_ar` populated, not just one.

---

## 14. Rollback procedure

Epic 1's migrations are additive-only (new schemas/tables, no destructive changes to anything pre-existing — there was nothing pre-existing), so rollback is low-risk **before real tenant data exists**. Two scenarios:

### 14.1 Rollback during initial validation (no real user data yet — the common case)
Safest option: reset entirely rather than attempting a partial down-migration.
```bash
# Local:
supabase db reset

# Remote staging project (destructive — confirm this is NOT production first):
supabase db reset --linked
```
This drops and recreates the entire local/linked database from the migrations + seed, which is safe specifically because Epic 1 validation is not expected to hold real tenant data yet. **Never run `db reset --linked` against a project with real provisioned tenants.**

### 14.2 Rollback after real data exists (staging with seeded/manual test tenants you want to keep, or any future production scenario)
No destructive `db reset`. Instead:
1. Identify the specific migration to reverse.
2. Write a new, explicit down-migration SQL file (not provided by this Epic — Epic 1 did not author down-migrations, consistent with `BACKEND_ARCHITECTURE.md` §31's expand/contract discipline, which treats destructive rollback as a deliberate follow-up action, not a default capability) that drops only the objects the target migration added, in reverse dependency order (§5 table, reversed: 8→1).
3. Apply it via `supabase db push` like any other migration — never via manual `psql` DDL against a linked project outside the migration system, or the CLI's tracked migration history will drift from actual schema state.
4. Edge Functions: `supabase functions delete <name>` removes a deployed function; there is no "undeploy to previous version" — redeploying the prior git commit's `index.ts` is the rollback path for function code.
5. Storage buckets: do not delete a bucket that may contain objects without first confirming it's empty (`supabase storage ls`) — Epic 1's buckets should be empty (no uploads happen until Epic 2+), but verify before any delete.

### 14.3 Emergency stop (something is actively wrong, need to halt without full rollback)
- Disable a misbehaving Edge Function immediately: `supabase functions delete <name>` (removes it from being invocable; redeploy once fixed).
- To stop new tenant provisioning without touching schema: revoke the `provision-tenant` function's ability to run by removing it, or (less disruptive) temporarily tighten the `tenants_insert_platform_admin_manager_tier` RLS policy's `WITH CHECK` to `false` via a follow-up migration — do not hand-edit the policy directly on the live project outside migration tracking.

---

## 15. Troubleshooting guide

| Symptom | Likely cause | Fix |
|---|---|---|
| `supabase db push` fails on migration 3 with a foreign-key error | Migrations applied out of order or migration 2 didn't fully complete | Check `supabase migration list` for what's actually applied; re-run from the first missing one, never skip ahead |
| Edge Function returns `500` with "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured" | Function deployed before project-level env vars were available, or a stale deployment | Redeploy the function (`supabase functions deploy <name>`) — these are platform-injected, not something you set, so a redeploy after project setup usually resolves it |
| `PERM_ROLE_DENIED` when it shouldn't be | Caller's JWT `app_metadata.role`/`tenant_id` claims are missing or wrong | Inspect the JWT via `supabase.auth.getUser()` client-side, or decode the access token — confirm `provision-tenant`'s `createUser` call actually set `app_metadata` correctly; check Edge Function logs for the exact claims seen |
| RLS adversarial suite fails at Test 6b (audit_log direct insert not blocked) | `platform.audit_log` RLS policies not applied, or applied to the wrong role | Re-run migration 6 explicitly; confirm `select * from pg_policies where schemaname='platform' and tablename='audit_log';` shows only SELECT policies, no INSERT policy for `authenticated` |
| `provision-tenant` succeeds but leaves an orphaned `auth.users` row with no `staff_profiles` match | The compensating `deleteUser` call itself failed (rare — logged as "manual cleanup required" per the code's own comment) | Check `supabase functions logs provision-tenant` for the compensation-failure log line; manually delete the orphaned Auth user via the dashboard, and manually verify no `tenant_phone_registry`/`tenants` row was left inconsistent |
| Idempotency key retry returns a *different* tenant than the first call | The idempotency key was reused across genuinely different requests (client bug) or `jobs.idempotency_keys` wasn't actually hit | Confirm `x-idempotency-key` header is present and identical across both calls; check `select * from jobs.idempotency_keys where key = '...'` |
| Realtime subscription receives nothing | Table not in publication, or RLS is correctly blocking the subscriber (not a bug) | Check §12's publication query first; if the table IS published, confirm the subscribing client's role/tenant actually has SELECT access to that row via the same RLS policy |
| Local `supabase start` hangs or fails | Docker not running, or a port conflict (54321-54323 already in use) | Confirm Docker Desktop is running; `supabase stop` to release ports from a previous session, then retry |
| `psql` connection to the remote project fails | Using the pooler port (6543) instead of direct (5432) for a script expecting a persistent session, or wrong password | Use the direct connection string from Project Settings → Database → Connection string, not the pgbouncer/pooler one, for one-off scripts like the RLS suite |

---

## 16. Production deployment checklist

Only proceed here after every item in §9–§13 passes against **staging**. Production is a separate Supabase project — never "promote" the staging project itself.

- [ ] Create the `masar-production` Supabase project (§1.2), region chosen deliberately (not copy-pasted from staging without re-checking latency needs).
- [ ] PITR **enabled and confirmed working** via one actual restore-drill on this project specifically (staging's drill does not substitute — confirm production's own backup posture, per §31's "validated, not assumed" RPO/RTO requirement).
- [ ] `supabase link --project-ref YOUR_PRODUCTION_REF` (from a clean checkout — never push to production from a working directory that also has staging changes uncommitted).
- [ ] `supabase db push --dry-run` reviewed by a second person before the real push.
- [ ] All 8 migrations applied (§5), `seed.sql` applied (§6, reference data only — **do not run `scripts/seed-dev-data.mjs` against production**, it creates fake demo accounts).
- [ ] All 5 Edge Functions deployed (§7) with production secrets set (§2) — `ALLOWED_ORIGINS` set to the real production portal domains, never `*`.
- [ ] Full §9 verification checklist re-run against production.
- [ ] Full §10 RLS verification checklist re-run against production (yes, again — a clean staging pass does not guarantee production's fresh database has identical policy state until independently confirmed).
- [ ] Full §11 Authentication checklist re-run, with the **real first Platform Admin owner account** created via the Admin API (not the demo seed script) and MFA enrolled before any other action.
- [ ] CORS/allowed-origins locked to the six real production portal domains (§2).
- [ ] Confirm `platform`/`jobs` schemas remain excluded from the PostgREST-exposed schema list (§3) — re-check explicitly, since this is easy to accidentally widen via dashboard settings drift.
- [ ] Confirm no Epic 2+ objects exist (`\dt academic.*`, `\dt transport.*`, etc. should all error "schema does not exist") — production must reflect Epic 1 scope exactly, same as staging.
- [ ] Document the production project's URL/ref/region in the team's credential store — not in this repo.
- [ ] Freeze: no further schema changes to production until Epic 2 is implemented, reviewed, and validated against staging first, following this same guide's shape for Epic 2 when that work begins.

---

## Summary

This guide takes Epic 1's already-complete codebase from "written and unit-tested" to "validated against a real Supabase project," in order: environment → project config → migrations → seed → Edge Functions → storage → verification (general, RLS, auth, realtime) → manual QA → rollback/troubleshooting readiness → production. No code was changed to produce this document. Epic 2 remains untouched and unstarted.
