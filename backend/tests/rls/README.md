# Epic 1 RLS adversarial test suite

These SQL scripts verify the Row Level Security policies created in
`supabase/migrations/20260714000006_epic1_rls_policies.sql` actually hold —
one assertion per Permission Matrix row Epic 1 touches (§12, §12.1), per the
"adversarial RLS suite" the execution plan requires before Epic 1 is
considered done (BACKEND_EXECUTION_PLAN.md, Epic 1 §21 Test Scenarios).

## Why these are not executed as part of this delivery

Running them requires a live Postgres instance with the Epic 1 migrations
applied (a local Supabase stack via `supabase start`, which needs Docker, or
a real provisioned Supabase project). Neither is available in this sandbox
(no Docker, no live project credentials) — see `EPIC_1_COMPLETION_REPORT.md`
for the full list of what was and wasn't executed and why.

## How to run them

```bash
supabase start                       # requires Docker
supabase db reset                    # applies every migration + seed.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic1_rls_adversarial.sql
```

Each block raises a Postgres exception (aborting the script) if an assertion
fails, so a clean run with no output beyond `NOTICE` lines means every check
passed.

## What is covered

1. Cross-tenant isolation on `identity.staff_profiles` — a manager from
   Tenant A can never see or modify Tenant B's staff.
2. `tenancy.tenants` — a manager can read/update only their own tenant row;
   cannot read another tenant's row at all.
3. Platform Admin `support` tier cannot write to `tenancy.tenants` (the exact
   regression the frontend Product Validation review caught as Critical
   finding C8) — `support` gets SELECT only, `owner`/`admin` get full CRUD.
4. `identity.platform_admins` — only `owner` tier can manage other platform
   admin rows; `admin`/`support` can only ever see their own row.
5. `platform.audit_log` — no role can UPDATE or DELETE a row (immutability);
   INSERT only succeeds through the `write_audit_log` RPC, never a direct
   table insert from an authenticated role.
6. `tenancy.tenant_provisioning_state` / `tenancy.tenant_phone_registry` —
   fully inaccessible to every authenticated role (service_role only).
7. A forged `tenant_id` in an INSERT payload is silently overridden/rejected
   by the `WITH CHECK` clause, never trusted from client input (§13.2).
