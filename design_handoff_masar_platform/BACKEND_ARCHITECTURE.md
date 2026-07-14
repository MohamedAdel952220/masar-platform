# Masar Platform — Backend Architecture Specification

**Status: Architecture Frozen v1.0.** Frontend-frozen; this document is the authoritative, independently re-reviewed backend architecture for implementation on Supabase (Postgres + Auth + Storage + Realtime + Edge Functions).
**Revision:** v1.0 — incorporates fixes for every Critical/High/Medium/Low finding in `BACKEND_ARCHITECTURE_REVIEW.md` (v0), verified clean by `BACKEND_ARCHITECTURE_REVIEW_V2.md` (0 Critical / 0 High / 0 Medium / 0 Low outstanding). Corrections are called out inline where they affect a stated rule, so the rationale for each fix stays visible rather than silently overwritten.
**Scope:** Architecture and design decisions only. No SQL, no application code, no migrations. Every section is written so an engineer can implement it without making further architectural judgment calls.
**Source of truth:** Derived from the complete frontend inventory across all six portals — Platform Admin, Nursery Dashboard, Parent App, Teacher App, Reception App, Driver App.

---

## 0. System Summary

Masar is a **multi-tenant B2B2C SaaS** for nursery/daycare operations. The Masar company operates one platform; each nursery ("school") is a tenant with fully isolated data. Each tenant provisions a subset of five applications depending on plan tier:

| App | Consumer | Primary responsibility |
|---|---|---|
| Nursery Dashboard | Nursery owner/manager, admin staff | Tenant-side administration: children, staff, classrooms, billing, cameras, buses, reports, approvals |
| Parent App | Guardians | View child status, academics, payments, chat, pickup authorization, bus tracking, cameras |
| Teacher App | Teachers | Attendance/evaluation, lesson logging, reports, chat, requests to admin |
| Reception App | Front-desk/gate staff | QR pickup verification, bus arrival/departure confirmation |
| Driver App | Bus drivers | Route execution, per-child pickup/drop-off confirmation |
| Platform Admin | Masar operator (super-admin) | Tenant provisioning, billing, support, system health, cross-tenant broadcast, audit |

Five architectural pillars drive every decision below:
1. **Tenant isolation** — every tenant-scoped row is unreachable from another tenant, enforced at the database layer (RLS), not just in application code.
2. **Identity is polymorphic but unified** — one `auth.users` row per human, one `role` that determines which portal(s) and permissions apply.
3. **Real-time is a first-class concern** — GPS, chat, notifications, attendance, and camera status all need live propagation, not polling.
4. **Provisioning is a workflow, not a form** — creating a child creates a guardian account; creating a bus creates a driver account; creating a tenant creates a full app suite. This cascade must be modeled explicitly as an orchestrated process, not implicit side effects buried in table triggers.
5. **Everything is auditable** — financial, custody (pickup), and administrative actions must be reconstructable after the fact.

---

## 1. Complete Entity Relationship Model (ERM)

### 1.1 Domain grouping

```
TENANCY & IDENTITY
  Tenant (School) ──< StaffProfile (teacher/reception/manager)
                  ──< GuardianProfile (parent)
                  ──< DriverProfile
                  ──< ServiceAccount (machine identity, e.g. camera agent)
                  ──< TenantProvisioningState (1:1, workflow tracking)
                  ──< TenantBillingTransaction (tenant pays Masar)
  PlatformAdmin (global, no tenant; role tier: owner/admin/support)
  PlanCatalog (global, no tenant) ──< PlanCatalogApp (which apps a plan provisions)
  TenantPhoneRegistry (global lookup: enforces one phone = one login identity per tenant
                        across StaffProfile/GuardianProfile/DriverProfile)

PEOPLE & STRUCTURE
  Tenant ──< Classroom ──< Child
  Child ──< ChildGuardianLink >── GuardianProfile   (many-to-many, tenant_id denormalized)
  Classroom ──< CameraClassroomLink >── Camera       (tenant_id denormalized)

ACADEMIC
  Classroom ──< Subject ──< Lesson ──< Evaluation >── Child
  Child ──< Concern
  Child ──< AttendanceRecord >── Classroom
  Classroom/Child ──< AIReportBatch ──< AIReportDraft >── Child
  Tenant ──< AIUsageCounter (per-day AI call cap tracking, `reports` schema alongside AIReportBatch/Draft)
  StaffProfile ──< Request (event/trip/exam) ── reviewed by StaffProfile(admin)

EVENTS
  Request (approved) ──> Event ──< EventRSVP >── Child
  Event ──< EventTripRegistration >── Child

TRANSPORT
  Tenant ──< Bus ──< BusRider >── Child
  Bus ──< Trip ──< TripStop ──< TripStopRider >── BusRider   (which children ride which stop)
  Trip ──< TripChildStatus >── Child
  Trip ──< GPSPing

SAFETY / CUSTODY
  Child ──< PickupPass
  PickupPass ──< PickupScanEvent (Reception)

FINANCE
  Tenant ──< FeeItem ──< FeeItemApplicability >── Child   (tenant_id denormalized)
  Child ──< BillingLedgerItem >── FeeItem
  Child ──< InstallmentPlan ──< InstallmentScheduleEntry   (tenant_id denormalized)
  Child ──< Invoice ──< InvoiceLine                        (tenant_id denormalized)
  Invoice ──< PaymentTransaction

COMMUNICATION
  Conversation >── (StaffProfile, GuardianProfile) ──< Message
  Tenant ──< Announcement ──< AnnouncementRecipient
  Notification >── recipient (any account type)
  Account (any type) ──< DeviceToken            (push delivery targets)
  Account (any type) ──< NotificationPreference (per-category channel opt-in/out)

OPERATIONS / PLATFORM
  ActivityLogEntry (tenant-scoped)
  AuditLogEntry (platform-scoped + tenant-scoped)
  SupportTicket >── Tenant
  ServiceHealthStatus (global)
  StorageObject (polymorphic owner)
  ScheduledJobRun / BackgroundJobQueue
```

### 1.2 Cardinality highlights (non-obvious ones)

- `Child ←→ GuardianProfile` is **many-to-many** (siblings share guardians; a guardian may have children at only one tenant — cross-tenant guardians are out of scope for v1).
- `StaffProfile.role` distinguishes `teacher` and `reception` from the same table, matching the frontend's unified staff CRUD (Dashboard → Teachers screen manages both).
- `Trip` is a **derived operational entity**, not equal to `Bus`: a bus has many trips over time (one per leg per day). `TripChildStatus` is the row that answers "was this child picked up on this specific trip."
- `Camera` belongs to `Tenant` directly; the link to `Classroom` is optional (a camera can be "Shared/Common" with no classroom, per the frontend's `zone: Common` case) — hence a join table, not a foreign key on `Camera`.
- `AIReportBatch` can target a classroom (all children) or an explicit child list — model as batch + per-child draft rows, never a single "report" row with a list field, so each draft has independent status/edit/send lifecycle (matches Dashboard's per-draft review/edit UI).
- `Request` → `Event` is a **promotion**, not the same row: a teacher's pending request becomes a full Event only on approval. Keeping them separate tables avoids polluting the Events model with rejected/pending noise and matches the frontend's distinct "Approvals" vs "Events" screens.
- **Every tenant-scoped table carries `tenant_id`, including pure link/join tables** (`ChildGuardianLink`, `CameraClassroomLink`, `FeeItemApplicability`, `InvoiceLine`, `InstallmentScheduleEntry`, staff subject-assignment links). This is a deliberate denormalization, not an oversight: it is what makes the single-equality-check RLS baseline in §13.1 apply uniformly, with **zero exceptions**, to every table in the system — a join table that required a subquery through its parent to determine tenant membership would be the one RLS policy in the system that doesn't follow the stated performance rule, so the convention is applied without exception (see §2.2).
- `TripStop` is a **routing waypoint**, not a per-child fact — which children are expected at a given stop is modeled as a separate `TripStopRider` join row (stop × bus-rider), so a driver's manifest and ETA-per-child can be reconstructed directly instead of being inferred from address proximity at read time.
- `ServiceAccount` is **not one of the six human RBAC roles** (§11) — it is a parallel, API-key-authenticated machine identity (e.g., an on-prem camera relay agent) scoped to one tenant, used only for the narrow set of machine-to-machine calls that have no human session behind them (§10.7).
- `Camera.online` (heartbeat-derived, automatic) and `Camera.admin_disabled` (manager-set, manual) are **two independent booleans**, not one shared status field — this resolves the manual-toggle-vs-heartbeat-sweep conflict by giving each write path its own column instead of one contested value (§17).

---

## 2. Complete Database Design

### 2.1 Schema-per-concern layout (logical, within one Postgres database)

Supabase uses a single Postgres database; use **Postgres schemas** to separate concerns, not separate databases:

| Schema | Contents |
|---|---|
| `tenancy` | tenants, plan_catalog, plan_catalog_apps, tenant_provisioning_state, tenant_phone_registry |
| `identity` | staff_profiles, staff_subjects, staff_leave_records, staff_feedback, guardian_profiles, driver_profiles, platform_admins, service_accounts |
| `academic` | classrooms, children, day_path_events, child_guardian_links, subjects, lessons, evaluations, concerns, attendance_records |
| `reports` | ai_report_batches, ai_report_drafts, ai_usage_counters |
| `approvals` | requests, events, event_rsvps, event_trip_registrations |
| `transport` | buses, bus_riders, trips, trip_stops, trip_stop_riders, trip_child_status, gps_pings |
| `safety` | pickup_passes, pickup_scan_events |
| `billing` | fee_items, fee_item_applicability, billing_ledger_items, installment_plans, installment_schedule_entries, invoices, invoice_lines, payment_transactions |
| `comms` | conversations, messages, announcements, announcement_recipients, notifications, notification_deliveries, device_tokens, notification_preferences |
| `platform` | activity_log, audit_log, support_tickets, service_health_status, tenant_billing_transactions |
| `media` | cameras, camera_classroom_links, storage_objects |
| `jobs` | scheduled_job_runs, background_job_queue, idempotency_keys (execution itself happens via pg_cron/Edge Functions, see §26–27; these tables hold run-history, the retry queue, and the idempotency ledger respectively) |

Rationale: schema separation gives clean `GRANT` boundaries between the Supabase `service_role` (jobs schema, platform schema) and client-exposed schemas, keeps RLS policy files organized 1:1 with schemas, and lets `supabase db diff` output stay readable as the system grows past ~60 tables.

> **Correction from v0 draft**: `identity.roles` and `identity.permissions` are **not tables**. Roles are a fixed Postgres enum (§11.1); the "permissions reference" mentioned in §11.3 is documentation-as-data maintained outside the runtime schema (e.g., a seed/fixture file used to generate §12, not a table PostgREST or RLS ever queries). They are intentionally absent from the schema listing above so the listing reflects only what is actually migrated.

### 2.2 Design conventions (apply to every table)

- Every tenant-scoped table carries `tenant_id` directly (denormalized onto every row, not inferred through joins) — this is what makes RLS policies a single equality check instead of a subquery, which is the single biggest Postgres performance lever under RLS. **This applies without exception, including pure link/join tables** (`child_guardian_links`, `camera_classroom_links`, `fee_item_applicability`, `invoice_lines`, `installment_schedule_entries`, `staff_subjects`, `trip_stop_riders`) — every one of these carries its own `tenant_id` column even though it could technically be derived by joining to a parent, precisely so no table in the system is the exception that needs a different RLS policy shape (§13.1).
- Every table has `created_at`, `updated_at` (trigger-maintained), and, where soft-delete applies (§8), `deleted_at`.
- Every table has a `created_by` (nullable, references the acting account) for audit reconstruction, except pure event-stream tables (`gps_pings`, `notifications`) where the actor is implicit in the row's own actor column.
- No table stores derived/aggregate values that can be computed from child rows (e.g., a child's "attendance %" is a view/materialized view, not a stored column) — this matches production-grade normalization and avoids drift, at the cost of requiring the materialized-view refresh strategy in §29. The two intentional exceptions (`children.day_path_status`, and the `overdue`/`status` fields on billing tables) are called out explicitly in their own table definitions with the reason a live column was chosen over a pure view.
- **Capacity-constrained writes use row-level locking, not a bare application-side count check.** Any RPC that inserts against a fixed ceiling (`bus_riders` vs. `buses.capacity`, `event_trip_registrations` vs. `events.capacity`, `children` vs. `classrooms.capacity`) opens its transaction with `SELECT ... FOR UPDATE` on the parent capacity row (the bus/event/classroom) before counting and inserting, so two concurrent requests near the limit serialize instead of both passing the check and overbooking. This is a standing convention for every such RPC, not something re-decided per feature (see §5, §14.3).
- **Every client-invoked mutating RPC accepts an idempotency key.** Every RPC in the catalog (§14.2) that isn't naturally idempotent (i.e., anything that isn't a pure upsert-by-natural-key) takes a client-generated `idempotency_key uuid` parameter; the RPC's first action is to check a short-lived idempotency ledger (`jobs.idempotency_keys(key, tenant_id, caller_id, response_snapshot, created_at)`, 24h retention) and replay the prior response instead of re-executing if the key was already seen. This generalizes the pattern §20 already required for payments to every mutating RPC in the system, so a mobile client's retry-on-flaky-network never double-submits an attendance mark, a message, or an evaluation.

---

## 3. Table Definitions

Notation: types are conceptual (Postgres-native), not SQL statements. `enum:` denotes a Postgres enum type (or a `text` + `CHECK` constraint where the value set is expected to grow — noted per field).

### 3.1 `tenancy.tenants`

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text | |
| slug | text, unique | subdomain (`slug.masar.app`) |
| city | text | |
| plan_id | uuid, FK → plan_catalog | |
| status | enum: `trial, active, overdue, suspended` | |
| contact_name | text | |
| contact_email | text | |
| contact_phone | text | |
| trial_ends_at | timestamptz, nullable | |
| suspended_at | timestamptz, nullable | |
| suspended_reason | text, nullable | |
| created_at / updated_at | timestamptz | |

### 3.1.1 `tenancy.tenant_provisioning_state`
`tenant_id (PK, FK tenants), step enum(created, initial_manager_created, plan_apps_provisioned, welcome_sent, complete), last_error text nullable, updated_at` — one row per tenant, written by the `provision_tenant` Edge Function (§10.3) as each step of the multi-step provisioning workflow completes. Exists specifically to make provisioning resumable/idempotent: if the Edge Function fails partway (e.g., after creating the tenant row but before creating the initial manager account), a retry reads this row to know which steps to skip rather than re-running the whole cascade or leaving the tenant stuck.

### 3.1.2 `tenancy.tenant_phone_registry`
`id, tenant_id, phone, account_type enum(staff, guardian, driver), account_id uuid` — unique on `(tenant_id, phone)`. This is the concrete mechanism behind the cross-table phone-uniqueness rule in §5: every account-provisioning RPC (§10.3) inserts one row here in the same transaction as the `staff_profiles`/`guardian_profiles`/`driver_profiles` insert, and the table's own unique constraint is what actually enforces "one phone = one login identity per tenant" across three otherwise-unrelated tables (Postgres has no native cross-table uniqueness constraint, so this registry table *is* the constraint, not just a lookup convenience).

### 3.2 `tenancy.plan_catalog`

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| code | enum: `starter, growth, premium` | |
| monthly_price | numeric(10,2) | |
| setup_fee | numeric(10,2) | |
| max_children | int, nullable | plan ceiling, enforced at provisioning + soft-warned at 90% |

### 3.2.1 `tenancy.plan_catalog_apps`
`plan_id (FK plan_catalog), app_code enum(dashboard, parent, teacher, reception, driver)` — composite PK `(plan_id, app_code)`. Formalized as a join table (not an array column on `plan_catalog`) specifically so each row can later carry per-app metadata (e.g., a feature flag for that app on that plan) and so it can be foreign-keyed from provisioning logic — an array column can do neither.

### 3.3 `identity.staff_profiles`

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | = `auth.users.id` (see §10) |
| tenant_id | uuid, FK | |
| role | enum: `manager, teacher, reception` | manager = nursery admin/owner |
| name, name_ar | text | |
| phone | text, unique per tenant | |
| email | text, nullable | |
| photo_object_id | uuid, FK → storage_objects, nullable | |
| national_id | text, nullable | |
| preferred_language | enum: `en, ar` | default `ar`; drives which language notifications/WhatsApp/PDFs render in for this account (§16, §19) |
| join_date | date | |
| employment_status | enum: `active, on_leave, terminated` | transitioning to `terminated` synchronously triggers session revocation, §10.6 |
| primary_classroom_id | uuid, FK → classrooms, nullable | "coordinator" room |
| rating | numeric(2,1), nullable | computed by scheduled job (§27), not user-writable |
| deleted_at | timestamptz, nullable | |

### 3.4 `identity.staff_subjects` (join)
`staff_profile_id, tenant_id, subject_id, days text[], sessions_per_week int` — a teacher's subject assignments across classrooms. Carries `tenant_id` directly per the no-exceptions convention in §2.2.

### 3.5 `identity.staff_leave_records`
`id, staff_profile_id, from_date, to_date, reason, covering_staff_id (nullable, FK staff_profiles), created_at`

### 3.6 `identity.staff_feedback` (complaints/commends, unified)
`id, staff_profile_id, kind (enum: complaint, commend), from_name, subject text nullable, body text, severity enum(low, medium, high) nullable, occurred_at`

### 3.7 `identity.guardian_profiles`

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | = `auth.users.id` |
| tenant_id | uuid, FK | a guardian belongs to exactly one tenant in v1 |
| name, name_ar | text | |
| phone | text, unique per tenant | login identifier |
| email | text, nullable | |
| photo_object_id | uuid, nullable | |
| national_id | text, nullable | |
| preferred_language | enum: `en, ar` | default `ar` |
| deleted_at | timestamptz, nullable | |

### 3.8 `identity.driver_profiles`
`id (=auth.users.id), tenant_id, bus_id (FK, nullable — a driver can be unassigned), name, name_ar, phone, photo_object_id, national_id, preferred_language enum(en, ar) default ar, deleted_at`

### 3.9 `identity.platform_admins`
`id (=auth.users.id), name, email, role (enum: owner, admin, support), deleted_at` — no `tenant_id`; these accounts operate above tenancy. `role` here is a **permission tier**, not a display label: `owner` and `admin` get full cross-tenant CRUD per §12's matrix, `support` gets a deliberately narrower read/triage-only slice (support tickets, service health, read-only tenant metadata) — the three-way split is carried through explicitly in §12's Platform Admin sub-matrix, not collapsed to one blanket permission set.

### 3.9.1 `identity.service_accounts`
`id (uuid, PK — not an auth.users id, since these are not human sessions), tenant_id (nullable — null for platform-global integrations, set for tenant-scoped ones like a camera relay agent), name, purpose enum(camera_agent, integration_other), api_key_hash text (hashed, never stored/returned in plaintext after issuance), scopes text[] (e.g. `camera:heartbeat`), status enum(active, revoked), issued_by (staff_id or platform_admin_id), issued_at, revoked_at nullable, last_used_at nullable` — the backing table for machine-to-machine authentication (§10.7). A `service_account` is deliberately **not** one of the six RBAC roles in §11 — it never receives a Supabase Auth JWT and never appears as `current_role()` in an RLS policy; it authenticates via API key to a narrow set of Edge Functions that verify the key against this table and act with `service_role`, scoped in code to exactly the `scopes` granted.

### 3.10 `academic.classrooms`

| Field | Type |
|---|---|
| id, tenant_id | uuid |
| name | text |
| grade | enum: `pre_kg, kg1, kg2, nursery` |
| age_min_months, age_max_months | int |
| coordinator_staff_id | uuid, FK staff_profiles, nullable |
| capacity | int |
| color_tag | text |
| deleted_at | timestamptz, nullable |

### 3.11 `academic.children`

| Field | Type | Notes |
|---|---|---|
| id, tenant_id | uuid | |
| name, name_ar | text | |
| dob | date | |
| gender | enum: `male, female` | |
| blood_type | text, nullable | |
| allergies | text, nullable | |
| notes | text, nullable | |
| photo_object_id | uuid, nullable | |
| classroom_id | uuid, FK classrooms | |
| package | enum: `full_day, half_day` | |
| membership_status | enum: `active, overdue, suspended` | drives billing gating, distinct from live day-path |
| day_path_status | enum: `at_home, in_bus, classroom, playing, nap, delivered` | live/ephemeral — see §29 on keeping this out of the hot table |
| address_line, building, area, city | text | |
| address_lat, address_lng | numeric(9,6) | used for bus route optimization |
| emergency_contact_name, phone, relation | text | |
| father_name, father_phone, father_job, father_national_id | text, nullable | |
| mother_name, mother_phone, mother_job, mother_national_id | text, nullable | |
| enrolled_at | date | |
| deleted_at | timestamptz, nullable | soft-delete = withdrawal |

> `day_path_status` is intentionally still a column (not purely derived) because it is written at high frequency by drivers/teachers/reception and read live by parents — see §29 for the hybrid strategy (column + append-only history table).

### 3.12 `academic.day_path_events` (history/audit trail of the above)
`id, child_id, tenant_id, status, source (enum: driver, teacher, reception, system), actor_id, occurred_at` — append-only; the current `children.day_path_status` is just "last row" denormalized for read speed.

### 3.13 `academic.child_guardian_links`
`child_id, guardian_id, tenant_id, relation (enum: father, mother, guardian), is_primary_contact bool` — composite PK `(child_id, guardian_id)`. Carries `tenant_id` directly per §2.2's no-exceptions convention, and is indexed on `guardian_id` alone (§6) since "list this guardian's children" — the query behind the Parent App's multi-child switcher and every guardian-scoped RLS policy — is the single hottest access path on this table.

### 3.14 `academic.attendance_records`
`id, tenant_id, child_id, classroom_id, date, present bool, marked_by staff_id, notified_parent bool, notified_at timestamptz nullable` — unique constraint `(child_id, date)`.

### 3.15 `academic.subjects`
`id, tenant_id, classroom_id, name, teacher_staff_id`

### 3.16 `academic.lessons`
`id, tenant_id, subject_id, classroom_id, date, title_en, title_ar, covered_en, covered_ar, objective_en, objective_ar, created_by staff_id` — unique `(subject_id, date)`.

### 3.17 `academic.evaluations`
`id, tenant_id, child_id, lesson_id, understanding smallint(1-5), participation smallint(1-5), behavior smallint(1-5), homework enum(done, partial, none), note text, note_ai_polished bool, created_by staff_id, created_at`

### 3.18 `academic.concerns`
`id, tenant_id, child_id, raised_by staff_id, category enum(academic, behavior, social, health), priority enum(info, attention, urgent), message text, status enum(open, acknowledged, resolved), resolved_at timestamptz nullable`

### 3.19 `reports.ai_report_batches`
`id, tenant_id, type enum(monthly_progress, subject_report, behavior_social, attendance_summary), scope enum(classroom, children), classroom_id nullable, topic text nullable, created_by (staff_id), created_at`

### 3.20 `reports.ai_report_drafts`
`id, batch_id, tenant_id, child_id, body text, metrics jsonb (understanding/participation/homework/attendance snapshot), status enum(draft, ready, scheduled, sent), scheduled_for timestamptz nullable, sent_at timestamptz nullable, delivery_channels text[] (subset of: app, whatsapp, email), edited_by staff_id nullable`

> `metrics` is jsonb here deliberately — it is a point-in-time snapshot for display inside a report, not a queryable fact table; the real evaluation facts live in `evaluations`.

### 3.20.1 `reports.ai_usage_counters`
`id, tenant_id, usage_date date, calls_used int default 0` — unique on `(tenant_id, usage_date)`. **Formalized from the v0 draft's "one option among several"** into the single committed mechanism for the per-tenant daily AI-call cap (§19): every `ai_polish_note`/`ai_draft_report` Edge Function invocation atomically increments this row (`INSERT ... ON CONFLICT (tenant_id, usage_date) DO UPDATE SET calls_used = calls_used + 1 RETURNING calls_used`) and rejects the call with `EXTERNAL_AI_QUOTA_EXCEEDED` if the returned count exceeds the plan's daily cap.

### 3.21 `approvals.requests`
`id, tenant_id, submitted_by staff_id, type enum(event, trip, exam), exam_kind enum(weekly, monthly) nullable, title, classroom_id nullable, subject_id nullable, date, time, note text nullable, place text nullable (trips), price numeric nullable (trips), attachment_object_id uuid nullable, status enum(pending, approved, rejected), reviewed_by staff_id nullable, reviewed_at timestamptz nullable, rejection_reason text nullable`

### 3.22 `approvals.events`
`id, tenant_id, source_request_id uuid FK nullable, type enum(exam, celebration, trip), title, description, classroom_id nullable, date, time, place text nullable, price numeric nullable, capacity int nullable`

### 3.23 `approvals.event_rsvps`
`id, event_id, child_id, tenant_id, attendee enum(child, father, mother, both), extra_guest_name text nullable, extra_guest_relation text nullable, contact_phone text nullable, responded_at`

### 3.24 `approvals.event_trip_registrations`
`id, event_id, child_id, tenant_id, status enum(open, registered, paid, cancelled), payment_transaction_id uuid nullable FK` — a trigger enforces `status = 'paid' ⟹ payment_transaction_id IS NOT NULL` (and the reverse: setting `payment_transaction_id` only ever happens as part of the same RPC transaction that moves `status` to `paid`), so the enum and the FK can never drift apart — see §5.

### 3.25 `transport.buses`
`id, tenant_id, number, plate, capacity, service_area text, driver_id uuid FK driver_profiles nullable, deleted_at`

### 3.26 `transport.bus_riders`
`id, bus_id, child_id, tenant_id, pickup_address_override text nullable, active bool` — one active row per child at a time; historical reassignment tracked via `deleted_at`/`active=false` + new row (append, don't overwrite, for billing/audit reasons).

### 3.27 `transport.trips`
`id, tenant_id, bus_id, leg enum(am, pm), service_date date, status enum(scheduled, moving, arrived, completed, cancelled), started_at timestamptz nullable, arrived_at timestamptz nullable, completed_at timestamptz nullable` — unique `(bus_id, leg, service_date)`.

### 3.28 `transport.trip_stops`
`id, trip_id, tenant_id, sequence int, lat, lng, label text nullable, reached_at timestamptz nullable`

### 3.28.1 `transport.trip_stop_riders`
`trip_stop_id (FK trip_stops), bus_rider_id (FK bus_riders), tenant_id, eta timestamptz nullable` — composite PK `(trip_stop_id, bus_rider_id)`. This is the row that answers "which children board/alight at this specific stop, in what order" — without it, a driver's manifest and per-child ETA can only be inferred by nearest-address matching at read time, which is what the original draft silently relied on. Populated when a trip is generated from the bus's current `bus_riders` roster (§14.2 `start_trip`), snapshotting stop assignment for that trip so a mid-route rider reassignment doesn't retroactively change an in-progress trip's manifest.

### 3.29 `transport.trip_child_status`
`id, trip_id, child_id, tenant_id, status enum(pending, picked_up, dropped_off, absent), status_changed_at timestamptz nullable, changed_by driver_id`

### 3.30 `transport.gps_pings`
`id, trip_id, tenant_id, lat, lng, heading numeric nullable, speed_kph numeric nullable, recorded_at timestamptz` — append-only, high-volume, retention policy in §29.

### 3.31 `safety.pickup_passes`
`id, tenant_id, child_id, created_by guardian_id, person_name, relation enum(father, mother, uncle, aunt, grandfather, grandmother, sibling, driver, other), id_photo_object_id, qr_token text unique (opaque, not the raw id — see §13.4), status enum(active, expired, revoked), expires_at timestamptz`

### 3.32 `safety.pickup_scan_events`
`id, tenant_id, pickup_pass_id nullable (null = invalid/unmatched scan, logged anyway for security review), scanned_by staff_id (reception), result enum(valid, invalid_expired, invalid_unknown, invalid_revoked), handover_confirmed bool, scanned_at`

### 3.33 `media.cameras`
`id, tenant_id, name, zone enum(classroom, outdoor, rest, entrance, common), ip_address inet, stream_protocol text (rtsp/webrtc endpoint identifier — not the credential itself, see §17), resolution enum(720p, 1080p, 4k), has_audio bool, online bool, admin_disabled bool default false, last_heartbeat_at timestamptz nullable, added_at date, deleted_at`

`online` and `admin_disabled` are **independent booleans, not one shared status**, resolving the manual-toggle-vs-heartbeat conflict: `online` is written only by the heartbeat mechanism (§17, §27 — true on a received heartbeat, false on a missed-heartbeat sweep) and a manager's manual "toggle camera off" action writes `admin_disabled` instead, never `online` directly. A camera is stream-viewable only when `online = true AND admin_disabled = false`; the heartbeat sweep never touches `admin_disabled`, so a manager's deliberate disable is never silently reverted by the next cron tick, and a heartbeat resuming on a still-`admin_disabled` camera correctly leaves it non-viewable until a manager re-enables it.

### 3.34 `media.camera_classroom_links`
`camera_id, classroom_id, tenant_id` — composite PK `(camera_id, classroom_id)`; nullable relationship modeled as "no row" (camera with zone=common and no link row = shared/unlinked). Carries `tenant_id` per §2.2.

### 3.35 `media.storage_objects`
`id, tenant_id nullable (null for platform-level objects), bucket text, object_path text, owner_type enum(child_photo, staff_photo, guardian_photo, pickup_id_photo, exam_paper, chat_attachment, payment_receipt, camera_snapshot), owner_id uuid, uploaded_by uuid, mime_type, size_bytes, created_at` — see §22 for the storage architecture this backs.

### 3.36 `billing.fee_items`
`id, tenant_id, name, name_ar, icon, cycle enum(monthly, per_term, once_per_year, one_time), scope enum(all, optional), required bool, price numeric(10,2), active bool`

### 3.37 `billing.fee_item_applicability`
`fee_item_id, child_id, tenant_id` — only populated for `scope=optional` items. Carries `tenant_id` per §2.2.

### 3.38 `billing.billing_ledger_items`
`id, tenant_id, child_id, fee_item_id, period_label text (e.g. "2026-09"), amount_due numeric(10,2), amount_paid numeric(10,2), status enum(unbilled, due, partially_paid, paid, overdue), due_date date` — `status` (including `overdue`) is a **stored, job-maintained** value (§27's "Billing status roll-up" job), never computed at read time — see §3.40 for why the sibling installment table now follows the same rule.

### 3.39 `billing.installment_plans`
`id, tenant_id, child_id, fee_item_id, label, installment_count int`

### 3.40 `billing.installment_schedule_entries`
`id, plan_id, tenant_id, sequence int, label, amount, due_date, paid bool, paid_at timestamptz nullable, status enum(pending, due, overdue, paid)` — **corrected from v0 draft**: `status` (including `overdue`) is now a **stored, job-maintained column**, using the same enum shape as `billing_ledger_items.status`, kept in sync by the same "Billing status roll-up" scheduled job (§27) rather than computed live. The two sibling billing tables previously disagreed on this (one stored, one computed-at-read) — they are now handled identically, which also means `overdue` is indexable (§6) the same way on both tables, which a read-time-only computation could never be.

### 3.41 `billing.invoices`
`id, tenant_id, child_id, invoice_number text unique per tenant, issued_at, total numeric(10,2), status enum(unpaid, paid, void), pdf_object_id uuid nullable`

### 3.42 `billing.invoice_lines`
`id, invoice_id, tenant_id, description, fee_item_id nullable, amount` — carries `tenant_id` per §2.2.

### 3.43 `billing.payment_transactions`
`id, tenant_id, child_id, invoice_id nullable, method enum(bank_transfer, instapay, wallet, fawry), amount, status enum(initiated, pending_verification, succeeded, failed, refunded), provider_reference text nullable, receipt_object_id uuid nullable, initiated_at, settled_at nullable` — see §20 for the reconciliation model.

### 3.44 `comms.conversations`
`id, tenant_id, guardian_id, child_id, subject_id nullable, staff_id, status enum(open, escalated, closed), escalated_at nullable, escalation_reason text nullable`

### 3.45 `comms.messages`
`id, conversation_id, tenant_id, sender_type enum(guardian, staff, system), sender_id uuid nullable, body text, sent_at, read_at nullable`

### 3.46 `comms.announcements`
`id, tenant_id nullable (null = platform-wide, see §12), created_by, audience enum(all, parents, classroom, teachers, drivers) — tenant-scoped meaning; OR audience enum(all_schools, plan_tier, overdue_accounts, trial_accounts) for platform scope (separate column `platform_audience`, mutually exclusive with `audience`), classroom_id nullable, title, body, priority enum(normal, important, urgent), channels text[] (subset of push, whatsapp, sms, email, in_app), scheduled_for nullable, sent_at nullable`

### 3.47 `comms.announcement_recipients`
`announcement_id, recipient_type enum(guardian, staff, driver, tenant), recipient_id uuid, delivered_at nullable, read_at nullable` — fan-out table, populated by the notification dispatch job (§26).

### 3.48 `comms.notifications`
`id, tenant_id nullable, recipient_type enum(guardian, staff, driver, platform_admin), recipient_id, category text (e.g. trip_update, payment_due, chat_message, report_ready, announcement), title, body, deep_link text, severity enum(info, attention, urgent), read_at nullable, created_at` — this is the in-app notification feed row; see §16 for the full matrix and §26 for how it's populated.

### 3.49 `comms.notification_deliveries`
`id, notification_id, channel enum(push, whatsapp, sms, email, in_app), status enum(queued, sent, delivered, failed, skipped_by_preference), provider_message_id text nullable, failed_reason text nullable, sent_at nullable` — `skipped_by_preference` is a new terminal status (see 3.49.2) distinguishing "we chose not to send this" from an actual delivery failure, so §16's matrix and Manager-visible delivery reports don't misreport preference opt-outs as errors.

### 3.49.1 `comms.device_tokens`
`id, tenant_id nullable (null only for platform_admin devices, which sit outside tenancy), recipient_type enum(guardian, staff, driver, platform_admin), recipient_id uuid, platform enum(ios, android, web), token text, last_seen_at timestamptz, created_at` — unique on `(recipient_type, recipient_id, token)`. This is the table the "Notification dispatch" background job (§26) was missing: it is the resolution from `(recipient_type, recipient_id)` to the actual FCM/APNs/web-push token(s) a push notification is sent to. Written by a `register_device_token` RPC called by every mobile/web app on login and on token-refresh; **hard-deleted** (not soft-deleted, §8) when a token is explicitly unregistered (logout) or when a push provider reports it as invalid/expired (stale-token cleanup, §27) — a device token has no historical value once dead.

### 3.49.2 `comms.notification_preferences`
`id, tenant_id nullable, recipient_type enum(guardian, staff, driver, platform_admin), recipient_id uuid, category text (matches `notifications.category`, e.g. `trip_update, payment_due, chat_message, report_ready, announcement, attendance, academic`), channel enum(push, whatsapp, sms, email, in_app), enabled bool default true` — unique on `(recipient_type, recipient_id, category, channel)`. Backs the per-category notification toggles shown in every mobile app's Settings screen. The `notification-dispatch` Edge Function (§26) checks this table **before** writing a `notification_deliveries` row for any (category, channel) pair with `enabled = false`, writing `status = 'skipped_by_preference'` instead of attempting delivery. `in_app` visibility (the `notifications` row itself) is never suppressed by preference — only the outbound channels (push/whatsapp/sms/email) are opt-out-able, so a user can never miss safety-relevant history entirely, only the noisy delivery channels.

### 3.50 `platform.activity_log`
`id, tenant_id, actor_type enum(staff, guardian, driver, system), actor_id nullable, action text, target_type text, target_id uuid nullable, metadata jsonb, occurred_at` — tenant-scoped operational feed (Dashboard "recent activity", Reception "activity log").

### 3.51 `platform.audit_log`
`id, tenant_id nullable (null = platform-scope action), actor_type enum(platform_admin, staff, system), actor_id nullable, action text, target_type text, target_id uuid nullable, ip_address inet nullable, occurred_at` — immutable, append-only, see §23.

### 3.52 `platform.support_tickets`
`id, tenant_id, subject, body text, category enum(technical, how_to, request, billing), severity enum(high, med, low), status enum(open, in_progress, resolved), reported_by uuid, assigned_to uuid nullable (platform_admin), created_at, resolved_at nullable`

### 3.53 `platform.service_health_status`
`id, service_code text unique (api_gateway, parent_app, teacher_app, reception_qr, driver_gps, camera_relay, notifications, payments), status enum(up, degraded, down), uptime_pct numeric(5,2), latency_ms int, checked_at` — written by health-check Edge Function on a schedule (§27), read by Platform Admin.

### 3.53.1 `platform.tenant_billing_transactions`
`id, tenant_id, amount numeric(10,2), currency text default 'EGP', kind enum(subscription_charge, setup_fee, refund), status enum(initiated, succeeded, failed, refunded), provider_reference text nullable unique where non-null, invoice_object_id uuid nullable (Masar-to-tenant invoice PDF), initiated_at, settled_at nullable` — this is the tenant-pays-Masar ledger referenced by §20 and by the "Tenant billing check" scheduled job (§27); formalized here as its own table rather than left as a dangling reference. Structurally mirrors `billing.payment_transactions` (same lifecycle shape, same idempotency-on-`provider_reference` pattern) but is deliberately a **separate table in the `platform` schema**, not a reused `billing.*` table, because it represents a different money flow with a different reconciliation owner (Masar's own finance operation, not a tenant's) — mixing the two would make "total revenue" queries ambiguous about which side of the marketplace they're summing.

### 3.53.2 `jobs.scheduled_job_runs`
`id, job_name text, started_at, finished_at nullable, status enum(running, succeeded, failed), rows_affected int nullable, error text nullable` — one row per `pg_cron` invocation (§27); this is what Platform Admin's system-health view partially surfaces, and what a failed-job alert (§16) is triggered from.

### 3.53.3 `jobs.background_job_queue`
`id, job_type text, payload jsonb, status enum(queued, processing, succeeded, failed), attempts int default 0, max_attempts int default 5, next_attempt_at timestamptz, last_error text nullable, created_at, completed_at nullable` — the polling-queue table for event-triggered background jobs (§26) that need at-least-once + ordered retry guarantees beyond what a bare database webhook gives (notably: notification dispatch, batch AI report generation, payment webhook post-processing). **Corrected from v0 draft's `background_job_queue_meta` naming** — this is the operational queue itself, not just metadata about it, so the name no longer undersells what it is.

### 3.53.4 `jobs.idempotency_keys`
`key uuid, tenant_id, caller_id uuid, rpc_name text, response_snapshot jsonb, created_at` — PK `key`. Backs the general RPC idempotency convention introduced in §2.2/§14.3: every idempotency-key-bearing RPC checks this table first and, on a hit, replays `response_snapshot` instead of re-executing. Rows older than 24h are purged by a scheduled job (§27) — the window only needs to cover realistic client retry timeouts, not permanent storage.

---

## 4. Relationships

Summary of every foreign key with its delete behavior — this is the contract for referential integrity and must match exactly at implementation time.

| Child table | Parent table | On parent delete |
|---|---|---|
| staff_profiles, guardian_profiles, driver_profiles | tenants | RESTRICT (tenants are never hard-deleted, only suspended — §8) |
| classrooms | tenants | RESTRICT |
| children | classrooms | RESTRICT (must reassign classroom before deleting it; enforce in application flow, not cascade) |
| child_guardian_links | children, guardian_profiles | CASCADE (link row is meaningless without both sides) |
| attendance_records, evaluations, concerns | children | RESTRICT (soft-delete children, never hard-delete — history must survive) |
| lessons | subjects | CASCADE |
| evaluations | lessons | RESTRICT |
| ai_report_drafts | ai_report_batches | CASCADE |
| requests | staff_profiles (submitted_by) | RESTRICT |
| events | requests (source_request_id) | SET NULL (event survives even if request row is archived) |
| event_rsvps, event_trip_registrations | events | CASCADE |
| bus_riders | buses, children | CASCADE on bus delete only if bus has no historical trips (enforce via application check — see §8, buses are soft-deleted, not hard) |
| trips | buses | RESTRICT |
| trip_stops, trip_child_status, gps_pings | trips | CASCADE |
| pickup_passes | children | CASCADE |
| pickup_scan_events | pickup_passes | SET NULL (scan record survives pass deletion for security audit) |
| camera_classroom_links | cameras, classrooms | CASCADE |
| billing_ledger_items, invoices, installment_plans | children | RESTRICT |
| invoice_lines | invoices | CASCADE |
| installment_schedule_entries | installment_plans | CASCADE |
| payment_transactions | invoices | SET NULL (transaction record survives; financial records are never cascade-deleted) |
| messages | conversations | CASCADE |
| announcement_recipients | announcements | CASCADE |
| notification_deliveries | notifications | CASCADE |
| storage_objects | — | never cascade-deleted from a DB FK; deletion is orchestrated (DB row + Storage object together) via the deletion workflow in §22.5 |
| trip_stop_riders | trip_stops, bus_riders | CASCADE (a snapshot join row is meaningless without both sides) |
| plan_catalog_apps | plan_catalog | CASCADE |
| device_tokens | owning account (guardian/staff/driver/platform_admin) | CASCADE — hard-deleted with no historical value, §8 |
| notification_preferences | owning account | CASCADE |
| tenant_provisioning_state | tenants | CASCADE (workflow-tracking row has no independent meaning) |
| tenant_billing_transactions | tenants | RESTRICT (financial record, never cascade-deleted, same rule as `payment_transactions`) |
| service_accounts | tenants | RESTRICT for tenant-scoped accounts; N/A (tenant_id null) for platform-global ones |
| ai_usage_counters | tenants | RESTRICT |

General rule: **anything that represents a historical fact (attendance, evaluation, payment, trip, audit) is never hard-deleted and never cascades away** when its "container" (child, tenant, staff) is removed — containers are soft-deleted instead, precisely so history stays queryable. The one deliberate exception is `device_tokens`/`notification_preferences`, which are pure technical/UX state with no audit value and are hard-deleted with their owning account for that reason.

---

## 5. Constraints

Beyond the PK/FK/unique constraints already listed per table:

- **Uniqueness**
  - `tenants.slug` — globally unique, lowercase, DNS-safe (validated at provisioning, §34).
  - `(tenant_id, phone)` unique across `staff_profiles`, `guardian_profiles`, `driver_profiles` combined (a phone number is one login identity within a tenant) — enforced by `tenancy.tenant_phone_registry`'s own `(tenant_id, phone)` unique constraint (§3.1.2), which every provisioning RPC writes to in the same transaction as the profile-table insert.
  - `(child_id, date)` unique on `attendance_records`.
  - `(subject_id, date)` unique on `lessons`.
  - `(bus_id, leg, service_date)` unique on `trips`.
  - `(tenant_id, invoice_number)` unique on `invoices`.
  - `pickup_passes.qr_token` globally unique.
  - `service_health_status.service_code` unique.
  - `(plan_id, app_code)` unique on `plan_catalog_apps` (its composite PK).
  - `(recipient_type, recipient_id, token)` unique on `device_tokens`.
  - `(recipient_type, recipient_id, category, channel)` unique on `notification_preferences`.
  - `(tenant_id, usage_date)` unique on `ai_usage_counters`.
  - `bus_riders (child_id) WHERE active = true` — **partial unique index**, one active bus assignment per child at a time; reassigning a child to a different bus must deactivate the old row before/atomically with inserting the new one (enforced in the `assign_bus_rider` RPC, §14.2).
- **Check constraints**
  - `evaluations.understanding/participation/behavior` ∈ [1,5].
  - `children.package` cannot be null; `children.dob` must be in the past.
  - `fee_items.price >= 0`, `payment_transactions.amount > 0`, `tenant_billing_transactions.amount > 0`.
  - `trips.leg` + `trips.status` transition validity is enforced in application/RPC layer (state machine, not a DB constraint — see §25).
  - `event_trip_registrations` requires `events.type = 'trip'` — enforced via a trigger, since cross-table check constraints don't exist natively in Postgres.
  - `event_trip_registrations.status = 'paid' ⟹ payment_transaction_id IS NOT NULL` — enforced via trigger (§3.24), so the status enum and the payment FK can never disagree about whether a registration was actually paid for.
- **Not-null discipline**: every FK that represents a required relationship (e.g. `children.classroom_id`, `evaluations.lesson_id`) is `NOT NULL`; optional relationships (e.g. `buses.driver_id`) are explicitly nullable and documented as such above.
- **Domain integrity for money**: all currency columns are `numeric(10,2)`, never `float`/`double precision`. Currency is EGP only in v1 (no multi-currency column needed yet; adding one later is a additive migration, not a breaking one).
- **Concurrency control on capacity-constrained inserts**: enforced by application-level row locking, not a DB constraint alone (Postgres has no native "count of child rows ≤ N" constraint) — see the standing convention in §2.2 and its RPC-level application in §14.3. This is called out here explicitly because it is a correctness guarantee (no overbooking), not merely a performance concern, even though the mechanism (`SELECT ... FOR UPDATE`) lives in application/RPC code rather than a table constraint.

---

## 6. Indexing Strategy

Principle: **every RLS policy's filter column must be indexed**, and every list/detail screen in the frontend must be served by an index, not a sequential scan, once tenants scale past a few hundred children.

| Table | Index | Serves |
|---|---|---|
| every tenant-scoped table | btree on `tenant_id` | RLS filter (mandatory baseline, see §13.1) |
| `children` | btree on `(tenant_id, classroom_id)` | Dashboard classroom roster, Attendance screen |
| `children` | btree on `(tenant_id, membership_status)` | Billing "unpaid" filters |
| `children` | GIN on `to_tsvector(name || ' ' || name_ar)` | Dashboard search |
| `staff_profiles`, `classrooms` | GIN on `to_tsvector(name || ' ' || name_ar)` | Dashboard staff/classroom search |
| `child_guardian_links` | btree on `guardian_id` | Parent App multi-child switcher, `current_guardian_child_ids()` RLS helper (§13.1) — the single hottest lookup on this table |
| `staff_subjects` | btree on `staff_profile_id` | `current_staff_classroom_ids()` RLS helper (§13.1) |
| `bus_riders` | btree on `child_id` (partial `WHERE active`) | "Which bus does this child ride" — driver/parent/reception lookups |
| `trip_stop_riders` | btree on `trip_stop_id`, btree on `bus_rider_id` | Driver manifest, per-child ETA |
| `attendance_records` | btree on `(classroom_id, date)` | Attendance day-view, time-travel by day |
| `evaluations` | btree on `(child_id, created_at desc)` | Parent subject daily log |
| `lessons` | btree on `(classroom_id, date desc)` | Teacher "today's lesson" banner |
| `gps_pings` | btree on `(trip_id, recorded_at desc)` | Live map replay/last-known-position |
| `trip_child_status` | btree on `(trip_id, child_id)` unique-ish lookup | Driver manifest, parent bus phase |
| `notifications` | btree on `(recipient_type, recipient_id, read_at, created_at desc)` | Notification feed + unread badge count |
| `device_tokens` | btree on `(recipient_type, recipient_id)` | Notification dispatch job's token resolution (§26) |
| `notification_preferences` | btree on `(recipient_type, recipient_id)` | Preference check on every dispatch (§26) |
| `messages` | btree on `(conversation_id, sent_at)` | Chat thread pagination |
| `billing_ledger_items` | btree on `(child_id, status)` | Parent payments due list |
| `billing_ledger_items` | partial btree on `(tenant_id)` `WHERE status = 'overdue'` | Billing status roll-up job, Dashboard overdue report |
| `installment_schedule_entries` | partial btree on `(tenant_id)` `WHERE status = 'overdue'` | Same as above, now indexable since `overdue` is a stored column (§3.40) |
| `invoices` | btree on `(tenant_id, status)` | Dashboard unpaid report |
| `activity_log` / `audit_log` | btree on `(tenant_id, occurred_at desc)` | Feed pagination |
| `pickup_passes` | btree on `qr_token` (already unique) | Reception scan lookup — must be O(log n), it's on the critical path of a physical handover |
| `camera_classroom_links` | btree on `classroom_id` | Parent "my classroom's cameras" |
| `support_tickets` | btree on `(status, severity)` | Platform Admin triage view |
| `jobs.idempotency_keys` | PK on `key` (already unique); btree on `created_at` | Idempotency replay lookup (O(1)); purge job scan (§27) |

Partial indexes worth calling out explicitly:
- `children (tenant_id) WHERE deleted_at IS NULL` — nearly every query filters out soft-deleted children; a partial index keeps the common-case index small.
- `notifications (recipient_id) WHERE read_at IS NULL` — unread-badge queries are the hottest read path in every mobile app's header.
- `trips (bus_id) WHERE status IN ('scheduled','moving')` — "current trip" lookups happen every few seconds from driver/parent live views.
- `bus_riders (child_id) WHERE active = true` — doubles as the enforcement index for the "one active rider row per child" uniqueness rule in §5 and as the fast lookup path.
- `cameras (tenant_id) WHERE online = true AND admin_disabled = false` — "is this camera actually viewable right now" is checked on every stream-token request (§17).

---

## 7. UUID Strategy

- **Every primary key is a UUID**, generated with `uuidv7` (time-ordered) where the extension/function is available in the target Postgres version, falling back to `gen_random_uuid()` (uuidv4, via `pgcrypto`) otherwise. Time-ordered UUIDs matter here specifically for `gps_pings`, `activity_log`, `audit_log`, `messages`, and `notifications` — high-insert-rate, time-series-shaped tables where UUIDv4's randomness causes B-tree index bloat and page fragmentation at scale. Non-time-series tables (e.g. `children`, `tenants`) can use either; standardize on uuidv7 everywhere for consistency of tooling.
- **Auth alignment**: `staff_profiles.id`, `guardian_profiles.id`, `driver_profiles.id`, and `platform_admins.id` are **not independently generated** — they equal `auth.users.id` for the corresponding Supabase Auth user (1:1). This is what makes RLS's `auth.uid()` usable as a direct join key with zero indirection (§13).
- **No sequential integer IDs anywhere**, including internal ones — this avoids enumeration attacks on tenant-facing endpoints (e.g. guessing invoice numbers) and keeps the id space mergeable if tenants are ever migrated between environments.
- **Human-facing identifiers are separate from PKs**: `invoices.invoice_number` (formatted, tenant-scoped sequence) and `pickup_passes.qr_token` (opaque random token, not the row's UUID — see §13.4 for why) are distinct generated values, not the primary key surfaced to users.

---

## 8. Soft Delete Strategy

- **Soft-delete applies to**: `tenants` (via `status=suspended`, not a delete flag — see below), `children`, `staff_profiles`, `guardian_profiles`, `driver_profiles`, `classrooms`, `buses`, `cameras`, `fee_items`, `service_accounts` (via `status=revoked`).
- **Soft-deleting a `staff_profiles`, `guardian_profiles`, or `driver_profiles` row synchronously triggers session revocation** (§10.6) — the two are treated as one operation, not two independently-timed ones, specifically so a suspended account can't continue operating on a still-valid access token after its row is marked deleted.
- **Hard-delete applies to (deliberate exception)**: `device_tokens` and `notification_preferences` (§3.49.1–2) — pure technical/UX state with no audit or historical value, cascade-deleted with their owning account.
- **Hard-delete never applies to**: any historical/transactional table — `attendance_records`, `evaluations`, `payment_transactions`, `invoices`, `gps_pings`, `activity_log`, `audit_log`, `messages`, `pickup_scan_events`, `trips`, `tenant_billing_transactions`. These are either immutable forever or subject to a data-retention purge job (§29), never to user-triggered deletion.
- **Mechanism**: a nullable `deleted_at timestamptz` column. A row is "deleted" iff `deleted_at IS NOT NULL`. No separate `is_deleted boolean` — the timestamp doubles as the audit fact of *when*.
- **Enforcement**: every RLS `SELECT` policy on a soft-deletable table includes `AND deleted_at IS NULL` by default; a second, more restrictive policy (`manager`/`platform_admin` only) allows viewing soft-deleted rows for recovery/audit screens. This is implemented as **two policies**, not one policy with an OR, so that the "show me deleted staff" screen is a deliberate, permission-gated query path, not an accidental default.
- **Cascading soft-delete**: deleting a `classroom` does not cascade-soft-delete its `children` (a classroom deletion requires re-assigning children first, enforced in the application RPC — see §25). Deleting a `child` does soft-delete its dependent `pickup_passes` and `bus_riders` (a pass or ride for a withdrawn child is meaningless going forward) but never its `attendance_records`/`evaluations`/`payment_transactions`.
- **Tenants specifically use `status` (trial/active/overdue/suspended), not `deleted_at`** — a tenant is never "deleted" in v1, only suspended (reversible) — because Platform Admin's UI explicitly supports "reactivate school." True tenant deletion (GDPR-style erasure) is out of scope for v1 and would be a separate, manually-invoked data-export-then-purge procedure, not part of normal CRUD.
- **Uniqueness + soft delete interaction**: unique constraints that could collide with a soft-deleted row (e.g., re-adding a classroom with the same name after deleting one) are scoped as **partial unique indexes** `WHERE deleted_at IS NULL`, so deleted rows don't block reuse of a name/slug/phone number.

---

## 9. Multi-Tenant Architecture

- **Model: shared database, shared schema, row-level isolation** (not schema-per-tenant, not database-per-tenant). Justification: tenant count is expected to be in the hundreds-to-low-thousands (nurseries), not enterprise-scale isolation needs; shared-schema keeps migrations, indexing, and Supabase's connection pooling manageable, and RLS gives strong isolation guarantees without operational multiplication of schemas/databases.
- **Tenant key propagation**: `tenant_id` is stamped on every tenant-scoped row (§2.2) and is the single column every RLS policy filters on. It is set **once, at row creation, from the authenticated user's own tenant claim** (never accepted as client input) — see §13.2.
- **Cross-tenant boundary**: no application query ever needs to join across two tenants except Platform Admin's aggregate views, which read through a **separate set of platform-only views** that intentionally span tenants (`platform.v_tenant_billing_summary`, `platform.v_tenant_health_summary`) and are only reachable via the `platform_admin` role's RLS bypass grant (§12).
- **Subdomain routing**: `slug.masar.app` resolves at the edge (hosting/CDN layer, not in Postgres) to the correct tenant context; the frontend passes the resolved `tenant_id` (or slug) at login, and the **Supabase Auth JWT is the actual source of truth for tenant scoping thereafter** — not the subdomain the request arrived on. This prevents a compromised/misconfigured subdomain routing rule from ever becoming a data-isolation bug.
- **Provisioning isolation**: creating a tenant never touches another tenant's rows; the provisioning workflow (§34) is fully idempotent and transactional per tenant.
- **Plan-based feature gating**: which apps a tenant's users can log into is enforced at **two layers** — (1) Auth: a user's role only exists if their app was provisioned (a `teacher` role simply isn't created if the tenant's plan excludes the Teacher App), and (2) defense-in-depth at the RLS layer via a `tenant_has_app(tenant_id, app_code)` policy helper (backed by `plan_catalog_apps`, §3.2.1) on any table that's app-specific (e.g., `cameras` table access could be gated if cameras become a plan add-on later).
- **Non-human tenant scoping (`service_accounts`)**: a tenant-scoped service account (e.g., a camera relay agent) carries `tenant_id` and is authorized through the same isolation boundary as human accounts, but via API key rather than a JWT (§10.7) — it never receives cross-tenant reach. Platform-global service accounts (e.g., the payment gateway's inbound webhook signer) have `tenant_id = NULL` and are authorized by signature/secret verification inside the specific public Edge Function they call, never via a table-level RLS bypass.

---

## 10. Authentication Architecture

### 10.1 Provider
Supabase Auth (GoTrue), phone-based primary identity for all tenant-side apps (matches the frontend's phone+password login pattern), email-based for Platform Admin.

### 10.2 Account types and their Auth mapping

| Frontend role | Auth identity | Login factor |
|---|---|---|
| Guardian (Parent App) | `auth.users` row, `phone` identity | phone + password |
| Teacher / Reception / Manager (Dashboard, Teacher App, Reception App) | `auth.users` row, `phone` identity | phone + password |
| Driver (Driver App) | `auth.users` row, `phone` identity | phone + password |
| Platform Admin | `auth.users` row, `email` identity | email + password (+ mandatory MFA, §28) |

- `auth.users.raw_app_meta_data` carries **immutable, server-set** claims: `tenant_id`, `role` (`guardian | teacher | reception | manager | driver | platform_admin`), and `app_access` (array of portals this identity may open). `app_meta_data` is only writable by the `service_role` (never by the client), which is what makes it safe to trust inside RLS policies (§13).
- `auth.users.raw_user_meta_data` carries **mutable, self-service** profile display data mirrored from the profile table (name, photo) purely for convenience in client-side JWT decoding; the profile tables remain the source of truth.

### 10.3 Account provisioning flow (who creates whom)
This directly encodes the cascade discovered in the frontend:

1. **Tenant provisioning** (Platform Admin creates a school) → creates the tenant row → creates **one** initial `manager` staff account (the nursery owner) via Supabase Admin API (`service_role`, server-side only — never client-side signup for this path) → writes/advances `tenant_provisioning_state` (§3.1.1) at each step.
2. **Child enrollment** (Dashboard "Add child") → creates the `children` row → **synchronously** provisions a `guardian_profiles` row + `auth.users` identity (phone, no password set yet) + a row in `tenancy.tenant_phone_registry` in the same server-side transaction/Edge Function call.
3. **Staff addition** (Dashboard "Add staff", role teacher|reception) → creates `staff_profiles` row + `auth.users` identity, same pattern.
4. **Bus addition** (Dashboard "Add bus") → creates `buses` row + `driver_profiles` row + `auth.users` identity, same pattern.
5. All of the above are implemented as a **single Postgres RPC wrapped in a Supabase Edge Function**, never as client-side `supabase.auth.signUp()` calls — because the client must never be the one deciding a new identity's `tenant_id`/`role` claims. The Edge Function runs with `service_role`, validates the caller's own role/tenant via their JWT first, then performs both the Auth Admin API call and the profile-table insert atomically (compensating delete of the Auth user if the profile insert fails, since these span two systems and can't share one DB transaction — see §25.3 for the exact compensation pattern).

**Credential handoff (corrected from v0 draft — no plaintext password ever leaves the server).** The v0 draft had the provisioning Edge Function generate a temporary password and return it in the API response for the manager to relay manually (e.g., via WhatsApp) — this puts a plaintext credential in an API response body and in a human relay step, which is unnecessary exposure. Instead: step 2–4 above create the `auth.users` identity **without setting a usable password**, and the Edge Function immediately triggers a Supabase Auth **invite/magic-link-equivalent flow** — a one-time, short-lived (e.g., 24h) `signInWithOtp`-style set-password link, sent **directly to the new account's own phone** via the same WhatsApp/SMS dispatch path used for all other notifications (§16, §26), not to the manager. The manager's UI shows confirmation that an activation message was sent, not a password. This removes the plaintext-credential-handoff risk entirely while preserving the frontend's "share via WhatsApp" *feel* — the WhatsApp message now carries a one-time activation link the new user controls, not a password the manager has to know and transmit.

### 10.4 Password/OTP reset
Matches the frontend's uniform "forgot password → OTP via WhatsApp/SMS → set new password" flow across all mobile apps: implemented via Supabase Auth's phone OTP (`signInWithOtp` / `verifyOtp`), with the WhatsApp delivery channel handled by routing the OTP send through the same notification-dispatch Edge Function used for all other WhatsApp messages (§16), rather than Supabase's native SMS-only OTP delivery — keeping one WhatsApp/SMS provider integration for the whole system instead of two. Login and OTP-request endpoints are rate-limited per §28.

### 10.5 Session/token strategy
Standard Supabase JWT access token (short-lived, ~1h) + refresh token (long-lived, rotated). Mobile apps (Parent/Teacher/Reception/Driver) persist the refresh token in secure device storage; Dashboard/Platform Admin (browser) use Supabase's cookie-based session helper. No custom token logic needed — this is one of the areas where Supabase's default is already production-grade.

### 10.6 Session revocation & account suspension
**New section, resolving a gap in the v0 draft**: soft-deleting a profile row (§8) denies *new* reads via RLS, but does nothing about an access token issued *before* suspension, which otherwise stays valid for up to ~1h (§10.5). Every RPC/Edge Function that transitions a `staff_profiles`/`guardian_profiles`/`driver_profiles` row to `deleted_at IS NOT NULL` or `employment_status = 'terminated'` (`suspend_staff_account`, `withdraw_child` cascading to its guardians where applicable, `reactivate`'s inverse) **synchronously** calls the Supabase Auth Admin API's session-invalidation endpoint (`auth.admin.signOut(user_id, scope: 'global')`) for that identity, in the same request, before returning success to the caller — not as a follow-up background job, precisely because this is a security-critical action where eventual consistency is the wrong tradeoff. A `revoke_sessions(user_id)` Edge Function (§14.2) also exists standalone, so a manager/platform admin can force a logout without a full suspension (e.g., suspected compromised device). Every such revocation is written to `audit_log` (§23).

### 10.7 Machine & service identities
**New section, resolving a gap in the v0 draft**: the six RBAC roles in §11 are all human-session roles backed by a Supabase Auth JWT. Some callers have no human session at all — most notably the on-premise camera relay agent that calls `camera_heartbeat()` (§17) on a fixed interval with nobody logged in. These are modeled as `identity.service_accounts` (§3.9.1), authenticated by a **static API key** (issued once, stored hashed, never re-displayed) sent as a header to a small, explicitly-enumerated set of Edge Functions (`camera-heartbeat`, and any future device-integration endpoint) — never via `supabase.auth`, and never granted a JWT. The receiving Edge Function verifies the key against `service_accounts.api_key_hash`, checks `status = 'active'` and that the requested action is within `scopes`, then acts with `service_role` scoped in application code to exactly that narrow action (e.g., updating one camera's `last_heartbeat_at`/`online`) — it never gets blanket table access. Issuing and revoking a service account's key are manager-only actions (own tenant) via `issue_service_account_key`/`revoke_service_account_key` (§14.2), both audit-logged (§23). Payment-gateway and other public webhook callers (§20, §25.3) are a related but distinct case — they authenticate via provider-specific request-signature verification, not an API key against this table, since Masar doesn't control their request shape.

---

## 11. RBAC (Role Based Access Control)

### 11.1 Roles (fixed set, not user-defined in v1)

`guardian`, `teacher`, `reception`, `manager`, `driver`, `platform_admin`. (`manager` covers both "owner" and "admin" distinctions seen informally in the frontend — v1 does not need finer-grained tenant-side roles; if a nursery later needs "owner vs. assistant admin," that's an additive `manager_tier` column, not a new role.)

`platform_admin` is the one role with internal tiers that **do** affect authorization: `owner`, `admin`, `support` (`identity.platform_admins.role`, §3.9). Unlike `manager`'s tiers (currently cosmetic), these three are permission-relevant from day one and are carried through explicitly in §12's Platform Admin sub-matrix — collapsing them to one blanket "Platform Admin can do X" column would let a `support` credential (the tier most exposed to routine day-to-day ticket handling, and thus the most likely to be phished) carry the same tenant-suspension/billing authority as `owner`.

Separately, **`service_accounts` (§3.9.1, §10.7) are not a seventh RBAC role** — they are a parallel, non-human authentication mechanism (API key, not JWT) scoped in code to a narrow, explicitly-enumerated set of machine-to-machine actions. They never appear as `current_role()` in an RLS policy and are not a row in the Permission Matrix below for that reason; their authorization is Edge-Function-level scope-checking against `service_accounts.scopes`, not RLS.

### 11.2 Role assignment
One role per identity (not multi-role) — matches the frontend, where an account opens exactly one app. Stored in `auth.users.raw_app_meta_data.role`, mirrored onto the profile row's implicit type (which table the profile lives in already encodes the role for `teacher/reception/manager` via `staff_profiles.role`, and for `guardian`/`driver`/`platform_admin` the table itself is the role).

### 11.3 Permission model
Rather than a fully dynamic permission table (over-engineering for six fixed roles), permissions are expressed as **capability groups checked in RLS policies and RPC-level guards**, documented exhaustively in §12's permission matrix. A `permissions` reference table exists purely as **documentation-as-data** (seed data describing each capability, used to generate the matrix in tooling/tests, not evaluated at runtime) — runtime authorization is always the RLS policy itself, never a lookup against this table, to avoid an extra query on every request.

---

## 12. Permission Matrix

Legend: **C**reate, **R**ead, **U**pdate, **D**elete/soft-delete, **A**pprove-type action. Scope column shows the boundary the permission is limited to.

| Resource | Guardian | Teacher | Reception | Manager | Driver | Platform Admin |
|---|---|---|---|---|---|---|
| Own tenant's children | R (own children only) | R (own classroom) | R (all, name/photo/parent only) | CRUD | R (own bus riders, minimal fields) | R (support context only, via impersonation-free read views) |
| Classrooms | R (own child's) | R (own) | R (all, names only) | CRUD | – | – |
| Attendance | R (own child) | CU (own classroom) | – | R, CU (override) | – | – |
| Evaluations/Lessons | R (own child) | CRU (own classroom) | – | R | – | – |
| Concerns | R (own child, non-escalated) | C, R (own) | – | CRUD | – | – |
| Staff leave records | – | R (own) | – | CRUD (own tenant) | – | – |
| Staff feedback (complaints/commends) | – | R (own, non-anonymous only) | – | CRUD (own tenant) | – | – |
| Staff subject assignments | – | R (own) | – | CRUD (own tenant) | – | – |
| Day-path history (`day_path_events`) | R (own child, current + own history) | R (own classroom, today) | C (system-generated via handover/bus actions) | R (own tenant) | C (system-generated via trip actions) | – |
| AI Reports | R (own child, sent only) | C (own students), R own | – | CRUD (all) | – | – |
| Requests (approvals) | – | C (own), R (own) | – | RUA (approve/reject) | – | – |
| Events | R (own classroom/all) | R | – | CRUD | – | – |
| Event RSVP/Trip reg | CRU (own child) | – | – | R | – | – |
| Buses/Trips | R (own child's bus, live only) | – | R (today's trip), U (confirm child pickup/drop-off status) | CRUD | RU (own trip, own bus) | – |
| Trip stops/stop riders | R (own child's, live only) | – | R (today's trip) | CRUD | RU (own trip) | – |
| GPS pings | R (own child's active trip) | – | – | R | C (own trip) | – |
| Cameras | R (own classroom's, stream token only) | – | – | CRUD (incl. `admin_disabled` toggle) | – | – |
| Pickup passes | CRUD (own child) | – | R (validate via scan) | R | – | – |
| Pickup scan events | – | – | C, R (own tenant) | R | – | – |
| Fee items | R | – | – | CRUD | – | – |
| Billing ledger/Invoices | R (own child) | – | – | CRUD | – | – |
| Payments | C (own child, initiate), R (own) | – | – | R, U (mark manual/verify) | – | R (support/reconciliation view) |
| Conversations/Messages | CRU (own) | CRU (own) | – | R (escalated only) | – | – |
| Announcements | R (targeted) | R (targeted) | R (targeted) | CRUD (own tenant) | R (targeted) | CRUD (platform-wide) |
| Notifications | R, U (own, mark read) | R, U (own) | R, U (own) | R, U (own) | R, U (own) | R, U (own) |
| Device tokens | CRUD (own, self-service) | CRUD (own) | CRUD (own) | CRUD (own) | CRUD (own) | CRUD (own) |
| Notification preferences | CRUD (own) | CRUD (own) | CRUD (own) | CRUD (own) | CRUD (own) | CRUD (own) |
| Activity log | – | – | R, C (system-generated) | R (own tenant) | – | – |
| Audit log | – | – | – | R (own tenant actions only) | – | R (all) — see sub-matrix below |
| Tenants | – | – | – | R, U (own settings only) | – | see sub-matrix below |
| Service accounts (§10.7) | – | – | – | CRUD (own tenant, issue/revoke keys) | – | R (support only) |
| Support tickets | – | – | – | C, R (own tenant) | – | see sub-matrix below |
| Service health | – | – | – | – (see note) | – | R |
| Staff/Driver accounts | – | – | – | CRUD (own tenant) | – | R (support only) |

Notes:
- "Own" always implies `tenant_id` match first, then the narrower ownership filter — tenant match is the outer RLS layer, ownership is the inner one (§13).
- Manager has no `D` (hard delete) anywhere in this system per §8 — only soft-delete, which is functionally a `U`.
- Platform Admin **never** gets blanket `R` on tenant operational data (children's health notes, chat contents, evaluation details) — support access is limited to what's needed for billing/technical support (tickets, service health, tenant metadata, payment reconciliation), enforced by giving Platform Admin RLS bypass only on `platform.*` schema tables and the specific cross-tenant support views, not a global bypass role. This is a deliberate privacy boundary, not an oversight.
- Reception's write on Buses/Trips is scoped narrowly to confirming an already-in-progress child's pickup/drop-off status (`update_child_trip_status`, §14.2) — it does not extend to creating/editing trips, buses, or routes, which remain Manager/Driver-only.
- **`service_health_status` is Platform-Admin-only by design, not by oversight**: this table reports on *Masar's own infrastructure* (API gateway, media relay, notification/payment provider reachability, §3.53) — it is operational telemetry for the company running the platform, not a tenant-facing status page. A manager's equivalent need ("is the camera relay actually working for my nursery") is already served more precisely by tenant-scoped signals the manager *does* have access to — `cameras.online`/`admin_disabled` directly (§3.33) and the `tenant:{id}:cameras` realtime channel (§15) — rather than a coarse global service-health row that wouldn't tell them anything more specific than what they can already see on their own camera list.

### 12.1 Platform Admin sub-role matrix
The single "Platform Admin" column above is a floor shared by all three tiers; this table states where `owner`/`admin` and `support` diverge — resolving the gap where the v0 draft's schema implied three tiers (§3.9) but the permission matrix never differentiated them.

| Resource | `owner` / `admin` | `support` |
|---|---|---|
| Tenants | CRUD (provision, suspend, reactivate, edit plan) | R only (metadata for ticket context); cannot suspend/reactivate/change plan |
| Tenant billing transactions | CRUD (issue refunds, adjust) | R only |
| Support tickets | CRUD, assign (all) | CRUD, assign (all) — no divergence, this is `support`'s core job |
| Audit log | R (all) | R (all) — read access to the audit trail is itself audited (§23), so broad read here is acceptable |
| Service health | R | R |
| Announcements (platform-wide) | CRUD | R only — broadcasting to all tenants is an `owner`/`admin` action |
| Platform admin accounts themselves | CRUD (`owner` only, not `admin`) | – |

Enforced the same way as every other role split in this document: an RLS policy branch keyed on `current_platform_admin_tier()` (a `SECURITY DEFINER` helper reading `platform_admins.role`, same pattern as §13.1), not an application-only check.

---

## 13. Row Level Security Design

### 13.1 Core pattern
Every tenant-scoped table gets RLS **enabled and forced** (`FORCE ROW LEVEL SECURITY`, so even the table owner role can't accidentally bypass it outside of explicit `service_role` use). The baseline policy shape used everywhere:

```
USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
```

layered with a resource-specific ownership clause where needed, e.g. for `children` read access by a guardian:

```
USING (
  tenant_id = current_tenant_id()
  AND (
    current_role() IN ('manager')
    OR (current_role() = 'teacher' AND classroom_id = ANY(current_staff_classroom_ids()))
    OR (current_role() = 'guardian' AND id = ANY(current_guardian_child_ids()))
    OR (current_role() = 'driver' AND id = ANY(current_driver_rider_ids()))
    OR (current_role() = 'reception')
  )
)
```

`current_tenant_id()`, `current_role()`, `current_guardian_child_ids()`, `current_platform_admin_tier()` (§12.1), etc. are **`SECURITY DEFINER` SQL functions**, not inline JWT parsing repeated per policy — this keeps policies short, testable in isolation, and gives one place to change if the JWT claim shape ever changes.

**This baseline shape applies to every tenant-scoped table with zero exceptions**, including pure link/join tables — corrected from the v0 draft, where six join tables (`child_guardian_links`, `staff_subjects`, `fee_item_applicability`, `invoice_lines`, `installment_schedule_entries`, `camera_classroom_links`) lacked their own `tenant_id` column and would have needed a join-through-parent policy instead. Since §2.2 now mandates `tenant_id` on every tenant-scoped row including these six, every RLS policy in the system — without exception — is a single equality check (plus, where relevant, one of the role-conditioned ownership branches below), never a subquery or a join.

### 13.2 `tenant_id` is never client-supplied
Every `INSERT` policy's `WITH CHECK` clause pins `tenant_id = current_tenant_id()` — the client-sent payload's `tenant_id` field (if the client even sends one) is irrelevant; Postgres rejects the row if it doesn't match the JWT's tenant regardless of what the client claims.

### 13.3 Manager as tenant-wide bypass, not superuser
`manager` role policies use `tenant_id = current_tenant_id()` with no further ownership narrowing — full read/write within their own tenant, nothing outside it. This is achieved with role-conditioned `OR` branches inside the same policy set described above, not a separate bypass mechanism, keeping one policy per table to reason about instead of two.

### 13.4 Special case: pickup pass validation must not leak data
Reception's QR scan flow queries `pickup_passes` by `qr_token`, a value that is **not the row's UUID** and is opaque/high-entropy specifically so that RLS can allow a reception-role lookup by token without allowing reception to enumerate/browse all passes by scanning sequential IDs. The RLS policy for `reception` role on `pickup_passes` is `SELECT`-only, scoped to `tenant_id = current_tenant_id()`, and the frontend only ever queries by exact `qr_token` match (enforced by never exposing a "list all passes" query path to the reception role at the API layer, even though RLS alone doesn't strictly forbid it — this is documented as an intentional two-layer control, not solely relying on RLS).

### 13.5 Realtime + RLS
Supabase Realtime (§15) respects the same RLS policies for postgres_changes subscriptions — a driver's GPS channel, a parent's chat subscription, etc. all inherit the table's RLS automatically, so there is no separate "realtime permission" system to maintain.

### 13.6 Platform Admin bypass scope
`platform_admin` role has RLS policies **only** added on: `tenants`, `tenant_billing_transactions`, `plan_catalog`, `plan_catalog_apps`, `support_tickets`, `service_health_status`, `audit_log` (all tenants), `announcements` (platform-scoped rows only), `service_accounts` (read-only, support context), and the dedicated cross-tenant support views. It has **no policy at all** (hence no access) on tenant operational tables like `children`, `messages`, `evaluations` — absence of a policy is a hard deny under RLS, which is the correct default for privacy. Within this bypass scope, write policies additionally branch on `current_platform_admin_tier()` per §12.1 (e.g., `tenants` UPDATE for suspend/reactivate/plan-change requires `tier IN ('owner','admin')`; `support` gets that table's SELECT policy only).

### 13.7 Machine identity requests bypass RLS entirely, by design
Requests authenticated via a `service_accounts` API key (§10.7) never carry a Supabase Auth JWT, so `auth.uid()`/`auth.jwt()` are null for them — they cannot satisfy any RLS policy above, by construction. This is intentional: these requests are handled by Edge Functions running as `service_role` that perform their own scope check against `service_accounts.scopes` in application code (§10.7) before executing a narrowly-targeted write (e.g., `UPDATE cameras SET online = true, last_heartbeat_at = now() WHERE id = :camera_id AND tenant_id = :service_account.tenant_id`). RLS is not the authorization mechanism for this path — the Edge Function's own scope/tenant check is — which is why service accounts are excluded from the RBAC/RLS model in §11 and §12 rather than shoehorned into it as a seventh pseudo-role.

### 13.8 Storage object visibility during the upload lifecycle
A `storage_objects` row in `pending` state (§22.1, before `finalize_upload` runs) is visible only via `SELECT ... WHERE uploaded_by = auth.uid()` — i.e., only its own uploader can see a not-yet-validated upload's metadata, regardless of what role/ownership rules would otherwise apply to its `owner_type`/`owner_id` once `confirmed`. Once `finalize_upload` flips the row to `confirmed`, the table's normal ownership-based policy (mirroring the resource it's attached to — a child's photo follows `children` visibility rules, an exam paper follows classroom visibility, etc.) takes over. This closes the gap in the v0 draft where an in-flight upload's metadata visibility was left unstated.

---

## 14. API Contracts

Supabase's auto-generated PostgREST API + client SDK covers the majority of CRUD directly against tables/views under RLS — **no bespoke REST layer is needed for straightforward CRUD** (children list, classroom detail, notification feed, etc.). Bespoke API surface is reserved for:

### 14.1 When to use a Postgres RPC (`SECURITY DEFINER` function callable via `supabase.rpc()`) vs. an Edge Function

| Use an RPC when... | Use an Edge Function when... |
|---|---|
| The operation is a multi-table transaction entirely within Postgres (e.g., approve a request → create an event row) | The operation needs to call an external service (WhatsApp API, payment gateway, AI/LLM endpoint) |
| The operation needs `SECURITY DEFINER` to briefly step outside RLS for a controlled write (e.g., writing a `notifications` row for someone other than yourself) | The operation needs the Supabase Admin API (creating an `auth.users` identity) |
| Latency-sensitive, high-frequency (GPS ping ingestion) | Involves file processing (PDF invoice generation, image resize) or scheduled/cron-triggered logic |

### 14.2 Contract catalog (grouped by domain — signatures are conceptual, not code)

**Provisioning**
- `provision_tenant(name, slug, plan_code, contact) → tenant` — Edge Function, `platform_admin` (`owner`/`admin` tier only, §12.1).
- `enroll_child(child_fields, guardian_fields) → {child, guardian_activation_sent}` — Edge Function, `manager` only. Returns confirmation that an activation link was dispatched to the guardian (§10.3) — never a credential.
- `add_staff(staff_fields, role) → {staff, activation_sent}` — Edge Function, `manager` only.
- `add_bus(bus_fields, driver_fields) → {bus, driver_activation_sent}` — Edge Function, `manager` only.
- `suspend_staff_account(staff_id, reason) / reactivate_staff_account(staff_id)` — Edge Function, `manager` (own tenant); synchronously revokes sessions on suspend (§10.6).
- `revoke_sessions(user_id)` — Edge Function, `manager` (own tenant staff/drivers/guardians) / `platform_admin` (any) — standalone forced-logout, independent of suspension.
- `regenerate_activation_link(user_id)` — Edge Function, `manager`/`platform_admin` — reissues a one-time activation/reset link (e.g., original expired) via the same no-plaintext-credential pattern as §10.3.
- `withdraw_child(child_id, reason) → child` — RPC, `manager`; orchestrates the §8 cascade (soft-deletes `pickup_passes`, deactivates `bus_riders`) as one transaction rather than a bare `UPDATE`.
- `suspend_child(child_id, reason) / reactivate_child(child_id)` — RPC, `manager`; toggles `membership_status`, does not withdraw.
- `issue_service_account_key(tenant_id, purpose, scopes[]) → {service_account_id, api_key}` — Edge Function, `manager` (own tenant only); the returned key is shown exactly once, never re-displayed (§10.7).
- `revoke_service_account_key(service_account_id)` — Edge Function, `manager`.

**Academic**
- `mark_attendance(classroom_id, date, records[]) → attendance_summary` — RPC, `teacher`.
- `notify_attendance(classroom_id | 'all', date) → dispatch_count` — RPC (writes notifications) + triggers Edge dispatch, `manager`/`teacher`.
- `submit_evaluation(...) → evaluation` — RPC, `teacher`.
- `ai_polish_note(raw_text) → polished_text` — Edge Function (calls LLM), `teacher`; enforces `ai_usage_counters` cap (§19).
- `ai_draft_report(scope, type, topic) → draft_batch` — Edge Function (calls LLM, fan-out per child), `teacher`/`manager`; enforces `ai_usage_counters` cap.
- `resend_report_draft(draft_id) / delete_report_draft(draft_id)` — RPC, `teacher` (own)/`manager` (all).
- `export_report_draft(draft_id) → {pdf_url}` — RPC + Edge Function for PDF render, `teacher` (own)/`manager` (all); writes to the `generated-documents` bucket (§21) and returns a signed URL/share link, matching the Dashboard's "export/share" AI-report action.

**Approvals**
- `submit_request(...) → request` — RPC, `teacher`.
- `review_request(request_id, decision, reason?) → {request, event?}` — RPC (transactional promotion to `events` on approve), `manager`.
- `update_rsvp(rsvp_id, ...) / cancel_trip_registration(registration_id)` — RPC, `guardian` (own child).

**Transport**
- `start_trip(bus_id, leg) → {trip, trip_stop_riders}` — RPC, `driver`; snapshots the bus's current `bus_riders` roster into `trip_stop_riders` (§3.28.1).
- `assign_bus_rider(bus_id, child_id) / unassign_bus_rider(bus_rider_id)` — RPC, `manager`; capacity-checked with `SELECT ... FOR UPDATE` on `buses` per §2.2/§14.3.
- `record_gps_ping(trip_id, lat, lng, ...) → void` — RPC, high-frequency, `driver` (called every few seconds by the app; see §18 for cadence).
- `update_child_trip_status(trip_id, child_id, status) → void` — RPC, triggers notification dispatch, `driver`/`reception`.
- `complete_trip(trip_id) → trip` — RPC, `driver`.

**Safety**
- `create_pickup_pass(child_id, person, relation, id_photo) → {pass, qr_payload}` — RPC, `guardian`.
- `scan_pickup_pass(qr_token) → validation_result` — RPC, `reception`.
- `confirm_handover(pickup_scan_event_id) → void` — RPC (writes activity_log + notification), `reception`.

**Billing**
- `initiate_payment(child_id, invoice_id | ledger_items[], method) → payment_intent` — Edge Function (calls payment gateway), `guardian`.
- `payment_webhook_handler` — Edge Function, public endpoint with signature verification, called by the payment provider (§20).
- `mark_installment_paid_manual(installment_entry_id, note) → installment_schedule_entry` — RPC, `manager`; for in-person/cash payments with no gateway transaction, distinct from `verify_payment` (which reconciles a submitted `payment_transactions` row).
- `generate_invoice(child_id, items[]) → invoice` — RPC + Edge Function for PDF render, `manager`.
- `resend_invoice(invoice_id, channel) → void` — RPC + Edge dispatch, `manager`.

**Communication**
- `send_message(conversation_id | new_conversation_target, body) → message` — RPC, `guardian`/`teacher`.
- `escalate_conversation(conversation_id, reason?) → conversation` — RPC, `guardian`/`teacher`.
- `broadcast_announcement(...) → announcement` — RPC (fan-out to `announcement_recipients`) + Edge dispatch, `manager`/`platform_admin` (platform-wide requires `owner`/`admin` tier, §12.1).
- `register_device_token(platform, token) → void` — RPC, any authenticated role (self).
- `update_notification_preferences(category, channel, enabled) → void` — RPC, any authenticated role (self).

**Machine identities**
- `camera_heartbeat(camera_id)` — Edge Function, `service_account` API-key auth only (§10.7, §13.7), not a human role.

### 14.3 Contract conventions
- Every RPC validates the caller's role/tenant **inside the function body** (never trusts that RLS alone is sufficient for multi-step writes) and raises a Postgres exception with a stable error code (§25) on violation.
- Every Edge Function that wraps an RPC re-checks the caller's JWT itself before invoking `service_role`-level operations — Edge Functions never blindly trust that "if the client could call this endpoint, it's authorized."
- All list-returning endpoints (whether PostgREST auto-CRUD or RPC) support cursor-based pagination (`created_at`+`id` composite cursor), never offset pagination, given the time-series-heavy nature of this data (messages, notifications, activity log, gps pings).
- **Idempotency**: every mutating RPC/Edge Function above that isn't a natural upsert-by-unique-key (i.e., everything except e.g. `register_device_token`, which is already idempotent via its own unique constraint) accepts a client-generated `idempotency_key` parameter and checks/writes `jobs.idempotency_keys` (§3.53.4, §2.2) as its first action, replaying the prior response on a repeat key instead of re-executing. This is the generalized form of the pattern §20 already specified for payments.
- **Capacity-checked RPCs** (`assign_bus_rider`, `review_request`'s trip-registration path, classroom (re)assignment) open their transaction with `SELECT ... FOR UPDATE` on the relevant capacity-holding row (bus/event/classroom) before counting existing assignments and inserting, per the standing convention in §2.2 — this is a correctness requirement (no overbooking under concurrent requests), not an optional optimization.

---

## 15. Realtime Event Matrix

Supabase Realtime channels, keyed by what the frontend must receive live:

| Channel / subscription | Table(s) | Who subscribes | Trigger |
|---|---|---|---|
| `trip:{trip_id}:position` | `gps_pings` (postgres_changes INSERT) | Parent (own child's active trip), Dashboard (all active trips) | Driver RPC `record_gps_ping` |
| `trip:{trip_id}:status` | `trips`, `trip_child_status` (UPDATE) | Parent, Dashboard, Reception | Driver/Reception status updates |
| `classroom:{id}:day_path` | `day_path_events` (INSERT) | Parent (own child) | Any status-changing action (bus, teacher, reception) |
| `conversation:{id}:messages` | `messages` (INSERT) | Guardian + Teacher in that conversation | `send_message` RPC |
| `user:{id}:notifications` | `notifications` (INSERT, UPDATE for read state) | Every account type, own feed | Any notification-writing RPC/job |
| `tenant:{id}:cameras` | `cameras` (UPDATE — online/offline, heartbeat) | Dashboard, Parent (linked classroom only) | Camera heartbeat job (§27) |
| `tenant:{id}:activity` | `activity_log` (INSERT) | Dashboard | Any logged action |
| `tenant:{id}:approvals` | `requests` (INSERT, UPDATE) | Dashboard (new pending), Teacher (own status change) | `submit_request`/`review_request` RPCs |
| `platform:service_health` | `service_health_status` (UPDATE) | Platform Admin | Health-check job |
| `platform:tenants` | `tenants` (UPDATE — status changes) | Platform Admin | Billing job, manual suspend/reactivate |
| `platform:support_tickets` | `support_tickets` (INSERT, UPDATE) | Platform Admin (all, `support` tier included) | New/updated ticket |
| `tenant:{id}:cameras:heartbeat` (subset of the cameras channel above) | `cameras` (`admin_disabled` UPDATE specifically) | Dashboard | Manager toggle — called out separately from heartbeat-driven `online` changes so the Dashboard UI can distinguish "I just disabled this" from "it went offline" (§17) |

Implementation notes:
- Channels are **scoped by RLS**, not by a separate authorization step — a parent subscribing to `trip:{trip_id}:position` for a trip that doesn't carry their child simply receives no rows, because the underlying `gps_pings` SELECT policy already filters it out.
- High-frequency GPS updates use Realtime's `postgres_changes` on `gps_pings`, **not** Supabase's ephemeral Broadcast feature, specifically because a persisted row-per-ping is required for trip replay/audit — Broadcast-only would be cheaper but would lose that history.
- Camera **video** itself is never realtime-over-Postgres (see §17) — only camera *metadata* (online/offline) flows through this matrix.
- Client apps must debounce/throttle GPS-driven UI updates (e.g., render at most 1x/second) independent of ping frequency, since ping frequency is a backend cadence decision (§18), not a UI one.

---

## 16. Notification Matrix

| Event | Recipient(s) | Channels | Category |
|---|---|---|---|
| Child picked up by driver (AM) | That child's guardians | push, in_app | trip_update |
| Bus arrived at school | All riders' guardians (bulk) | push, in_app | trip_update |
| Child dropped off (PM) | That child's guardians | push, in_app | trip_update |
| Bus departed for home | All riders' guardians (bulk) | push, in_app | trip_update |
| Attendance marked (per class or all) | Targeted guardians | push, in_app, (whatsapp optional) | attendance |
| Teacher evaluation/concern raised | That child's guardians | push, in_app | academic |
| AI report sent | Target guardians | push, in_app, whatsapp/email (per selection) | report_ready |
| Request approved/rejected | Submitting teacher | in_app, push | approval |
| Event published (new exam/celebration/trip) | Classroom guardians | push, in_app | event |
| Payment due / overdue | Child's guardians | push, in_app, (whatsapp reminder) | payment_due |
| Price change | Affected guardians | push, in_app | billing |
| Payment received/confirmed | Child's guardians, Manager | push, in_app | payment |
| New chat message | Other participant | push, in_app | chat_message |
| Chat escalated | Manager | in_app, push | escalation |
| Pickup handover confirmed | Child's guardians | push, in_app | safety |
| Reception bus arrival/departure confirm | All relevant guardians (bulk) | push, in_app | safety |
| Announcement/broadcast | Selected audience | per announcement's `channels[]` | announcement |
| Camera goes offline (heartbeat lapse) | Manager | in_app | system |
| Support ticket status change | Reporting manager | in_app, email | support |
| Tenant overdue / suspended | Manager, Platform Admin | in_app, email | billing |
| New school provisioned | Platform Admin team | in_app | platform |
| New request submitted (awaiting review) | Manager | in_app, push | approval |
| Leave scheduled with covering teacher assigned | Covering teacher | in_app, push | academic |
| Child added to / removed from a bus route | Child's guardians | push, in_app | trip_update |
| Payment reminder (recurring cadence, T-3/T0/T+3 days from due date) | Child's guardians | push, in_app, whatsapp | payment_due |
| Background job repeatedly failing (past retry cap) | Manager (tenant-scoped job) / Platform Admin (platform-scoped job) | in_app | system |
| Manual payment stuck in `pending_verification` past SLA | Manager | in_app | payment |
| Account suspended / sessions revoked | The affected account (informational, sent before session invalidation completes) | push, in_app | system |

All rows funnel through the same `notifications` table + `notification_deliveries` fan-out (§3.48-49) and the same dispatch Edge Function (§26) — this matrix is the **content/routing spec**, not 20+ separate implementations.

**Preference gating (resolves a gap in the v0 draft):** this matrix states the *default* routing; actual delivery on the push/whatsapp/sms/email channels is gated per-recipient by `comms.notification_preferences` (§3.49.2) — the dispatch job checks preference before attempting each channel and records `skipped_by_preference` rather than sending if the recipient opted out of that (category, channel) pair. `in_app` (the `notifications` row itself, i.e. the feed the recipient sees inside the app) is never gated by preference — only outbound-channel noise is opt-out-able, so category toggles in Settings control "do you get pinged," not "does this ever reach your feed." Safety-critical categories (`safety`, `payment_due` past a hard threshold, `escalation`) are additionally exempt from opt-out on the `in_app` channel by policy, though their push/whatsapp delivery still respects preference.

---

## 17. Camera Architecture

- **Scope boundary (explicit)**: Postgres/Supabase stores **camera metadata only** — registry, online/offline state, classroom linkage, resolution/audio flags, heartbeat timestamps. **Video stream transport is out of the Supabase stack entirely.**
- **Streaming approach**: cameras are RTSP/IP sources on-premise at each nursery. A dedicated **media relay service** (e.g., an RTSP-to-WebRTC/HLS gateway, run as separate infrastructure — not a Supabase component) converts on-prem RTSP into browser/mobile-consumable WebRTC or low-latency HLS. The relay is the "Camera relay" service tracked in `service_health_status`.
- **Credential handling**: raw camera IP/RTSP credentials (`cameras.ip_address`, stream auth) are **never sent to client apps**. The client requests a **short-lived signed stream token** from an Edge Function (`get_camera_stream_token(camera_id)`), which: (1) checks RLS-equivalent authorization (is this parent's child linked to this camera's classroom?) via the RPC's own tenant/ownership check, (2) mints a scoped, time-limited token against the media relay's own auth system, (3) returns a relay URL + token, never the camera's real network address.
- **Access rule**: Parent App only ever resolves cameras via `camera_classroom_links` joined through the parent's own child's `classroom_id` — a parent can never list or view a camera outside their child's linked classroom(s), enforced both by RLS on `cameras`/`camera_classroom_links` reads and again by the stream-token RPC (defense in depth, since stream tokens are higher-stakes than metadata reads).
- **Heartbeat**: each camera's on-prem agent authenticates as a tenant-scoped `service_account` (§10.7, not a human role) and calls the `camera-heartbeat` Edge Function on an interval (e.g., every 60s), which sets `online=true, last_heartbeat_at=now()`; a scheduled job (§27) flips `online=false` for any camera whose `last_heartbeat_at` exceeds a threshold (e.g., 3 missed intervals), which fans out into the realtime channel (§15) and a Manager notification (§16).
- **Manual override is a separate field, not a shared status** (resolves a conflict in the v0 draft): a manager's "toggle camera off" action in the Dashboard writes `admin_disabled`, never `online` — the heartbeat mechanism only ever reads/writes `online` and never touches `admin_disabled`. A camera is stream-viewable only when `online = true AND admin_disabled = false` (§3.33), so a manager's deliberate disable persists across heartbeat cycles instead of being silently reverted by the next sweep, and the two realtime channels (`tenant:{id}:cameras` for heartbeat-driven `online` changes, `tenant:{id}:cameras:heartbeat`'s sibling for `admin_disabled` changes, §15) let the Dashboard UI distinguish the two causes in its display.
- **No recording/storage in v1**: the frontend shows a live-only feed (explicitly flagged in the frontend as a placeholder for real RTSP/WebRTC). If recording/playback becomes a requirement later, that's a new `camera_recordings` table + object storage bucket + retention policy — deliberately not built now to avoid speculative storage-cost architecture.

---

## 18. GPS Tracking Architecture

- **Write path**: Driver App calls `record_gps_ping(trip_id, lat, lng, heading, speed)` on a fixed cadence while a trip is `status IN ('scheduled'→started, 'moving')`. **Cadence: every 5-10 seconds**, chosen to balance live-map smoothness against write volume and mobile battery/data usage — configurable per-tenant later via a settings column if needed, hardcoded constant in v1.
- **Client-side throttling contract**: the Driver App only sends a ping if the device has moved more than a small threshold (e.g., ~10m) OR the max interval has elapsed, whichever first — reduces redundant writes when the bus is stationary (traffic, stop).
- **Read path**: Parent App and Dashboard subscribe to the Realtime channel (§15) for live position; they do **not** poll `gps_pings` directly. For "last known position" on initial load (before the first realtime event arrives), a single indexed query (`gps_pings` ordered by `(trip_id, recorded_at desc)` limit 1) seeds the map.
- **Trip completion semantics**: a trip's `status` moves `scheduled → moving → arrived → completed` (or `cancelled`); `arrived` fires when the driver confirms nursery arrival (AM) or all drop-offs are done (PM); `completed` is a manager/system-confirmed closeout. GPS pings stop being written once `completed`/`cancelled`.
- **Retention**: `gps_pings` is high-volume and time-series-shaped. Retention policy (enforced by a scheduled job, §27): raw pings older than **30 days** are purged; a lightweight `trip_route_snapshot` (simplified polyline, one row per trip, computed once at trip completion) is retained indefinitely for historical "did the bus follow its route" review, decoupling long-term storage cost from raw ping volume.
- **No geofencing in v1** — the frontend shows manual driver/reception confirmation, not automatic arrival detection. Geofencing (auto-detecting "bus is within Xm of school") is a clearly-scoped future enhancement, not built speculatively now.

---

## 19. AI Report Architecture

- **Provider boundary**: all LLM calls happen inside **Edge Functions only** (`ai_polish_note`, `ai_draft_report`) — API keys for the LLM provider live in Edge Function secrets, never reach the client, matching the frontend's existing `window.claude.complete`-with-fallback pattern (which must be replaced by a real server-side call, not left client-side).
- **Two distinct AI touchpoints**, mirroring the frontend exactly:
  1. **Note polishing** (Teacher App, per-evaluation): takes raw free-text, returns a polished version. Stateless, no persistence of intermediate drafts — only the final chosen text is saved to `evaluations.note`.
  2. **Report drafting** (Teacher App per-student, Dashboard batch by classroom/children): takes `type`, `topic`, and a **structured context payload assembled server-side** from `evaluations`/`attendance_records`/`lessons` for the relevant period — not just a free-text prompt — so the LLM is grounded in actual data, not hallucinating from a topic string alone. Output is written as `ai_report_drafts.status='draft'`, always human-reviewed/edited before `status` can move to `ready`/`scheduled`/`sent`.
- **Fallback template**: if the LLM call fails or times out, the Edge Function falls back to a deterministic templated report (same pattern as the frontend's existing fallback), so report drafting is never a hard-blocking dependency on external AI uptime.
- **No AI-authored content is ever auto-sent without a human decision point**: `ai_report_drafts.status` reaches `ready`/`sent` only via explicit staff action (`send_report_draft` RPC) for immediate sends. For **scheduled** sends (`status='scheduled'`, `scheduled_for` set by staff after reviewing/editing the draft — the human-in-the-loop step already happened at scheduling time, not at delivery time), a scheduled job (§27, "AI report scheduled dispatch") sweeps for `scheduled_for <= now()` and transitions those specific drafts to `sent`, triggering delivery — this closes a gap in the v0 draft where `scheduled` was a reachable status with no job that ever acted on it. The AI itself never has write access to trigger delivery at any point in either path.
- **Cost/rate control**: the Edge Function enforces a per-tenant daily cap on AI calls via `reports.ai_usage_counters` (§3.20.1) — committed as the single mechanism, not left as one option among several — preventing runaway cost from a misbehaving client loop; batch report generation is processed as a background job (§26), not a synchronous request, once batch size exceeds a small threshold (e.g., >10 children), to avoid Edge Function timeout limits.

---

## 20. Payment Architecture

- **Model**: Masar is a **payment facilitator, not a payment processor** — actual money movement happens through the payment methods already visible in the frontend (bank transfer w/ receipt upload, InstaPay, mobile wallet, Fawry), meaning **at least two of these four methods are manual/semi-manual (bank transfer, Fawry code) and require reconciliation**, not instant webhook confirmation; InstaPay/wallet can be gateway-integrated for instant confirmation depending on the chosen PSP (payment service provider — selection is a vendor decision outside this document's scope, but the architecture below is PSP-agnostic).
- **Transaction lifecycle**: `payment_transactions.status`: `initiated → pending_verification → succeeded | failed → (refunded)`.
  - **Gateway-backed methods** (InstaPay/wallet, if integrated with a real-time PSP): `initiated` → PSP webhook → `succeeded`/`failed` automatically, via `payment_webhook_handler` Edge Function (public endpoint, PSP signature verified, idempotent on `provider_reference`).
  - **Manual methods** (bank transfer, Fawry): `initiated` (guardian submits + uploads receipt for bank transfer, or generates a Fawry reference code) → `pending_verification` → a **Manager** reviews and manually transitions to `succeeded`/`failed` via the `verify_payment` RPC. This matches the frontend's manual receipt-upload flow exactly — there is no pretense of automatic bank-transfer confirmation. A row stuck in `pending_verification` past a defined SLA (e.g., 48h) is flagged by a scheduled job (§27) and notifies the Manager (§16) — reconciliation delay is surfaced proactively rather than silently sitting until a parent complains.
  - **In-person/cash payments** (no `payment_transactions` row at all — e.g., cash handed to a manager) use the separate `mark_installment_paid_manual` RPC (§14.2) against `installment_schedule_entries` directly, distinct from `verify_payment`, which always reconciles an existing guardian-submitted transaction. Keeping these as two different RPCs (rather than overloading `verify_payment`) keeps "was there ever a payment_transactions record" an honest question the ledger can answer.
- **Ledger update**: on `succeeded`, a trigger/RPC atomically updates the related `billing_ledger_items`/`installment_schedule_entries` (`paid=true`/`status='paid'`, `amount_paid` incremented) and the `invoices.status`, and fires the "payment received" notification (§16). This must be one transaction — partial ledger updates on payment success are a correctness bug class to explicitly guard against. `installment_schedule_entries.status` now uses the same stored enum as `billing_ledger_items.status` (§3.40), so this update touches both tables with identical semantics.
- **Idempotency**: `payment_transactions.provider_reference` is unique where non-null, so a duplicate webhook delivery (standard for most PSPs, which retry on non-2xx) never double-credits a ledger.
- **Refunds**: `status=refunded` is a distinct terminal state with its own ledger-reversal RPC (`refund_payment`) — not modeled as a negative-amount new transaction, to keep `SUM(amount) WHERE status='succeeded'` meaningful without special-casing.
- **PCI scope**: card data, if ever added, must never touch Supabase directly — hosted PSP checkout/tokenization only. Not currently in scope (no card payment method in the frontend).
- **Platform-level billing** (tenant paying Masar, not parent paying tenant) is a **structurally separate flow** reusing the same `payment_transactions`-style pattern but scoped at `tenants` rather than `children` — modeled as `platform.tenant_billing_transactions`, deliberately not reusing the `billing.*` schema's tables, since mixing "parent pays nursery" and "nursery pays Masar" into one table would conflate two different money flows with different reconciliation owners.

---

## 21. Storage Architecture

Supabase Storage, bucket-per-sensitivity-tier design:

| Bucket | Contents | Access pattern |
|---|---|---|
| `public-branding` | Tenant logos, plan marketing assets | Public read |
| `profile-photos` | Child/staff/guardian photos | Private, signed URL, RLS-gated via `storage_objects` ownership check |
| `identity-documents` | Pickup pass ID photos, staff national ID scans | Private, signed URL, short expiry, tightest access (manager/reception only, never public) |
| `academic-attachments` | Exam paper uploads, lesson attachments | Private, signed URL, classroom/tenant-scoped |
| `payment-receipts` | Bank transfer receipt uploads | Private, signed URL, guardian (own) + manager (own tenant) |
| `chat-attachments` | Future chat file/image sharing | Private, signed URL, conversation participants only |
| `generated-documents` | Invoice PDFs, exported AI reports | Private, signed URL, generated by Edge Functions, not user-uploaded |
| `camera-snapshots` | (Future) still-frame snapshots, if added | Private — not in v1 scope, reserved |

- **Path convention**: every object path is prefixed `{tenant_id}/{bucket-specific-subpath}` — this makes Storage bucket policies mirror the same tenant-isolation pattern as RLS (Supabase Storage policies can reference the path structure directly).
- **`storage_objects` table is the source of truth for ownership/metadata** (§3.35); the Storage bucket holds bytes, the table holds who-owns-what and drives access control decisions before a signed URL is ever minted. No client ever constructs a Storage path itself — upload flows always go through an RPC/Edge Function that returns a pre-signed upload URL scoped to the correct tenant-prefixed path.
- **Signed URL TTLs**: profile photos ~1h (frequently re-fetched, low sensitivity), identity documents ~5min (rare, high sensitivity), generated documents ~24h (user may want to re-download same session).
- **Pending-upload visibility**: see §13.8 — a `storage_objects` row is visible only to its own uploader until `finalize_upload` confirms it, after which normal ownership-based visibility (mirroring the attached resource) applies.

---

## 22. File Upload Architecture

### 22.1 Upload flow (uniform across all upload types)
1. Client requests an upload slot: `request_upload(owner_type, owner_id, mime_type) → {signed_upload_url, storage_object_id (pre-created row, pending)}` — an Edge Function or RPC, validates the caller may attach a file to that `owner_type/owner_id` (e.g., a guardian may only attach to their own child's pickup pass, not another's).
2. Client uploads bytes directly to Supabase Storage using the signed URL (bypasses the app server for the bytes themselves — standard practice, avoids proxying large files through Edge Functions).
3. Client calls `finalize_upload(storage_object_id)` → validates the object actually landed (size, mime match) → flips the `storage_objects` row from pending to confirmed, and only then does it become visible to any RLS-governed read.
4. **Orphan cleanup**: a scheduled job (§27) purges `storage_objects` rows (and their bucket objects) left in `pending` state for more than 24h — covers abandoned uploads (user backed out mid-flow) without needing client-side cleanup guarantees.

### 22.2 Validation
- Server-side (Edge Function, at `request_upload` time): mime-type allowlist per `owner_type` (e.g., `identity-documents` only accepts image mimes, `academic-attachments` accepts PDF/image), max size per type (e.g., photos capped ~5MB, exam papers ~20MB).
- Client-side validation is UX-only, never trusted as the actual control.

### 22.3 Image handling
Profile photos are resized/optimized (thumbnail + display size) by an Edge Function triggered on `finalize_upload` for `owner_type IN (photo types)` — writes both sizes as separate `storage_objects` rows linked by a `variant_of` self-reference, so the frontend can request the cheap thumbnail for list views and the full size only in detail views.

### 22.4 Exam paper preview
Matches the Dashboard's "preview uploaded exam paper" approval-screen feature: PDFs are served via signed URL directly (browser-native PDF viewing), no server-side rendering needed.

### 22.5 Deletion
File deletion is **always orchestrated**, never a bare Storage API call from the client: a `delete_storage_object(id)` RPC/Edge Function removes the bucket object and the `storage_objects` row together, and only after verifying the caller owns/administers that object per the same rules as upload. This avoids the failure mode of an orphaned DB row pointing at deleted bytes (or vice versa).

---

## 23. Audit Logging

- **Table**: `platform.audit_log` (§3.51) — immutable, append-only, **no `UPDATE`/`DELETE` grants to any role including `manager`**; only `service_role`-executed RPCs can insert.
- **What is audited** (security/compliance-relevant actions, distinct from the operational `activity_log` in §24): authentication events (login, failed-login, password reset, MFA changes) for staff/platform_admin roles; **session revocations** (§10.6 — every `suspend_staff_account`/`revoke_sessions` call, who triggered it and why); tenant lifecycle changes (provisioned, suspended, reactivated, plan changed); role/permission-adjacent changes (staff added/removed, activation links regenerated per §10.3); **service account key issuance and revocation** (§10.7 — who issued a camera agent's key, when, and its scopes); financial state changes (payment verified/refunded, invoice voided, manual cash payments marked via `mark_installment_paid_manual`); data access to sensitive resources by Platform Admin specifically (any cross-tenant support read is itself logged, so "who at Masar looked at this tenant's data and when" is always answerable); pickup pass creation/revocation and scan results (custody-adjacent, high sensitivity).
- **Immutability enforcement**: RLS policy grants `INSERT` only (no `UPDATE`, no `DELETE`) to the roles permitted to write it, and even those inserts route through RPCs rather than direct table access, so the audit trail can't be tampered with by a compromised client session — only by direct database admin access, which is itself outside the app's threat model and covered by Supabase project-level access controls.
- **Retention**: audit log is retained indefinitely (or per whatever compliance requirement applies once one is defined) — it is explicitly exempt from the general data-retention purge job in §29.

---

## 24. Activity Logging

- **Table**: `tenancy.activity_log` (§3.50) — the **operational, user-facing** feed (Dashboard "recent activity," Reception "activity log"), distinct from the security-focused `audit_log`. Mutable retention (can be pruned for storage cost, see §29), not held to the same immutability bar.
- **What is logged**: child status transitions, attendance marked, request submitted/approved/rejected, payment received, staff leave scheduled, camera added/removed, classroom changes, pickup handovers, bus trip milestones — essentially every write that a human on the Dashboard or Reception screens would want to see summarized in a feed.
- **Population mechanism**: written by the same RPCs that perform the underlying action (e.g., `mark_attendance` writes both the `attendance_records` rows and one `activity_log` row summarizing the batch) — **never** via a generic table-level trigger that logs every raw `UPDATE`, because that produces noise (e.g., a `day_path_status` change from `classroom`→`playing` is operationally uninteresting at the activity-log level even though it's tracked in `day_path_events` for other purposes). This is a deliberate distinction: `activity_log` is curated/summarized, `day_path_events`/`gps_pings`/`audit_log` are raw/complete.

---

## 25. Error Handling

### 25.1 Error taxonomy (stable codes surfaced to clients)
| Code prefix | Meaning | Example |
|---|---|---|
| `AUTH_*` | Authentication/session issues | `AUTH_EXPIRED`, `AUTH_INVALID_CREDENTIALS` |
| `PERM_*` | Authorization failures (RLS denial surfaced as a clean error, not a raw Postgres error) | `PERM_TENANT_MISMATCH`, `PERM_ROLE_DENIED` |
| `VALIDATION_*` | Input/business-rule violations caught before/inside an RPC | `VALIDATION_CAPACITY_EXCEEDED` (bus/classroom full), `VALIDATION_DUPLICATE_PHONE` |
| `STATE_*` | Illegal state transition | `STATE_TRIP_ALREADY_COMPLETED`, `STATE_REQUEST_ALREADY_REVIEWED` |
| `EXTERNAL_*` | Downstream dependency failure | `EXTERNAL_PAYMENT_GATEWAY_TIMEOUT`, `EXTERNAL_AI_PROVIDER_UNAVAILABLE` |
| `CONFLICT_*` | Idempotency/uniqueness conflicts | `CONFLICT_DUPLICATE_PAYMENT_REFERENCE` |

### 25.2 RPC error contract
Every RPC raises Postgres exceptions using `RAISE EXCEPTION ... USING ERRCODE, MESSAGE, DETAIL` with the `DETAIL` field carrying a JSON payload `{code, human_message_en, human_message_ar}` — PostgREST surfaces this in a predictable shape the client SDK can pattern-match on, rather than parsing free-text error strings. Bilingual messages are returned from the backend (not just the code) because the frontend is bilingual throughout (every entity above has `_ar` fields) and error UX shouldn't be the exception to that.

### 25.3 Cross-system operation failures (Auth + DB, Payment + DB)
Any operation spanning Supabase Auth and the Postgres profile tables (account provisioning, §10.3) or spanning an external payment gateway and the ledger (§20) follows a **saga/compensation pattern**, not a distributed transaction (Postgres and external systems can't share one ACID transaction):
1. Perform the external/Auth call first.
2. On success, perform the DB write.
3. If the DB write fails, issue a compensating action against the external system (delete the just-created Auth user; void the just-initiated payment intent) and surface a clean retryable error to the client.
4. All such flows are also idempotent on retry (checking "does this already exist" before re-calling the external API), since network failures between steps 1-3 can leave the system in an inconsistent state that a client retry must be able to safely repair.

### 25.4 Edge Function error handling
Every Edge Function wraps external calls (LLM, payment gateway, WhatsApp/SMS provider) with a timeout and a typed catch that maps provider-specific failures to the `EXTERNAL_*` taxonomy above — provider error details are logged server-side for debugging but never passed through raw to the client.

### 25.5 Client-facing degradation
Where a non-critical dependency fails (AI report generation, WhatsApp delivery), the system degrades gracefully per the patterns already specified elsewhere in this document (AI fallback template in §19, in-app notification always succeeds even if WhatsApp delivery fails in §26) rather than failing the entire user action.

### 25.6 Idempotency and retry contract
Every mutating RPC/Edge Function that accepts an `idempotency_key` (the default per §2.2/§14.3, with the narrow exceptions noted there) guarantees: calling it twice with the same key and the same caller returns the same result the second time without re-executing the underlying write, and calling it with the same key but a *different* payload raises `CONFLICT_IDEMPOTENCY_KEY_REUSED` rather than silently applying either version. Clients are expected to generate a fresh key per logical user action (not per HTTP attempt) and reuse it only across retries of that same action. This is the generalized rule that §20's payment-specific idempotency was previously the only instance of.

---

## 26. Background Jobs

Background jobs (as opposed to scheduled/cron jobs, §27) are **triggered by an event**, processed asynchronously to keep the triggering request fast. Implementation: Supabase's `pg_net`/database webhooks triggering Edge Functions, or the `jobs.background_job_queue` table (§3.53.3, renamed from the v0 draft's `background_job_queue_meta` — it is the queue itself, not just metadata about one) polled by a scheduled Edge Function every ~10-30s if ordering/retry guarantees beyond what database webhooks give are needed (e.g., notification dispatch, where at-least-once + idempotency matters).

| Job | Trigger | Work |
|---|---|---|
| Notification dispatch | Any INSERT into `notifications` | Check `notification_preferences` per (category, channel) (§16); fan out to `notification_deliveries` for enabled channels; resolve `device_tokens` for push; call push/WhatsApp/SMS/email provider APIs; update delivery status |
| Batch AI report generation | `ai_draft_report` RPC when scope size > threshold | Check/increment `ai_usage_counters` (§19); iterate children, call LLM per child, write drafts, notify requesting staff on completion |
| Invoice PDF generation | `generate_invoice` RPC | Render PDF, upload to `generated-documents` bucket, link `invoices.pdf_object_id` |
| Image variant generation | `finalize_upload` for photo owner types | Resize, upload variants (§22.3) |
| Provisioning cascade | `provision_tenant` / `enroll_child` / `add_staff` / `add_bus` | Auth Admin API calls (no password set) + activation-link dispatch to the new account directly (§10.3) + `tenant_phone_registry` insert |
| Payment webhook processing | Inbound PSP webhook | Verify signature, update `payment_transactions`, trigger ledger update RPC |
| Device token invalidation | Push provider reports a token as invalid/expired | Hard-delete the matching `device_tokens` row (§3.49.1) |

Retry policy: every job is idempotent (keyed by the triggering row's id, or by `idempotency_key` per §25.6 for anything that also has a client-facing RPC form) and retried with exponential backoff up to a fixed cap (e.g., 5 attempts), after which it's marked `failed` in `jobs.background_job_queue` and triggers the "background job repeatedly failing" notification (§16) rather than silently dropping — critical for payment and notification jobs specifically.

---

## 27. Scheduled Jobs

Implementation: `pg_cron` (Supabase's built-in Postgres cron extension) triggering either a Postgres function directly (for pure-DB work) or a database webhook to an Edge Function (for anything needing external calls).

| Job | Schedule | Work |
|---|---|---|
| **Recurring billing ledger generation** | Daily | For every active `fee_items` row whose `cycle`'s period has rolled over since its last `billing_ledger_items` row for a given child (monthly/per-term/yearly), insert the new `billing_ledger_items` row for the new `period_label`. **Resolves a gap in the v0 draft**: the "Billing status roll-up" job below only recomputed status on *existing* ledger rows — nothing previously created the recurring rows themselves, so recurring fees were never actually billed period-over-period. |
| Billing status roll-up | Daily, early morning | Recompute `children.membership_status`, `billing_ledger_items.status`, and `installment_schedule_entries.status` (overdue detection, now stored identically on both tables per §3.40) from due dates; queue payment_due notifications |
| **Payment reminder cadence** | Daily | For each unpaid `billing_ledger_items`/`installment_schedule_entries` row, send a reminder notification at T-3/T0/T+3 days relative to `due_date` (§16) — the recurring counterpart to the Dashboard's manual "remind all unpaid" action, which remains available as an on-demand supplement, not a replacement |
| **Stale manual-payment escalation** | Daily | Flag `payment_transactions` in `pending_verification` past SLA (e.g., 48h) and notify Manager (§16, §20) |
| **AI report scheduled dispatch** | Every 5 min | Sweep `ai_report_drafts` where `status='scheduled' AND scheduled_for <= now()`, transition to `sent`, trigger delivery (§19) |
| Tenant billing check | Daily | Recompute `tenants.status` (overdue/suspended) from `platform.tenant_billing_transactions`; notify Platform Admin of newly-overdue tenants |
| Camera heartbeat sweep | Every 1-2 min | Flip `cameras.online=false` for stale heartbeats — never touches `admin_disabled` (§17) |
| GPS ping retention purge | Daily | Delete `gps_pings` older than 30 days (§18), after `trip_route_snapshot` generation for any completed trip missing one |
| Storage orphan cleanup | Daily | Purge `pending` `storage_objects` older than 24h (§22.1) |
| Idempotency key purge | Daily | Delete `jobs.idempotency_keys` rows older than 24h (§25.6) |
| Staff rating recomputation | Weekly | Recompute `staff_profiles.rating` from `staff_feedback` (§3.6) |
| Service health check | Every 1 min | Ping each internal service (API gateway, media relay, notification provider, payment gateway reachability) and write `service_health_status` |
| Trial expiry sweep | Daily | Flip `tenants.status` from `trial` to `overdue`/prompt-to-upgrade at `trial_ends_at`, notify Platform Admin |
| Attendance non-marking alert | Daily, mid-morning | Flag classrooms with no attendance marked yet, notify Manager |
| **Failed-login / session anomaly sweep** | Hourly | Review recent `audit_log` authentication-failure entries (§23) for per-account/per-IP thresholds beyond normal login rate-limiting (§28); flag suspicious patterns for Manager/Platform Admin review |
| Audit/activity log archival | Monthly | Move `activity_log` rows older than the retention window (§29) to cold storage/export, keep `audit_log` untouched (indefinite retention, §23) |

At higher tenant counts, the sub-2-minute jobs above (camera heartbeat sweep, service health check) are revisited for staggering/sharding rather than one global scan — see §30.

All scheduled jobs are registered with a **run-history table** (`jobs.scheduled_job_runs`, §3.53.2: job_name, started_at, finished_at, status, rows_affected, error) so failures are observable without grepping logs, and a run that ends `failed` triggers the "background job repeatedly failing" notification (§16) — this is what Platform Admin's "system health" view partially surfaces.

---

## 28. Security Model

- **Defense in depth, four layers**: (1) Supabase Auth session validity, (2) JWT claim-based role/tenant checks inside RPCs, (3) RLS as the database-enforced backstop that holds even if an application-layer check is buggy, (4) network/infra-level controls (Edge Function secrets never exposed to client, Storage buckets private-by-default).
- **RLS is mandatory, not optional, on every table** — including tables that "feel" safe (e.g., `plan_catalog` is read-only reference data, but still gets an explicit `SELECT`-for-authenticated policy rather than being left with RLS disabled, so a future column addition can't accidentally leak).
- **Least privilege for Platform Admin**, detailed in §13.6 — the single most important boundary in the whole system, since Platform Admin is the role most likely to be socially engineered or phished given its cross-tenant reach; scoping its actual data access tightly limits blast radius even if that credential is compromised.
- **MFA required for `platform_admin` role** (Supabase Auth MFA/TOTP) — not required for tenant-side roles in v1 (matches the frontend, which shows simple password auth for all tenant apps), but the schema/Auth config should make it a config toggle, not a redesign, if a tenant later requests it for `manager`.
- **Secrets management**: all third-party API keys (LLM provider, payment gateway, WhatsApp/SMS provider, media relay auth) live in Supabase Edge Function environment secrets, never in the database, never in any client bundle.
- **PII minimization on the wire**: list views (e.g., Reception's bus roster) request only the fields the screen needs (PostgREST column selection), not full child records with medical/financial data, even though RLS would technically permit broader access for that role — narrowing the query is a deliberate additional control against over-fetching.
- **Rate limiting**: sensitive/abusable RPCs (`scan_pickup_pass`, OTP request, `ai_polish_note`) have per-caller rate limits enforced at the Edge Function layer (simple sliding-window counter, e.g. via a small Postgres table or Upstash-style external store) to prevent brute-force/abuse. **Primary login (phone/email + password) is included in this rule, not exempted** (resolves a gap in the v0 draft): Supabase Auth's built-in rate limiting is enabled and tuned per environment, backstopped by the same per-caller sliding-window counter (keyed on phone/email + source IP) on top of it, with progressive lockout on repeated failures — every failure is written to `audit_log` (§23) and feeds the hourly session-anomaly sweep (§27).
- **Input sanitization**: all free-text fields that flow into notifications/WhatsApp/PDF generation are treated as untrusted and escaped/sanitized at render time in the relevant Edge Function — relevant because these values eventually render in external channels (WhatsApp, email, PDF) with their own injection surface.
- **No credential ever leaves the server in plaintext**: account provisioning delivers a one-time activation link directly to the new account's own phone, never a password through an API response or a manager relay step (§10.3).
- **Session lifecycle is actively managed, not just access-controlled**: suspension/termination synchronously revokes active sessions (§10.6); a standalone `revoke_sessions` action exists for forced logout independent of suspension.
- **Machine callers never share the human auth surface**: on-prem/service integrations authenticate via scoped API keys against `service_accounts` (§10.7), never via a shared or default Supabase Auth credential, and are excluded from the RBAC role model entirely rather than mapped onto a convenient existing role.
- **Data residency and compliance**: given Egypt-based operation (EGP currency, national ID numbers, children's health data) and Egypt's Personal Data Protection Law (Law No. 151/2020), the Supabase project region (§30, §34), the payment gateway, and the media relay vendor are all selected with data-residency and lawful-basis-for-processing obligations as an explicit vendor-selection criterion, not an afterthought — this is a legal/vendor decision to be finalized before Phase 0 sign-off (§35), not a backend implementation detail this document can resolve unilaterally.
- **Observability**: see §31 for the structured-logging/error-tracking strategy that backstops `service_health_status`'s coarse uptime signal — security incident response depends on having more than an up/down flag to investigate from.

---

## 29. Performance Strategy

- **RLS performance discipline**: `tenant_id` denormalized onto every row (§2.2) + indexed (§6) is the single highest-leverage decision here — Postgres RLS policies that require a join or subquery to determine tenant membership are the most common cause of slow RLS-protected queries at scale; this schema avoids that by construction.
- **Hybrid current-state + history pattern** for high-write, live-read fields (`children.day_path_status`, `trips.status`): keep a fast denormalized "current value" column for reads (dashboard, parent live view) alongside an append-only history table (`day_path_events`, `gps_pings`) for audit/replay — avoids the two competing failure modes of "pure event-sourcing is too slow for a live status read" and "pure mutable column loses history."
- **Materialized views for aggregates**: `children`'s attendance percentage, staff `rating`, tenant billing summaries — computed via materialized views refreshed by scheduled jobs (§27), not computed live on every request and not stored as manually-maintained columns prone to drift.
- **Connection pooling**: Supabase's built-in PgBouncer (transaction mode) for all PostgREST/RPC traffic; long-running Edge Functions that need a dedicated session (rare) use direct connections sparingly.
- **Pagination discipline**: cursor-based everywhere (§14.3) — offset pagination degrades badly on the largest tables here (`gps_pings`, `messages`, `notifications`, `activity_log`).
- **N+1 avoidance**: PostgREST's embedded-resource querying (`select=*,classroom(*)`) is used for the common list+relation screens (e.g., children with classroom name) instead of client-side fan-out queries.
- **Realtime channel scoping**: subscriptions are always scoped to the narrowest relevant filter (`trip_id`, `conversation_id`), never a tenant-wide firehose, to keep Realtime's replication load proportional to actual UI need — see §30 for the connection-concurrency budget this scoping is meant to protect.
- **Capacity-lock contention is bounded by design**: the `SELECT ... FOR UPDATE` pattern (§2.2, §14.3) locks one parent row (a bus/event/classroom) per capacity-checked write, held only for the duration of a short transaction — this is a per-resource lock, not a table-wide one, so contention is limited to genuinely concurrent writes against the *same* bus/event/classroom, which is both rare and exactly the case that needs serializing.
- **Stored `overdue`/`status` columns are indexable by design**: now that `installment_schedule_entries.status` matches `billing_ledger_items.status` as a stored, job-maintained value (§3.40), both support the same partial-index pattern (§6) — a read-time-only computation could never be indexed this way, which is the performance reason (on top of the consistency reason in §1) that the v0 draft's approach was corrected.

---

## 30. Scalability Strategy

- **Horizontal scale of stateless layers**: PostgREST and Edge Functions scale horizontally by default under Supabase's managed infrastructure — no architectural work needed there beyond keeping functions stateless (no in-memory session state across invocations).
- **Vertical + read-replica scale of Postgres**: as tenant count grows, the shared-database model (§9) scales vertically first (Supabase's managed Postgres tiers); if/when read load from Dashboard analytics or Platform Admin cross-tenant views becomes a bottleneck, introduce a **read replica** specifically for reporting/aggregate queries (materialized views in §29 refresh from the primary; ad-hoc analytics reads route to the replica) — this is a deferred, clearly-scoped future step, not built prematurely.
- **Partitioning candidates** (deferred until volume warrants it, but the schema is designed to make this additive): `gps_pings` and `activity_log`/`audit_log` are natural candidates for time-range partitioning (e.g., monthly) once row counts justify it — because every query pattern on these tables already filters by a time range or a recent-first ordering, partitioning won't require query rewrites, only a physical storage change.
- **Tenant growth path**: the shared-schema model (§9) comfortably scales to low-thousands of tenants; if Masar's business grows well beyond that with very large individual tenants (a "premium" nursery chain with tens of thousands of children), the `tenant_id`-first design here is what makes a future move to **schema-per-large-tenant or database-per-large-tenant for outliers only** possible without redesigning the data model — it would be a deployment/routing change, not a schema rewrite.
- **Media/GPS scale independent of core DB**: the camera relay (§17) and any future video recording storage are explicitly kept **outside** Postgres/Supabase Storage's scaling envelope — video is the one workload class in this system with fundamentally different scaling characteristics (bandwidth-bound, not row-bound), and coupling it to the primary database would be the single biggest scalability mistake available in this design, hence it's excluded by design.
- **Realtime connection concurrency at peak windows** (resolves a gap in the v0 draft): the system's stated real-time pillar (§0) produces a genuinely spiky load shape, not a flat one — the AM/PM pickup windows (roughly 15–30 minutes, twice a day) are when the large majority of `trip:{trip_id}:position` and `classroom:{id}:day_path` subscriptions are simultaneously open across every tenant at once, concentrated in two daily bursts rather than spread evenly. Mitigations, in order of when they're needed: (1) channel scoping to `trip_id`/`conversation_id` (§29) already keeps per-connection replication cost minimal; (2) monitor Supabase's per-project concurrent-Realtime-connection ceiling against measured peak-window concurrency once real tenant/usage numbers exist, as a standing item in §35 Phase 9; (3) if the ceiling becomes binding, the documented escalation path is client-side connection pooling per device (a parent only needs one open channel even if watching multiple simultaneous status updates) before considering a Realtime-tier upgrade or a self-hosted Realtime replica — a decision deferred to actual load data, not pre-built speculatively.
- **`pg_cron` job contention as tenant count grows**: the sub-2-minute global sweeps (camera heartbeat, service health check, §27) run as one scan across all tenants today, which is appropriate at current scale but revisited once tenant count is high enough that a single sweep's duration risks approaching its own interval — the documented mitigation is staggering (sharding the sweep by `tenant_id` hash across multiple staggered cron entries) rather than shortening the interval, since interval reduction directly increases the very Realtime/notification fan-out load the point above is managing.
- **GPS ping throughput, modeled roughly**: at a 5–10s cadence (§18) with client-side movement-threshold throttling, one active trip generates on the order of 1 ping every ~7s average, i.e. roughly 500 pings/hour per active bus-leg. At a scale of a few hundred tenants with a handful of buses each, concurrent AM/PM windows put sustained insert throughput in the low hundreds of rows/second — well within a single Postgres instance's write capacity, but the number that justifies revisiting the "deferred until volume warrants it" partitioning stance in the earlier bullet: partitioning becomes worth the operational overhead once this figure is closer to an order of magnitude higher than today's estimate, not before.

---

## 31. Deployment Architecture

- **Environments**: `local` (Supabase CLI, local Postgres) → `staging` (dedicated Supabase project, seeded with synthetic multi-tenant data) → `production` (dedicated Supabase project). Each environment is a **fully separate Supabase project**, not a schema-based split within one project — this keeps production Auth users, Storage buckets, and secrets fully isolated from staging/testing.
- **Migrations**: Supabase CLI migration files are the single source of truth for schema; applied via CI on merge to the environment's tracking branch (`staging` branch → staging project, `main` → production project), never applied by hand against a live environment.
- **Edge Functions deployment**: versioned alongside migrations in the same repo/CI pipeline, deployed via `supabase functions deploy` in the same CI step as migrations, so schema and function code that depend on each other ship atomically.
- **Secrets**: managed via Supabase project secrets per environment (never committed), injected into Edge Function runtime.
- **Media relay & external services** (camera relay, payment gateway, WhatsApp/SMS provider): deployed/configured independently of Supabase, with staging using sandboxed/test-mode credentials for each provider — these are explicitly **not** part of the Supabase deployment pipeline and need their own (lighter) deployment notes at implementation time.
- **Rollback**: schema migrations follow expand/contract (additive-first) discipline specifically because RLS policies and application code deploy slightly asynchronously in practice — a migration that drops/renames a column a still-deployed Edge Function reads is the single most common cause of a bad deploy in an RLS-heavy system, so destructive migrations always ship in a follow-up release after the reading code no longer depends on the old shape.
- **Backup & disaster recovery** (new — resolves a gap in the v0 draft, which had no DR posture at all): production runs on a Supabase tier with **point-in-time recovery (PITR)** enabled, target **RPO ≤ 5 minutes** (PITR's continuous WAL archiving) and **RTO ≤ 4 hours** for a full-project restore — both figures to be validated, not assumed, via a scheduled restore-drill (quarterly, tracked in `ops/runbooks/`). Daily logical backups are retained for 35 days as a secondary recovery path independent of PITR (protects against a PITR-affecting infrastructure issue, not just user error). Storage buckets are covered by Supabase's own object redundancy; the media relay and payment/WhatsApp provider integrations are explicitly **out of this DR scope** (they are stateless integrations against Masar's own DB, not systems Masar backs up).
- **Region selection**: the Supabase project region is chosen for lowest latency to the actual user base (Egypt-based parents/staff/drivers), which matters concretely for this system's most latency-sensitive workloads — GPS ping round-trips (§18), camera stream-token issuance (§17), and chat message delivery (§15) — not just as a generic best practice; the specific region is a deployment-time decision made against Supabase's then-current region list, re-evaluated if Supabase adds a closer region later.
- **Wildcard subdomain + TLS**: `*.masar.app` is provisioned as a single wildcard DNS record + wildcard TLS certificate at the hosting/CDN layer (not per-tenant certificate issuance), so a new tenant's `slug.masar.app` (§9) is immediately routable and served over TLS the moment `provision_tenant` commits — no per-tenant DNS/cert provisioning step is part of the provisioning workflow (§10.3, §3.1.1) because none is needed under the wildcard approach.
- **CORS / allowed origins**: PostgREST and every Edge Function restrict `Access-Control-Allow-Origin` to the known set of client origins (the five mobile app bundle contexts, plus the Dashboard/Platform Admin web origins per environment) rather than a wildcard — configured per-environment (§34) so staging and production never share an allowed-origin list.
- **External vendor failover**: the media relay, payment gateway, and WhatsApp/SMS provider (§31 dependencies, §17/§20/§10.4) are each single-vendor integrations in v1 — this is an accepted v1 tradeoff, not an oversight, but it means an outage in the WhatsApp/SMS provider specifically **blocks password-reset OTP platform-wide** (§10.4) since that flow has no fallback channel. The documented mitigation is a secondary SMS-only provider configured as a manual failover switch (not automatic multi-provider routing, which is unwarranted complexity at v1 scale) that Platform Admin can flip via an environment-level config change if the primary provider has an extended outage — tracked as an operational runbook (`ops/runbooks/`), not built as automatic failover logic.
- **Observability**: beyond `service_health_status`'s coarse uptime/latency signal (§3.53, §27), every Edge Function emits structured (JSON) logs to Supabase's log drains, and errors are additionally forwarded to a dedicated error-tracking service (e.g., Sentry or equivalent) with tenant/request-id context attached — this is what an on-call engineer actually investigates an incident with; `service_health_status` tells Platform Admin *that* something is wrong, structured logs + error tracking tell an engineer *why*. Log retention follows the hosting log-drain's default (typically 7–30 days) for application logs, separate from and much shorter than the `audit_log`'s indefinite retention (§23), since these serve different purposes (debugging vs. compliance).

---

## 32. Folder Structure

Backend-relevant repository layout (frontend folders already exist and are out of scope):

```
supabase/
  migrations/                  # timestamped SQL migration files (schema, RLS, indexes)
  seed.sql                     # local/staging synthetic seed data
  functions/
    provision-tenant/
    enroll-child/
    add-staff/
    add-bus/
    suspend-staff-account/
    revoke-sessions/
    regenerate-activation-link/
    issue-service-account-key/
    revoke-service-account-key/
    camera-heartbeat/           # service-account (API key) auth, not human JWT — §10.7
    ai-polish-note/
    ai-draft-report/
    payment-webhook/
    initiate-payment/
    notification-dispatch/
    camera-stream-token/
    generate-invoice-pdf/
    resend-invoice/
    _shared/                   # shared auth/tenant-context helpers, provider clients (LLM, payment, WhatsApp), idempotency-key helper
  config.toml

backend-docs/
  BACKEND_ARCHITECTURE.md      # this document
  BACKEND_ARCHITECTURE_REVIEW.md  # review history, kept for traceability of resolved findings
  permission-matrix.md         # generated/kept in sync with §12
  event-matrix.md              # generated/kept in sync with §15-16

ops/
  cron/                        # pg_cron schedule definitions (or migration files that register them)
  runbooks/                    # failed-job triage, tenant suspension procedure, payment reconciliation procedure,
                                # DR restore drill, vendor-failover switch (WhatsApp/SMS provider), region migration
```

Rationale: Edge Functions are grouped **one folder per capability**, matching the RPC/Edge Function catalog in §14.2 1:1, so any engineer can find the implementation of a named contract without cross-referencing a routing table.

---

## 33. Backend Module Breakdown

| Module | Owns | Depends on |
|---|---|---|
| **Tenancy & Provisioning** | tenants, plan_catalog, plan_catalog_apps, tenant_provisioning_state, tenant_phone_registry, provisioning RPCs/functions | Identity module (creates initial manager account) |
| **Identity & Auth** | staff/guardian/driver/platform_admin profiles, staff_subjects/staff_leave_records/staff_feedback, service_accounts (machine identities, §10.7), RLS helper functions, RBAC | Supabase Auth |
| **Academic** | classrooms, children, day_path_events, attendance, evaluations, lessons, concerns | Identity, Tenancy |
| **Reports (AI)** | ai_report_batches/drafts, ai_usage_counters, AI Edge Functions, scheduled-dispatch job | Academic (data source), Communication (delivery), external LLM provider |
| **Approvals & Events** | requests, events, rsvps, trip registrations | Academic, Identity |
| **Transport** | buses, bus_riders, trips, trip_stops, trip_stop_riders, trip_child_status, gps_pings | Identity (drivers), Academic (children) |
| **Safety** | pickup_passes, pickup_scan_events | Academic, Identity |
| **Media** | cameras (incl. `online`/`admin_disabled` split), camera_classroom_links, storage_objects, stream tokens | Academic (classroom linkage), Identity (service_accounts for heartbeat), external media relay |
| **Billing & Payments** | fee_items, ledgers, installment tables (unified `status` enum), invoices, payment_transactions, tenant_billing_transactions | Academic (children), Tenancy (tenant billing), external PSP |
| **Communication** | conversations, messages, announcements, notifications, notification_deliveries, device_tokens, notification_preferences, dispatch job | all modules (every module triggers notifications) |
| **Platform Operations** | activity_log, audit_log, support_tickets, service_health_status | all modules (cross-cutting observability) |
| **Jobs & Scheduling** | background_job_queue, scheduled_job_runs, idempotency_keys, pg_cron registrations | all modules (executes work on their behalf; idempotency_keys backs every mutating RPC, §25.6) |

This breakdown maps directly onto the Postgres schema grouping in §2.1 — each module owns exactly one (or occasionally two closely related) schema(s), which is what keeps RLS policy files, migration files, and Edge Function folders all organizable along the same seams.

---

## 34. Supabase Project Structure

- **One Supabase project per environment** (§31): `masar-staging`, `masar-production` (plus ad-hoc local via CLI). Production's region is selected for lowest latency to Egypt-based users (§31) — the specific region is a deployment-time decision against Supabase's current region list.
- **Auth configuration**: phone provider enabled (with WhatsApp/SMS OTP routed through the shared notification provider, §10.4), email provider enabled for `platform_admin` only (restricted via a signup-disabled + admin-invite-only configuration — platform admins are never self-registered), MFA enforced for the `platform_admin` role via a database-checked policy at first login if not yet enrolled. Auth rate-limiting is enabled and tuned per environment (§28) — staging uses relaxed limits for test automation, production uses the full brute-force protection posture.
- **Database**: single Postgres instance, schemas per §2.1, `pg_cron` and `pg_net` extensions enabled for scheduled/webhook jobs, `pgcrypto`/uuid generation extension enabled, **point-in-time recovery enabled on production** (§31).
- **Storage**: buckets per §21, each with bucket-level RLS-style policies mirroring the tenant-prefix path convention.
- **Realtime**: enabled per-table for the specific tables listed in §15 only (not blanket-enabled on every table, to keep replication overhead scoped to actual need); concurrent-connection usage is monitored against Supabase's project ceiling starting in Phase 9 (§30, §35).
- **Edge Functions**: one function per capability per §14.2/§32, environment-specific secrets configured per function as needed (not all functions need all secrets — e.g., only `payment-webhook`/`initiate-payment` need PSP credentials; `camera-heartbeat` needs no LLM/PSP secrets but does need the `service_accounts` API-key-verification path, §10.7). CORS allowed-origins configured per environment (§31), never wildcarded in production.
- **DNS/TLS**: wildcard `*.masar.app` DNS + wildcard TLS certificate at the hosting/CDN layer (§31) — no per-tenant provisioning step.
- **API exposure**: PostgREST auto-API is enabled on client-facing schemas (`academic`, `approvals`, `transport`, `safety`, `billing`, `comms`, `media` — read/write per RLS) and **disabled/excluded** on `platform`, `jobs`, and the machine-identity-relevant parts of `identity` (`service_accounts`) from the public API surface entirely (`db.schema` config), reachable only via `service_role`-executed Edge Functions/RPCs — an extra belt-and-suspenders layer beyond RLS for the most sensitive schemas.

---

## 35. Complete Implementation Roadmap

Sequenced so each phase is independently deployable and testable, and later phases never require reworking earlier ones (additive dependency order).

**Phase 0 — Foundation**
Provision Supabase projects (staging/production), including region selection and PITR enablement (§31, §34). Implement schemas, tables, constraints, indexes for `tenancy` + `identity` (§3.1-3.9.1), **including `tenant_provisioning_state`, `tenant_phone_registry`, `plan_catalog_apps`, and `service_accounts` from the outset** — these are foundational, not additive. Implement RLS helper functions and the uniform baseline policy (§13.1-13.3, now applied with zero exceptions per the corrected `tenant_id` convention, §2.2) and the Platform Admin sub-role split (§12.1). Implement Auth configuration (§34), session revocation (§10.6), the no-plaintext-credential provisioning flow (§10.3), and the tenant/staff/guardian/driver provisioning Edge Functions. Stand up CI/migration pipeline, CORS config, wildcard DNS/TLS (§31). `audit_log` writes begin here (viewing UI lands in Phase 8). The legal/vendor data-residency review (§28) is a Phase 0 sign-off gate, not a later add-on.

**Phase 1 — Core Academic Data**
`academic` schema: classrooms, children (incl. `preferred_language` on all profile tables), day_path_events, child_guardian_links (with `tenant_id`, indexed on `guardian_id`), attendance_records, subjects, lessons, evaluations, concerns, staff_subjects/staff_leave_records/staff_feedback. RLS for all academic tables including the new permission-matrix rows (§12, §13). This phase alone unblocks Dashboard's Children/Classrooms/Teachers screens and read-only Parent App academic views against real data.

**Phase 2 — Transport & Safety**
`transport` + `safety` schemas: buses, bus_riders (with the one-active-rider-per-child partial unique index, §5), trips, trip_stops, **trip_stop_riders**, trip_child_status, gps_pings, pickup_passes, pickup_scan_events. The `assign_bus_rider`/`unassign_bus_rider` capacity-locked RPCs (§14.2) and `withdraw_child`/`suspend_child` orchestration RPCs ship here, since they depend on this schema. Realtime channels for trip position/status (§15). Driver App and Reception App become fully backed, including Reception's `update_child_trip_status` write path now reflected correctly in the permission matrix (§12).

**Phase 3 — Communication & Notifications**
`comms` schema in full: conversations, messages, announcements, notifications, notification_deliveries, **device_tokens, notification_preferences**. Notification dispatch background job (§26) wired to at least one real push provider + WhatsApp/SMS provider, **including the preference-check step and device-token resolution from day one** — these are not deferred additions, since §16's matrix assumes them. This phase is a dependency for every other phase's "notify on X" requirements, so it lands early relative to billing/reports even though those are listed after it here.

**Phase 4 — Approvals & Events**
`approvals` schema: requests, events, rsvps, trip registrations (with the paid-status/payment-FK consistency trigger, §3.24). `update_rsvp`/`cancel_trip_registration` RPCs. Teacher App request submission, Dashboard approvals (including the "new request submitted → notify Manager" scenario, §16), Parent App events become fully backed.

**Phase 5 — Billing & Payments**
`billing` schema in full, with `installment_schedule_entries.status` and `billing_ledger_items.status` sharing the same stored enum from the start (§3.40). Payment gateway integration for at least one instant method + manual verification flow for bank transfer/Fawry (§20), **plus the recurring billing-ledger-generation scheduled job, payment reminder cadence, and stale-`pending_verification` escalation job (§27) — these ship in this phase, not deferred to Phase 9**, since recurring fees don't actually bill without the first one. `mark_installment_paid_manual`, `resend_invoice` RPCs. Invoice PDF generation job. This is sequenced after Communication (Phase 3) because every billing state change fires a notification.

**Phase 6 — Media (Cameras)**
`media` schema + camera relay integration + stream token Edge Function (§17), **`service_accounts`-based heartbeat auth (§10.7) and the independent `online`/`admin_disabled` fields**. Explicitly sequenced late since it depends on external media infrastructure being ready and is lower-risk to delay than payments/safety.

**Phase 7 — AI Reports**
`reports` schema including `ai_usage_counters` (§3.20.1) + LLM Edge Functions with fallback templates (§19), **plus the AI-report scheduled-dispatch job (§27) so `status='scheduled'` drafts are ever actually acted on**. Sequenced after Academic (Phase 1, its data source) and Communication (Phase 3, its delivery mechanism).

**Phase 8 — Platform Operations**
`platform` schema in full: activity_log, audit_log, support_tickets, service_health_status, **tenant_billing_transactions**. Platform Admin's Overview/Support/System-health/Audit screens go live, including the `owner`/`admin`/`support` tier distinction (§12.1) enforced from first login, not retrofitted.

**Phase 9 — Jobs, Performance & Hardening**
All remaining scheduled jobs (§27, including the failed-login/session-anomaly sweep), materialized views (§29), retention/purge jobs (incl. `idempotency_keys` purge), rate limiting (§28, incl. primary-login rate limiting), partitioning readiness review using the GPS-throughput estimate in §30, read-replica evaluation, Realtime concurrent-connection monitoring against measured peak-window usage (§30), and the first scheduled DR restore-drill (§31). Load/security testing pass across the full permission matrix (§12) — including the Platform Admin sub-role split and the corrected Reception write permission — before general availability.

**Cross-cutting, continuous from Phase 0**: RLS policy tests (one automated test per row of the permission matrix in §12, including §12.1, is the target coverage bar), audit logging, error-code contract discipline (§25) including the general idempotency-key convention (§25.6), and capacity-locking correctness tests (concurrent-request simulations against `assign_bus_rider`/trip registration/classroom capacity) from the phase each capacity-checked RPC ships in, not deferred to Phase 9.
