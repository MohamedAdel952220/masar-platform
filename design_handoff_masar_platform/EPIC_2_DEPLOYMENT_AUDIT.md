# Epic 2 Deployment Audit — Live Supabase Project vs. Intended Architecture

**Scope:** compares the deployed database (per the migration files that define it — see §0 Methodology) against `BACKEND_ARCHITECTURE.md`, `BACKEND_EXECUTION_PLAN.md`, `EPIC_1_COMPLETION_REPORT.md`, and `EPIC_2_COMPLETION_REPORT.md`. Documentation only. No redesign, no optimization, no Epic 3 work performed.

---

## 0. Methodology (read this first)

This sandbox has no live database connection tool (no `psql`, no Docker, confirmed absent — consistent with every prior report in this project, from `EPIC_1_COMPLETION_REPORT.md` onward). This audit cannot literally connect to the live Supabase project and query `information_schema`/`pg_catalog`.

Given the user's confirmation that "the migration history is clean" and "all migrations are synchronized," this audit instead treats the migration files in `backend/supabase/migrations/` as the authoritative definition of what is now live, and verifies **(a)** those files, individually and collectively, define exactly what the architecture requires, and **(b)** nothing in the repository (config, seed scripts, Edge Functions, frontend client) has drifted from what those migrations imply. Every inventory figure below was produced by parsing the actual migration file contents (via `grep`/small Node scripts), not recalled from memory or copied from prior reports — where a prior report's own figure was checked against this parse and disagreed, that is called out explicitly in §12, separately from actual gaps.

**This is the same honesty standard maintained throughout this project: a static/code-level audit standing in for direct live inspection, stated plainly rather than assumed away.**

---

## 1. Schemas

| Schema | Required by | Status |
|---|---|---|
| `tenancy` | Epic 1 | ✅ present |
| `identity` | Epic 1 | ✅ present |
| `platform` | Epic 1 (Epic 2 slice: none added) | ✅ present |
| `jobs` | Epic 1 (Epic 2 slice: none added) | ✅ present |
| `academic` | Epic 2 | ✅ present |

All 5 schemas required through Epic 2 are present. `config.toml`'s `[api] schemas` list (`["public", "tenancy", "identity", "academic"]`) correctly exposes `academic` via PostgREST and correctly continues to exclude `platform`/`jobs` from the public API surface, per `BACKEND_ARCHITECTURE.md` §34.

**Nothing missing.**

---

## 2. Tables

**24 tables total** (12 Epic 1 + 12 Epic 2), matching `BACKEND_EXECUTION_PLAN.md`'s Epic 1 §5 and Epic 2 §5 lists exactly:

Epic 1 (12): `tenancy.tenants`, `tenancy.plan_catalog`, `tenancy.plan_catalog_apps`, `tenancy.tenant_provisioning_state`, `tenancy.tenant_phone_registry`, `identity.staff_profiles`, `identity.guardian_profiles`, `identity.driver_profiles`, `identity.platform_admins`, `identity.service_accounts`, `platform.audit_log`, `jobs.idempotency_keys`.

Epic 2 (12): `academic.classrooms`, `academic.children`, `academic.child_guardian_links`, `academic.day_path_events`, `academic.attendance_records`, `academic.subjects`, `academic.lessons`, `academic.evaluations`, `academic.concerns`, `identity.staff_subjects`, `identity.staff_leave_records`, `identity.staff_feedback`.

**Nothing missing.**

---

## 3. Enums

**25 enum types total** (12 Epic 1 + 13 Epic 2), all present and correctly schema-placed:

Epic 1 (12): `tenant_status`, `plan_code`, `app_code`, `provisioning_step`, `phone_account_type` (`tenancy`); `staff_role`, `employment_status`, `language`, `platform_admin_tier`, `service_account_purpose`, `service_account_status` (`identity`); `audit_actor_type` (`platform`).

Epic 2 (13): `grade_level`, `gender`, `package_type`, `membership_status`, `day_path_status`, `guardian_relation`, `day_path_source`, `homework_status`, `concern_category`, `concern_priority`, `concern_status` (`academic`); `feedback_kind`, `feedback_severity` (`identity`).

**Nothing missing** — see §12 for a header/count labeling discrepancy found in two prior reports (documentation accuracy only, not a deployment gap).

---

## 4. Constraints

- **CHECK constraints:** every non-null/format constraint specified in `BACKEND_ARCHITECTURE.md` §5 is present (non-empty-name checks, numeric bounds, date-in-past checks, capacity `> 0`, rating range checks, evaluation score ranges `1–5`). Additionally present: the five `EPIC_2_REVIEW.md` M6 constraints on `academic.children` (`address_lat` ∈ [-90,90], `address_lng` ∈ [-180,180], and format checks on `father_phone`/`mother_phone`/`emergency_contact_phone`).
- **UNIQUE constraints:** `attendance_records (child_id, date)`, `lessons (subject_id, date)`, `evaluations (child_id, lesson_id)` all present, matching §5's uniqueness table and `EPIC_2_ARCHITECTURE_REVIEW.md` §14.5's natural-upsert-key requirement.

**Nothing missing.**

---

## 5. Foreign keys

Every FK specified in `BACKEND_ARCHITECTURE.md` §4's relationship table for Epic 2's tables is present, with the delete behaviors (`RESTRICT`/`CASCADE`/`SET NULL`) matching that table row-for-row (verified in the prior fix-pass report, re-confirmed by inspection here). The additive FK on Epic 1's `identity.staff_profiles.primary_classroom_id` → `academic.classrooms(id)` — anticipated by Epic 1's own column comment ("FK to academic.classrooms, added in Epic 2") — is present, added via `ALTER TABLE` in migration 2, with zero modification to the Epic 1 migration that created the column.

**Beyond simple FKs:** 12 tenant-consistency trigger functions (added during the `EPIC_2_REVIEW.md` H2 fix pass) enforce that every cross-reference between tenant-scoped tables (`coordinator_staff_id`, `teacher_staff_id`, `created_by`, `raised_by`, `marked_by`, `covering_staff_id`, and both `child_guardian_links` FKs) actually belongs to the same tenant as the referencing row — a guarantee plain FKs cannot express (an FK only proves the referenced row *exists somewhere*, not that it's in the same tenant). All 12 are present and attached to the correct tables.

**Nothing missing.**

---

## 6. Indexes

**35 indexes** across Epic 2's tables, covering every access pattern named in `BACKEND_ARCHITECTURE.md` §6: `tenant_id` baseline index on every tenant-scoped table, `(tenant_id, classroom_id)` and full-text search on `children`, `guardian_id`-only index on `child_guardian_links` (§3.13's "single hottest lookup"), `(classroom_id, date)` on `attendance_records`, `(child_id, created_at desc)` on `evaluations`, `(classroom_id, date desc)` on `lessons`, plus the `EPIC_2_REVIEW.md` L5 additions (`attendance_records.marked_by`, `concerns.raised_by`) and the H3-driven `classroom_id` indexes on `evaluations`/`day_path_events` (added alongside those columns).

**Nothing missing.**

---

## 7. RLS policies

| | Tables with `FORCE ROW LEVEL SECURITY` | Policies |
|---|---|---|
| Epic 1 | 9 | 35 |
| Epic 2 | 12 | 62 |

Every one of Epic 2's 12 tables has RLS enabled and forced. A static scan of all 62 Epic 2 policies confirms **zero remaining references to any set-returning function** (the class of defect `EPIC_2_DEPLOYMENT_FIX.md` addressed) — both `current_staff_classroom_ids()` and `current_guardian_child_ids()` are `uuid[]`-returning, and every `= ANY(fn())` call site resolves against that array-returning signature. Reception's column-narrowed access pattern (`children_reception_safe()`, `classrooms_reception_safe()`) is in place with no base-table policy granting reception full-row access to either table, matching `EPIC_2_ARCHITECTURE_REVIEW.md` §14.3 and the `EPIC_2_REVIEW.md` L4 fix.

**Nothing missing.**

---

## 8. Helper functions

| Function | Schema | Owner Epic | Present |
|---|---|---|---|
| `current_tenant_id()` | `public` | 1 | ✅ |
| `current_role()` | `public` | 1 | ✅ |
| `current_platform_admin_tier()` | `public` | 1 | ✅ |
| `is_platform_admin()` | `public` | 1 | ✅ |
| `is_platform_admin_manager_tier()` | `public` | 1 | ✅ |
| `current_staff_classroom_ids()` | `public` | 2 | ✅ (`uuid[]`-returning) |
| `current_guardian_child_ids()` | `public` | 2 | ✅ (`uuid[]`-returning) |
| `children_reception_safe()` | `academic` | 2 | ✅ |
| `classrooms_reception_safe()` | `academic` | 2 | ✅ |

**Nothing missing.**

---

## 9. RPC functions

| Function | Owner Epic | Present |
|---|---|---|
| `write_audit_log` | 1 | ✅ |
| `advance_tenant_provisioning` | 1 | ✅ |
| `idempotency_replay` | 1 | ✅ |
| `idempotency_store` | 1 | ✅ |
| `enroll_child_row` | 2 | ✅ |
| `link_child_guardian` | 2 | ✅ |
| `enroll_child_with_guardian` | 2 (added during `EPIC_2_REVIEW.md` C3 fix) | ✅ |
| `mark_attendance` | 2 | ✅ |
| `submit_evaluation` | 2 | ✅ |
| `withdraw_child` | 2 | ✅ |
| `suspend_child` | 2 | ✅ |
| `reactivate_child` | 2 | ✅ |

All match `BACKEND_EXECUTION_PLAN.md` Epic 2 §8's required RPC list plus the fix-pass addition. `EXECUTE` grants confirmed scoped correctly: `enroll_child_row`/`link_child_guardian`/`enroll_child_with_guardian` → `service_role` only (never directly client-callable, per the saga design); `mark_attendance`/`submit_evaluation`/`withdraw_child`/`suspend_child`/`reactivate_child` → `authenticated` (client-invocable RPCs per `BACKEND_ARCHITECTURE.md` §14.1).

**Nothing missing.**

---

## 10. Edge Functions

| Function | Owner Epic | Present |
|---|---|---|
| `provision-tenant` | 1 | ✅ |
| `suspend-staff-account` | 1 | ✅ |
| `reactivate-staff-account` | 1 | ✅ |
| `revoke-sessions` | 1 | ✅ |
| `regenerate-activation-link` | 1 | ✅ |
| `add-staff` | 2 | ✅ |
| `enroll-child` | 2 | ✅ |

7 of 7 required Edge Functions present in `backend/supabase/functions/`, matching `BACKEND_EXECUTION_PLAN.md` Epic 1 §7 and Epic 2 §7.

**Nothing missing.**

---

## 11. Storage buckets & Realtime

**Storage buckets (5):** `public-branding`, `profile-photos`, `identity-documents`, `generated-documents` (Epic 1) + `academic-attachments` (Epic 2), with tenant-prefix-scoped policies on all five. Matches `BACKEND_ARCHITECTURE.md` §21 and `EPIC_2_ARCHITECTURE_REVIEW.md` §7's "Epic 2 needs `profile-photos` (reused, no new policy) + `academic-attachments` (new shell)."

**Realtime (2 tables published):** `tenancy.tenants` (Epic 1, `platform:tenants` channel) + `academic.day_path_events` (Epic 2, `classroom:{id}:day_path` channel), matching `BACKEND_ARCHITECTURE.md` §15 and the execution plan's explicit note that this is the only Epic 2 channel wired (bus/trip-driven day-path writes remain Epic 3).

**Nothing missing.**

---

## 12. Seed data

- `supabase/seed.sql` (auto-applied by `supabase db reset`/first migration run): contains `tenancy.plan_catalog` (3 plans) + `tenancy.plan_catalog_apps` — **present, correct, Epic 1 scope only.** Consistent with the architecture's own rule that human identities (tenants/staff/guardians/children) are never seeded via raw SQL, only through the Auth Admin API.
- `scripts/seed-dev-data.mjs` (Epic 1 demo tenant + manager, via `provision-tenant`) and `scripts/seed-dev-data-epic2.mjs` (Epic 2 demo classroom + teacher + child + guardian, via `add-staff`/`enroll-child`) — both present and correct, but **both are manual, not automatically run** by a migration replay. Per `EPIC_2_DEVELOPMENT_RESET_PLAN.md` §7/§8, running them is the explicit "Integration Validation" step that follows migration + Edge Function deployment, not part of it.

**Nothing missing** — this is the architecture's intended design (schema and reference data ship via migrations/seed.sql; identity-bearing demo data ships via scripts calling the real provisioning path), not a gap. Noted here only to confirm the live database's actual row-level state depends on whether those two scripts have been run as a separate step — which this audit cannot verify without a live connection (§0).

---

## 13. Auth integration

Per `config.toml`, confirmed to match `BACKEND_ARCHITECTURE.md` §10/§34 exactly: phone-based auth for tenant-side roles, email-based for platform admin; `[auth.email] enable_signup = false` and `[auth.sms] enable_signup = false` (server-side provisioning only, no public self-signup, §10.3); MFA (`[auth.mfa.totp]`) enrollment/verification enabled, ready for the platform-admin-mandatory-MFA requirement (§28); `[auth.sms.twilio] enabled = false` — correctly still disabled, since real WhatsApp/SMS delivery is Epic 4 scope and Epic 1/2's activation-link and OTP dispatch remain intentionally stubbed (`_shared/activation.ts`).

**Nothing missing** for Epic 1+2 scope specifically — the Twilio/SMS provider gap is a known, already-documented Epic 4 dependency, not an Epic 2 regression.

---

## 14. Frontend integration assumptions

`ui_kits/_shared/supabaseClient.epic1.js`'s `window.MasarClient` surface currently exposes **only** Epic 1 methods (`provisionTenant`, `suspendStaffAccount`, `reactivateStaffAccount`, `revokeSessions`, `regenerateActivationLink`, plus `auth.*`). **Zero Epic 2 methods** (`enrollChild`, `addStaff`, `markAttendance`, `submitEvaluation`, `withdrawChild`, `suspendChild`, `reactivateChild`) exist in the frontend client, confirmed by direct inspection — no partial/broken wiring, simply absent.

This is **not a gap** — it is the explicit, deliberate scope boundary stated in `EPIC_2_COMPLETION_REPORT.md` §7 ("Out of scope for this delivery, by explicit instruction") and consistent with how Epic 1's own frontend integration was a separate, later-requested phase of work, not bundled into the backend delivery. `BACKEND_EXECUTION_PLAN.md`'s Epic sequencing treats "backend Epic ships" and "frontend wires up to it" as two distinct, separately-triggered steps throughout the whole plan, not a single atomic unit — so this does not block Epic 3, which is itself a backend Epic (Transport & Safety) with the same two-phase expectation.

**Confirmed assumption, not a missing item.**

---

## Missing items

**None.** Every schema, table, enum, constraint, foreign key, index, RLS policy, helper function, RPC function, Edge Function, storage bucket, and Realtime publication required by `BACKEND_ARCHITECTURE.md` and `BACKEND_EXECUTION_PLAN.md` through the end of Epic 2, and claimed as delivered by `EPIC_1_COMPLETION_REPORT.md`/`EPIC_2_COMPLETION_REPORT.md`, is present in the migration files that (per the user's confirmation) now define the live database's state.

---

## 15. Documentation accuracy notes (not deployment gaps — informational only)

Three header/list-count mismatches were found in prior reports while cross-referencing. None represent a missing deployed item — in each case every individually-named object is confirmed present; only the summary number in the report's own heading disagrees with its own list:

1. `EPIC_1_COMPLETION_REPORT.md` §4 states "26 policies across 9 RLS-enabled tables" — the actual, current count is **35 policies** across the same 9 tables.
2. `EPIC_1_COMPLETION_REPORT.md` §3 states "Enums (11)" but lists 12 names.
3. `EPIC_2_COMPLETION_REPORT.md` §4 states "Enums (15)" but lists 13 names.

These are pre-existing labeling errors in already-published reports, not something this audit is asked to correct (`do not redesign, do not optimize`), and none of them indicate anything absent from the deployed schema.

---

## Verdict

**READY FOR EPIC 3**

**Precise reasons:**
1. Every table, enum, constraint, foreign key, index, RLS policy, helper function, RPC, Edge Function, storage bucket, and Realtime publication specified for Epic 1 and Epic 2 by `BACKEND_ARCHITECTURE.md`/`BACKEND_EXECUTION_PLAN.md` is present and correctly configured, per the migration files that define the now-clean, synchronized live schema.
2. The specific defect that previously blocked deployment (set-returning functions inside RLS policy expressions) is fully resolved: zero remaining occurrences across all 62 Epic 2 policies, confirmed by static scan.
3. Epic 1 remains completely unmodified throughout the review/fix/patch/reset sequence — confirmed by empty diff, not assumed.
4. The one area with zero coverage — frontend wiring to Epic 2 endpoints — is a deliberate, already-documented scope boundary consistent with this project's established backend-then-integration pattern, not a defect, and does not gate the start of a new **backend** Epic.
5. No missing item was found in any of the sixteen audited categories.

**Caveat carried forward from every report in this project:** this audit was performed against the migration/code files that define the intended live state, not via a direct live-database connection (unavailable in this sandbox, §0). If the live project's actual applied-migration history differs from what these files describe — which the user has stated it does not — that would need to be re-verified through the Supabase dashboard or CLI (`supabase migration list --linked`) before this verdict can be treated as a live-database fact rather than a source-of-truth-file audit.

Not starting Epic 3.
