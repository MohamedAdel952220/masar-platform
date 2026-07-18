# Epic 2 Development Reset Plan

**Context correction:** this Supabase project is a **development environment with no real data** — no tenants, no schools, no customers, no production users. `EPIC_2_DEPLOYMENT_PATCH.md`'s forward-only patch migration (`20260716000001_epic2_patch_rls_helper_functions.sql`) was written under a production-hotfix assumption (never edit an applied migration, reconcile forward instead) that does not apply here. That assumption is correct for a live system with data at risk; it is unnecessary overhead for a dev database that can simply be reset. **This document replaces that approach.**

---

## 1. Review of the migration strategy that led to the patch

The patch was the right shape of fix *if* the live database held data that couldn't be discarded — forward-only migrations exist specifically to avoid destructive operations against systems with real state. But this project's actual constraint is different: `EPIC_1_COMPLETION_REPORT.md` through `EPIC_2_FIX_REPORT.md` have consistently documented that **no live Supabase project has ever held real records** — every "deployment" so far is schema-only, seeded at most with synthetic demo rows via `scripts/seed-dev-data*.mjs`. Applying production-grade migration discipline (never touch an applied migration; reconcile forward) to an environment with nothing to protect just adds a second migration file whose only purpose is to fix a mistake in the first one — that's noise in the migration history of a project that hasn't shipped yet, not safety.

**The correct dev-environment answer is simpler:** since `20260715000005` and `20260715000006` were already corrected locally (§3 below) before the live database ever executed anything past migration 5, a **full reset replays the corrected migration files from scratch** — migration 6 never fails, because by the time it runs, migration 5 has already created the array-returning functions it needs. There is no window where a broken function signature and a dependent policy coexist. The forward-patch migration is not just unnecessary, it's solving a problem a reset makes impossible to have in the first place.

---

## 2. What was removed

| File | Action | Why |
|---|---|---|
| `backend/supabase/migrations/20260716000001_epic2_patch_rls_helper_functions.sql` | **Deleted** | The forward-only patch migration. Its DROP/CREATE POLICY dance exists only to work around an already-applied broken migration on a system that can't be reset — not applicable here. |
| `design_handoff_masar_platform/EPIC_2_DEPLOYMENT_PATCH.md` | **Deleted** | Documented the now-deleted migration; keeping it would leave stale documentation describing a file that no longer exists. |

Both files were untracked (never committed) in this working tree, confirmed via `git status` before deletion — removing them discards nothing that was ever part of the project's committed history.

**Nothing else changed.** `20260715000005_epic2_rls_helpers.sql` and `20260715000006_epic2_rls_policies.sql` — already corrected in the prior fix pass (`EPIC_2_DEPLOYMENT_FIX.md`) — are untouched by this document. Migration history for Epic 2 is now exactly 8 files, `20260715000001` through `20260715000008`, with no gap, no patch layer, and no reference to one anywhere in the codebase (verified — see §7).

---

## 3. Confirming the migration files themselves are already correct

The patch was removable *only because* the actual defect (the two `RETURNS SETOF uuid` functions) was already fixed at the source, in `20260715000005`, during the prior fix pass. Re-verified directly from the current file contents:

```sql
-- 20260715000005_epic2_rls_helpers.sql, lines 55 and 80:
returns uuid[]     -- current_staff_classroom_ids()
returns uuid[]     -- current_guardian_child_ids()
```

```sql
-- 20260715000007_epic2_rpc_functions.sql, lines 230 and 364:
if v_role = 'teacher' and p_classroom_id <> all (public.current_staff_classroom_ids()) then
if v_lesson_classroom_id <> all (public.current_staff_classroom_ids()) then
```

No `ARRAY(SELECT ...)` double-wrap remains at either RPC call site (that wrapper was only ever needed around a `SETOF`-returning call; it was correctly removed when the return type changed). No file anywhere in the repository references `20260716000001` or `EPIC_2_DEPLOYMENT_PATCH` any longer (grepped across `.sql`, `.md`, `.toml`, `.ts`, `.mjs` — zero remaining hits).

---

## 4. Verification: all Epic 2 migrations are internally consistent for a fresh replay

**Replay order** (unchanged filenames, unchanged order — Supabase applies migrations in filename/timestamp order):

```
20260715000001_epic2_academic_schema.sql
20260715000002_epic2_people_and_structure_tables.sql
20260715000003_epic2_academic_records_tables.sql
20260715000004_epic2_identity_staff_extension_tables.sql
20260715000005_epic2_rls_helpers.sql              <- functions created as uuid[] from the start
20260715000006_epic2_rls_policies.sql             <- policies reference those functions; correct on first run
20260715000007_epic2_rpc_functions.sql
20260715000008_epic2_storage_and_realtime.sql
```

Because migration 5 now creates `current_staff_classroom_ids()`/`current_guardian_child_ids()` as `uuid[]`-returning **on the very first (and only) time it ever runs in a fresh database**, migration 6's 21 policies that call `ANY(public.current_staff_classroom_ids())`/`ANY(public.current_guardian_child_ids())` are valid the first time they're created — there is no prior broken version for them to have been built against. This is the structural reason a reset fully resolves the issue with zero risk of hitting the original error again.

**Checks re-run against the current (patch-free) migration set:**

```
SQL balance ($$-delimiters, parentheses) — all 8 Epic 2 files:  balanced
  20260715000001: $$=0  parens(2/2)     OK
  20260715000002: $$=6  parens(105/105) OK
  20260715000003: $$=12 parens(133/133) OK
  20260715000004: $$=6  parens(60/60)   OK
  20260715000005: $$=8  parens(63/63)   OK
  20260715000006: $$=0  parens(281/281) OK
  20260715000007: $$=16 parens(117/117) OK
  20260715000008: $$=0  parens(20/20)   OK

Static scan — every CREATE POLICY in migration 6 checked for a call to
any function still declared RETURNS SETOF/TABLE:
  Scanned 62 CREATE POLICY statements.
  No remaining SRF-in-policy references found. Clean.

TypeScript layer (unaffected by this SQL-only change, re-run for completeness):
  npx tsc -p tsconfig.json --noEmit     ->  0 errors
  npx vitest run                         ->  10 test files, 92 tests, ALL PASSING
```

---

## 5. Verification: zero Epic 1 migrations need modification

```
git status --porcelain backend/supabase/migrations/20260714*.sql   ->  (no output)
```

No Epic 1 migration file (`20260714000001` through `20260714000008`) has been added, removed, or modified at any point across the deployment-fix and this reset — confirmed by an empty diff, not asserted from memory. Epic 1's SETOF-free helper functions (`current_tenant_id()`, `current_role()`, `current_platform_admin_tier()`, `is_platform_admin()`, `is_platform_admin_manager_tier()`) were never affected by this bug class in the first place (none of them are set-returning), so there was never a reason to touch Epic 1 — this section confirms that remains true after the cleanup, not that a fix was avoided.

---

## 6. The safest way to reset the development database

For a project confirmed to hold no real data, the Supabase CLI's own reset command is the correct tool — it is specifically designed for exactly this situation (local/dev iteration) and is explicitly documented as destructive, which is the point:

```bash
supabase db reset
```

**What this does:** drops the local (or linked dev-project) database, recreates it, and replays **every** migration file in `supabase/migrations/` in filename order from scratch, followed by `supabase/seed.sql`. It is the standard, intended Supabase workflow for "I changed migration history during development and want a clean slate" — not a workaround, the documented mechanism for this exact scenario.

**Before running it, confirm you're pointed at the dev project, not anything else** — this is the one safety check worth doing explicitly even in a no-real-data environment, since `db reset` run against the wrong target is the only way this command could ever be a mistake:

```bash
supabase status          # confirms which local/linked project is active
# or, if linked to a remote dev project:
supabase projects list   # confirms project ref before any --linked/--db-url command
```

If working against a **remote** dev Supabase project (not the local CLI stack), `db reset` operates only against the local Docker Postgres by default — to reset a remote dev project's schema, the equivalent is dropping and recreating the schemas this project owns, then re-pushing migrations:

```bash
# Remote dev project — explicit schema drop (safe here specifically because
# this project is confirmed to hold no real data; this is NOT a command to
# reuse against any project with real tenants/users):
supabase db push --linked --dry-run     # review exactly what would apply first
supabase db push --linked               # applies any migrations not yet recorded as applied

# If the remote project's migration history table itself is out of sync
# (e.g. it still thinks 20260715000005/6 applied in their pre-fix form),
# the clean option for a no-data dev project is to reset the linked
# project's database from the Supabase dashboard (Project Settings ->
# Database -> Reset database), then re-run `supabase db push --linked`
# to replay the full corrected migration set from scratch.
```

---

## 7. Exact commands: reset and redeploy Epic 1 + Epic 2 from scratch

```bash
# 1. From the backend/ directory
cd backend

# 2. Confirm current project/link target before doing anything destructive
supabase status

# 3. Reset the database and replay every migration (Epic 1 + Epic 2, in
#    filename order) plus supabase/seed.sql, from scratch
supabase db reset

# 4. Deploy every Edge Function (Epic 1's five + Epic 2's two)
supabase functions deploy provision-tenant
supabase functions deploy suspend-staff-account
supabase functions deploy reactivate-staff-account
supabase functions deploy revoke-sessions
supabase functions deploy regenerate-activation-link
supabase functions deploy add-staff
supabase functions deploy enroll-child

# (equivalently, deploy all functions in one pass:)
supabase functions deploy

# 5. Type-check and run the full test suite as a final sanity gate
npm run typecheck
npm test

# 6. Integration Validation: seed demo data through the real, now-deployed
#    stack (exercises provisioning, RLS, and both Epic 2 Edge Functions
#    end-to-end against the reset database)
node scripts/seed-dev-data.mjs          # Epic 1: demo tenant + manager
node scripts/seed-dev-data-epic2.mjs    # Epic 2: demo classroom + teacher + child + guardian
```

**If `supabase db reset` targets a remote/linked dev project rather than the local CLI stack**, replace step 3 with the remote-project sequence in §6, then continue from step 4 unchanged.

---

## 8. Confirmed deployment order

1. **Epic 1 migrations** (`20260714000001`–`20260714000008`) — schemas, tenancy/identity tables, RLS helpers, RLS policies, RPCs, storage/realtime. Applied first, unconditionally, by `supabase db reset`'s filename-order replay.
2. **Epic 2 migrations** (`20260715000001`–`20260715000008`) — academic schema, tables, RLS helpers (now correctly `uuid[]`-returning on first creation), RLS policies (valid on first creation, per §4), RPCs, storage/realtime. Applied second, in the same replay, immediately after Epic 1.
3. **Edge Functions** — all seven (Epic 1's five, Epic 2's two: `add-staff`, `enroll-child`) deployed after the schema is fully in place, since every function's Edge runtime code assumes the tables/RPCs/RLS it calls already exist.
4. **Integration Validation** — the two seed scripts, run last, against the fully-migrated-and-deployed stack: `seed-dev-data.mjs` (Epic 1: tenant + manager via `provision-tenant`) then `seed-dev-data-epic2.mjs` (Epic 2: classroom + teacher via `add-staff` + child/guardian via `enroll-child`), confirming the whole stack works end-to-end, not just that each migration applied without error.

This order was already correct in every prior report in this project (`EPIC_1_DEPLOYMENT_GUIDE.md`, `EPIC_2_COMPLETION_REPORT.md`) — nothing about this reset changes it. What changes is *how Epic 2's migrations are gotten onto a live database*: replay-from-scratch instead of patch-forward, because this is a dev environment where replay is safe, simple, and available.

---

## Verdict

The forward-only patch migration and its documentation have been removed — both were untracked, unshipped files, and deleting them discards no committed history. Epic 2's migration set is now exactly 8 files, already internally correct for a fresh sequential replay (verified: balanced SQL, zero remaining SRF-in-policy references, 92/92 tests passing). Epic 1 remains fully unmodified (verified via empty git diff, not assumed). The safest reset for this confirmed-no-real-data environment is `supabase db reset` (or the remote-project schema-reset equivalent), which replays the corrected migrations from scratch and cannot reproduce the original failure, since migration 6 now only ever sees the corrected migration 5 in every possible execution order. Exact CLI commands for a full reset-and-redeploy — Epic 1 migrations, then Epic 2 migrations, then all seven Edge Functions, then Integration Validation via both seed scripts — are provided in §7.

Not continuing to Epic 3, per instruction.
