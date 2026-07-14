# Architecture Review Report — BACKEND_ARCHITECTURE.md

**Reviewer role:** Principal Backend Architect (independent critical review)
**Subject:** `design_handoff_masar_platform/BACKEND_ARCHITECTURE.md`
**Nature of this document:** Findings only. No rewrite, no implementation. Section numbers below (`§N`) refer to the reviewed document unless stated otherwise.

---

## Top-line assessment

The document is structurally sound and unusually disciplined for a first pass — the tenant-isolation model, soft-delete strategy, and money-handling rules are production-credible. The most serious issue is **not a missing section but an internal contradiction**: the document states a hard design rule in §2.2 ("every tenant-scoped table carries `tenant_id` directly... this is what makes RLS policies a single equality check") and then violates that rule in at least six of its own table definitions in §3. That single inconsistency, if carried into implementation, silently breaks the RLS performance model the rest of the document depends on. Beyond that, the review found a consistent pattern: **anything requiring a "device," "background service," or "user preference" as a first-class actor is under-specified** — push notification delivery has no device-token table, notification opt-outs described in the frontend have no backing table, and machine-to-machine callers (camera agents) have no authentication model at all. These are flagged in detail below.

---

## 1. Contradictions Between Sections

These are internal inconsistencies — places where two parts of the document disagree with each other, not just gaps.

### 1.1 `tenant_id` denormalization rule is violated by ~6 of the document's own tables (Critical)
§2.2 states as a hard convention: *"Every tenant-scoped table carries `tenant_id` directly... this is what makes RLS policies a single equality check instead of a subquery."* §13.1 then states the *"baseline policy shape used everywhere"* is `USING (tenant_id = current_tenant_id())`.

But the following tables defined in §3 have **no `tenant_id` column**:
- `academic.child_guardian_links` (§3.13)
- `identity.staff_subjects` (§3.4)
- `billing.fee_item_applicability` (§3.37)
- `billing.invoice_lines` (§3.42)
- `billing.installment_schedule_entries` (§3.40)
- `media.camera_classroom_links` (§3.34)

For these tables, the "baseline policy shape" in §13.1 is literally inapplicable — RLS on them must fall back to a join/subquery through their parent table, which is exactly the anti-pattern §2.2 says the whole schema is designed to avoid. This is the single highest-priority fix candidate in the document, because it undermines the stated rationale for §6 (Indexing) and §29 (Performance) simultaneously.

### 1.2 Tables referenced in prose but never defined in §3
Three tables are used elsewhere in the document as if they exist, but have no entry in §3 (Table Definitions) and, in most cases, aren't even in the §2.1 schema-content listing:
- `identity.tenant_phone_registry` — introduced in §5 ("Uniqueness") to enforce cross-table phone uniqueness, never appears in §2.1's `identity` schema listing or in §3.
- `platform.tenant_billing_transactions` — used in §20 (Payment Architecture) and again in §27 (Scheduled Jobs, "Tenant billing check") as the source of tenant-vs-Masar billing state, but has no §3 definition and is absent from §2.1's `platform` schema content list.
- `tenancy.tenant_provisioning_state` — listed in §2.1's schema content table but never defined anywhere in §3, and never referenced again in the rest of the document. Dead reference in the opposite direction (declared, never used or specified).

### 1.3 `identity.roles` / `identity.permissions` — schema listing contradicts the RBAC section's own model
§2.1 lists `roles, permissions` as contents of the `identity` schema (implying they are tables). §11.1 then states roles are *"a fixed set, not user-defined"* (i.e., an enum, not a table), and §11.3 states the `permissions` table, if it exists at all, is *"documentation-as-data... not evaluated at runtime"* — but it's still never defined in §3, and its relationship to the fixed-enum role model in §11.1 is never reconciled. As written, a reader can't tell whether `roles`/`permissions` are real tables to be migrated or not.

### 1.4 Camera `online` field: manual override vs. automatic heartbeat — no reconciliation rule
The frontend inventory (Dashboard → Cameras) includes an explicit **manual** "toggle camera online status" action. §17 separately defines an **automatic** heartbeat sweep that flips `online=false` on missed heartbeats (§27). The document never states which wins, or how a manager's manual override survives (or doesn't survive) the next heartbeat sweep cycle. As written, a manager manually marking a camera "online" for troubleshooting purposes would be silently reverted by the next cron tick if the on-prem agent isn't actually sending heartbeats — likely not the intended behavior, and not addressed as a state-machine question anywhere.

### 1.5 `overdue` computed inconsistently across two sibling billing tables
§3.38 `billing_ledger_items.status` includes `overdue` as a **stored enum value**. §3.40 `installment_schedule_entries.overdue` is explicitly **"computed at read time, not stored"**. Both tables represent the same underlying business concept (a due amount past its due date) for the same billing domain, yet one persists the fact and the other derives it live. This is inconsistent with no stated rationale for the difference, and it also means §6's indexing strategy (which has no "overdue" partial index for either table) can't be applied uniformly — a query for "all overdue installments" can't be indexed at all under the current design, while the equivalent query against `billing_ledger_items` can.

### 1.6 Reception's "confirm" action isn't reflected in the Permission Matrix
§14.2 lists `update_child_trip_status(...)` as callable by **driver/reception**, i.e., Reception has a write path onto `trip_child_status`. §12's Permission Matrix, however, lists Reception's "Buses/Trips" row as `R (today's trip, confirm)` — "confirm" is described in prose but the matrix's own C/R/U/D/A legend never assigns Reception a `U` or `C` on this resource. The matrix and the API catalog disagree on whether Reception has a write permission here.

### 1.7 Incorrect cross-reference in the Indexing section
§6's `tenant_id` index row cites *"RLS filter (mandatory baseline, see §14)"*. §14 is **API Contracts**, not RLS — the correct reference is §13 (Row Level Security Design). Minor on its own, but worth fixing since it's exactly the kind of cross-reference an implementing engineer would follow and land in the wrong section.

### 1.8 `jobs.background_job_queue` vs `jobs.background_job_queue_meta`
§2.1 names the table `background_job_queue_meta`; §26 refers to the same concept as `jobs.background_job_queue`. Not fatal, but it's the kind of naming drift that produces a wrong migration if two engineers implement from different sections.

### 1.9 Notification Matrix assumes unconditional delivery; frontend (and nowhere else in the doc) models opt-out
§16's Notification Matrix is written as if every listed event unconditionally produces a notification to every listed recipient. But the frontend inventory this document was built from explicitly shows **per-category notification toggles** in Settings on the Driver, Teacher, and Parent apps ("trip reminders, student changes, route updates, announcements"). Nothing in §3 (no `notification_preferences` table), §16, or §26 (dispatch job) accounts for checking a recipient's opt-out state before dispatch — the dispatch job as specified would ignore user preferences entirely. See also §2 below.

---

## 2. Missing Entities / Tables

- **Notification preferences** — no table backs the per-category push/WhatsApp/SMS toggles shown in every mobile app's Settings screen (§16 contradiction above). Needed: something like `comms.notification_preferences(recipient_type, recipient_id, category, channel, enabled)`.
- **Device / push tokens** — there is no table anywhere for registering a device's FCM/APNs push token against an account. §26's "Notification dispatch" job is specified as calling "push... provider APIs" with no data source for *which device token to push to*. This is a hard blocker for the push channel, not a nice-to-have.
- **User locale/language preference** — every entity in the system is bilingual (`_en`/`_ar` fields throughout), yet no profile table (`staff_profiles`, `guardian_profiles`, `driver_profiles`) has a `preferred_language` field, and the notification dispatch job has no documented way to know which language to render a push/WhatsApp message in.
- **Trip stop ↔ child linkage** — `transport.trip_stops` (§3.28) has `sequence, lat, lng, label, reached_at` but no relationship to which child(ren) that stop serves. The frontend explicitly shows an "ordered stop list" tied to specific children's addresses; as modeled, a driver's manifest can't be reconstructed from `trip_stops` alone — the document silently relies on `bus_riders.pickup_address_override`/`children.address_lat/lng` doing double duty, which isn't stated anywhere.
- **Machine/service identities** — the RBAC model (§11) only enumerates human-facing roles (`guardian, teacher, reception, manager, driver, platform_admin`). The camera on-prem agent calling `camera_heartbeat()` (§17) and any future automated integration have no defined identity/auth mechanism — they can't authenticate as any of the six roles, and no service-account/API-key pattern is described.
- **`plan_catalog_apps` join table** — §3.2's own callout recommends this table over an array column ("Use a join table `plan_catalog_apps`... in production") but it's never promoted to a formal §3.x definition, and it doesn't appear in §2.1's schema listing either. The recommendation is made and then dropped.
- **AI usage counters** — §19 mentions "a dedicated `ai_usage_counters` table" as one option for rate-capping AI calls but leaves it as an alternative rather than committing, so it's absent from §2.1/§3.

## 3. Missing Relationships

- Trip stops to children (above).
- No FK/relationship from `staff_leave_records.covering_staff_id` back to a notification — nothing connects "leave scheduled with covering teacher" to the covering teacher actually being informed (see §7, missing notification scenarios).
- `platform_admins.role` (owner/admin/support, §3.9) has no corresponding relationship to the Permission Matrix (§12), which treats all Platform Admin sub-roles as one column — the schema implies three tiers of platform staff but the permission model doesn't differentiate them (e.g., should `support` really have the same tenant-suspend authority as `owner`?).
- `event_trip_registrations.payment_transaction_id` (§3.24) is nullable FK to `payment_transactions`, but there's no reverse constraint ensuring a `registered`/`paid` status is only reachable when that FK is actually set — a state/data consistency gap between the enum and the FK.

## 4. Missing APIs / Edge Functions / RPCs

Relative to the frontend inventory this document was built from, the API catalog in §14.2 is missing several contracts implied by documented UI actions:

- **`withdraw_child` / `suspend_child` / `reactivate_child`** — Dashboard's "suspend/reactivate/remove child" actions have cascading effects per §8 (soft-deleting `pickup_passes`/`bus_riders`) that should not be a bare `UPDATE` through PostgREST; they need an orchestrating RPC, but none is listed.
- **`assign_bus_rider` / `unassign_bus_rider`** — the document defines a `VALIDATION_CAPACITY_EXCEEDED` error code (§25.1) implying a dedicated capacity-checked RPC exists, but §14.2 never names it.
- **Credential regeneration / forced logout** — no RPC exists for "regenerate a staff/driver's password" (a routine admin action) or, more importantly, for revoking a suspended account's active sessions/refresh tokens. §8 soft-deletes the profile row but never states that a suspended/removed staff member's live Supabase session is invalidated — this is a live security gap, not just a documentation gap (see §9 below).
- **Resend/export actions** — "resend invoice," "resend/delete AI report batch," "export report as PDF/share link" are explicit Dashboard features in the frontend inventory but have no corresponding entries in §14.2.
- **Manual/cash payment marking** distinct from gateway/manual-verification flows — Dashboard's "mark installment paid" as a direct staff action (e.g., cash received in person) is not clearly mapped onto `verify_payment` or given its own contract.
- **Event/RSVP update or cancellation** — `create`/read paths exist for RSVPs and trip registrations; there's no documented way to change or cancel one.

## 5. Missing Permissions (Permission Matrix gaps)

- No row for `staff_leave_records`, `staff_feedback` (complaints/commends), or `staff_subjects` — who can create/read a complaint against a teacher, and can the teacher see it, is left unanswered despite the entity existing in §3.
- No row for `day_path_events` (the raw history table) — only the denormalized "current status" is covered implicitly under "Own tenant's children."
- No row for `trip_stops` specifically (bundled loosely under "Buses/Trips").
- Platform Admin's three sub-roles (`owner/admin/support` per §3.9) collapse to one matrix column, so nothing prevents (on paper) a `support` platform admin from having the same tenant-suspend/reactivate authority as `owner` — likely unintended given the stated least-privilege philosophy in §28.

## 6. Missing RLS Policies

- The six `tenant_id`-less join/detail tables in §1.1 above (`child_guardian_links`, `staff_subjects`, `fee_item_applicability`, `invoice_lines`, `installment_schedule_entries`, `camera_classroom_links`) need their RLS policies specified as the join-through-parent exception to the stated baseline — currently the document implies (via §13.1) that they'd get the same baseline policy, which won't compile/work as described.
- No policy is specified for the `pending` vs. `confirmed` state of `storage_objects` (§22.1) — should a `pending` upload row be readable by anyone before `finalize_upload` runs? Left unstated; a plausible gap where an attacker could read another user's in-flight (pre-validated) upload metadata if not explicitly denied.
- No RLS statement for who can read `service_health_status` at the row level beyond "Platform Admin: R" in the matrix — is this table locked to `platform_admin` only, or could tenant `manager`s eventually see a scoped subset (e.g., "is the camera relay up right now")? Given cameras/GPS live-status matter to managers too, this boundary is asserted but not really justified.

## 7. Missing Notification Scenarios

Relative to the frontend inventory:
- **New request submitted → notify Manager** (only "request approved/rejected → notify teacher" is in the matrix; the initial submission has a Realtime channel in §15 but no corresponding notification row in §16 — inconsistent with how every other "X happened" event in the matrix gets both).
- **Covering teacher notified when assigned to another teacher's leave** (`staff_leave_records.covering_staff_id`) — no row.
- **Bus rider assignment/removal → notify guardian** ("your child has been added to/removed from Bus 4's route") — absent.
- **Payment reminder cadence** — the matrix has a single "payment due/overdue" row; the frontend shows a manager-triggered bulk "remind all unpaid" action, but there's no automatic recurring reminder cadence (e.g., T-3/T0/T+3 days) defined as a scheduled behavior, only a manual trigger.
- **Stale/failed background job → notify Platform Admin or Manager** — §26 says failed jobs are "surfaced in a... view," but doesn't add a corresponding notification row for critical failures (e.g., a failed payment webhook or failed notification dispatch), which arguably deserves an alert, not just a passive dashboard.

## 8. Missing Background Jobs

- **Recurring billing ledger generation** — nothing in §26/§27 creates new `billing_ledger_items` rows when a `monthly`/`per_term` `fee_item`'s cycle rolls over. §27's "Billing status roll-up" job only *recomputes status from existing ledger items* — it presumes the ledger rows already exist, but no job is specified that actually creates them period-over-period. This is a significant functional gap: without it, recurring fees never generate new amounts owed.
- **AI report scheduled dispatch** — `ai_report_drafts.status` includes `scheduled` with a `scheduled_for` timestamp (§3.20), but no scheduled job in §27 sweeps for drafts whose `scheduled_for` has passed and transitions them to `sent` (with actual delivery). As written, "schedule for later" is a dead-end status with no job to act on it.
- **Stale `pending_verification` payment escalation** — no job flags/escalates manual payments (bank transfer, Fawry) that have sat in `pending_verification` beyond a reasonable window, which is a real operational risk for a manual-reconciliation-heavy payment model.
- **Login/session anomaly monitoring** — no scheduled review of failed-login patterns feeding into the audit log, despite §28 elsewhere emphasizing defense-in-depth.

## 9. Missing Security Risks (not addressed anywhere in the document)

- **No session revocation on suspension/termination.** §8 soft-deletes `staff_profiles`/`guardian_profiles`/`driver_profiles` via `deleted_at`, and RLS would then deny new reads — but a currently-valid JWT access token (up to ~1h per §10.5) issued *before* suspension remains valid until it expires naturally, since nothing in §10 or §25 states that suspension actively revokes refresh tokens / forces re-authentication. For a terminated staff member or a suspended driver, this is a real window of continued access.
- **Plaintext temporary credential handoff.** §10.3 states account provisioning "returns credentials for the manager to share" — this is consistent with the frontend's WhatsApp-share pattern, but at the backend-architecture level, generating and returning a plaintext temporary password through an API response (rather than a self-service invite/set-password link sent directly to the new user) is a real credential-exposure risk worth explicitly flagging, even if it matches the current frontend design.
- **No brute-force protection on primary login**, only on secondary flows (`scan_pickup_pass`, OTP, `ai_polish_note` per §28). Phone+password login — the primary auth path for five of six roles — has no stated rate-limiting/lockout policy.
- **No mention of backup/disaster recovery.** No RPO/RTO targets, no PITR (point-in-time recovery) policy, no backup retention — absent from §31 (Deployment) entirely. For a system holding health data (allergies, blood type) and financial records, this is a notable omission for a "production-grade" spec.
- **No data-residency/compliance framing.** Given Egypt-specific operation (EGP currency, `.masar.app`) and the sensitivity of the data handled (children's health notes, national ID numbers, guardians' financial data), there's no mention of applicable data-protection obligations (e.g., Egypt's Personal Data Protection Law) or where Supabase's underlying infrastructure region is expected to sit. This affects vendor selection for the payment gateway and media relay too, not just Supabase project region.
- **No observability/logging strategy beyond `service_health_status`.** That table is a coarse uptime/latency signal; nothing describes structured application logging, error tracking, or Edge Function log retention — "production-grade" typically requires this to debug incidents, and §31/§28 are silent on it.
- **Race conditions on capacity-constrained writes.** Bus seat capacity, classroom capacity, and event capacity are all enforced only as an application-layer check (implied by `VALIDATION_CAPACITY_EXCEEDED`) with no stated locking strategy (`SELECT ... FOR UPDATE`, a DB-level check via trigger, or a covering unique constraint). Two concurrent "assign rider" calls near the capacity boundary could both pass the check and overbook — not called out anywhere as a concurrency risk.
- **No general RPC idempotency mechanism.** §20 specifically solves idempotency for payments (`provider_reference` uniqueness), but nothing generalizes this to other write-heavy RPCs (`mark_attendance`, `send_message`, `submit_evaluation`) — a double-tap or client retry on a flaky mobile connection could produce duplicate rows in tables with no compensating unique constraint.

## 10. Missing Scalability Considerations

- **Realtime connection concurrency at peak windows.** §0 names real-time propagation as one of five architectural pillars, and §15 lists ten realtime channel types, but nothing in §30 (Scalability Strategy) discusses Supabase Realtime's per-project concurrent-connection ceiling against this system's actual peak load shape — potentially hundreds of parents simultaneously watching live bus GPS during the ~15–30 minute AM/PM pickup windows across all tenants at once. This is exactly the kind of "obvious in hindsight, invisible until launch day" scaling cliff a Principal review should catch.
- **No discussion of `pg_cron`/scheduled-job contention** as tenant count grows — jobs like "Camera heartbeat sweep" (every 1–2 min) and "Service health check" (every 1 min) are fine at today's scale but §30 never revisits whether per-tenant-scoped variants of these jobs would be needed at higher tenant counts (a single global sweep across thousands of cameras every 60–120s is a different performance profile than tens).
- **GPS ping write throughput isn't stress-tested against the stated cadence.** §18 sets a 5–10s ping cadence per active trip; at scale (many tenants, many buses, two daily legs), this is a meaningfully high sustained insert rate into `gps_pings`, but §30 doesn't connect this workload back to the partitioning discussion — it's mentioned as a partitioning *candidate* but not modeled with even rough numbers to justify "deferred until volume warrants it."

## 11. Missing Deployment Considerations

- **Backup/DR strategy** — as noted under Security Risks, this is arguably a deployment-architecture gap as much as a security one; §31 has no subsection on it at all.
- **Wildcard subdomain + SSL provisioning** — §9 and §34 both describe `slug.masar.app` routing as a given, but §31 (Deployment Architecture) never states how new tenant subdomains get DNS + TLS certificates provisioned at tenant-creation time (wildcard cert vs. per-tenant issuance is a real decision with operational consequences, left unaddressed).
- **CORS/allowed-origins configuration** — with five distinct client apps plus a web Dashboard/Platform Admin, §31/§34 never states the CORS policy for PostgREST/Edge Functions (e.g., locking allowed origins to the known app bundle IDs/domains).
- **Region selection** — no mention of which Supabase project region será chosen relative to the user base's actual location (Egypt), which affects latency for GPS/chat/camera-token round-trips specifically — the workloads this document itself identifies as most latency-sensitive.
- **External vendor failover** — §31 states the media relay, payment gateway, and WhatsApp/SMS provider are deployed independently of Supabase, but never discusses what happens operationally if one of these single-vendor dependencies goes down (no failover/backup-provider strategy for, e.g., the WhatsApp/SMS provider that OTP delivery itself depends on per §10.4 — an outage here would block password resets platform-wide).

---

## Summary Table (severity-ranked)

| # | Finding | Severity |
|---|---|---|
| 1 | §2.2 `tenant_id`-on-every-row rule violated by 6 tables in §3 | Critical — undermines RLS/performance model as documented |
| 2 | No session/token revocation on staff/driver suspension | Critical — live security gap |
| 3 | No recurring billing-ledger-generation job | Critical — recurring fees never get billed as designed |
| 4 | No device-token table / push-token model | Critical — blocks the push notification channel entirely |
| 5 | No notification-preferences table despite frontend opt-out UI | High |
| 6 | Three tables referenced in prose, never defined (`tenant_phone_registry`, `tenant_billing_transactions`, `tenant_provisioning_state`) | High |
| 7 | No AI-report scheduled-dispatch job for `status=scheduled` | High |
| 8 | No machine/service identity model (camera agents) | High |
| 9 | No backup/DR policy anywhere in the document | High |
| 10 | Camera manual-toggle vs. heartbeat-sweep conflict unresolved | Medium |
| 11 | No capacity-check locking strategy (race condition risk) | Medium |
| 12 | Realtime concurrency at peak load not modeled | Medium |
| 13 | Platform Admin sub-roles (owner/admin/support) not reflected in permission matrix | Medium |
| 14 | Trip stops not linked to children | Medium |
| 15 | `overdue` modeled inconsistently (stored vs. computed) across two billing tables | Low–Medium |
| 16 | Missing resend/regenerate/withdraw-style RPCs | Low–Medium |
| 17 | Wrong cross-reference (§6 → §14 instead of §13) | Low |
| 18 | Naming drift (`background_job_queue` vs. `_meta`) | Low |
