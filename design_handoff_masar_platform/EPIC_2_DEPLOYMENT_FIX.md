# Epic 2 Deployment Fix — Set-Returning Functions in RLS Policy Expressions

**Trigger:** live Supabase migration deployment failed with:
```
ERROR: set-returning functions are not allowed in policy expressions
```
on `classrooms_select_teacher` (and, as this document establishes, every other policy using the same helper functions).

**Status: root-caused, fixed everywhere it occurred, statically re-validated. Not yet executed against a live Postgres instance** — no Docker/live project is available in this environment (the same disclosed limitation as every prior report in this project). See §6 for exactly what was and wasn't verified, and §7 for the deployment-readiness statement this document can and cannot honestly make.

---

## 1. Root cause

`academic.classrooms`, and every other table with a teacher- or guardian-scoped RLS policy, relied on two helper functions:

```sql
create or replace function public.current_staff_classroom_ids()
returns setof uuid
...

create or replace function public.current_guardian_child_ids()
returns setof uuid
...
```

Both were declared `RETURNS SETOF uuid` — a **set-returning function (SRF)**. Every affected policy called one of them directly inside its `USING`/`WITH CHECK` boolean expression, in one of two shapes:

```sql
-- shape A: direct membership test
id = any(public.current_staff_classroom_ids())

-- shape B: nested one level inside a subquery's WHERE clause
id in (
  select classroom_id from academic.children
  where deleted_at is null and id = any(public.current_guardian_child_ids())
)
```

PostgreSQL's row-security planner rejects **any** appearance of a set-returning function inside a policy's boolean expression tree — including nested inside a subquery's `WHERE` clause, as in shape B — because a policy's `USING`/`WITH CHECK` clause must evaluate to a single scalar boolean per row, and a set-returning function call in that position doesn't have well-defined scalar semantics for Postgres's row-security expression rewriter (it isn't a plain `FROM`-clause table function invocation, which *is* allowed; it's a bare function call sitting where a scalar value is expected). This is a hard, unconditional restriction — it applies no matter how deeply the SRF call is nested inside the overall policy expression, which is why shape B (the guardian-scoped subqueries) is exactly as broken as shape A, even though it "looks" like ordinary subquery syntax.

---

## 2. Why PostgreSQL rejects this specifically

Three things are true simultaneously, and the combination is what triggers the restriction:

1. `current_staff_classroom_ids()` is declared to return **a set** (`SETOF uuid`) — conceptually, calling it can produce zero, one, or many rows, not one value.
2. A `CREATE POLICY ... USING (expr)` clause is compiled into a boolean qualifier that Postgres substitutes into every query touching the table — the row-security planner needs to reason about `expr` as a single, self-contained scalar-boolean expression it can push down, combine with other quals, and evaluate per candidate row.
3. Postgres's row-security machinery explicitly disallows SRFs anywhere in that expression tree, because letting a per-row boolean check invoke a function that can itself yield a variable number of rows breaks the planner's ability to treat the policy expression as a simple, side-effect-free scalar predicate — the same restriction (for closely related reasons) exists for SRFs in plain `CHECK` constraints and in the qual of some other row-scoped contexts.

The fix is **not** "wrap the SRF call differently" (e.g. `id = any(select * from current_staff_classroom_ids())` doesn't help — the SRF is still an SRF, just called via `FROM`, and it's still inside the policy's own expression tree, not a top-level query). The fix is to make the function **not be an SRF at all**: change its declared return type from `SETOF uuid` (a set) to `uuid[]` (a single array-typed scalar value). `x = ANY(array_expression)` is a completely ordinary, always-legal scalar array-membership test — nothing about it is special-cased or restricted in policy expressions, because there is no SRF involved anymore.

---

## 3. The rewritten RLS strategy

Both functions were changed from `RETURNS SETOF uuid` to `RETURNS uuid[]`, wrapping their existing query body in `ARRAY(...)`:

```sql
create or replace function public.current_staff_classroom_ids()
returns uuid[]                              -- was: returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select array(                             -- new: wraps the same query
    select id from academic.classrooms
    where coordinator_staff_id = auth.uid() and deleted_at is null
    union
    select s.classroom_id
    from academic.subjects s
    join academic.classrooms c on c.id = s.classroom_id
    where s.teacher_staff_id = auth.uid() and c.deleted_at is null
  );
$$;
```

and identically for `current_guardian_child_ids()`. This is a **return-type change with an unchanged query body and unchanged external behavior** — the set of IDs returned for any given caller is identical to before; only the container type changed from "a set of rows" to "one array value."

**Why every `= ANY(fn())` call site in every policy needed zero textual changes:** `ANY()` already accepts a plain array expression as valid, ordinary PostgreSQL syntax — `id = any(public.current_staff_classroom_ids())` is syntactically identical whether the function returns `SETOF uuid` (invalid in this position) or `uuid[]` (always valid). The bug was entirely in the function's declared return type, not in how any policy called it. This is what made the fix minimal: one line changed per function definition (plus wrapping the body in `ARRAY(...)`), and **every one of the 20 call sites across migration 6 required no edit at all.**

**Correctness of the empty-result edge case (verified, not assumed):** `ARRAY(subquery)` over zero matching rows evaluates to `'{}'::uuid[]` (an empty array), never `NULL`. This matters because `x = ANY(NULL)` evaluates to `NULL` (neither true nor false) in SQL's three-valued logic, which would make an affected policy's `USING` clause evaluate to `NULL` — and Postgres treats a `NULL` policy result as "deny" for `USING`, so a `NULL` here would have accidentally still been safe (fail-closed) rather than a hole. But relying on that coincidence was never necessary: `ARRAY()` guarantees an empty array, not `NULL`, so `x = ANY('{}')` is a clean, deterministic `FALSE` for a teacher/guardian with zero assignments — confirmed by a new regression test (Test 17, §5).

**The two RPC call sites that needed a one-line fix (not policies — PL/pgSQL bodies, so not broken by the original error, but needing adjustment for the new return type):**

```sql
-- before (migration 7, mark_attendance and submit_evaluation):
p_classroom_id <> all (array(select public.current_staff_classroom_ids()))

-- after — the ARRAY(SELECT ...) wrapper is no longer needed; the function
-- already returns an array directly. Keeping the old wrapper would have
-- produced a 2-D array (uuid[][]) and silently broken the comparison.
p_classroom_id <> all (public.current_staff_classroom_ids())
```

---

## 4. Search: every similar policy across Epic 2

A full-text search for both function names across every Epic 2 SQL file, followed by a static scan of every `CREATE POLICY` statement in `20260715000006_epic2_rls_policies.sql` for calls to any function still declared `RETURNS SETOF`/`RETURNS TABLE`, found:

| Location | Occurrences | Status |
|---|---|---|
| `current_staff_classroom_ids()` calls in `migration 6` (`CREATE POLICY` bodies) | 15 | All fixed — zero textual change needed (function return-type fix alone resolves them) |
| `current_guardian_child_ids()` calls in `migration 6` (`CREATE POLICY` bodies) | 8 (including the two nested-subquery "shape B" cases: `classrooms_select_guardian`, `subjects_select_guardian`, `lessons_select_guardian`) | All fixed — zero textual change needed |
| `current_staff_classroom_ids()` calls in `migration 7` (PL/pgSQL RPC bodies — `mark_attendance`, `submit_evaluation`) | 2 | Fixed — `ARRAY(SELECT ...)` wrapper removed (no longer needed/correct) |
| `current_staff_classroom_ids()` calls in `tests/rls/epic2_rls_adversarial.sql` | 1 | Fixed — same wrapper removal |

**Every other `SECURITY DEFINER` function in Epic 2 was checked and is unaffected:**
- `academic.children_reception_safe()` and `academic.classrooms_reception_safe()` are also declared `RETURNS TABLE (...)` (also SRFs) — but neither is ever referenced inside a `CREATE POLICY` statement (confirmed by the same static scan, zero matches). Both are only ever called properly, via a `FROM`-clause table-function invocation (`select * from academic.children_reception_safe()`) or as an RPC from a client, which is legitimate SRF usage and entirely unrelated to this restriction. **Left unchanged — they were never broken.**
- Every Epic 1 helper (`current_tenant_id()`, `current_role()`, `current_platform_admin_tier()`, `is_platform_admin()`, `is_platform_admin_manager_tier()`) returns a plain scalar (`uuid`, `text`, an enum, `boolean`) — none are SRFs, none are affected. **Confirmed by inspection, not modified — Epic 1 is never touched.**
- **Observation, not a fix:** the pre-fix-pass `epic1_rls_adversarial.sql` and this file both had a *separate*, unrelated pre-existing defect (invalid non-hexadecimal fixture UUIDs), already found and fixed for Epic 2's file in `EPIC_2_FIX_REPORT.md`. Epic 1's copy of that same UUID defect remains **unfixed and untouched**, consistent with the standing instruction to never modify Epic 1 files, even for bugs discovered incidentally. It has no relationship to the SRF-in-policy issue this document addresses.

**Conclusion: exactly two functions were the entire root cause, and their fix (a return-type change) transitively fixes every one of the 23 call sites across Epic 2 — no other Epic 2 policy, function, or table needed any change.**

---

## 5. Files fixed

| File | Change |
|---|---|
| `supabase/migrations/20260715000005_epic2_rls_helpers.sql` | `current_staff_classroom_ids()` and `current_guardian_child_ids()` changed from `RETURNS SETOF uuid` to `RETURNS uuid[]`, query bodies wrapped in `ARRAY(...)`. Comments updated to explain why, so a future reader doesn't "helpfully" revert it back to `SETOF`. |
| `supabase/migrations/20260715000007_epic2_rpc_functions.sql` | Two call sites (`mark_attendance`, `submit_evaluation`) had the now-incorrect `ARRAY(SELECT ...)` double-wrap removed. |
| `tests/rls/epic2_rls_adversarial.sql` | One matching call site fixed the same way; **all fixture UUIDs across the file were confirmed still valid** (already fixed in the prior pass, unrelated to this issue); added **Test 17**, a new regression test proving the empty-array edge case (§3) behaves correctly — a teacher with zero classroom assignments gets `'{}'::uuid[]`, never `NULL`, and is correctly denied access to every classroom/child in their own tenant. |
| `tests/rls/epic2_README.md` | Documents Test 17 and links back to this document. |

**`20260715000006_epic2_rls_policies.sql` (the file the original error was reported against) required zero edits** — every one of its 62 `CREATE POLICY` statements, including `classrooms_select_teacher`, is fixed transitively by the two function definitions changing in migration 5, since `= ANY(fn())` is valid syntax regardless of which of the two return types `fn()` has.

**Epic 1 files touched: zero. Frontend files touched: zero.**

---

## 6. Migration validation re-run

```
# Static SQL validation (no live Postgres available in this environment — see below)
$$-delimiter balance check on every touched file:       all balanced
Parenthesis balance check on every touched file:         all balanced
Node-based scan: every CREATE POLICY in migration 6      62 statements scanned,
  checked for calls to any RETURNS SETOF/TABLE function   0 violations found

# TypeScript layer (unaffected by this pure-SQL fix, re-run for completeness)
npx tsc -p tsconfig.json --noEmit     →  0 errors
npx vitest run                         →  10 test files, 92 tests, ALL PASSING
```

**What this validation does and does not prove:** the static scan confirms, by construction, that no `CREATE POLICY` statement anywhere in Epic 2 references a function currently declared `RETURNS SETOF` or `RETURNS TABLE` — which is precisely the condition that caused the original deployment failure. It does **not** prove the migrations execute cleanly end-to-end on a real Postgres server (connection handling, extension availability, exact PostgREST/Supabase version behavior, etc.), because — as in every report in this project since `EPIC_1_COMPLETION_REPORT.md` — **no Docker installation and no live Supabase project are available in this sandbox.** This was checked explicitly (`docker`/`psql` both absent) before writing this section, rather than assumed.

---

## 7. Deployment readiness

**What is now true:** the specific, reported failure (`set-returning functions are not allowed in policy expressions`, on `classrooms_select_teacher`) is root-caused, and the same defect class has been eliminated from every one of the 23 places it appeared across Epic 2 — not patched at the single reported call site. The fix is minimal and additive (two function return-type changes, two RPC-body syntax adjustments, zero policy text changes, zero table/column changes), so it carries none of the regression risk a broader rewrite would.

**What remains honestly unverified:** actual execution against a live Supabase project. The next real deployment attempt is the first true test of this fix, exactly as it would have been for the original (broken) migration. Given the fix directly targets the exact error message returned, and the static validation in §6 confirms no other instance of the same defect class survives anywhere in Epic 2, this delivery has a specific, falsifiable expectation: **the next deployment attempt should succeed past the point it failed at (`classrooms_select_teacher`) and should not encounter this same error message on any other policy**, since none remain.

---

## Verdict

Root cause identified (SRF called inside an RLS policy boolean expression — a hard PostgreSQL restriction, not a Supabase-specific quirk). Explained precisely why Postgres rejects it. RLS strategy rewritten (two helper functions changed from `SETOF` to array-returning) in a way that required editing zero policy statements. Searched exhaustively — confirmed exactly two functions and 23 call sites were affected, and confirmed every other Epic 2 SRF is used correctly and untouched. All affected migrations and the test suite fixed. Static migration validation re-run and passing; live-execution validation remains blocked on infrastructure unavailable in this environment, stated plainly rather than assumed away.

Not continuing to Epic 3, per instruction.
