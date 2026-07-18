# Epic 2 RLS adversarial test suite

Companion to `README.md` (Epic 1) — kept as a separate file rather than
appended to it, so Epic 1's file is never modified. Same execution
instructions apply; only the target script differs.

These SQL scripts verify the Row Level Security policies created in
`supabase/migrations/20260715000006_epic2_rls_policies.sql` and the RPCs in
`20260715000007_epic2_rpc_functions.sql` actually hold — one assertion per
Permission Matrix row Epic 2 touches (§12), per
`BACKEND_EXECUTION_PLAN.md` Epic 2 §20's cross-tenant leak test and
concurrent-enrollment race test requirements.

## Why these are not executed as part of this delivery

Same reason as Epic 1's suite: running them requires a live Postgres
instance with every migration through Epic 2 applied (`supabase start` +
Docker, or a real provisioned project), neither of which is available in
this sandbox. See `EPIC_2_COMPLETION_REPORT.md` for the full list of what
was and wasn't executed and why.

## How to run them

```bash
supabase start                       # requires Docker
supabase db reset                    # applies every migration (Epic 1 + Epic 2) + seed.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic1_rls_adversarial.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic2_rls_adversarial.sql
```

Run Epic 1's suite first — Epic 2's fixtures assume a clean database and do
not depend on Epic 1's leftover fixture rows (each script wraps its own
fixtures in `begin ... rollback`), but running Epic 1's suite first matches
the actual migration/test order this codebase expects.

## What is covered

1. Cross-tenant isolation on `academic.children` — a manager from Tenant B
   can never see Tenant A's child.
2. Teacher classroom scoping holds across tenants (a teacher in Tenant B
   sees nothing from Tenant A).
3. `current_staff_classroom_ids()` correctly includes a classroom the caller
   *coordinates* (§14.4's union of coordinator + subject-teacher sources) —
   this specific fixture only exercises the coordinator branch; the
   subject-teacher branch is exercised indirectly by Test 8's mark_attendance
   rejection using the same helper.
4. Guardian scoping — a guardian with a linked child sees exactly that
   child; a guardian in the *same tenant* with no linked children sees zero,
   proving the isolation is per-guardian, not merely per-tenant.
5. Reception has zero row-level access to the base `children` table (the
   column-narrowing decision from `EPIC_2_ARCHITECTURE_REVIEW.md` §14.3 is
   enforced by omission of any reception SELECT policy on the table itself)
   but successfully reads via `academic.children_reception_safe()`.
6. A forged `tenant_id` on a classroom INSERT is rejected by `WITH CHECK`,
   never trusted from client input (§13.2) — mirrors Epic 1's Test 8 for a
   different table.
7. `enroll_child_row`'s capacity lock (§2.2/§5) rejects enrollment into an
   already-full classroom rather than silently overbooking — the direct
   RPC-level counterpart to the execution plan's concurrent-enrollment race
   test (a true concurrency test requires two simultaneous sessions, which
   this single-script suite cannot simulate; this test proves the capacity
   *check* itself is correct, which is the precondition for the lock to be
   meaningful under concurrency).
8. `mark_attendance` rejects a teacher who is not assigned to the target
   classroom, including across tenants.

## Fix-pass additions (EPIC_2_FIX_REPORT.md)

Tests 9-16 were added when implementing every finding in `EPIC_2_REVIEW.md`,
closing the specific H4 gap that finding named: C1, C2, C3, M1, M2, M5/H2,
and M6 previously had **zero test coverage of any kind**, executed or not.
While extending this file, every fixture UUID was also rewritten — the
previous IDs (e.g. `...e2mg1`, `...e2tc2`) contained non-hexadecimal
characters (`m`, `g`, `t`, `c`...) that Postgres's `uuid` type would have
rejected outright the moment this file was ever actually run, meaning the
*entire original suite*, tests 1-8 included, could not have executed
successfully as written. This was invisible until now because the file was
never run. (Epic 1's `epic1_rls_adversarial.sql` has the identical defect —
confirmed by inspection, **not fixed**, since that file belongs to Epic 1
and this delivery does not modify Epic 1 files under any circumstance.)

9. Fix for **C1**: a direct `INSERT` into `academic.children` (bypassing
   `enroll_child_row` entirely) into an already-full classroom is now
   rejected by `trg_children_classroom_consistency` — the capacity guarantee
   holds regardless of write path, not just through the RPC.
10. Fix for **C1**: a direct `INSERT` into `academic.children` with a
    `classroom_id` belonging to a *different tenant* than the row's own
    `tenant_id` is rejected, even though RLS's `WITH CHECK` alone (which only
    ever validated the row's own `tenant_id`) would have allowed it.
11. Fix for **C2**: `mark_attendance` now rejects a `childId` that exists and
    belongs to the caller's own tenant, but not to the target classroom —
    previously nothing checked this at all.
12. Fix for **M5/H2**: a direct `INSERT` into `child_guardian_links` linking
    a Tenant-A child to a Tenant-B guardian is rejected by
    `trg_child_guardian_links_tenant`, independent of `link_child_guardian`'s
    own (now-redundant-but-still-present) trust in its caller.
13. Fix for **M6**: `address_lat` outside `[-90, 90]` is rejected by a CHECK
    constraint rather than silently accepted.
14. Fix for **M2**: `current_staff_classroom_ids()`'s subject-teacher branch
    now excludes a soft-deleted classroom — isolated from the
    coordinator-based branch (already correct) by using a classroom reached
    *only* via a subject assignment.
15. Fix for **M1**: sequential-correctness check for the rewritten atomic
    `UPDATE ... WHERE` pattern in `suspend_child` — calling it twice in a row
    succeeds once and then cleanly rejects with `STATE_ALREADY_PROCESSED`. A
    true concurrency test needs two simultaneous sessions, which this
    single-script suite cannot simulate; this proves the precondition the
    race fix depends on.
16. Fix for **C3**: `enroll_child_with_guardian` is confirmed atomic — a
    cross-tenant `guardian_id` (rejected by Test 12's same trigger, reached
    from inside this RPC) causes the whole call to fail, and — critically —
    leaves **no orphaned child row behind**, proving the earlier child insert
    within the same function body was rolled back, not merely that an error
    was raised on top of a partial write.

## Deployment-fix addition (EPIC_2_DEPLOYMENT_FIX.md)

17. Regression test for the live deployment failure ("set-returning
    functions are not allowed in policy expressions"): confirms
    `current_staff_classroom_ids()`'s rewrite from `RETURNS SETOF uuid` to
    `RETURNS uuid[]` preserves the original "empty result matches nothing"
    semantics for a teacher with zero classroom assignments — the function
    must return an empty array (`'{}'`), never `NULL`, since `x = ANY(NULL)`
    is `NULL` (neither true nor false) rather than `FALSE`, which would have
    made every teacher-scoped policy in the system behave unpredictably for
    a brand-new teacher. See `EPIC_2_DEPLOYMENT_FIX.md` for the full
    root-cause analysis.
