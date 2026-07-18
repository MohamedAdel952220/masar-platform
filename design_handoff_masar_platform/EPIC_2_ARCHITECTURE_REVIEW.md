# Epic 2 Architecture Review — Core Academic Data

**Status:** Pre-implementation review. Documentation only — no SQL written, no code modified, no migrations created.
**Basis:** `BACKEND_ARCHITECTURE.md` (Architecture Frozen v1.0, §1, §2.2, §3.10–3.18, §4–§8, §12–§16, §21–§27, §33, §35 Phase 1), `BACKEND_EXECUTION_PLAN.md` (Epic 2 — Core Academic Data), `EPIC_1_COMPLETION_REPORT.md`, `EPIC_1_INTEGRATION_REPORT.md`, and a targeted re-read of the live frontend (`ui_kits/nursery-dashboard/DashboardChildren.jsx`, `DashboardClassrooms.jsx`, `DashboardTeachers.jsx`, `DashboardAttendance.jsx`, `teacher-app/TeacherReports.jsx`, `parent-app/ParentApp.jsx`, `ParentAcademics.jsx`).
**Purpose:** Validate that the frozen architecture's Epic 2 slice is complete, internally consistent, and matches what the frontend actually collects/displays, before a single migration is written.

---

## 0. Executive summary

The architecture doc's Epic 2 slice (academic schema, §3.10–3.18) is substantially sound and does not need a structural rewrite. This review found **zero Critical** gaps (nothing that would require a breaking schema change after data exists), but surfaces **five schema clarifications** (§14) that are cheap to resolve now and expensive to resolve after Epic 2 ships real child/guardian data, plus **two scope boundaries** that need an explicit decision before implementation starts (billing/fee fields appearing in the live "Add child" form, and camera-classroom linkage appearing in the live Classrooms screen — both belong to later Epics per the architecture doc, and the frontend already has UI for them). Epic 1's foundation (tenancy, identity, RLS helpers, audit log, idempotency ledger, provisioning pattern) is exactly what Epic 2 needs and nothing is missing at that layer.

---

## 1. Entities belonging to Epic 2

Per `BACKEND_ARCHITECTURE.md` §1.1 ("PEOPLE & STRUCTURE" and "ACADEMIC" domain groups) and `BACKEND_EXECUTION_PLAN.md` Epic 2 §5:

| # | Entity | Domain group | Notes |
|---|---|---|---|
| 1 | Classroom | People & Structure | |
| 2 | Child | People & Structure | widest table in the system (§1.2) |
| 3 | ChildGuardianLink | People & Structure | many-to-many, tenant_id denormalized |
| 4 | DayPathEvent | Academic | append-only history behind `children.day_path_status` |
| 5 | AttendanceRecord | Academic | |
| 6 | Subject | Academic | |
| 7 | Lesson | Academic | |
| 8 | Evaluation | Academic | |
| 9 | Concern | Academic | |
| 10 | StaffSubject (join) | Identity (owned by Identity module, exercised first by Epic 2) | |
| 11 | StaffLeaveRecord | Identity | |
| 12 | StaffFeedback | Identity | complaints/commends, unified |

**Not Epic 2, despite adjacency** (confirmed against §33's module breakdown and explicitly flagged because the live frontend already has UI for both — see §13 below):
- `Camera` / `CameraClassroomLink` — Media module, Epic 6/Phase 6.
- `FeeItem` / `BillingLedgerItem` / `InstallmentPlan` — Billing module, Epic 5 (execution plan) / Phase 5 (architecture roadmap).
- `AIReportBatch` / `AIReportDraft` — Reports module, Epic 7 (execution plan) / Phase 7.
- `Request` / `Event` — Approvals module, Epic 4 (execution plan) / Phase 4.

---

## 2. Tables required

All in the `academic` schema except where noted (per §2.1's schema-per-concern layout):

1. `academic.classrooms` (§3.10)
2. `academic.children` (§3.11)
3. `academic.day_path_events` (§3.12)
4. `academic.child_guardian_links` (§3.13)
5. `academic.attendance_records` (§3.14)
6. `academic.subjects` (§3.15)
7. `academic.lessons` (§3.16)
8. `academic.evaluations` (§3.17)
9. `academic.concerns` (§3.18)
10. `identity.staff_subjects` (§3.4) — lives in the `identity` schema (owned by the Identity module per §33) but is functionally exercised by Epic 2; its migration ships in this Epic per the execution plan.
11. `identity.staff_leave_records` (§3.5)
12. `identity.staff_feedback` (§3.6)

**12 tables total.** This matches `BACKEND_EXECUTION_PLAN.md` Epic 2 §5's list exactly (`classrooms, children, day_path_events, child_guardian_links, attendance_records, subjects, lessons, evaluations, concerns, staff_subjects, staff_leave_records, staff_feedback`) — no discrepancy between the two source documents.

No new tables outside this list are proposed by this review (see §14 for column-level clarifications that stay within these 12 tables).

---

## 3. Relationships

Per §4's relationship table, the Epic 2 subset:

| Child table | Parent table | On parent delete | Notes |
|---|---|---|---|
| `classrooms` | `tenants` | RESTRICT | tenant never hard-deleted anyway |
| `children` | `classrooms` | RESTRICT | must reassign classroom before deleting it — **application-enforced**, not a DB cascade (§4) |
| `child_guardian_links` | `children`, `guardian_profiles` | CASCADE | link row meaningless without both sides |
| `attendance_records` | `children` | RESTRICT | soft-delete children, never hard-delete — history survives |
| `evaluations` | `children` | RESTRICT | same |
| `concerns` | `children` | RESTRICT | same |
| `lessons` | `subjects` | CASCADE | |
| `evaluations` | `lessons` | RESTRICT | |
| `day_path_events` | `children` | (append-only, no delete path modeled — see §14.1) | |
| `staff_subjects` | `staff_profiles`, `subjects`(?) | not explicitly stated in §4 — see §14.2 | |
| `staff_leave_records` | `staff_profiles` (and `covering_staff_id` → `staff_profiles`, nullable self-referencing FK) | not explicitly stated in §4 | |
| `staff_feedback` | `staff_profiles` | not explicitly stated in §4 | |

Additional relationships implied by column definitions but not in §4's table (gap noted for §14):
- `children.classroom_id → classrooms.id` (RESTRICT, stated above)
- `classrooms.coordinator_staff_id → staff_profiles.id`, nullable — delete behavior unstated (a terminated staff member who was a coordinator: does the FK block termination, or does it need `ON DELETE SET NULL`? Staff aren't hard-deleted per §8, only soft-deleted via `deleted_at`, so this FK never actually fires a delete-behavior clause in practice — but it should still be documented as `RESTRICT`-in-spirit / enforced-in-application, matching the pattern already used for `children → classrooms`.)
- `subjects.classroom_id → classrooms.id`, `subjects.teacher_staff_id → staff_profiles.id`
- `lessons.subject_id → subjects.id`, `lessons.classroom_id → classrooms.id` (denormalized alongside `subject_id` — both present per §3.16)
- `evaluations.child_id → children.id`, `evaluations.lesson_id → lessons.id`
- `concerns.child_id → children.id`, `concerns.raised_by → staff_profiles.id`

**Finding:** §4's relationship table does not explicitly list `staff_subjects`, `staff_leave_records`, `staff_feedback`, `day_path_events`, `subjects`, `lessons`, `concerns`, or `classrooms.coordinator_staff_id`'s delete behavior, even though their FK columns are defined in §3.4–3.6 and §3.10/3.15–3.18. This is a documentation completeness gap, not a design flaw — the reasonable inference from §8's general rule ("anything representing a historical fact is never hard-deleted and never cascades away when its container is removed") is that all of these follow `RESTRICT` (soft-delete the parent staff/child, never cascade), which is consistent with every other historical-fact table in the system. **Recommendation:** add these rows to §4 explicitly during Epic 2's migration-writing pass, rather than leaving them to per-developer inference.

---

## 4. RLS policies required

Per §12's permission matrix and §13's core pattern, applied to the 12 Epic 2 tables:

| Table | Guardian | Teacher | Reception | Manager | Driver | Platform Admin |
|---|---|---|---|---|---|---|
| `classrooms` | R (own child's) | R (own) | R (all, names only) | CRUD | – | – |
| `children` | R (own children only) | R (own classroom) | R (all, name/photo/parent only — **column-level narrowing**, see §14.3) | CRUD | – (Epic 2 has no bus data yet; this branch activates in Epic 3) | – |
| `child_guardian_links` | R (own) | – | – | CRUD | – | – |
| `attendance_records` | R (own child) | CU (own classroom) | – | R, CU (override) | – | – |
| `subjects` | R (own child's classroom, implied) | R/CRU (own) | – | CRUD | – | – |
| `lessons` | R (own child's classroom, implied — feeds Parent Academics screen) | CRU (own classroom) | – | R | – | – |
| `evaluations` | R (own child) | CRU (own classroom) | – | R | – | – |
| `concerns` | R (own child, non-escalated) | C, R (own) | – | CRUD | – | – |
| `day_path_events` | R (own child, current + own history) | R (own classroom, today) | C (system-generated) | R (own tenant) | – (Epic 2 slice: teacher/reception/system sources only; driver source activates Epic 3) | – |
| `staff_subjects` | – | R (own) | – | CRUD (own tenant) | – | – |
| `staff_leave_records` | – | R (own) | – | CRUD (own tenant) | – | – |
| `staff_feedback` | – | R (own, non-anonymous only) | – | CRUD (own tenant) | – | – |

Every one of these is the standard §13.1 baseline shape (`tenant_id = current_tenant_id()` AND a role-conditioned ownership branch), using the two RLS helper functions the execution plan calls out as first-exercised-with-real-data here:

- `current_staff_classroom_ids()` — teacher-scoped classroom visibility.
- `current_guardian_child_ids()` — guardian-scoped child visibility.

Both helpers are net-new for Epic 2 (Epic 1 only shipped `current_tenant_id()`, `current_role()`, `current_platform_admin_tier()`, `is_platform_admin()`, `is_platform_admin_manager_tier()` per the completion report §2.2/§4). `current_guardian_child_ids()` depends on `child_guardian_links` being indexed on `guardian_id` (§6 — already specified) since it's "the single hottest lookup on this table" per §3.13.

**Soft-delete policy doubling (§8):** `children`, `classrooms`, `staff_profiles`(-adjacent tables) all need the two-policy pattern from §8 — a default `deleted_at IS NULL` SELECT policy plus a separate, more restrictive manager/platform_admin-only policy for viewing soft-deleted rows. This applies to `children` and `classrooms` directly in Epic 2; it does not apply to `attendance_records`/`evaluations`/`concerns`/`lessons`/`day_path_events` since those are historical-fact tables with no `deleted_at` column at all (§8's soft-delete list does not include them).

**Concurrency-locked RLS interaction:** `children` inserts against `classrooms.capacity` require the `SELECT ... FOR UPDATE` row-locking convention (§2.2, §5) — this is an RPC-layer concern, not an RLS policy per se, but the RLS `WITH CHECK` on `children` INSERT (`tenant_id = current_tenant_id()`) still applies underneath the RPC's locking transaction.

---

## 5. Edge Functions required

Per §14.2's "Provisioning" and "Academic" groups, filtered to Epic 2:

1. **`enroll-child`** — `manager` only. Creates the `children` row, then **synchronously** provisions a `guardian_profiles` row + `auth.users` identity (phone, no password) + `tenant_phone_registry` row in the same transaction/Edge Function call (§10.3 step 2), OR links to an existing guardian phone number within the tenant if one already exists (sibling case — see §7's risk discussion). Returns `{child, guardian_activation_sent}`, never a credential (§10.3's no-plaintext-credential rule, already proven correct in Epic 1's `provision-tenant`).
2. **`add-staff`** — `manager` only. Creates a `staff_profiles` row (role `teacher` or `reception`) + `auth.users` identity, same provisioning pattern as `provision-tenant`'s manager-creation step, reusing the exact saga/compensation pattern (§25.3) and the Auth-Admin-API-port abstraction Epic 1 already built (`authAdminPort.ts`, per the completion report §2.4) — **this is a direct extension of Epic 1's `tenantProvisioningService`, not a new pattern to invent.**

Both Edge Functions are idempotency-key aware (§2.2/§14.3's blanket rule) and must reuse Epic 1's `_shared/{cors,errors,supabaseAdmin,auth,idempotency,activation}.ts` modules rather than duplicating that logic — the folder structure in §32 already anticipates `enroll-child`/`add-staff` as siblings of `provision-tenant` inside `supabase/functions/`.

Neither function needs a new external vendor dependency (no LLM, no payment gateway, no WhatsApp/SMS integration beyond the already-stubbed activation-link dispatch path Epic 1 built) — this is why they're implementable now without waiting on Epic 4's real notification provider.

---

## 6. RPCs required

Per §14.2 and Epic 2's execution plan §8, plus the RLS-helper functions from §13.1 (functions, not RPCs in the client-invocable sense, but required migration objects):

**Client-invocable RPCs:**
1. `mark_attendance(classroom_id, date, records[]) → attendance_summary` — `teacher`. Writes `attendance_records` rows **and** an `activity_log` summary row per §24's rule ("written by the same RPCs that perform the underlying action") — **caveat:** `activity_log` itself is an Epic 9/Phase 8 table (see §12 of this review); Epic 2's `mark_attendance` should be written to call a no-op-until-Epic-9 logging hook, or the activity-log write deferred entirely until that table exists. This is flagged explicitly in §12 as a cross-epic sequencing dependency, not silently worked around.
2. `submit_evaluation(child_id, lesson_id, understanding, participation, behavior, homework, note) → evaluation` — `teacher`.
3. `withdraw_child(child_id, reason) → child` — `manager`. Orchestrates the §8 cascade: soft-deletes `pickup_passes` and deactivates `bus_riders` **as one transaction** — but neither `pickup_passes` nor `bus_riders` exist yet in Epic 2 (they're Epic 3/Phase 2 tables). Per the execution plan's acceptance criteria (§19: "verified even though bus riders don't exist as a real feature until Epic 3 — schema-level correctness only at this point"), Epic 2's `withdraw_child` should be implemented to soft-delete `children` correctly and structured so the pickup-pass/bus-rider cascade steps are added additively in Epic 3 without rewriting the RPC's core transaction — e.g., as conditional blocks guarded by `IF EXISTS (... information_schema ...)` is over-engineering; the cleaner approach is a `withdraw_child` RPC in Epic 2 scoped to what exists today, with an Epic 3 migration that **extends** the same function body (`CREATE OR REPLACE FUNCTION`) to add the two new cascade steps. Documented here so the Epic 3 review doesn't rediscover this as a surprise.
4. `suspend_child(child_id, reason) / reactivate_child(child_id) → child` — `manager`. Toggles `membership_status`, does not withdraw. **Note:** `membership_status` "drives billing gating" per §3.11, but Billing doesn't exist until Epic 5 — this RPC is fully implementable in Epic 2 on schema grounds alone (it only touches `children.membership_status`), the billing-gating *effect* simply has no consumer yet.

**RLS helper functions (SECURITY DEFINER, not client-invoked, but required migration objects per §13.1):**
5. `current_staff_classroom_ids()` — returns the calling teacher's assigned classroom IDs (sourced from `staff_subjects` and/or `classrooms.coordinator_staff_id` — **the exact source is a schema clarification, see §14.4**).
6. `current_guardian_child_ids()` — returns the calling guardian's child IDs via `child_guardian_links`.

Every client-invocable RPC above follows §14.3's conventions: caller role/tenant validated inside the function body, stable bilingual error codes on violation (§25.1/§25.2), idempotency-key parameter and ledger check (§2.2, except `mark_attendance` and `submit_evaluation` — worth double-checking whether these are "natural upserts" exempt per §14.3's narrow exception list, or need the full idempotency treatment; `mark_attendance`'s unique `(child_id, date)` constraint makes it naturally idempotent on retry via `ON CONFLICT`, but `submit_evaluation` has no such natural key (a teacher could legitimately submit two evaluations for the same lesson+child in some workflows, or it could be meant as one-per-lesson-per-child) — **this needs an explicit decision before implementation, flagged in §14.5.**

---

## 7. Storage buckets required

Per §21's bucket table and Epic 2's execution plan §9:

1. **`profile-photos`** — child/staff/guardian photos. Bucket already exists (created empty in Epic 1, per the completion report §3 — "shells only, first real upload use is Epic 2+"). Epic 2 is where this bucket gets its first real objects and its first real `finalize_upload`/image-variant-generation traffic (§22.3, §26's "Image variant generation" background job).
2. **`academic-attachments`** — per the execution plan, "schema/policy only" in Epic 2; first real use is Epic 5's exam-paper uploads. Epic 2 should create the bucket + RLS-style path policies (mirroring §21's tenant-prefix convention) but does not need the full upload-flow RPC (`request_upload`/`finalize_upload` for this specific `owner_type`) wired end-to-end yet — that's Epic 5 work. **Recommendation:** still stand up the generic `request_upload`/`finalize_upload` RPCs in Epic 2 (they're needed for `profile-photos` anyway), since they're already `owner_type`-parameterized per §22.1 — Epic 5 then just adds `academic-attachments`'s `owner_type` to the existing allowlist rather than building new upload infrastructure.

`identity-documents` (Epic 1, already exists, unrelated to Epic 2) and `generated-documents` (Epic 1 shell, first real use in Epic 5/7) are not touched by Epic 2.

**Background job dependency surfaced here:** the "Image variant generation" job (§26, triggered on `finalize_upload` for photo owner types) needs to exist for Epic 2's child/staff photo uploads to produce thumbnail + display-size variants (§22.3). This job is not listed anywhere in `BACKEND_EXECUTION_PLAN.md`'s per-Epic breakdown explicitly — it's implicitly Epic 2's responsibility since it's the first Epic with real photo uploads, but the execution plan's Epic 2 §11 ("Background Jobs Involved") only lists "Provisioning cascade for guardian accounts." **This is a gap between the two planning documents flagged in §12.**

---

## 8. Realtime channels required

Per §15's matrix and Epic 2's execution plan §10:

1. **`classroom:{id}:day_path`** — `day_path_events` INSERT, subscribed by Parent (own child). Execution plan explicitly notes: "foundation laid here; fully exercised once Epic 3's bus/trip actions start writing to it." In Epic 2, the only sources writing to this channel are `teacher`, `reception`, and `system` (per `day_path_events.source` enum, §3.12) — the `driver` source is inert until Epic 3, since no bus/trip infrastructure exists yet. The channel and table must still support all four enum values from day one (§3.12 defines the full enum now), so Epic 3 doesn't need an enum-altering migration later.

No other Epic 2 realtime channel exists per §15 — `tenant:{id}:approvals` (Epic 4), `tenant:{id}:activity` (Epic 9), and every transport/chat/billing channel are out of scope here.

**Realtime + RLS note (§13.5):** `day_path_events`'s Realtime subscription automatically inherits its table's RLS policy — a guardian subscribing to `classroom:{id}:day_path` for a classroom that doesn't contain their child receives no rows, with no separate authorization layer to build.

---

## 9. Frontend screens that become connected

Per the execution plan's §18 and this review's direct re-inspection of the live frontend:

| Screen | Portal | Backend dependency |
|---|---|---|
| Children (roster, add/edit, profile, withdraw/suspend) | Dashboard | `children`, `child_guardian_links`, `classrooms`, `enroll-child` |
| Classrooms (list, add/edit, capacity, coordinator) | Dashboard | `classrooms` |
| Teachers (staff CRUD, subject assignment, leave, feedback) | Dashboard | `staff_profiles` (Epic 1, already live), `staff_subjects`, `staff_leave_records`, `staff_feedback`, `add-staff` |
| Attendance (mark present/absent, notify parents) | Dashboard | `attendance_records`, `mark_attendance` |
| Home (day-path status, live) | Parent App | `day_path_events`, `children.day_path_status`, `classroom:{id}:day_path` realtime channel |
| Subjects / Academics (read-only eval log) | Parent App | `evaluations`, `lessons`, `subjects` |
| Home (classes) | Teacher App | `staff_subjects`, `classrooms` |
| Roster / evaluation sheets | Teacher App | `children`, `evaluations`, `lessons`, `concerns` |

**Frontend-confirmed field inventory (this review's direct re-read, see §14 for the clarifications this surfaces):**
- `DashboardChildren.jsx`'s Add/Edit form collects: name, photo, dob, gender, classroom, package (full/half day), blood type, allergies, notes, father `{name, phone, job, national_id}`, mother `{name, phone, job, national_id}`, emergency contact `{name, phone, relation}`, address `{street, building, area, city, lat/lng map pin}` — **all present in §3.11's `children` table definition, one-to-one.** No missing columns found on the `children` table itself.
- The same screen also renders **billing fields** (fee, paid, balance, status, cycle, next-due) and a **payment-reminder action** directly on the child profile — these are Epic 5 (Billing) concerns per the architecture doc, not Epic 2. See §13 for the scope-boundary decision this requires.
- `DashboardClassrooms.jsx` also renders a **`cameraIds[]`** list on each classroom — an Epic 6 (Media) concern. See §13.
- `DashboardTeachers.jsx`'s `classes[]` structure (`{room, subject, days, sessions}`) confirms `staff_subjects`'s `days text[]` and `sessions_per_week int` columns (§3.4) are correctly shaped — no gap.
- `DashboardTeachers.jsx`'s `complaints[]`/`commends[]` use a `level` field (e.g. "attention") on complaints that mirrors `concerns.priority`'s vocabulary (`info/attention/urgent`) — `staff_feedback`'s schema (§3.6) already has an optional `severity enum(low, medium, high)` field, which is a *different* three-value set than `concerns.priority`. This is a naming/value inconsistency worth resolving before implementation — see §14.6.
- `DashboardTeachers.jsx` also shows an aggregate `rating` value per teacher — this is `staff_profiles.rating`, explicitly documented in §3.3 as "computed by scheduled job (§27), not user-writable." That scheduled job (`Staff rating recomputation`, §27, weekly) depends on `staff_feedback` existing, so it's a soft dependency of Epic 2 even though the job itself belongs to whichever Epic ships the jobs infrastructure (see §12).
- `DashboardAttendance.jsx` confirms attendance is a **binary present/absent** state (no "late") — matches `attendance_records.present bool` (§3.14) exactly, no gap. It also tracks **per-child, per-subject attendance** ("subjects attended" within a present day) — this is *not* modeled anywhere in `attendance_records` (§3.14 is one row per `(child_id, date)`, not per subject-session). See §14.1 for this finding.
- `teacher-app/TeacherReports.jsx`'s `StudentEvalSheet` confirms the 1–5 rating scale for understanding/participation/behavior and the `done/partial/none` homework enum — matches §3.17 exactly. It also has a `ConcernSheet` (category/priority/message) matching §3.18's shape, but **no visible `status` (open/acknowledged/resolved) control** in the frontend today — `concerns.status` exists in the schema (§3.18) but has no UI write path yet. This isn't a schema problem; it's a note that the Dashboard's "Concerns" management screen (implied by the Manager's CRUD permission in §12) needs a status-transition UI as part of Epic 2's frontend-integration step, or the field ships schema-complete but UI-incomplete (acceptable, same pattern Epic 1 used for guardian/driver profile shells).
- The monthly AI-report preview in `TeacherReports.jsx` uses a **0–100 aggregate scale**, distinct from the 1–5 per-evaluation scale — this is `ai_report_drafts.metrics` (§3.20, a jsonb snapshot), which is Epic 7 (Reports) scope, not Epic 2. No action needed in Epic 2 beyond ensuring `evaluations`/`attendance_records` carry enough raw data for that future aggregation (they already do — the 0–100 figure is presumably a derived average, computed at report-generation time in Epic 7, not stored anywhere in Epic 2's tables). Confirmed no Epic 2 schema change needed here.
- `parent-app/ParentApp.jsx`'s Home screen shows day-path states **At Home → In Bus → Classroom → Playing → Nap → Delivered**, each with a `state: done/live/pending` and a `time` — matches `children.day_path_status`'s enum (§3.11: `at_home, in_bus, classroom, playing, nap, delivered`) exactly, 1:1, no gap. The bus-phase sub-text ("In bus – heading to nursery/home") is presentation logic derived from `day_path_status` + `source`/time-of-day context, not a separate stored field — no schema change needed, but the `day_path_events.source` enum's `driver` value (inert until Epic 3, see §8) is what eventually backs this distinction.

---

## 10. API contracts Epic 2 depends on

From Epic 1 (already deployed, per `EPIC_1_COMPLETION_REPORT.md` and `EPIC_1_INTEGRATION_REPORT.md`):
- `current_tenant_id()`, `current_role()` RLS helpers — every Epic 2 RLS policy is built on these.
- `identity.staff_profiles` table + its RLS policies — Epic 2's `teacher`/`reception`/`manager` role checks resolve through this table, already live with 5 policies per the completion report.
- The Auth-provisioning pattern (`authAdminPort.ts`, saga/compensation per §25.3, no-plaintext-credential activation flow per §10.3) — `enroll-child` and `add-staff` are direct extensions of `provision-tenant`'s already-proven pattern, not new infrastructure.
- `platform.audit_log` + `write_audit_log` RPC — available for Epic 2 to write audit-relevant events into (staff added/removed is explicitly in §23's "what is audited" list), though most of Epic 2's day-to-day writes (attendance, evaluations) belong in `activity_log` (Epic 9), not `audit_log`.
- `jobs.idempotency_keys` + `idempotency_replay`/`idempotency_store` RPCs — Epic 2's `enroll-child`/`add-staff` Edge Functions and idempotency-key-bearing RPCs reuse this ledger directly.
- `tenancy.tenant_phone_registry` — every new guardian phone from `enroll-child` must write here in the same transaction, exactly as Epic 1's provisioning flow already does for managers.
- `MasarClient` (frontend, `ui_kits/_shared/supabaseClient.epic1.js`) — Epic 2's frontend-integration step (mirroring what was just done for Epic 1's Integration Validation pass) will extend this same `window.MasarClient` object with `enrollChild`/`addStaff`/`markAttendance`/`submitEvaluation` methods, following the exact pattern already established (busy/error state, bilingual `getErrorMessage`, idempotency-key generation via `crypto.randomUUID()`).

Epic 2 does **not** depend on any contract from Epic 3 onward — confirmed no forward dependency exists in either direction beyond the intentionally-inert `driver` source value and bus-rider withdrawal cascade noted in §5/§8/§11.

---

## 11. Dependencies on Epic 1

All satisfied by the already-deployed Epic 1 backend (per `EPIC_1_COMPLETION_REPORT.md`):

1. `tenancy.tenants`, `identity.staff_profiles` — Epic 2's `classrooms.coordinator_staff_id`, `subjects.teacher_staff_id`, `concerns.raised_by`, `attendance_records.marked_by`, `evaluations.created_by`, `lessons.created_by` all FK into `staff_profiles`, which is live with real rows (managers, at minimum) since Epic 1's `provision-tenant`.
2. `identity.guardian_profiles` — schema exists (Epic 1 created it empty, "schema ready for Epic 2 data" per the completion report §4). Epic 2 is the first Epic to write real rows here via `enroll-child`.
3. RLS helper functions and the zero-exception `tenant_id` convention (§2.2, §13.1) — Epic 1 proved this pattern works end-to-end (26 policies across 9 tables); Epic 2 extends the identical shape to 12 more tables.
4. The saga/compensation provisioning pattern (§25.3) and idempotency-key convention (§2.2/§25.6) — directly reused, not reinvented.
5. `MasarClient` frontend integration convention — directly reused (§10 above).
6. **Known Epic 1 limitation that Epic 2 inherits:** per `EPIC_1_INTEGRATION_REPORT.md` §5.1, the Dashboard's manager login uses email while the real manager Auth identity is phone-only — this is orthogonal to Epic 2 (child/guardian provisioning uses phone identity from the start, matching `enroll-child`'s design, so it does not inherit this specific mismatch), but it's called out here because Epic 2's own `add-staff` for `teacher`/`reception` roles must confirm it uses **phone**, not email, identity — consistent with `staff_profiles.phone` being the documented login factor (§10.2) and avoiding the same mismatch class the manager-login gap already demonstrated the cost of.
7. **Known Epic 1 limitation that Epic 2 resolves:** `EPIC_1_INTEGRATION_REPORT.md` §5.2 and §5.3 both note that "teacher/staff records... are still local mock data" and "no real Auth user id exists yet" for staff/driver accounts — Epic 2's `add-staff` Edge Function is precisely what resolves this for teachers/reception (driver remains Epic 3's responsibility). Once Epic 2 ships, the frontend integration follow-up should also **rewire `AccountCreatedDialog`'s `userId` field** (already plumbed for this in the Integration Validation pass, per §5.3 of that report — `makeAccount()` already accepts an optional `userId`) so `regenerate-activation-link`'s resend buttons become live for staff accounts. This is a small, already-anticipated frontend follow-up, not new design work.

---

## 12. Dependencies on future Epics

Documented so nothing here is silently deferred without a record:

| Epic 2 element | Depends on (future Epic) | What breaks if built in isolation |
|---|---|---|
| `withdraw_child`'s pickup-pass/bus-rider cascade | Epic 3 (`pickup_passes`, `bus_riders`) | Nothing breaks — the RPC ships scoped to what exists, extended additively later (§6, `CREATE OR REPLACE`). Documented so Epic 3's review doesn't rediscover this as a surprise. |
| `day_path_events.source = 'driver'` | Epic 3 (Transport) | Enum value exists from day one (§3.12), simply unused until Epic 3's bus actions start writing it. |
| `children.membership_status`'s billing-gating effect | Epic 5 (Billing) | The column and its transitions (`suspend_child`/`reactivate_child`) work fully in Epic 2; only the *consumer* (billing gating logic) doesn't exist yet. No rework needed later — Epic 5 reads a column that's already correctly maintained. |
| `mark_attendance`'s `activity_log` write | Epic 9 (Platform Operations, `activity_log` table) | `activity_log` doesn't exist until Epic 9/Phase 8. Epic 2's RPC must either omit this write entirely (with a `-- TODO(Epic 9)` marker) or the write target must be created as a minimal-schema stub earlier than Epic 9 intends. **This needs a decision — see §14.7.** |
| `academic-attachments` bucket's first real use | Epic 5 (exam-paper uploads) | Bucket + policies created empty in Epic 2 (mirrors exactly how Epic 1 pre-created `profile-photos` for Epic 2's use) — zero rework, this is the established pattern already proven working once. |
| `staff_profiles.rating` (read by Dashboard's Teachers screen) | Weekly "Staff rating recomputation" scheduled job (§27) — not tied to a specific Epic number in the execution plan, but logically depends on `staff_feedback` (Epic 2) existing first and `pg_cron`/jobs infrastructure (Epic 10/Phase 9) | Dashboard already renders a `rating` field today (currently client-side mock data). Once Epic 2 ships `staff_feedback` with real rows but the recompute job doesn't exist until Epic 10, `staff_profiles.rating` will either stay stale/manually-seeded or need a temporary manual-trigger path. **Flagged as a UX gap to accept knowingly, not a blocker** — same category of honest limitation Epic 1's Integration Report already documented for other fields (e.g., teacher accounts still being mock data). |
| Parent App's read-only academic screens going fully live | None beyond Epic 2 itself — but the **frontend-integration wiring** (replacing mock `evaluations`/`lessons` data with real `MasarClient` calls) is explicitly a separate, later step per the pattern established after Epic 1 (a dedicated "Integration Validation" pass), not bundled into the backend-only Epic 2 build. |
| `concerns.status` transition UI | No specific future Epic named in the execution plan — flagged as an open frontend gap (§9) that should be assigned to either Epic 2's own frontend-integration pass or explicitly deferred with a documented reason, not left ambiguous. |

---

## 13. Architectural risks

1. **Scope-boundary risk — billing fields already live in the `children` form.** `DashboardChildren.jsx`'s add/edit form and profile drawer today render fee/paid/balance/status/cycle/next-due fields and a "send payment reminder" action, none of which correspond to any Epic 2 table — they belong to `billing.fee_items`/`billing_ledger_items` (Epic 5). Because Epic 1's constraint set ("no code changes beyond what's asked, preserve existing UX") means this UI was never touched, Epic 2's frontend-integration step will need an explicit decision: wire the child-creation flow to real data while **leaving the billing fields as continued mock data** until Epic 5, or treat this as a scope trigger to pull minimal `fee_items`/`billing_ledger_items` scaffolding earlier. **Recommendation: leave billing fields as mock/placeholder through Epic 2's integration pass, exactly as Epic 1 already did for guardian/driver data it wasn't yet responsible for** — this is a proven, low-risk pattern, not a new risk to solve differently.
2. **Scope-boundary risk — `cameraIds[]` already live in the `classrooms` form.** Same shape of risk as #1, for Epic 6 (Media) instead of Epic 5. Same recommendation: leave as mock/placeholder.
3. **Guardian identity collision risk** (already named in the execution plan §25, restated here with the schema mechanism that resolves it): siblings entered with slightly different phone formatting across two `enroll-child` calls could create duplicate guardian identities if `enroll-child` doesn't normalize-and-check-first. Mitigation is already specified — `tenancy.tenant_phone_registry`'s `(tenant_id, phone)` unique constraint (§3.1.2, live since Epic 1) is the actual enforcement mechanism, but `enroll-child` must **query it first** (not just rely on the constraint to throw on insert) so the "link to existing guardian" path in §5's Edge Function description actually triggers instead of surfacing a raw uniqueness-violation error to the manager. This is an implementation-order risk (check-then-insert vs. insert-then-catch), not a schema risk.
4. **Data model rigidity risk** (already named in the execution plan §25): `children` is confirmed by this review's frontend re-read to be schema-complete against the live form today (§9) — this substantially de-risks the concern the execution plan raised, but the mitigation ("final field-by-field cross-check against the frontend inventory before this Epic is marked done") should still happen once more, immediately pre-migration, since UI can drift between this review and implementation start.
5. **Attendance granularity mismatch** (new finding, §9/§14.1): the live Attendance screen tracks per-child, per-subject session attendance within a present day, but `attendance_records` (§3.14) is one row per `(child_id, date)` with no subject dimension. If this finer granularity is actually required for Epic 2 (not just a frontend display artifact), it changes `attendance_records`'s grain — a decision needed **before** the migration is written, since changing grain after live attendance data exists is exactly the kind of "missed field discovered later" risk the execution plan's own §25 risk entry warns about. See §14.1 for options.
6. **`staff_feedback.severity` vs. `concerns.priority` vocabulary mismatch** (§9, §14.6): two conceptually similar three-value enums (`low/medium/high` vs. `info/attention/urgent`) with no stated relationship, in a system that otherwise reuses vocabulary deliberately (e.g., `preferred_language` is identical across every profile table). Low risk in isolation (they're genuinely different concepts — a complaint's severity isn't a child-concern's priority) but worth a deliberate "yes, these are intentionally different scales" confirmation rather than an accidental inconsistency.
7. **Cross-document gap on the Image variant generation job** (§7, §12): `BACKEND_EXECUTION_PLAN.md`'s Epic 2 §11 doesn't list this job, but `BACKEND_ARCHITECTURE.md` §22.3/§26 requires it for any real photo upload, which Epic 2 is the first Epic to produce. If this is missed at implementation time, child/staff photo uploads will store originals but never generate the thumbnail variant the frontend's list views are architected to request (§22.3) — a silent perf/UX gap, not a hard failure, but one that's cheap to catch now and easy to miss later since no test would fail without it (list views would just fall back to full-size images, degrading load time without an obvious error).
8. **RPC exemption ambiguity for `submit_evaluation`** (§6, §14.5): if `submit_evaluation` is wrongly treated as idempotency-exempt when it isn't naturally idempotent, a flaky-network retry could double-submit an evaluation — exactly the failure class §2.2's blanket idempotency-key rule exists to prevent. Low likelihood, but worth closing explicitly before implementation rather than discovering it via a duplicate-evaluation bug report later.
9. **Concurrency risk is already well-mitigated, noted for completeness, not as a new finding:** `children` INSERT against `classrooms.capacity` correctly falls under the `SELECT ... FOR UPDATE` convention (§2.2, §5) already specified system-wide — no new risk here, just confirming Epic 2's own capacity-constrained write (child enrollment into a classroom) is explicitly covered by the existing convention and not a Epic-2-specific edge case needing separate design.

---

## 14. Schema clarifications recommended before implementation

Numbered for direct reference from §3/§6/§9/§13 above. None of these require a structural rewrite; all are additive clarifications or small scope decisions.

**14.1 — Attendance grain: per-day vs. per-subject-session.**
`attendance_records` (§3.14) is `(child_id, date)`-unique — one present/absent fact per child per day. The live Attendance screen additionally tracks which subjects/sessions a present child attended within that day. Two resolution options, both additive to the current design:
  - (a) Keep `attendance_records` as the daily present/absent fact (matches the schema today, matches the Parent App's "was my child present today" question exactly), and model per-subject attendance as a derived/display concern read from `lessons`/`evaluations` presence rather than a stored fact — i.e., the frontend's "subjects attended" list is actually asking "for which subjects does a lesson+evaluation exist for this child today," not a new stored fact.
  - (b) If per-subject attendance needs to be an explicit, independently-markable fact (a child present for the day but marked absent for one specific session), add a `(child_id, date, subject_id)`-grained companion table — additive, does not change `attendance_records`'s existing grain, so it's a zero-risk addition even if decided later, but cheaper to decide before Epic 2 ships than after.
  **Recommendation:** confirm with product/frontend intent before writing the migration; this review defaults to option (a) as the lower-complexity interpretation consistent with the architecture doc's existing design, but flags it as a confirm-not-assume item.

**14.2 — `staff_subjects`'s relationship to `subjects` is unstated.**
§3.4 defines `staff_subjects` as `(staff_profile_id, tenant_id, subject_id, days[], sessions_per_week)` — but §4's relationship table never lists `staff_subjects → subjects` or `staff_subjects → staff_profiles`'s delete behavior. Given `subjects.teacher_staff_id` already exists as a direct FK on `subjects` itself (§3.15), the exact relationship between `subjects.teacher_staff_id` (one teacher per subject, stored on `subjects`) and `staff_subjects` (a teacher's assignment across potentially multiple classroom/subject/schedule combinations) needs to be stated explicitly: is `staff_subjects` the many-to-many assignment table that `subjects.teacher_staff_id` denormalizes the "primary" teacher from, or are these two independent facts that could disagree? **Recommendation:** document `subjects.teacher_staff_id` as authoritative for "who currently teaches this subject" and `staff_subjects` as the richer scheduling record (days/sessions), with an application-level (or trigger-enforced) consistency rule that a `staff_subjects` row's `subject_id` must belong to a `subjects` row whose `teacher_staff_id` matches — otherwise the two tables can silently drift.

**14.3 — Reception's "children, name/photo/parent only" column-level narrowing needs a mechanism.**
§12's matrix states Reception gets `R (all, name/photo/parent only)` on children — this is a **column-level** restriction, not a row-level one, which plain RLS (row filtering) cannot express on its own. §28 already names the general pattern ("PII minimization on the wire... narrowing the query is a deliberate additional control against over-fetching") but Epic 2 is the first Epic where this specific narrowing must actually be implemented, via either (a) a dedicated view (`academic.v_children_reception_safe`) that Reception's RLS policy targets instead of the base table, or (b) API-layer column selection discipline enforced in the PostgREST query the frontend issues (relying on the frontend to never request more columns, which is the weaker of the two options per §28's own stated principle). **Recommendation: use option (a)**, a dedicated view, since it's enforceable at the database layer rather than depending on client discipline — consistent with how Platform Admin's cross-tenant reads already use dedicated views (`platform.v_tenant_billing_summary` etc., §9) rather than trusting column selection alone.

**14.4 — `current_staff_classroom_ids()`'s exact source query is unspecified.**
§13.1 names this helper function but doesn't state whether "own classroom(s)" for a teacher means: rooms where `classrooms.coordinator_staff_id = current_user`, rooms implied by `staff_subjects.subject_id → subjects.classroom_id` for that teacher's subject assignments, or both unioned. Given a teacher can be a subject teacher in one room and a coordinator in another (§3.10's `coordinator_staff_id` is a distinct concept from subject-teaching per §3.3's "coordinator room" note), **the helper almost certainly needs to union both sources** — a teacher who coordinates Room A but only teaches a subject in Room B needs classroom-scoped visibility into both for the permission matrix's "R (own classroom)" to match actual coordinator duties (e.g., viewing the full roster of a room they coordinate but don't teach a subject in). **Recommendation:** define this explicitly as `SELECT classroom_id FROM classrooms WHERE coordinator_staff_id = current_uid() UNION SELECT classroom_id FROM subjects WHERE teacher_staff_id = current_uid()` (or the `staff_subjects`-sourced equivalent, consistent with whatever §14.2 resolves) before writing the migration — this directly determines whether the permission matrix's promise is actually honored.

**14.5 — `submit_evaluation`'s idempotency exemption status.**
§14.3 exempts only "natural upserts" (its example is `register_device_token`) from the mandatory idempotency-key convention. `submit_evaluation` has no natural uniqueness key stated in §3.17 (no `(child_id, lesson_id)` unique constraint is listed, unlike `attendance_records`' `(child_id, date)` or `lessons`' `(subject_id, date)`). **Recommendation:** either (a) add a `(child_id, lesson_id)` unique constraint if one evaluation per child per lesson is the intended business rule (making it a natural upsert, idempotency-exempt, and also closing a data-integrity gap where a UI bug or double-tap could otherwise create duplicate evaluation rows for the same lesson), or (b) explicitly require the idempotency-key parameter if multiple evaluations per child per lesson is intentionally allowed (e.g., a correction/amendment flow). Given the frontend's `StudentEvalSheet` (per §9's findings) appears to be a single per-lesson form with no visible "amend previous evaluation" UI, option (a) looks like the better fit, but this is a product-intent question this review cannot resolve unilaterally.

**14.6 — `staff_feedback.severity` vs. `concerns.priority` — confirm intentional vocabulary divergence.**
Named as risk #6 in §13; the recommendation here is simply to add one sentence to §3.6 stating explicitly that `staff_feedback.severity (low/medium/high)` and `concerns.priority (info/attention/urgent)` are deliberately independent scales for deliberately independent concepts (a staff performance signal vs. a child-welfare signal), so a future reader doesn't "fix" the apparent inconsistency by merging them.

**14.7 — `mark_attendance`'s `activity_log` write needs an explicit Epic 2 decision.**
Named as risk #7/dependency-table entry in §12. **Recommendation:** Epic 2 ships `mark_attendance` (and `submit_evaluation`, `withdraw_child`, `suspend_child`/`reactivate_child`) **without** the `activity_log` write — §24 describes `activity_log` as populated by "the same RPCs that perform the underlying action," which is achievable additively via `CREATE OR REPLACE FUNCTION` once Epic 9 ships the table, exactly the same additive-extension pattern already recommended for `withdraw_child`'s bus-rider cascade in §6/§12. This keeps Epic 2 fully deployable on its own schema without a forward reference to a table that doesn't exist yet, and avoids the alternative (creating a minimal `activity_log` stub ahead of Epic 9) which would fragment that table's ownership across two Epics for no real benefit.

---

## 15. Summary verdict

Epic 2's architecture is **implementation-ready with five clarifications (§14) and two scope-boundary decisions (§13, risks #1–#2) to resolve first** — none of which require changing a single column already specified in §3.10–3.18, §3.4–3.6. This is a materially lower-risk starting position than Epic 1 was (which had to resolve several v0-draft corrections before freezing); Epic 2 inherits an already-frozen, already-proven foundation and a frontend that, per this review's direct re-inspection, matches the `children`/`staff_subjects` schema field-for-field with no missing columns on the core entities themselves. The two scope-boundary findings (billing fields, camera fields already live in Epic-2-adjacent screens) are not schema defects — they're a reminder that the frontend was built screen-first, ahead of the backend Epic sequence, and Epic 2's integration pass should treat those fields exactly as Epic 1's integration pass already treated out-of-scope fields elsewhere: honestly left as mock data, explicitly documented, not silently wired to nothing or silently over-implemented ahead of schedule.

**No code, SQL, or migrations were written as part of this review, per instruction. Epic 2 implementation has not started.**
