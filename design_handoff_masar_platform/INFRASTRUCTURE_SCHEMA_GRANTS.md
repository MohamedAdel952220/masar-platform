# Infrastructure Schema Grants

A single additive, forward-only migration —
`backend/supabase/migrations/20260728000001_infra_schema_usage_grants.sql` —
grants the missing `USAGE` privilege on every custom schema created across
Epic 1 through Epic 8. This is a **platform infrastructure fix, not an Epic
change**: no existing migration, RLS policy, RPC, Edge Function, or
application-logic file was touched.

---

## Root cause

Confirmed in `EPIC_8_PERMISSION_INVESTIGATION.md` by grepping all 54
pre-existing migration files: **no migration in this project's history,
across every Epic, has ever issued a schema-level privilege grant**
(`GRANT USAGE ON SCHEMA`, `GRANT ALL ON SCHEMA`, or
`ALTER DEFAULT PRIVILEGES ... IN SCHEMA`). Every one of the twelve custom
schemas in this project was created with a bare
`create schema if not exists <name>;` and nothing else.

Supabase's platform automatically provisions `USAGE` on the `public` schema
for the `anon`, `authenticated`, and `service_role` roles once, at project
creation. It does **not** do the equivalent for any schema a project creates
afterward — adding a schema to `[api] schemas` only changes which schemas
PostgREST is willing to *route* a request to; it does not grant the
underlying Postgres role privilege that request needs once it arrives. That
privilege has always been this project's own responsibility, for every
schema, since Epic 1 — and it was never done.

This was invisible for the entire project history because no custom schema
had ever been successfully exposed via `config push` until the session that
fixed Epic 8's own `PGRST106` ("schema not exposed") finding. A request
PostgREST rejects at its own routing layer never reaches Postgres, so the
missing `USAGE` grant — a database-level permission, evaluated only *after*
PostgREST agrees to route the request — could not have surfaced as an error
before that point, for any schema, in any Epic. Fixing the routing-level gap
didn't introduce this problem; it removed the layer that had been masking
it since Epic 1. Live testing during the Epic 8 deployment audit confirmed
this directly: `billing` (Epic 6, frozen, unrelated to Epic 8) fails with
the identical `42501 permission denied for schema billing` that `reports`
does.

---

## Schemas affected

All twelve custom schemas created across Epic 1–8:

| Schema | Introduced by | In `[api] schemas`? |
|---|---|---|
| `tenancy` | Epic 1 | Yes |
| `identity` | Epic 1 | Yes |
| `platform` | Epic 1 | No — cross-cutting, internal only |
| `jobs` | Epic 1 | No — cross-cutting, internal only |
| `academic` | Epic 2 | Yes |
| `transport` | Epic 3 | Yes |
| `safety` | Epic 3 | Yes |
| `comms` | Epic 4 | Yes |
| `approvals` | Epic 5 | Yes |
| `billing` | Epic 6 | Yes |
| `media` | Epic 7 | Yes |
| `reports` | Epic 8 | Yes |

`platform` and `jobs` are not in `config.toml`'s `[api] schemas` list and
are not intended to be directly reachable by an anonymous or logged-in
client at all (`platform.audit_log` is written exclusively through the
`public.write_audit_log` `SECURITY DEFINER` RPC; `jobs.idempotency_keys` is
read/written exclusively through `public.idempotency_replay`/
`idempotency_store`). They are covered by this migration anyway, scoped to
`service_role` only — see the next section for why.

---

## Exact grants applied

```sql
-- anon, authenticated, service_role: the ten schemas exposed via [api] schemas.
grant usage on schema tenancy   to anon, authenticated, service_role;
grant usage on schema identity  to anon, authenticated, service_role;
grant usage on schema academic  to anon, authenticated, service_role;
grant usage on schema transport to anon, authenticated, service_role;
grant usage on schema safety    to anon, authenticated, service_role;
grant usage on schema comms     to anon, authenticated, service_role;
grant usage on schema approvals to anon, authenticated, service_role;
grant usage on schema billing   to anon, authenticated, service_role;
grant usage on schema media     to anon, authenticated, service_role;
grant usage on schema reports   to anon, authenticated, service_role;

-- service_role only: the two cross-cutting, not-API-exposed schemas.
grant usage on schema platform to service_role;
grant usage on schema jobs     to service_role;
```

**Twelve statements, one per schema. `USAGE` only — nothing else.** No
`GRANT SELECT`/`INSERT`/`UPDATE`/`DELETE`/`EXECUTE` on any table or function,
no `ALTER DEFAULT PRIVILEGES` for future objects, no RLS policy change.

Role scoping, explained:

- **`tenancy` through `reports` (the ten API-exposed schemas) → `anon`,
  `authenticated`, `service_role`**: these are the only three roles
  PostgREST ever connects as, and all ten schemas are already reachable via
  `Accept-Profile`/`Content-Profile` per `config.toml`. Granting all three
  roles `USAGE` uniformly matches the grant pattern this project's own
  migrations already use at the table/function level (e.g. every RPC in
  every Epic grants `EXECUTE` to `authenticated`, and several — like
  `public.write_audit_log`, `public.idempotency_replay` — grant to both
  `authenticated` and `service_role`), so this is consistent with, not a
  departure from, the project's own established convention.
- **`platform`, `jobs` → `service_role` only**: no application code anywhere
  in this repository calls `.schema('platform')`. Two frozen Edge Functions
  — `generate-invoice-pdf` and `notification-dispatch` (Epic 4/6) — do call
  `.schema('jobs')` directly, but only through their `service_role` admin
  client, to claim/update `jobs.background_job_queue` rows. Granting `anon`/
  `authenticated` `USAGE` on either schema would serve no purpose (neither
  role has any reason, today or by design, to reach them, and PostgREST
  won't even route there for those roles since neither schema is in
  `[api] schemas`) — so, per "grant the minimum required," they are
  excluded. Granting `service_role` here is a genuine, currently-latent bug
  fix for the two Edge Functions above (identically blocked today to
  `reports`/`billing`, just via a schema `jobs` doesn't even reach PostgREST
  routing for yet) and a no-op everywhere it isn't yet exercised.

---

## Security analysis

**This migration cannot expand what any role can read or write.** `USAGE ON
SCHEMA` is a prerequisite privilege only — in Postgres, it lets a role
*resolve a schema-qualified name* (e.g. `reports.ai_report_drafts`) enough to
attempt an object-level operation against it. It grants no privilege on any
table, view, sequence, or function inside that schema. Every actual
data-access decision continues to be made exactly where it already was:

- **Row-level security is untouched.** Every table across all twelve
  schemas that has RLS enabled (which, per each Epic's own established
  convention, is every tenant-scoped table) also has `FORCE ROW LEVEL
  SECURITY` set, and keeps every `SELECT`/`INSERT`/`UPDATE`/`DELETE` policy
  exactly as each Epic's own migrations defined it. A role with schema
  `USAGE` but no matching RLS policy on a given table still gets zero rows,
  exactly as before this migration.
- **Table and function grants are untouched.** No table in this project
  grants any privilege directly to `anon`/`authenticated` outside of RLS;
  every RPC's own `REVOKE ALL ... GRANT EXECUTE ...` sequence (established
  per-Epic, e.g. `send_report_draft`'s `authenticated`-only grant,
  `increment_ai_usage`'s `service_role`-only grant) is unchanged by this
  migration and remains the sole gate on which role may call which function.
- **No new attack surface.** `anon`/`authenticated` already had `USAGE` on
  `public`, which is where every client-facing RPC in this project already
  lives (`send_report_draft`, `review_request`, `generate_invoice`,
  `create_camera`, etc.) — those were never blocked by the missing grant
  this migration fixes, since `SECURITY DEFINER` functions evaluate their
  internal schema access under their *owner's* privileges, not the caller's.
  This migration only affects **direct** schema-qualified REST/RPC calls
  into a non-`public` schema, which is exactly the pattern the Node
  repository layer (`AiReportRepository` and its siblings in every other
  Epic) and two service-role Edge Functions already use and were designed
  around from the start — this migration makes that pre-existing, intended
  design actually work, rather than granting any new capability beyond what
  every Epic's own architecture already assumed would be possible.
- **`anon`'s exposure is unchanged in practice.** Every table this
  migration's ten `anon`-inclusive schemas contain either has no RLS policy
  granting `anon` anything at all, or (for the handful of genuinely public
  read paths, if any exist per each Epic's own permission matrix) already
  had that access correctly scoped by its own RLS policy — this migration
  changes none of those policies.

**Net effect**: this migration closes a request-routing/permission gap that
was silently rejecting *every* direct call into *every* custom schema in
this project (visible live only once the separate `PGRST106` exposure issue
was fixed) — a strict availability fix, with zero change to which data any
role can actually see or modify.

---

## Why this is infrastructure hardening rather than an Epic change

- **It is not scoped to any single Epic's business logic.** The migration
  contains no table, enum, RLS policy, trigger, or RPC — only twelve `GRANT
  USAGE` statements, none of which reference Epic 8 (or any other Epic)
  specifically by name in their effect, only in this file's own explanatory
  comments.
- **It does not modify, and could not have been placed inside, any existing
  Epic's own migration** — the task's own constraint ("do not modify any
  existing migration") is also the *correct* engineering choice
  independently: retroactively editing Epic 1's `20260714000001` migration
  to add these grants would rewrite already-applied migration history, which
  this project's own established discipline (re-stated in every prior
  Epic's own fix/deployment report) treats as off-limits once a migration
  has shipped.
- **The root cause predates Epic 8 by four days of migration history** (Epic
  1's `tenancy`/`identity`/`platform`/`jobs` schemas, created
  `2026-07-14`, carry the identical gap this migration fixes for `reports`,
  created `2026-07-27`) — it is a characteristic of how this project
  provisions *every* schema, not a defect in any one Epic's own design or
  implementation.
- **The fix is uniform and mechanical** — the same one-line `GRANT USAGE`
  statement, repeated once per schema, with no per-Epic variation in shape
  or reasoning. This is the signature of an infrastructure/platform-layer
  gap (a missing step in how the project provisions a schema for API use in
  general), not of an Epic-specific application defect (which would instead
  show up as a variation in shape — different tables, different policies,
  different business rules — per Epic).

---

## Stopping point

Per instruction, this task stops after creating the migration and this
report. The migration has **not** been applied to the live project — it
still needs `supabase db push` (or the live project's own migration-apply
mechanism) to take effect, and a subsequent live re-verification (the same
kind of direct HTTP test used in `EPIC_8_DEPLOYMENT_AUDIT_FINAL.md`) to
confirm `42501 permission denied for schema X` no longer occurs on any of
the ten API-exposed schemas.
