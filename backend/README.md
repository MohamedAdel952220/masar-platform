# Masar Backend — Epic 1: Foundation & Platform Bootstrap

Implements Epic 1 of `BACKEND_EXECUTION_PLAN.md` exactly, on top of the schema
frozen in `BACKEND_ARCHITECTURE.md` (Architecture Frozen v1.0). See
`../design_handoff_masar_platform/EPIC_1_COMPLETION_REPORT.md` for the full
delivery record — this README is the "how do I run it" companion.

## Layout

```
backend/
  supabase/
    config.toml           Supabase project config (Epic 1 scope: tenancy, identity schemas)
    migrations/            8 migrations — schemas, tables, RLS, RPCs, storage, realtime
    seed.sql                Reference data (plan_catalog / plan_catalog_apps)
    functions/               5 Edge Functions + _shared utilities
  src/
    types/                  Hand-authored DB + domain types
    validation/               zod schemas
    repositories/            Thin Supabase-client data access
    services/                Testable business logic (mirrors the Edge Functions)
    api/routes/                Framework-agnostic API handlers
    audit/                    write_audit_log wrapper
  tests/
    unit/                     vitest — runs today, no live project needed
    rls/                      SQL adversarial suite — needs a live/local Supabase project
  scripts/
    seed-dev-data.mjs         Demo tenant + accounts via Auth Admin API (needs a live project)
```

## Prerequisites this sandbox did NOT have (see completion report for details)

- Docker (required for `supabase start` / local Postgres)
- A provisioned Supabase project + credentials
- The Supabase CLI itself

Everything below is written so it works the moment those three exist.

## Deploying against a real Supabase project

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push                      # applies all 8 Epic 1 migrations
supabase db seed                      # or: psql "$DB_URL" -f supabase/seed.sql
supabase functions deploy provision-tenant
supabase functions deploy suspend-staff-account
supabase functions deploy reactivate-staff-account
supabase functions deploy revoke-sessions
supabase functions deploy regenerate-activation-link
```

Set Edge Function secrets (`supabase secrets set ...`): none required beyond
the platform-provided `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`
for Epic 1 (no third-party vendor keys yet — activation-link dispatch is
stubbed until Epic 4).

## Local development (requires Docker)

```bash
cp .env.example .env.local     # fill in after `supabase start` prints local creds
supabase start
supabase db reset              # migrations + seed.sql
npm test                       # unit suite
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic1_rls_adversarial.sql
node scripts/seed-dev-data.mjs
```

## Running what IS runnable in this sandbox

```bash
npm install
npm run typecheck   # tsc --noEmit — passes clean
npm test            # vitest — 33/33 passing, zero live dependencies
```
