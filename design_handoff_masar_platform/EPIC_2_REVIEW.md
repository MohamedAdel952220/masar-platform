# Epic 2 Review — Principal Backend Audit

**Role:** Principal Backend Auditor. **Scope:** every file delivered in Epic 2 (`backend/supabase/migrations/20260715*.sql`, `backend/supabase/functions/{enroll-child,add-staff}`, `backend/src/**` additions, `backend/tests/**` additions). **Method:** line-by-line re-read of every migration, RPC body, RLS policy, Edge Function, and TypeScript file — not a re-statement of `EPIC_2_COMPLETION_REPORT.md`'s own claims. Cross-checked against `BACKEND_ARCHITECTURE.md` (§2.2, §5, §12, §13, §14.3, §25.2) and `EPIC_2_ARCHITECTURE_REVIEW.md`.

**This is documentation only. No code was modified as part of this review.**

---

## Executive summary

Epic 2's structural shape is sound — schema, RLS coverage, and Edge Function conventions faithfully follow Epic 1's precedent, and no Epic 1 file was touched. However, this audit found **three Critical-severity gaps** that were not caught by the 83/83 "passing" test suite, because that suite is entirely mock-based and never exercises real SQL: (1) RLS `INSERT`/`UPDATE` policies validate a row's own `tenant_id` but never validate that its foreign-key references belong to the same tenant, which — combined with the RPCs being merely a *convenience path* rather than the *only path* — means capacity enforcement and cross-tenant reference integrity are bypassable via direct table access; (2) `mark_attendance` does not verify a submitted `childId` belongs to the target classroom or even the caller's tenant; (3) `enroll-child`'s two-RPC saga has no compensation for a `link_child_guardian` failure, and a client retry after that failure creates a duplicate child row. All three are concrete, exploitable-in-principle correctness/security gaps, not stylistic nitpicks.

The completion report's coverage claims are technically true (83/83 unit tests pass) but materially overstate verification confidence: none of the findings below live in code paths any of those tests actually exercise, since every test replaces the database with a hand-written fake.

**Finding counts: 3 Critical · 4 High · 6 Medium · 6 Low.**

---

## Critical

### C1 — RLS `INSERT`/`UPDATE` policies validate a row's own `tenant_id` only, never its foreign-key references' tenant — capacity and cross-tenant integrity are bypassable via direct table access

**Where:** `20260715000006_epic2_rls_policies.sql` — `children_insert_manager`, `attendance_insert_teacher`, `evaluations_insert_teacher`, and (by the same pattern) most other `INSERT`/`UPDATE` policies in the file.

Every `WITH CHECK` clause in this migration is shaped `tenant_id = current_tenant_id() AND current_role() = '<role>'` (plus, in a few cases, a same-tenant ownership narrowing like `classroom_id = ANY(current_staff_classroom_ids())`). None of them verify that the row's *other* foreign keys point at objects belonging to the same tenant, and — critically — the capacity-locked, business-rule-validating RPCs (`enroll_child_row`, `mark_attendance`, `submit_evaluation`) are **not the only way to write these tables**. RLS grants `INSERT`/`UPDATE` directly on the base tables to `manager`/`teacher`, so any client with a valid manager/teacher session can call PostgREST directly (`POST /rest/v1/children`, `POST /rest/v1/attendance_records`, etc.) and completely bypass the RPC layer:

- `children_insert_manager` (line 79) has no capacity check at all. A manager can `INSERT` directly into `children` past a classroom's `capacity`, silently defeating the "correctness guarantee (no overbooking)" `BACKEND_ARCHITECTURE.md` §5 explicitly claims for this system: *"Any RPC that inserts against a fixed ceiling... this is a standing convention for every such RPC."* The convention only holds if the RPC is the only entry point, and here it demonstrably isn't.
- `children_insert_manager` also does not verify `classroom_id` belongs to the manager's own tenant — only the row's own `tenant_id` column is checked. A manager could insert a child with `tenant_id = <own tenant>` and `classroom_id = <another tenant's classroom>`, since nothing joins the two.
- `attendance_insert_teacher` (line 135) checks `classroom_id = ANY(current_staff_classroom_ids())` (good) but never checks that `child_id` belongs to that classroom or even to the caller's tenant — see C2, which shows this is independently exploitable at the RPC layer too, confirming the gap is systemic, not RPC-specific.
- `evaluations_insert_teacher` checks `child_id` is in the caller's own classroom (good) but never checks `lesson_id` belongs to the same tenant/classroom at all — a teacher could `INSERT` an evaluation referencing an arbitrary `lesson_id`, including one from a different tenant.

**Impact:** the capacity-locking guarantee (§5) and several business-consistency rules that only exist inside RPC bodies (see C2, H2) can be silently defeated by any client that talks to PostgREST directly instead of calling the intended RPC — which is not a hypothetical: it is literally what a REST client does by default unless it's specifically coded to call the RPC instead.

**Severity: Critical** — directly contradicts a stated architectural correctness guarantee and is trivially reachable by any authenticated manager/teacher session, not just a compromised one.

---

### C2 — `mark_attendance` does not verify a record's `childId` belongs to the target classroom or the caller's tenant

**Where:** `20260715000007_epic2_rpc_functions.sql`, `public.mark_attendance` (lines 161–228).

The function validates the caller's role and that they're assigned to `p_classroom_id`, and validates that `p_classroom_id` itself belongs to `v_tenant_id`. It then loops over `p_records` and, for every entry, executes:

```sql
insert into academic.attendance_records (tenant_id, child_id, classroom_id, date, present, marked_by)
values (v_tenant_id, (v_record->>'childId')::uuid, p_classroom_id, p_date, (v_record->>'present')::boolean, auth.uid())
on conflict (child_id, date) do update ...
```

There is **no check anywhere that `(v_record->>'childId')::uuid` is actually a child enrolled in `p_classroom_id`, or even that it belongs to `v_tenant_id`**. The only constraint that can stop this is the bare `child_id references academic.children(id)` foreign key, which requires the UUID to exist as *some* row in `children` — in any tenant, any classroom. A teacher or manager (accidentally, via a client bug, or deliberately) can submit an attendance record for a child that belongs to a different classroom in their own tenant, or a child belonging to a **completely different tenant**, and the row will insert successfully with `attendance_records.tenant_id` set to the caller's own tenant while `attendance_records.child_id` points at a child whose actual `tenant_id` differs.

**Impact:** cross-tenant data pollution (an attendance record existing for a child who does not belong to the tenant that "owns" the record) and a straightforward integrity violation within a single tenant (marking attendance for a child not in the target classroom). This is the same missing-validation class as C1 but demonstrates it's not merely an RLS gap — the RPC that's supposed to be the safe, validated path has the identical hole.

**Severity: Critical** — a routine daily-use RPC (called by every teacher, every day) with no defense against a malformed or malicious child ID.

---

### C3 — `enroll-child`'s two-RPC saga is not atomic; a `link_child_guardian` failure orphans the child and a retry creates a duplicate

**Where:** `supabase/functions/enroll-child/index.ts` (lines 188–216) and identically in `src/services/childEnrollmentService.ts` (lines 82–90).

The saga, after guardian resolution, does:

1. `enroll_child_row` (RPC call #1 — its own transaction) → creates the `children` row.
2. `link_child_guardian` (RPC call #2 — a **separate** transaction) → creates the `child_guardian_links` row.

If step 2 fails, the code throws `EXTERNAL_AUTH_ADMIN_FAILURE` immediately (line 215 / line ~90) with **no compensation** — unlike every other saga step in both Epic 1 and Epic 2, which compensate (delete the just-created Auth user) on a downstream failure. The just-created child row is left in the database with zero guardians linked to it.

This is compounded by the idempotency wrapper (`withIdempotency`, called around the entire `runEnrollChild`): the response snapshot is only written to `jobs.idempotency_keys` **after** the wrapped function resolves successfully. Because step 2's failure throws before that point, the idempotency key is never stored. A client that retries the same logical request (same idempotency key, standard retry-on-failure behavior) will re-run `runEnrollChild` from scratch. The guardian-phone lookup correctly finds the already-created guardian (no duplicate guardian), but `enroll_child_row` has **no natural uniqueness key for a child** (no equivalent of `attendance_records`' `(child_id, date)` or `evaluations`' `(child_id, lesson_id)`) — so the retry inserts a **second, duplicate child row** for the same enrollment.

**Impact:** a single transient failure between two RPC calls (network blip, connection pool exhaustion, Postgres momentarily unavailable — not exotic conditions) produces either (a) a permanently orphaned child with no guardian, if the caller does not retry, or (b) a duplicate child, if the caller does retry — and the system's own idempotency-key convention, which exists specifically to make retries safe (§2.2, §25.6), does not protect this endpoint at all in this specific failure window.

**Severity: Critical** — directly undermines the idempotency guarantee this codebase treats as a load-bearing, universal convention ("every mutating RPC/Edge Function... guarantees calling it twice with the same key... returns the same result... without re-executing" — §25.6), and the failure mode (duplicate child enrollment) is a real operational problem, not a cosmetic one.

---

## High

### H1 — The §25.2 bilingual structured-error contract is defined in every RPC but never consumed anywhere in the TypeScript layer

**Where:** all seven RPC bodies in `20260715000007_epic2_rpc_functions.sql` (each `RAISE EXCEPTION ... USING DETAIL = json_build_object('code', ..., 'human_message_en', ..., 'human_message_ar', ...)`), versus `src/repositories/childRepository.ts`, `attendanceRepository.ts`, `evaluationRepository.ts` (each simply `if (error) throw error;`).

`BACKEND_ARCHITECTURE.md` §25.2 requires: *"the DETAIL field carrying a JSON payload {code, human_message_en, human_message_ar} — PostgREST surfaces this in a predictable shape the client SDK can pattern-match on, rather than parsing free-text error strings."* Every Epic 2 RPC correctly builds this payload. But:

- The five repositories that wrap these RPCs (`childRepository`, `attendanceRepository`, `evaluationRepository`) rethrow the raw Postgrest error object unmodified — no code anywhere parses `error.details` (where PostgREST places the `DETAIL` clause content) back into a `{code, message_en, message_ar}` shape.
- There is no RPC-side equivalent of `toErrorResponse`/`AppError.toResponseBody()` — that reshaping exists only for the two Edge Functions.
- The five RPC-only endpoints (`mark_attendance`, `submit_evaluation`, `withdraw_child`, `suspend_child`, `reactivate_child`) — which, per `BACKEND_ARCHITECTURE.md` §14.1, are meant to be called directly from the frontend via `supabase.rpc()`, not through an Edge Function — therefore have **no clean bilingual error path built anywhere** in this delivery. A frontend integration calling these directly today would receive a raw `PostgrestError` with an unparsed JSON string sitting in `.details`.

**Severity: High** — the bilingual-error architecture is a named, explicit requirement (not an implementation detail) precisely because the frontend is bilingual throughout, and it is unimplemented for the majority (5 of 7) of this Epic's new RPCs.

### H2 — No cross-table tenant-consistency enforcement exists anywhere in the Epic 2 schema

**Where:** every FK in migrations 2–4 that references another tenant-scoped table without a same-tenant check: `classrooms.coordinator_staff_id`, `subjects.teacher_staff_id`, `lessons.created_by`, `evaluations.created_by`, `concerns.raised_by`, `attendance_records.marked_by`, `staff_leave_records.covering_staff_id`, `staff_leave_records.staff_profile_id`, etc.

None of these columns have a `CHECK` constraint or trigger verifying that the referenced row's own `tenant_id` equals the referencing row's `tenant_id`. This is the schema-level root cause behind C1/C2: because `tenant_id` is deliberately denormalized onto every row for RLS performance (§2.2), the system relies entirely on *application code* (RPCs, Edge Functions) to keep these values consistent — and this audit already found two concrete places (C1, C2) where that reliance is not backed up by validation. Even setting aside the RLS-bypass angle, a bug in any future service-role code path (a scheduled job, a future Edge Function, a manual `psql` fix) has no database-level backstop against creating a row whose FK-referenced entities belong to a different tenant than the row itself claims.

**Severity: High** — this is a structural gap, not a one-off bug; C1 and C2 are two concrete symptoms of it, but the underlying absence of a consistency backstop is the more durable risk.

### H3 — `evaluations` and `day_path_events` lack a denormalized `classroom_id`, forcing RLS policies into a subquery join, contradicting §13.1's stated invariant

**Where:** `academic.evaluations` and `academic.day_path_events` table definitions (migration 3); `evaluations_select_teacher`, `evaluations_insert_teacher`, `evaluations_update_teacher`, `day_path_events_select_teacher` policies (migration 6).

`BACKEND_ARCHITECTURE.md` §13.1 states, as an explicit, "zero exceptions" design invariant: *"every RLS policy in the system — without exception — is a single equality check (plus, where relevant, one of the role-conditioned ownership branches), never a subquery or a join."* Because `evaluations` and `day_path_events` only carry `child_id` (not `classroom_id`), the teacher-scoping policies on both tables must join through `academic.children` to determine classroom membership:

```sql
child_id in (select id from academic.children where deleted_at is null and classroom_id = any(public.current_staff_classroom_ids()))
```

This is a genuine subquery, not a single equality check, and is a direct deviation from the stated invariant every other Epic 1/Epic 2 table follows (every other table with a teacher-scoping policy carries `classroom_id` directly). Every one of these RLS-governed operations (list evaluations, submit an evaluation, list a child's day-path history) now pays for a nested-loop or hashed subquery against `children` per policy evaluation, rather than a direct indexed comparison.

**Severity: High** — not an immediate outage risk at small scale, but a measurable, avoidable violation of the system's own stated performance-critical design rule, on two of this Epic's higher-traffic tables (evaluations are written multiple times per classroom per day; day-path events are the backing table for a realtime channel).

### H4 — Test coverage is 100% mock-based; zero executed coverage exists for any of the logic where C1–C3 live

**Where:** `tests/unit/academicRecordService.test.ts`, `childEnrollmentService.test.ts`, `academicApiRoutes.test.ts`, `academicValidation.test.ts`, `addStaffService.test.ts` (all Epic 2 unit tests) versus `tests/rls/epic2_rls_adversarial.sql` (written, never executed).

Every one of the 50 new Vitest tests replaces the database with a hand-written fake object (`vi.fn()`). This is a legitimate and clearly-disclosed choice (mirroring Epic 1's approach, and honestly documented as such in the completion report), but it means: **not one of the 83 "passing" tests would have failed if C1, C2, or C3 were present** — and they are present. The only place any of this logic is actually exercised against something resembling real Postgres semantics is `epic2_rls_adversarial.sql`, which this delivery explicitly did not run (no Docker/live project available), and which — even if it had been run — does not contain a test for C1 (direct-insert capacity bypass on `children`), C2 (`mark_attendance` cross-classroom/cross-tenant `childId`), or C3 (the saga's partial-failure/duplicate-on-retry path). Those three specific scenarios have no test anywhere in this delivery, executed or not.

**Severity: High** — the completion report's "83/83 tests passing" and "coverage" language, while factually accurate, does not support the confidence level a reader would reasonably infer from it regarding correctness of the actual database logic.

---

## Medium

### M1 — `suspend_child`/`reactivate_child` use a check-then-update without a row lock, permitting a race on the "already processed" guard

**Where:** `20260715000007_epic2_rpc_functions.sql`, `public.suspend_child` (lines 377–416) and `public.reactivate_child` (lines 418+).

Both functions do a plain `SELECT * INTO v_row FROM academic.children WHERE ...` (no `FOR UPDATE`), check `v_row.membership_status`, and only then issue a separate `UPDATE`. Two concurrent calls to `suspend_child` for the same child can both read `membership_status = 'active'`, both pass the guard, and both proceed to `UPDATE ... SET membership_status = 'suspended'` — the second call's intended `STATE_ALREADY_PROCESSED` rejection silently never fires. Contrast with `withdraw_child` in the same file, which correctly folds its "not already withdrawn" check into the `UPDATE ... WHERE deleted_at IS NULL` clause itself, making the check-and-set atomic. `suspend_child`/`reactivate_child` should follow the same pattern but don't.

**Impact:** low real-world likelihood (requires two genuinely concurrent suspend calls for the same child), and no data corruption results (both converge on the same final state) — but it is a real, avoidable correctness gap in the exact category ("Concurrency Risks") this audit was asked to check, and the codebase already demonstrates the correct pattern two functions away.

### M2 — `current_staff_classroom_ids()`'s subject-teacher branch does not exclude soft-deleted classrooms

**Where:** `20260715000005_epic2_rls_helpers.sql`, `current_staff_classroom_ids()` (lines 21–33).

The function's first branch (`classrooms.coordinator_staff_id`) correctly filters `deleted_at is null`. The second branch (`academic.subjects where teacher_staff_id = auth.uid()`) has no equivalent filter — `academic.subjects` has no `deleted_at` column at all, and the branch does not join back to `classrooms` to check the classroom's own `deleted_at`. A teacher who was ever assigned a subject in a classroom that is later soft-deleted retains "assigned" status to that classroom indefinitely through this branch, which means continued RLS-granted read/write access to that classroom's (soft-deleted) children, evaluations, and attendance records via every policy that depends on this helper.

### M3 — Validation has drifted between the deployed Edge Function and the parallel Zod schema

**Where:** `supabase/functions/enroll-child/index.ts`'s hand-rolled `validate()` (lines ~76–91) versus `src/validation/academic.schema.ts`'s `childFieldsSchema`.

The Zod schema enforces `addressLat`/`addressLng` numeric ranges (-90..90 / -180..180), string length caps on every optional field, and strict enum membership. The Edge Function's own `validate()` — which is what actually runs in production, since the Zod-validated `enrollChildRoute` API-layer path is not wired into any deployed entry point — only checks presence/format of `classroomId`, `child.name`, `child.dob`, `child.gender`, `child.package`, and the guardian fields. Every other field (blood type, allergies, notes, address, lat/lng, emergency contact, father/mother details) passes through to `enroll_child_row` with no server-side validation at all beyond whatever a raw Postgres type cast happens to reject. This mirrors a pattern already present in Epic 1 (`provision-tenant`'s own inline `validate()` vs. `tenant.schema.ts`), so it is not a new category of problem, but Epic 2 both continued it and widened the gap (more optional, unvalidated fields on `children` than Epic 1's tenant-provisioning payload had).

### M4 — Error classification via substring-matching on exception message text is fragile and produces misleading error codes

**Where:** `supabase/functions/enroll-child/index.ts`, lines 195–204:

```ts
const detail = (childErr as { message?: string }).message ?? 'enroll_child_row failed';
if (detail.includes('full capacity')) { throw new AppError('VALIDATION_FAILED', ...); }
if (detail.includes('not found')) { throw new AppError('NOT_FOUND', ...); }
throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', ...);
```

This works today only because the two handled cases happen to have those exact substrings in their `RAISE EXCEPTION` primary message. Any other failure from `enroll_child_row` — an invalid enum value reaching the cast (`(p_child->>'gender')::academic.gender`), a numeric-cast failure on `addressLat`/`addressLng` (see M3 — nothing upstream stops a malformed value from reaching this cast), a transient connection error, a future code change that reorders/rewords the exception messages — falls through to `EXTERNAL_AUTH_ADMIN_FAILURE`, a code whose name specifically implies an Auth Admin API problem. This is actively misleading for whoever is triaging alerts or reading logs: a data-validation bug and an Auth-provider outage would be indistinguishable by error code alone.

### M5 — `link_child_guardian` trusts its caller entirely; no verification that the child/guardian belong to the stated tenant

**Where:** `20260715000007_epic2_rpc_functions.sql`, `public.link_child_guardian` (lines 133–147).

This `service_role`-only RPC inserts a `child_guardian_links` row using whatever `p_child_id`, `p_guardian_id`, and `p_tenant_id` it is given, with no query verifying those IDs actually correspond to rows belonging to that tenant. It is safe today only because its single caller (the `enroll-child` Edge Function) happens to always pass mutually consistent values. `BACKEND_ARCHITECTURE.md` §14.3 states every RPC should validate rather than trust that the caller got it right — normally RLS is the backstop for that principle, but this function runs as `service_role` (RLS does not apply), so there is no backstop of any kind here, only caller discipline.

### M6 — No DB-level format/range validation on children's free-text contact and geo fields

**Where:** `academic.children` table definition (migration 2) — `father_phone`, `mother_phone`, `emergency_contact_phone`, `address_lat`, `address_lng`, and related columns.

Unlike the login-identity phone columns (`tenant_phone_registry.phone` has an E.164 `CHECK` constraint), these informational-only phone fields and the geo-coordinate fields have no `CHECK` constraint at all at the database layer. Combined with M3 (the actual enforcement point — the Edge Function — not validating these either), there is currently no layer, executed or not, that rejects a garbage value in these columns before it lands in the database.

---

## Low

### L1 — SECURITY DEFINER functions pin `search_path = public` rather than the hardened empty string

**Where:** all three new helper functions in `20260715000005_epic2_rls_helpers.sql`.

Current Supabase/Postgres security guidance for `SECURITY DEFINER` functions recommends `SET search_path = ''` with fully-qualified references, to eliminate any possibility of search-path-based object shadowing. All three Epic 2 helpers already fully-qualify every reference (`academic.classrooms`, `public.current_tenant_id()`, etc.), so this is not currently exploitable — but it is a known linter-flagged deviation from best practice, inherited unchanged from Epic 1's identical pattern rather than improved.

### L2 — `mark_attendance` processes records with a per-row loop instead of a set-based upsert

**Where:** `20260715000007_epic2_rpc_functions.sql`, lines 206–218.

The function loops over `jsonb_array_elements(p_records)` and issues one `INSERT ... ON CONFLICT` per child, rather than a single set-based `INSERT ... SELECT ... FROM jsonb_array_elements(...) ON CONFLICT`. Not a correctness issue and unlikely to matter at typical classroom sizes, but a real, avoidable inefficiency worth revisiting if this RPC's usage pattern changes (larger classrooms, bulk multi-classroom marking, etc.).

### L3 — `write_audit_log` call results are never checked in either Edge Function

**Where:** `enroll-child/index.ts` (line ~230) and `add-staff/index.ts` — both `await admin.rpc('write_audit_log', {...});` with no error check.

A failed audit-log write is completely silent — no thrown error, no `console.error`, nothing. This is an unchanged carry-over of an identical pattern already present in Epic 1's `provision-tenant`, so it is not a new regression, but it is a real gap worth noting given `platform.audit_log`'s stated role in compliance/security-incident reconstruction (§23) — a silently-failing write undermines exactly the guarantee that table exists to provide.

### L4 — Reception's classroom access is full-row while children's is column-narrowed, an inconsistent application of the same principle

**Where:** `classrooms_select_reception` policy vs. `academic.children_reception_safe()`.

Reasonable today (classrooms carry no PII-equivalent field), but the two tables apply "give Reception only what they need" differently — one via RLS row access to every column, one via a dedicated narrow function — which is worth revisiting if `classrooms` ever gains a sensitive column (e.g., internal notes) in a later Epic, since the precedent set here is "full access unless a column is obviously sensitive," not "narrow by default."

### L5 — Indexing strategy is not exhaustive against every plausible Epic 2 query shape

**Where:** `20260715000003_epic2_academic_records_tables.sql`'s index set.

E.g., no dedicated index backs `concerns_select_teacher`'s `raised_by = auth.uid()` filter beyond what a sequential scan or the existing `(child_id, created_at desc)` index incidentally helps with; no index on `attendance_records.marked_by`. Unlikely to matter at current expected scale, but the completion report's claim of following §6 "row-for-row" is an overstatement — §6 doesn't enumerate these specific access patterns either, so this is a minor gap in both documents, not just the implementation.

### L6 — The Epic 2 seed script authenticates to Edge Functions using the `service_role` key as a bearer token

**Where:** `scripts/seed-dev-data-epic2.mjs`, both `fetch()` calls (`Authorization: Bearer ${serviceRoleKey}`).

Copied verbatim from Epic 1's `seed-dev-data.mjs` pattern. Works because `requireCaller()` will attempt to resolve whatever token is presented, but a `service_role` key is not a normal user JWT and this is dev-only tooling, not a production code path — low risk, but worth flagging since it's the kind of pattern a future maintainer could mistake for a supported caller shape.

---

## Findings by review category (cross-reference)

| Category | Findings |
|---|---|
| SQL migrations / Schemas / Tables | H2, H3, M6, L5 |
| Constraints / Foreign Keys | C1, H2, M6 |
| Indexes | H3, L5 |
| RLS Policies | C1, H2, H3, L4 |
| RPC Functions | C2, C3, M1, M2, M5, L2 |
| Edge Functions | C3, M3, M4, L3, L6 |
| Validation | M3, M6 |
| Services / API layer | C3, H1 |
| Security | C1, C2, H2, L1 |
| Multi-tenancy | C1, C2, H2, M5 |
| Performance | H3, L2, L5 |
| Scalability | H3, L2 |
| Supabase Best Practices | L1, L6 |
| Test Coverage | H4 |
| Error Handling | H1, M4, L3 |
| Transaction Boundaries | C3 |
| Concurrency Risks | C2 (indirectly, via unvalidated writes), M1 |

---

## Verdict

Epic 2 is **not production-ready as currently written**, specifically because of C1–C3: two of them are real security/data-integrity gaps reachable by any legitimately-authenticated manager or teacher (not requiring a compromised credential or unusual access), and the third is a genuine data-duplication bug under an ordinary transient-failure retry — not an edge case requiring adversarial conditions. None of the three require exotic circumstances to trigger. The High findings (H1–H4) compound the risk: the bilingual error contract gap (H1) means even a well-behaved client can't cleanly detect and handle these failure modes, and the test-coverage gap (H4) explains why none of this surfaced before now — the test suite that reports "83/83 passing" was never positioned to catch it.

The Medium and Low findings are real but individually lower-stakes; several (M3, L1, L3) are inherited, unimproved patterns from Epic 1 rather than new regressions, and are noted for completeness rather than as urgent items.

**This review recommends the three Critical findings be treated as blocking** before any live-project deployment or frontend integration pass against Epic 2's RPCs proceeds, and that H1/H4 be addressed alongside them since fixing C1–C3 without also building the error-surfacing layer (H1) and adding real (non-mocked) tests for the fixed behavior (H4) would leave this audit's findings undetectable again the next time something regresses.

**No code was changed. No fixes were applied. This document is the complete output of this review.**
