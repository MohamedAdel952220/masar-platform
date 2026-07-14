# Masar Backend Execution Plan v1.0

**Status:** Planning document. Derived from `BACKEND_ARCHITECTURE.md` (Architecture Frozen v1.0). No code, no SQL, no migrations, no API implementations are contained in this document — it is an engineering execution plan only.
**Audience:** Engineering leadership, backend team, QA, DevOps.
**Purpose:** Convert the frozen architecture into a sequenced set of independently deployable Epics that take the Masar backend from zero to production-hardened over roughly one year, without ever leaving the platform in a broken or partially-working state between releases.

---

## 0. How to read this plan

### 0.1 Epic philosophy
Each Epic below is a **vertical slice**, not a horizontal layer — it ships a working schema, its RLS policies, its RPCs/Edge Functions, its jobs, and enough frontend-facing capability to be genuinely usable, in the same release. No Epic ships "just the database" or "just the API" and waits for a later Epic to make it usable. This is what makes "independently deployable" true rather than aspirational: at the end of every Epic, a real user (parent, teacher, driver, manager, or platform admin) can do something new and complete in production.

### 0.2 Sequencing principle
Epics are ordered so that every dependency an Epic needs already shipped in an earlier Epic — never a forward reference. This mirrors, and is more granular than, the 10-phase roadmap in `BACKEND_ARCHITECTURE.md` §35: each roadmap Phase maps to exactly one Epic here (Phase 0 → Epic 1, Phase 1 → Epic 2, … Phase 9 → Epic 10), so architecture and execution planning stay traceable to each other by number offset alone.

### 0.3 Team assumption
Estimates assume a **small dedicated backend team**: 2 backend engineers + 1 QA engineer, with a DevOps/platform engineer available part-time (shared with frontend). Where an Epic can run in parallel with another without violating the dependency graph, this is called out explicitly — the calendar timeline is shorter than the sum of Epic durations because of this.

### 0.4 Epic sequencing & timeline summary

| # | Epic | Complexity | Dev Time | Test Time | Can Run Parallel With |
|---|---|---|---|---|---|
| 1 | Foundation & Platform Bootstrap | L | 3 weeks | 1.5 weeks | — (all others depend on this) |
| 2 | Core Academic Data | L | 3 weeks | 1.5 weeks | — |
| 3 | Transport & Safety | XL | 4 weeks | 2 weeks | — |
| 4 | Communication & Notification Backbone | L | 3 weeks | 1.5 weeks | — |
| 5 | Approvals & Events | M | 2 weeks | 1 week | Epic 6 |
| 6 | Billing & Payments | XL | 5 weeks | 2 weeks | Epic 5 |
| 7 | Media & Camera Architecture | M | 2 weeks | 1 week | Epic 8 |
| 8 | AI Report Architecture | M | 2 weeks | 1 week | Epic 7 |
| 9 | Platform Operations & Admin Console | M | 2.5 weeks | 1 week | — |
| 10 | Jobs, Performance & Production Hardening | L | 3 weeks | 2 weeks | — (closes the plan) |

**Sequential critical path:** 1 → 2 → 3 → 4 → (5 ∥ 6) → (7 ∥ 8) → 9 → 10.
**Calendar estimate:** ~30 weeks of critical-path work (~7 months) with the two parallel windows, plus buffer for staging bake time, stakeholder review, and the vendor/legal dependencies noted in Epic 1 and Epic 6 (payment gateway contracting, data-residency review) that are **not** engineering time but can gate a release if not started early — this plan assumes those are kicked off in parallel with Epic 1, not after it. Total elapsed calendar time including buffer, review cycles, and vendor lead time: **9–11 months**, comfortably inside a one-year budget with slack for the unplanned.

### 0.5 Dependency graph (text form)

```
Epic 1 (Foundation)
  └─▶ Epic 2 (Academic)
        └─▶ Epic 3 (Transport & Safety)
              └─▶ Epic 4 (Communication Backbone)
                    ├─▶ Epic 5 (Approvals & Events)
                    └─▶ Epic 6 (Billing & Payments)
                          └─▶ Epic 7 (Media/Camera)
                          └─▶ Epic 8 (AI Reports)
                                └─▶ Epic 9 (Platform Operations)
                                      └─▶ Epic 10 (Jobs/Performance/Hardening)
```
Epic 7 and Epic 8 both depend on Epic 4 (notifications) and Epic 2 (their data source) but not on each other or on Epic 6 — they are drawn converging into Epic 9 because Epic 9's Platform Admin console is more useful once every domain it observes exists, not because it has a hard technical dependency on 7/8 individually.

### 0.6 What "independently deployable" means here in practice
Every Epic ends with a tagged release to `staging`, a soak period, then a production deploy behind the existing CI/migration pipeline (§31 of the architecture doc) — never a long-lived feature branch merged all at once. Migrations are additive-first (expand/contract, per §31), so an Epic's schema changes are safe to deploy even if the Epic's frontend consumer isn't live yet, and safe to roll back without touching a later Epic's tables.

---

## Epic 1 — Foundation & Platform Bootstrap

### 1. Epic Overview
Stands up both Supabase environments, the `tenancy` and `identity` schemas, the uniform RLS baseline, Auth configuration, the no-plaintext-credential provisioning cascade, session revocation, and the CI/CD + DR posture everything else in the system builds on. This is infrastructure-shaped but ships one real end-user capability: Platform Admin can provision a new tenant and its first manager account, and that manager can log in.

### 2. Business Goal
Unblock every subsequent Epic and prove the multi-tenant isolation model end-to-end before any tenant data exists — the single highest-leverage place to catch an isolation bug is before there's real data to leak.

### 3. Features Included
- Platform Admin: create a new school (tenant), assign a plan, provision the initial manager account.
- Manager: first login, password/activation flow, session behaves correctly (issued, refreshed, revocable).
- Platform Admin: suspend/reactivate a tenant (data access, not billing consequence yet — billing lands in Epic 9).

### 4. Backend Modules
Tenancy & Provisioning; Identity & Auth (per `BACKEND_ARCHITECTURE.md` §33).

### 5. Database Tables Involved
`tenants`, `plan_catalog`, `plan_catalog_apps`, `tenant_provisioning_state`, `tenant_phone_registry`, `staff_profiles`, `guardian_profiles` (schema only — first row not until Epic 2), `driver_profiles` (schema only), `platform_admins`, `service_accounts` (schema only — first row not until Epic 7).

### 6. Supabase Features Involved
Auth (phone + email providers, MFA for platform admins), Postgres (schema/RLS baseline), Storage (bucket shells created, not yet populated), CLI-based migrations, Auth Admin API, PITR.

### 7. Edge Functions Required
`provision-tenant`, `suspend-staff-account`, `reactivate-staff-account`, `revoke-sessions`, `regenerate-activation-link`.

### 8. RPC Functions Required
Provisioning-adjacent Postgres helper RPCs used inside the above Edge Functions (tenant row creation, `tenant_provisioning_state` step advancement); the RLS helper functions (`current_tenant_id()`, `current_role()`, `current_platform_admin_tier()`, etc.) that every later Epic's RPCs will call.

### 9. Storage Buckets Involved
None populated yet; bucket shells for `profile-photos`, `identity-documents`, `generated-documents`, `public-branding` created with policies in place, ready for Epic 2+ to use.

### 10. Realtime Channels Involved
`platform:tenants` (tenant status changes visible to Platform Admin).

### 11. Background Jobs Involved
Provisioning cascade (Auth Admin API calls + activation-link dispatch — dispatch itself is stubbed/logged until Epic 4 ships the real notification pipeline; see Risk below).

### 12. Scheduled Jobs Involved
None yet (health-check and trial-expiry jobs land in Epic 9/10).

### 13. External Integrations Involved
None live yet. WhatsApp/SMS provider contracting and data-residency/legal review (§28 of the architecture doc) are **kicked off in parallel** with this Epic since they gate Epic 4 and Epic 6 later.

### 14. Required Permissions
`platform_admin` (`owner`/`admin` tier) can provision tenants; `manager` can log in and view/edit own tenant settings; no other role exists yet.

### 15. Required RLS Policies
Baseline `tenant_id = current_tenant_id()` policy pattern implemented and unit-tested on every table created in this Epic; Platform Admin bypass scope (§13.6) implemented for `tenants`, `plan_catalog`, `plan_catalog_apps`; `FORCE ROW LEVEL SECURITY` enabled everywhere from day one.

### 16. API Groups
Provisioning API group; Auth/session API group (login, refresh, revoke).

### 17. Dependencies on Previous Epics
None — this is the root Epic.

### 18. Frontend Screens Affected
Platform Admin: "Add School" wizard, Schools list, School detail (suspend/reactivate). Nursery Dashboard: login screen only (no data screens yet).

### 19. Acceptance Criteria
- A Platform Admin can provision a tenant end-to-end and the resulting manager account can log in within one activation-link click.
- A suspended tenant's manager cannot authenticate a new session; an already-issued session is invalidated within the same request that performs the suspension (§10.6).
- No RLS policy in this Epic can be bypassed by a crafted `tenant_id` in a client payload (§13.2) — verified by an adversarial test suite, not just happy-path tests.
- Two tenants provisioned back-to-back have zero data crossover in any query, including edge cases (same slug prefix, same admin phone-number format).

### 20. Test Scenarios
- Provision tenant → login as manager → confirm JWT claims (`tenant_id`, `role`) are correct and immutable from the client.
- Attempt to read/write another tenant's row directly via the client SDK with a forged `tenant_id` — must fail.
- Suspend tenant mid-session → confirm the manager's next request fails, not just their next login.
- Re-run provisioning with a duplicate slug — must fail cleanly with a stable error code, not a raw constraint violation.
- Kill the Edge Function mid-provisioning (simulated) → confirm `tenant_provisioning_state` allows a safe resume instead of a duplicate/orphaned tenant.

### 21. Definition of Done
All acceptance criteria pass in `staging` against the real Supabase Auth Admin API (not mocked); RLS test suite (one test per policy) green; migration applied cleanly to a fresh `staging` project from empty; DR/PITR enabled and confirmed via one manual restore test; CORS/wildcard TLS confirmed against a live `*.masar.app` subdomain; runbook for manual tenant suspension written.

### 22. Estimated Complexity
**L**

### 23. Estimated Development Time
3 weeks

### 24. Estimated Testing Time
1.5 weeks (includes the adversarial RLS suite, which is disproportionately valuable this early)

### 25. Risks
- **Vendor lead time risk**: WhatsApp/SMS provider contracting (needed for real activation-link delivery in Epic 4) can slip past this Epic's timeline — mitigated by stubbing activation-link dispatch to a logged/manual-copy fallback for this Epic only, explicitly not shipped to production until Epic 4 replaces the stub.
- **RLS foundational bug risk**: an error in the baseline policy shape here propagates to every later Epic — mitigated by the adversarial test suite being a hard gate, not optional, before this Epic is considered done.
- **Region/PITR selection risk**: picking a Supabase region without confirming PITR availability in that region could force a re-platform later — mitigated by confirming region + PITR support together before any schema is migrated.

### 26. Rollback Strategy
Entire Epic is additive (new schemas/tables, no shared state with any pre-existing system) — rollback is `supabase db reset` against `staging` or a straight migration revert against `production` before any tenant has real users, with zero blast radius since nothing downstream exists yet.

### 27. Deployment Strategy
Direct-to-production after staging soak (no feature flag needed — no end users exist on the platform yet). Migration + Edge Function deploy in the same CI step per §31.

### 28. Production Checklist
- [ ] PITR enabled and restore-tested
- [ ] Wildcard DNS + TLS live
- [ ] CORS allowed-origins locked to known app origins
- [ ] Platform Admin MFA enforced
- [ ] Adversarial RLS suite green in CI, wired to run on every future migration
- [ ] Runbook: manual tenant suspension/reactivation

---

## Epic 2 — Core Academic Data

### 1. Epic Overview
Ships the classroom/child/guardian/staff data model, attendance, evaluations, lessons, and concerns — the data backbone every other domain (transport, billing, reports, chat) attaches to. Ends with a Manager able to fully run the "front office" of a nursery in the Dashboard, and a Guardian able to see their child's live status and academic record in a read-only capacity (Parent App messaging/payments still come later).

### 2. Business Goal
Get real operational data into the system as early as possible — this is the data every other Epic's realism depends on, and the earlier it's in staging, the more Epics can be tested against realistic data instead of synthetic stubs.

### 3. Features Included
Child enrollment (incl. guardian account provisioning), classroom management, staff/reception onboarding, daily attendance marking, teacher evaluations, lesson logging, concerns/flags, staff leave scheduling, staff feedback (complaints/commends).

### 4. Backend Modules
Academic (per §33).

### 5. Database Tables Involved
`classrooms`, `children`, `day_path_events`, `child_guardian_links`, `attendance_records`, `subjects`, `lessons`, `evaluations`, `concerns`, `staff_subjects`, `staff_leave_records`, `staff_feedback`.

### 6. Supabase Features Involved
Postgres (full-text search indexes for child/staff search), Storage (profile photos now actually used), Auth (guardian account provisioning cascade activated).

### 7. Edge Functions Required
`enroll-child`, `add-staff`.

### 8. RPC Functions Required
`mark_attendance`, `submit_evaluation`, `withdraw_child`, `suspend_child`/`reactivate_child`, plus the RLS helpers `current_staff_classroom_ids()`, `current_guardian_child_ids()` that this Epic is the first to actually exercise with real data.

### 9. Storage Buckets Involved
`profile-photos` (child/staff/guardian photos), `academic-attachments` (schema/policy only — first real use is Epic 5's exam-paper uploads).

### 10. Realtime Channels Involved
`classroom:{id}:day_path` (foundation laid here; fully exercised once Epic 3's bus/trip actions start writing to it).

### 11. Background Jobs Involved
Provisioning cascade for guardian accounts (still stubbed for activation delivery until Epic 4).

### 12. Scheduled Jobs Involved
None new.

### 13. External Integrations Involved
None new.

### 14. Required Permissions
Full §12 rows for: children, classrooms, attendance, evaluations/lessons, concerns, staff leave records, staff feedback, staff subject assignments, day-path history.

### 15. Required RLS Policies
Guardian-scoped child visibility (`current_guardian_child_ids()`), teacher-scoped classroom visibility (`current_staff_classroom_ids()`), Manager tenant-wide bypass — all exercised against real multi-child, multi-classroom data for the first time.

### 16. API Groups
Children API group, Classrooms API group, Attendance API group, Academic Records API group, Staff Management API group.

### 17. Dependencies on Previous Epics
Epic 1 (tenancy, identity, RLS baseline, provisioning pattern).

### 18. Frontend Screens Affected
Dashboard: Children, Classrooms, Teachers, Attendance. Parent App: Home (day-path, read-only), Subjects (read-only). Teacher App: Home (classes), Roster, evaluation sheets.

### 19. Acceptance Criteria
- Enrolling a child provisions exactly one guardian account (or links to an existing guardian phone number within the tenant without duplicating identity).
- A teacher can only see/evaluate children in classrooms they're assigned to; a guardian can only see their own children, verified across multiple simultaneous tenants in the test dataset.
- Attendance marked for a classroom is queryable by date with correct historical accuracy (time-travel by day, per the Dashboard's requirement).
- Withdrawing a child soft-deletes correctly per §8's cascade rules (pickup passes/bus riders deactivated, historical records untouched) — verified even though bus riders don't exist as a real feature until Epic 3 (schema-level correctness only at this point).

### 20. Test Scenarios
- Enroll 50 synthetic children across 5 classrooms in one tenant; confirm search, filtering, and classroom rosters all perform acceptably (index sanity check ahead of real load).
- Cross-tenant leak test: two tenants each with children named identically — confirm zero visibility crossover.
- Evaluate a child as a teacher not assigned to their classroom — must be denied at the RLS layer, not just hidden in the UI.
- Concurrent classroom-capacity enrollment race test (two simultaneous enrollments against a classroom one seat from full) — confirms the row-locking convention from §2.2/§14.3 as first exercised here.

### 21. Definition of Done
All acceptance criteria pass in staging with realistic synthetic data volume; RLS test coverage extended to every new row in §12; Dashboard/Parent App/Teacher App smoke-tested against real (not mocked) data for the screens listed above.

### 22. Estimated Complexity
**L**

### 23. Estimated Development Time
3 weeks

### 24. Estimated Testing Time
1.5 weeks

### 25. Risks
- **Data model rigidity risk**: this is the widest table (`children`) in the system; a missed field discovered later means a migration touching live tenant data — mitigated by a final field-by-field cross-check against the frontend inventory before this Epic is marked done, not after.
- **Guardian identity collision risk**: siblings sharing a guardian phone number, entered slightly differently across two enrollments, could create duplicate guardian accounts — mitigated by the `tenant_phone_registry` uniqueness constraint (Epic 1) being exercised deliberately in this Epic's test suite for the sibling case specifically.

### 26. Rollback Strategy
Additive migration; if a defect is found post-deploy, roll forward with a corrective migration rather than backward, since guardian accounts (real Auth identities) will exist by the time this ships — a schema rollback that drops columns with live data is avoided per the expand/contract discipline in §31.

### 27. Deployment Strategy
Staging soak with synthetic data first, then a limited production pilot with one real or friendly-test tenant before wider rollout, since this Epic is the first to create real end-user (guardian) accounts.

### 28. Production Checklist
- [ ] Field-by-field parity check against frontend `children`/`staff` forms
- [ ] RLS adversarial suite extended and green
- [ ] Search indexes verified against realistic data volume
- [ ] Sibling/guardian-collision test passing
- [ ] Withdrawal cascade verified end-to-end

---

## Epic 3 — Transport & Safety

### 1. Epic Overview
Ships bus fleet management, trip execution (driver-side), live GPS tracking, and the QR pickup-authorization/handover flow. This is the highest-risk Epic in the plan from both a technical (realtime, high-frequency writes) and a trust (child custody) standpoint, so it ships as its own Epic rather than being folded into Academic or Communication.

### 2. Business Goal
Unlock the platform's most safety-critical and most visibly "live" feature set — parents watching their child's bus in real time and reception verifying custody handovers are core to why nurseries adopt Masar over a generic school-management tool.

### 3. Features Included
Bus fleet CRUD, rider assignment (capacity-checked), trip execution (start/GPS-ping/status-update/complete), driver manifest, reception QR scan + handover confirmation, reception bus arrival/departure bulk confirmation, pickup-pass creation (guardian side).

### 4. Backend Modules
Transport; Safety (per §33).

### 5. Database Tables Involved
`buses`, `bus_riders`, `trips`, `trip_stops`, `trip_stop_riders`, `trip_child_status`, `gps_pings`, `pickup_passes`, `pickup_scan_events`.

### 6. Supabase Features Involved
Realtime (`postgres_changes` on `gps_pings`/`trips`/`trip_child_status`), Auth (driver accounts provisioned), Postgres row-locking (capacity-checked rider assignment).

### 7. Edge Functions Required
`add-bus` (driver account provisioning).

### 8. RPC Functions Required
`assign_bus_rider`/`unassign_bus_rider`, `start_trip`, `record_gps_ping`, `update_child_trip_status`, `complete_trip`, `create_pickup_pass`, `scan_pickup_pass`, `confirm_handover`.

### 9. Storage Buckets Involved
`identity-documents` (pickup-pass ID photos).

### 10. Realtime Channels Involved
`trip:{trip_id}:position`, `trip:{trip_id}:status`, `classroom:{id}:day_path` (now fully exercised — bus pickup/dropoff is a major day-path driver).

### 11. Background Jobs Involved
None new (notification dispatch for trip/handover events is stubbed until Epic 4; see Risk below).

### 12. Scheduled Jobs Involved
GPS ping retention purge (staged here structurally, first meaningful run once real ping volume exists — actual cron registration can land with Epic 10, noted as a forward reference the Epic explicitly tracks rather than silently deferring).

### 13. External Integrations Involved
None new (media relay is Epic 7).

### 14. Required Permissions
Full §12 rows for: Buses/Trips, Trip stops/stop riders, GPS pings, Pickup passes, Pickup scan events — including the corrected Reception write permission on trip-status confirmation.

### 15. Required RLS Policies
`current_driver_rider_ids()` exercised for the first time; the `pickup_passes` token-based lookup policy (§13.4) implemented and specifically adversarially tested (this is the one deliberately-narrow lookup-by-opaque-token pattern in the whole system).

### 16. API Groups
Fleet Management API group, Trip Execution API group, Pickup/Safety API group.

### 17. Dependencies on Previous Epics
Epic 1 (provisioning pattern, RLS baseline), Epic 2 (children, classrooms — riders are children).

### 18. Frontend Screens Affected
Dashboard: Bus fleet management, live map. Driver App: Trip, Students manifest, History. Parent App: Bus tracking, Pickup (QR pass creation). Reception App: Scan, Bus confirmation, Activity log.

### 19. Acceptance Criteria
- A parent watching a live trip sees GPS position update within the stated cadence (§18) with no stale-position gap greater than the ping interval.
- Reception's QR scan correctly distinguishes valid/expired/revoked/unknown passes and never allows a handover confirmation on an invalid scan.
- Two simultaneous rider-assignment requests against a bus one seat from capacity never both succeed (row-lock correctness, §2.2/§14.3, verified under actual concurrency, not just unit-tested sequentially).
- A trip's `trip_stop_riders` snapshot is immutable once the trip starts, even if the bus's live roster changes mid-route.

### 20. Test Scenarios
- Full AM trip simulation: assign riders → start trip → simulate GPS pings at realistic cadence → mark pickups → confirm arrival → complete trip; verify every realtime subscriber (parent, dashboard) received every state transition.
- Adversarial pickup-pass scan: attempt to enumerate valid tokens via sequential/guessed values — must fail (token is opaque/high-entropy, §7).
- Concurrent capacity race test at real concurrency (not simulated sequentially) against `assign_bus_rider`.
- Kill the driver app mid-trip (simulated network loss) → confirm trip state remains coherent and resumable, not stuck in an ambiguous state.

### 21. Definition of Done
All acceptance criteria pass in staging with a simulated multi-bus, multi-trip realistic dataset; realtime load-tested at a plausible peak-window concurrency estimate (even though the full concurrency monitoring program is Epic 10); pickup-pass security test suite green.

### 22. Estimated Complexity
**XL**

### 23. Estimated Development Time
4 weeks

### 24. Estimated Testing Time
2 weeks — the longest testing allocation of any single-domain Epic, reflecting the custody/safety stakes.

### 25. Risks
- **Custody-safety risk**: a bug in pickup-pass validation is the single worst-case defect class in the entire system — mitigated by dedicating the largest test-time allocation in the plan to this Epic specifically and requiring a second engineer's sign-off (not just the implementer's) on the pickup-pass RLS/RPC logic before merge.
- **Realtime load risk**: this Epic is the first to generate sustained high-frequency writes (GPS) — mitigated by load-testing against the throughput estimate already modeled in the architecture doc (§30) before this Epic is called done, rather than discovering the ceiling in production.
- **Notification stub risk**: trip/handover events should notify parents, but the real dispatch pipeline isn't live until Epic 4 — mitigated by writing to the `notifications` table (in-app feed) from day one even though push/WhatsApp delivery is stubbed, so nothing is silently lost once Epic 4 activates delivery.

### 26. Rollback Strategy
Additive migration. If a defect is found in production, the immediate mitigation is disabling the affected RPC at the Edge Function/RPC-guard layer (a feature-flag-style kill switch) rather than a schema rollback, since trip/GPS data has real-time consumers who'd be disrupted by a rollback more than by a temporary feature pause.

### 27. Deployment Strategy
Staged rollout: enable for one pilot tenant's real bus operation first, monitor a full day's AM+PM cycle in production before enabling tenant-wide, given the safety stakes.

### 28. Production Checklist
- [ ] Pickup-pass adversarial suite green, second-engineer sign-off obtained
- [ ] Capacity-lock concurrency test passing under real concurrent load
- [ ] Realtime load test against modeled peak-window throughput
- [ ] Pilot-tenant full-day dry run completed successfully
- [ ] Kill-switch mechanism verified for each new RPC

---

## Epic 4 — Communication & Notification Backbone

### 1. Epic Overview
Ships the real chat, announcement, and notification dispatch pipeline — including device tokens and per-category preferences — and **retroactively activates** every stubbed notification from Epics 1–3 (activation links, trip/handover alerts). This Epic is deliberately positioned right after the three data-heavy Epics specifically to close out that technical debt in one place rather than let it linger.

### 2. Business Goal
Turn every "something happened" event already flowing through the system into an actual message a human receives — without this Epic, Epics 1–3 are functionally complete but silent.

### 3. Features Included
Teacher↔parent chat (with escalation), Dashboard/Platform announcements, in-app notification feed, push/WhatsApp/SMS/email delivery, device-token registration, per-category notification preferences, activation-link and OTP delivery (retroactively wired for Epics 1–3).

### 4. Backend Modules
Communication (per §33).

### 5. Database Tables Involved
`conversations`, `messages`, `announcements`, `announcement_recipients`, `notifications`, `notification_deliveries`, `device_tokens`, `notification_preferences`.

### 6. Supabase Features Involved
Realtime (`conversation:{id}:messages`, `user:{id}:notifications`), Edge Functions (provider integrations), `pg_net`/database webhooks or the `background_job_queue` polling pattern for dispatch.

### 7. Edge Functions Required
`notification-dispatch` (the central fan-out function every other Epic's events route through).

### 8. RPC Functions Required
`send_message`, `escalate_conversation`, `broadcast_announcement`, `register_device_token`, `update_notification_preferences`.

### 9. Storage Buckets Involved
`chat-attachments` (schema/policy only, no upload UI yet unless frontend enables it).

### 10. Realtime Channels Involved
`conversation:{id}:messages`, `user:{id}:notifications`.

### 11. Background Jobs Involved
Notification dispatch (fully live for the first time — preference check, device-token resolution, multi-channel fan-out).

### 12. Scheduled Jobs Involved
None new (payment/AI-report scheduled dispatch are Epic 6/8).

### 13. External Integrations Involved
**Push notification provider (FCM/APNs), WhatsApp/SMS provider** — both go live in this Epic; this is the hard external-vendor gate for the whole plan, so vendor contracting/sandbox access must be confirmed complete before this Epic starts, not during it.

### 14. Required Permissions
Full §12 rows for: Conversations/Messages, Announcements, Notifications, Device tokens, Notification preferences.

### 15. Required RLS Policies
Conversation participant scoping (guardian/teacher pair), notification/preference self-ownership (`recipient_id = auth.uid()`-equivalent), announcement audience-targeting read policies.

### 16. API Groups
Chat API group, Announcements API group, Notifications API group, Device/Preferences API group.

### 17. Dependencies on Previous Epics
Epic 1 (accounts to notify), Epic 2 (children/classrooms as notification targets), Epic 3 (the specific trip/pickup events this Epic activates delivery for).

### 18. Frontend Screens Affected
Parent App: Chat, Notifications, Settings (notification toggles). Teacher App: Chat, Notifications. Dashboard: Announce/broadcast modal, Overview activity feed. Platform Admin: Broadcast. Every app's Settings notification-preferences screen.

### 19. Acceptance Criteria
- Every event type in the Notification Matrix (§16 of the architecture doc) produces a correctly-routed `notifications` row and, where the recipient hasn't opted out, a delivered push/WhatsApp/SMS/email.
- A recipient who disables a category/channel never receives that channel for that category again, verified end-to-end against the real provider sandbox, not just the DB state.
- Chat escalation correctly notifies the Manager and flips conversation state, with the original guardian↔teacher thread still intact.
- Previously-stubbed Epic 1/3 events (activation links, trip/handover alerts) are now delivered for real, with zero regressions to those Epics' already-shipped functionality.

### 20. Test Scenarios
- End-to-end provider sandbox test for each of the four external channels (push, WhatsApp, SMS, email).
- Preference-opt-out test: disable `trip_update` push for one guardian, confirm they still get `in_app` but not push, while a second guardian without the opt-out still gets both.
- Chat load test: high message-volume conversation, confirm pagination/realtime performance holds.
- Provider outage simulation (WhatsApp sandbox unreachable) → confirm graceful degradation (in-app still succeeds, per §25.5) rather than the whole dispatch job failing.

### 21. Definition of Done
All Notification Matrix rows verified against real provider sandboxes; preference-gating verified; retroactive activation of Epic 1/3 stubbed notifications confirmed with no regression; dispatch job failure/retry behavior verified against a simulated provider outage.

### 22. Estimated Complexity
**L**

### 23. Estimated Development Time
3 weeks

### 24. Estimated Testing Time
1.5 weeks

### 25. Risks
- **Vendor integration risk** (highest risk in this Epic): provider API quirks/rate limits discovered late — mitigated by starting provider sandbox integration in week 1 of this Epic, not after the DB schema is finished, so integration surprises surface early.
- **Retroactive-activation regression risk**: turning on real delivery for previously-stubbed Epic 1/3 events could reveal payload/timing bugs invisible while stubbed — mitigated by re-running the full Epic 1 and Epic 3 acceptance test suites as part of this Epic's Definition of Done, not just this Epic's own new tests.

### 26. Rollback Strategy
Provider integrations are isolated behind the single `notification-dispatch` function — a provider-specific failure can be disabled per-channel (config toggle) without rolling back schema or affecting other channels/Epics.

### 27. Deployment Strategy
Provider sandbox → provider production credentials in a controlled canary (one pilot tenant) → tenant-wide, mirroring Epic 3's safety-conscious rollout given this Epic now carries real messaging cost and deliverability reputation (WhatsApp sender reputation specifically).

### 28. Production Checklist
- [ ] All four provider integrations confirmed in production credentials (not sandbox)
- [ ] Preference-gating verified end-to-end
- [ ] Epic 1 + Epic 3 regression suites re-run and green
- [ ] Dispatch failure/retry runbook written
- [ ] WhatsApp sender reputation/rate-limit posture confirmed with provider

---

## Epic 5 — Approvals & Events

### 1. Epic Overview
Ships the teacher-request → manager-approval → published-event pipeline: exams, celebrations, and trips, including RSVPs and paid trip registration. Runs in parallel with Epic 6 (Billing) since the two only share the `event_trip_registrations` ↔ `payment_transactions` link, which Epic 5 builds against Epic 6's contract, not its live implementation.

### 2. Business Goal
Close the loop on the academic calendar/administrative-request workflow that's core to daily nursery operations, independent of billing readiness.

### 3. Features Included
Teacher request submission (event/trip/exam), Manager approve/reject with exam-paper preview, event publication, guardian RSVP (celebrations), guardian trip registration (open/paid).

### 4. Backend Modules
Approvals & Events (per §33).

### 5. Database Tables Involved
`requests`, `events`, `event_rsvps`, `event_trip_registrations`.

### 6. Supabase Features Involved
Storage (exam-paper attachments via `academic-attachments`), Realtime (`tenant:{id}:approvals`).

### 7. Edge Functions Required
None new — this Epic is pure RPC/PostgREST.

### 8. RPC Functions Required
`submit_request`, `review_request`, `update_rsvp`, `cancel_trip_registration`.

### 9. Storage Buckets Involved
`academic-attachments` (now actually used — exam paper uploads).

### 10. Realtime Channels Involved
`tenant:{id}:approvals`.

### 11. Background Jobs Involved
None new (notifications for approval events route through Epic 4's already-live dispatch pipeline).

### 12. Scheduled Jobs Involved
None new.

### 13. External Integrations Involved
None (payment for trips is Epic 6's responsibility; this Epic only creates the registration row and defers to Epic 6's `initiate_payment` once that Epic ships).

### 14. Required Permissions
Full §12 rows for: Requests (approvals), Events, Event RSVP/Trip reg.

### 15. Required RLS Policies
Teacher own-request visibility, Manager tenant-wide approvals visibility, Guardian own-child RSVP/registration ownership.

### 16. API Groups
Requests/Approvals API group, Events API group, RSVP/Registration API group.

### 17. Dependencies on Previous Epics
Epic 2 (staff/children), Epic 4 (notification dispatch for approval/event events).

### 18. Frontend Screens Affected
Teacher App: Requests. Dashboard: Approvals. Parent App: Events (exams/celebrations/trips), RSVP flow.

### 19. Acceptance Criteria
- A request can only be promoted to an event on explicit Manager approval, and the promotion is transactional (never a half-created event on failure).
- An exam-paper attachment previews correctly for the reviewing Manager without exposing the raw storage path.
- A trip registration cannot reach `status='paid'` without an associated `payment_transaction_id` (the §3.24/§5 trigger, verified here for the first time under real conditions).

### 20. Test Scenarios
- Full request lifecycle: submit → approve → verify event visible to targeted guardians only.
- Reject with reason → verify teacher sees the reason, not a generic denial.
- Attempt to set `event_trip_registrations.status='paid'` directly without a payment transaction — must be rejected by the trigger.
- Concurrent RSVP updates on the same registration (double-tap) — must be idempotent, not duplicate.

### 21. Definition of Done
All acceptance criteria pass in staging; exam-paper preview verified across both image and PDF attachment types; approval realtime channel verified against both Dashboard and Teacher App simultaneously.

### 22. Estimated Complexity
**M**

### 23. Estimated Development Time
2 weeks

### 24. Estimated Testing Time
1 week

### 25. Risks
- **Cross-Epic contract risk**: this Epic builds against Epic 6's payment contract before Epic 6 ships — mitigated by freezing the `event_trip_registrations`/`payment_transactions` interface shape as part of this Epic's design review, with Epic 6 held to that contract rather than the other way around.

### 26. Rollback Strategy
Additive migration, no shared mutable state with other in-flight Epics beyond the frozen contract above; safe to roll back independently of Epic 6's progress.

### 27. Deployment Strategy
Direct to staging → production once Epic 4 is live (notification dependency); no phased rollout needed (non-safety-critical domain).

### 28. Production Checklist
- [ ] Request→event promotion transactionality verified
- [ ] Exam-paper preview verified for both file types
- [ ] Payment-status/FK trigger verified
- [ ] Approval realtime channel verified across both consuming apps

---

## Epic 6 — Billing & Payments

### 1. Epic Overview
Ships the full financial stack: fee configuration, per-child ledgers, installment plans, invoices, and the payment lifecycle across gateway-backed and manual reconciliation methods — plus the recurring billing-ledger-generation job that makes recurring fees actually bill. This is the second-highest-risk Epic in the plan (real money) after Epic 3 (real safety).

### 2. Business Goal
Enable the core commercial loop of the platform — nurseries collecting fees from parents through Masar — which is the product's primary monetization surface for tenants and, transitively, evidence the platform is viable for Masar's own subscription revenue in Epic 9.

### 3. Features Included
Fee item configuration, per-child billing ledger, installment plans, invoice generation/PDF/resend, payment initiation (gateway + manual), manual verification workflow, manual cash marking, refunds, recurring billing-ledger generation, payment reminder cadence, stale-verification escalation.

### 4. Backend Modules
Billing & Payments (per §33).

### 5. Database Tables Involved
`fee_items`, `fee_item_applicability`, `billing_ledger_items`, `installment_plans`, `installment_schedule_entries`, `invoices`, `invoice_lines`, `payment_transactions`.

### 6. Supabase Features Involved
Storage (`generated-documents` for invoice PDFs, `payment-receipts`), `pg_cron` (recurring billing, reminders, stale-escalation), background job queue (invoice PDF rendering, webhook processing).

### 7. Edge Functions Required
`initiate-payment`, `payment-webhook`, `generate-invoice-pdf`, `resend-invoice`.

### 8. RPC Functions Required
`mark_installment_paid_manual`, `generate_invoice`, `verify_payment`, `refund_payment`.

### 9. Storage Buckets Involved
`generated-documents`, `payment-receipts`.

### 10. Realtime Channels Involved
None new (payment status changes surface via the Epic 4 notification pipeline, not a dedicated realtime channel — matches the architecture doc's matrix).

### 11. Background Jobs Involved
Invoice PDF generation, payment webhook processing.

### 12. Scheduled Jobs Involved
**Recurring billing ledger generation**, billing status roll-up, payment reminder cadence, stale manual-payment escalation — the four jobs this Epic is specifically responsible for standing up per the architecture doc's explicit sequencing note (§35 Phase 5).

### 13. External Integrations Involved
**Payment gateway/PSP** (contracting, sandbox, then production credentials — the other hard external-vendor gate in this plan alongside Epic 4's providers; kick off vendor selection no later than the start of Epic 4 so it's ready in time).

### 14. Required Permissions
Full §12 rows for: Fee items, Billing ledger/Invoices, Payments.

### 15. Required RLS Policies
Guardian own-child billing visibility, Manager tenant-wide billing CRUD, payment-initiation ownership (a guardian can only initiate payment against their own child's ledger).

### 16. API Groups
Fee Configuration API group, Billing Ledger API group, Invoices API group, Payments API group.

### 17. Dependencies on Previous Epics
Epic 2 (children as billing subjects), Epic 4 (payment notifications).

### 18. Frontend Screens Affected
Dashboard: Payments (fee config, ledger, installment plans, invoicing). Parent App: Payments (dues, pay flow, history, invoice download).

### 19. Acceptance Criteria
- A monthly fee item correctly generates a new `billing_ledger_items` row every billing period without manual intervention, verified across at least two consecutive simulated periods.
- A successful gateway payment atomically updates the ledger, installment schedule, and invoice status in one transaction — no partial-update state reachable even under simulated mid-transaction failure.
- A duplicate webhook delivery never double-credits a ledger (idempotency on `provider_reference`).
- A manual bank-transfer payment stuck in `pending_verification` past SLA triggers the Manager escalation notification.

### 20. Test Scenarios
- Full gateway payment happy path, sandbox to production credential cutover tested separately.
- Duplicate webhook replay test (send the same webhook twice) — ledger must reflect exactly one credit.
- Manual payment: submit receipt → verify → confirm ledger/invoice/notification all update together.
- Refund flow: confirm ledger reversal is correct and `SUM(amount) WHERE status='succeeded'` stays meaningful (§20).
- Recurring billing job: simulate a period rollover and confirm exactly one new ledger row per applicable child, no duplicates on job re-run (idempotent).

### 21. Definition of Done
All acceptance criteria pass in staging against the payment gateway's sandbox; recurring billing job verified across simulated period boundaries; financial reconciliation report (ledger vs. transactions vs. invoices) produced and manually cross-checked once before go-live.

### 22. Estimated Complexity
**XL**

### 23. Estimated Development Time
5 weeks

### 24. Estimated Testing Time
2 weeks

### 25. Risks
- **Financial correctness risk** (highest-stakes risk category alongside Epic 3's safety risk): a ledger bug directly costs the business money or trust — mitigated by requiring a second engineer's sign-off on the ledger-update transaction logic and a manual reconciliation pass before production cutover.
- **PSP integration risk**: gateway sandbox behavior often diverges from production edge cases (partial refunds, currency rounding) — mitigated by scheduling a dedicated production-credential smoke-test window before full rollout, not assuming sandbox parity.
- **Recurring-job correctness risk**: an off-by-one in period-rollover logic either double-bills or silently under-bills — mitigated by the idempotent re-run test being a hard gate in the Definition of Done.

### 26. Rollback Strategy
Payment initiation can be disabled at the Edge Function layer (kill switch) independently of the ledger schema; a schema rollback is avoided once real transactions exist — corrective migrations only, never destructive ones, from this Epic onward for any billing table.

### 27. Deployment Strategy
Sandbox → one pilot tenant on production gateway credentials, monitored through at least one full billing cycle (to observe the recurring-ledger job fire for real) → tenant-wide rollout.

### 28. Production Checklist
- [ ] Production PSP credentials confirmed and smoke-tested
- [ ] Recurring billing job verified through one real cycle in pilot
- [ ] Webhook idempotency verified against real duplicate-delivery behavior
- [ ] Manual reconciliation pass completed and signed off
- [ ] Refund flow verified end-to-end
- [ ] Kill switch verified for `initiate-payment`

---

## Epic 7 — Media & Camera Architecture

### 1. Epic Overview
Ships the camera registry, classroom linkage, service-account-based heartbeat authentication, and stream-token issuance — deliberately scoped to metadata/access-control only, with video transport handled by external media relay infrastructure outside this Epic's engineering surface.

### 2. Business Goal
Deliver the classroom-camera feature that's a strong differentiator for parent trust and engagement, without taking on video-infrastructure risk inside the core backend team's critical path.

### 3. Features Included
Camera registry CRUD, classroom linkage, online/admin-disabled state management, service-account heartbeat authentication, stream-token issuance for authorized parents.

### 4. Backend Modules
Media (per §33).

### 5. Database Tables Involved
`cameras`, `camera_classroom_links`, `service_accounts` (first real rows).

### 6. Supabase Features Involved
Auth (service-account API-key pattern, not Supabase Auth JWT), Realtime (`tenant:{id}:cameras`), `pg_cron` (heartbeat sweep).

### 7. Edge Functions Required
`camera-heartbeat` (service-account authenticated), `camera-stream-token`, `issue-service-account-key`, `revoke-service-account-key`.

### 8. RPC Functions Required
None beyond the above Edge Functions' internal RPC calls (this Epic is Edge-Function-heavy given the machine-identity auth pattern).

### 9. Storage Buckets Involved
None (video is out of Supabase Storage scope per §17).

### 10. Realtime Channels Involved
`tenant:{id}:cameras` (heartbeat-driven `online` changes and manager-driven `admin_disabled` changes, both now live).

### 11. Background Jobs Involved
None new.

### 12. Scheduled Jobs Involved
Camera heartbeat sweep.

### 13. External Integrations Involved
**Media relay service** (RTSP-to-WebRTC/HLS gateway) — external infrastructure, coordinated with but not built by the backend team; this Epic's job is the metadata/auth contract the relay integrates against.

### 14. Required Permissions
Full §12 row for Cameras, plus the Service Accounts row.

### 15. Required RLS Policies
Parent classroom-scoped camera visibility (via `camera_classroom_links`), Manager tenant-wide camera CRUD including `admin_disabled` toggle; service-account requests bypass RLS by design (§13.7), verified as intentional, not a gap.

### 16. API Groups
Camera Registry API group, Stream Token API group, Service Account Management API group.

### 17. Dependencies on Previous Epics
Epic 2 (classrooms), Epic 4 (offline-camera notifications).

### 18. Frontend Screens Affected
Dashboard: Cameras registry, classroom linking. Parent App: Cameras (live view, resolved via stream token).

### 19. Acceptance Criteria
- A parent can only ever resolve stream tokens for cameras linked to their own child's classroom(s) — verified adversarially, not just via the happy-path UI.
- A manager's `admin_disabled` toggle persists across heartbeat cycles (the resolved v0→v1 conflict, re-verified here under real heartbeat traffic for the first time).
- A camera's raw IP/RTSP credentials never appear in any client-facing response at any point in the flow.
- A revoked service-account key immediately stops being accepted by `camera-heartbeat`.

### 20. Test Scenarios
- Heartbeat sweep correctness: simulate 3 missed heartbeats, confirm `online` flips to false and the realtime channel + Manager notification both fire.
- Manual-disable-survives-heartbeat test: disable a camera, then send a real heartbeat, confirm it stays non-viewable.
- Adversarial stream-token test: attempt to request a token for a camera outside the requesting parent's classroom — must be denied both at the Edge Function's tenant/ownership check and (defense-in-depth) at the RLS layer for the underlying metadata read.
- Service-account key revocation test: revoke mid-session, confirm the next heartbeat from that key is rejected.

### 21. Definition of Done
All acceptance criteria pass in staging with a simulated camera agent (no physical hardware required for backend sign-off — physical integration is a media-relay-team concern); service-account key lifecycle fully exercised.

### 22. Estimated Complexity
**M**

### 23. Estimated Development Time
2 weeks

### 24. Estimated Testing Time
1 week

### 25. Risks
- **External infrastructure coordination risk**: the media relay is built/operated outside this Epic — mitigated by this Epic shipping and testing its full metadata/auth contract against a simulated agent, so the backend's Definition of Done doesn't block on relay infrastructure timing.
- **Machine-identity auth novelty risk**: this is the only API-key (non-JWT) auth path in the system — mitigated by the adversarial test coverage above being non-negotiable before merge, since it's the least-battle-tested pattern in the plan.

### 26. Rollback Strategy
Additive migration; if the heartbeat/stream-token mechanism has a defect, cameras simply show as offline/unavailable (safe failure mode) rather than exposing anything — no rollback urgency beyond a normal bug-fix release.

### 27. Deployment Strategy
Ships as soon as ready; camera feature is opt-in per tenant (only visible where cameras are actually registered), so no phased-rollout mechanism is needed beyond normal staging soak.

### 28. Production Checklist
- [ ] Stream-token adversarial test suite green
- [ ] Manual-disable-survives-heartbeat verified under real heartbeat traffic
- [ ] Service-account key revocation verified
- [ ] Media relay integration contract confirmed with relay-owning team/vendor

---

## Epic 8 — AI Report Architecture

### 1. Epic Overview
Ships server-side LLM integration for note-polishing and structured report drafting, the human-in-the-loop review/send flow, the per-tenant usage cap, and the scheduled-dispatch job for pre-scheduled reports.

### 2. Business Goal
Deliver the AI-assisted reporting feature that reduces teacher administrative burden — a key retention driver for the Teacher App specifically — while keeping cost and content-quality risk bounded.

### 3. Features Included
AI note-polishing (teacher evaluations), AI-assisted report drafting (per-student and batch-by-classroom), human review/edit before send, scheduled send, resend/delete/export of report drafts, per-tenant daily AI usage cap.

### 4. Backend Modules
Reports (AI) (per §33).

### 5. Database Tables Involved
`ai_report_batches`, `ai_report_drafts`, `ai_usage_counters`.

### 6. Supabase Features Involved
Edge Functions (LLM calls, secrets management), Storage (`generated-documents` for exported reports), `pg_cron` (scheduled dispatch).

### 7. Edge Functions Required
`ai-polish-note`, `ai-draft-report`.

### 8. RPC Functions Required
`resend_report_draft`, `delete_report_draft`, `export_report_draft`.

### 9. Storage Buckets Involved
`generated-documents` (exported report PDFs).

### 10. Realtime Channels Involved
None dedicated (report status changes surface via Epic 4's notification pipeline).

### 11. Background Jobs Involved
Batch AI report generation (for scope sizes above the synchronous threshold, per §19).

### 12. Scheduled Jobs Involved
AI report scheduled dispatch.

### 13. External Integrations Involved
**LLM provider** — API key provisioning, fallback-template behavior verified before this Epic is considered done (the provider must be able to fail without breaking the feature).

### 14. Required Permissions
Full §12 row for AI Reports.

### 15. Required RLS Policies
Guardian sent-only visibility, Teacher own-student create/read, Manager tenant-wide CRUD.

### 16. API Groups
AI Assist API group, Report Management API group.

### 17. Dependencies on Previous Epics
Epic 2 (evaluations/attendance/lessons as the grounding data source), Epic 4 (report-sent notifications).

### 18. Frontend Screens Affected
Teacher App: evaluation note AI-polish action, Reports (draft/send). Dashboard: AI Reports composer, history.

### 19. Acceptance Criteria
- No AI-drafted report ever reaches `sent` status without an explicit staff action having occurred at some point in its lifecycle (immediate send or prior scheduling) — verified there is no code path that bypasses this.
- LLM provider failure/timeout falls back to the deterministic template without failing the user's request.
- A tenant that exceeds its daily AI-call cap receives a clean `EXTERNAL_AI_QUOTA_EXCEEDED` error, not a silent failure or an uncapped bill.
- A `scheduled` report's `scheduled_for` timestamp reliably triggers delivery within the sweep interval, verified across the boundary condition (exactly at sweep time).

### 20. Test Scenarios
- Full draft→edit→send lifecycle, immediate and scheduled paths.
- LLM provider simulated outage → confirm fallback template output is used and the user isn't blocked.
- Usage-cap boundary test: exactly at the cap, one over the cap.
- Batch generation for a large classroom (above the synchronous threshold) → confirm it correctly routes to the background job path and completes with a completion notification.

### 21. Definition of Done
All acceptance criteria pass in staging against the real LLM provider (not a mock) for at least the happy-path and outage-simulation cases; usage-cap enforcement verified; scheduled-dispatch sweep verified across a real time boundary, not just a mocked clock.

### 22. Estimated Complexity
**M**

### 23. Estimated Development Time
2 weeks

### 24. Estimated Testing Time
1 week

### 25. Risks
- **Cost-runaway risk**: an unbounded/misconfigured client loop could generate excessive LLM cost — mitigated by the usage-cap being enforced server-side and tested at its exact boundary before launch, not assumed correct.
- **Content-quality/liability risk**: AI-generated content about a specific child reaching a parent unreviewed would be a serious trust failure — mitigated by the human-in-the-loop invariant being explicitly tested as "no code path bypasses review," not just tested on the happy path.

### 26. Rollback Strategy
The AI features are additive and can be disabled per-tenant or globally at the Edge Function layer (fallback-template-only mode) without any schema rollback, since the fallback path is already a first-class supported mode, not an error state.

### 27. Deployment Strategy
Ships with fallback-template mode as the safe default; LLM provider integration enabled behind a config flag, flipped on after a brief staging bake specifically watching for provider latency/cost in realistic conditions.

### 28. Production Checklist
- [ ] Usage-cap boundary test passing
- [ ] Fallback-template path verified end-to-end under simulated provider outage
- [ ] Human-in-the-loop invariant code-reviewed explicitly (no bypass path)
- [ ] Scheduled-dispatch sweep verified across a real time boundary

---

## Epic 9 — Platform Operations & Admin Console

### 1. Epic Overview
Ships the Platform Admin operational surface: activity/audit logging (audit writes actually began in Epic 1, this Epic ships the *viewing* UI and the remaining platform-scoped tables), support tickets, service health monitoring, and tenant-to-Masar billing.

### 2. Business Goal
Give the Masar operations team the tools to run the business on top of the platform — support, billing, and system health — closing the loop between "the product works for tenants" (Epics 1–8) and "Masar can operate the product as a company."

### 3. Features Included
Platform Admin dashboard (Overview, Schools, Billing, Support, System health, Audit log), support ticket lifecycle, tenant-to-Masar billing transactions, service health checks, `owner`/`admin`/`support` tier enforcement.

### 4. Backend Modules
Platform Operations (per §33).

### 5. Database Tables Involved
`activity_log`, `audit_log` (viewing surface — writes already live since Epic 1), `support_tickets`, `service_health_status`, `tenant_billing_transactions`.

### 6. Supabase Features Involved
`pg_cron` (health checks, tenant billing check, trial-expiry sweep), Realtime (`platform:service_health`, `platform:support_tickets`).

### 7. Edge Functions Required
None new beyond what already exists — this Epic is primarily read-surface and RPC work on top of already-live write paths.

### 8. RPC Functions Required
Support ticket CRUD/assignment RPCs, tenant billing transaction RPCs (issue/refund/adjust, `owner`/`admin` tier only per §12.1).

### 9. Storage Buckets Involved
None new.

### 10. Realtime Channels Involved
`platform:service_health`, `platform:support_tickets`.

### 11. Background Jobs Involved
None new.

### 12. Scheduled Jobs Involved
Service health check, tenant billing check, trial expiry sweep, attendance non-marking alert.

### 13. External Integrations Involved
None new (tenant billing reuses the payment-gateway relationship from Epic 6 at the platform level, not a new vendor).

### 14. Required Permissions
Full §12/§12.1 rows for: Activity log, Audit log, Tenants, Support tickets, Service health — including the full `owner`/`admin`/`support` differentiation.

### 15. Required RLS Policies
Platform Admin bypass scope finalized across all `platform.*` tables; `current_platform_admin_tier()` branching verified for every tier-differentiated action (§12.1).

### 16. API Groups
Support API group, Platform Billing API group, System Health API group, Audit API group.

### 17. Dependencies on Previous Epics
All of Epics 1–8 (this Epic observes and operates on everything that exists by this point).

### 18. Frontend Screens Affected
Platform Admin: Overview, Schools (billing detail), Billing, Support, System health, Broadcast, Audit log.

### 19. Acceptance Criteria
- A `support`-tier Platform Admin cannot suspend a tenant, change a plan, or issue a billing refund — verified as a hard RLS denial, not a UI-only restriction.
- Service health status accurately reflects a simulated real outage of each tracked service within one health-check interval.
- Audit log queries correctly reconstruct "who did what and when" for every tier-differentiated action taken during this Epic's own test suite (dogfooding the audit trail).

### 20. Test Scenarios
- `support` tier attempts a tenant suspension via direct API call (bypassing UI) — must be denied.
- Simulate a payment-gateway outage → confirm `service_health_status` reflects `degraded`/`down` within the check interval and Platform Admin is notified.
- Support ticket full lifecycle: create → assign → resolve, with correct notifications at each step.
- Audit log completeness check: perform a scripted sequence of tier-differentiated actions, confirm every one has a corresponding audit row with correct actor/action/target.

### 21. Definition of Done
All acceptance criteria pass in staging; `owner`/`admin`/`support` tier separation verified for every row in §12.1, not just a sample; audit log spot-checked against a full scripted action sequence.

### 22. Estimated Complexity
**M**

### 23. Estimated Development Time
2.5 weeks

### 24. Estimated Testing Time
1 week

### 25. Risks
- **Privilege-boundary risk**: `support` tier over-permission would undermine the least-privilege design explicitly called out as the system's most important security boundary (§28) — mitigated by testing every §12.1 row individually rather than sampling.

### 26. Rollback Strategy
Additive migration; this Epic is purely observational/operational on top of already-live data, so rollback risk is minimal — worst case is a UI/RPC-level revert with zero data-model impact.

### 27. Deployment Strategy
Direct to production after staging soak; internal-only surface (Platform Admin), so no tenant-facing phased rollout is needed.

### 28. Production Checklist
- [ ] `support`-tier restriction verified for every §12.1 row
- [ ] Service health check verified against simulated outages for every tracked service
- [ ] Audit log completeness spot-check passed
- [ ] Tenant billing transaction flow verified end-to-end

---

## Epic 10 — Jobs, Performance & Production Hardening

### 1. Epic Overview
Closes the plan: remaining scheduled jobs, materialized views, retention/purge automation, full-system rate limiting, partitioning readiness review, read-replica evaluation, Realtime concurrent-connection monitoring against real measured peak-window usage, and the first scheduled DR restore drill. This Epic is where the platform moves from "feature-complete" to "production-hardened at scale."

### 2. Business Goal
De-risk the platform for real-world growth and reduce operational surprises — this Epic exists specifically so that scaling problems are found and mitigated by the team on a schedule, not discovered by users during an incident.

### 3. Features Included
No new user-facing features — this Epic is exclusively hardening: performance, retention, security posture, and operational readiness across everything shipped in Epics 1–9.

### 4. Backend Modules
Jobs & Scheduling (per §33), cross-cutting hardening across every other module.

### 5. Database Tables Involved
`jobs.scheduled_job_runs`, `jobs.background_job_queue`, `jobs.idempotency_keys`; materialized views over `children` (attendance %), `staff_profiles` (rating), tenant billing summaries — layered over tables from every prior Epic, no new base tables.

### 6. Supabase Features Involved
Materialized views, `pg_cron` (remaining jobs), read-replica evaluation, partitioning readiness assessment, Realtime connection monitoring.

### 7. Edge Functions Required
None new — this Epic hardens existing functions (rate limiting, idempotency enforcement) rather than adding new ones.

### 8. RPC Functions Required
None new — idempotency-key checking is retrofitted onto every existing mutating RPC per the §2.2/§25.6 convention, verified Epic by Epic.

### 9. Storage Buckets Involved
None new — storage orphan cleanup job hardened across all existing buckets.

### 10. Realtime Channels Involved
All existing channels — this Epic adds concurrency monitoring, not new channels.

### 11. Background Jobs Involved
Idempotency-key purge, device-token invalidation (retrofit verification across all channels established in Epic 4).

### 12. Scheduled Jobs Involved
Staff rating recomputation, GPS ping retention purge (activated for real), storage orphan cleanup (activated for real), idempotency key purge, failed-login/session-anomaly sweep — every remaining job from §27 not already stood up in an earlier Epic.

### 13. External Integrations Involved
None new — this Epic verifies failover posture for existing integrations (WhatsApp/SMS secondary provider switch, per §31) rather than adding vendors.

### 14. Required Permissions
No new permission rows — this Epic verifies enforcement of every existing row under load and adversarial conditions.

### 15. Required RLS Policies
No new policies — full adversarial RLS regression suite re-run across every table in the system as a hard gate for this Epic.

### 16. API Groups
No new API groups — rate limiting and idempotency enforcement retrofitted across every existing group.

### 17. Dependencies on Previous Epics
All of Epics 1–9 (this Epic hardens the complete system).

### 18. Frontend Screens Affected
None directly — this Epic is invisible to end users by design (performance and reliability, not new features).

### 19. Acceptance Criteria
- Login and other rate-limited endpoints correctly throttle and lock out under a simulated brute-force pattern, across every environment.
- A full DR restore drill completes within the stated RTO target (§31) against a realistic data volume, not an empty database.
- Realtime concurrent-connection usage is measured against real (or realistically simulated) peak-window traffic and compared against Supabase's project ceiling, with a documented mitigation plan if headroom is thin.
- GPS ping retention purge and storage orphan cleanup run correctly against real accumulated data volume without locking contention that affects live traffic.

### 20. Test Scenarios
- Brute-force simulation against login and every other rate-limited RPC (`scan_pickup_pass`, OTP request, `ai_polish_note`).
- Full DR restore drill: restore `staging` from a production-scale synthetic backup, time the process, verify data integrity.
- Load test simulating realistic AM/PM peak-window Realtime concurrency across the full simulated tenant base.
- Materialized view refresh correctness and staleness-window verification (attendance %, staff rating) against known-good manually-computed values.
- Idempotency retrofit regression: replay a duplicate request against a sample of RPCs from every prior Epic, confirm no double-effects anywhere in the system.

### 21. Definition of Done
All acceptance criteria pass; DR drill documented with actual RPO/RTO figures achieved (not just targeted); Realtime concurrency headroom documented with a clear go/no-go for current tenant-growth trajectory; full adversarial RLS suite green across all ten Epics' tables in one combined run.

### 22. Estimated Complexity
**L**

### 23. Estimated Development Time
3 weeks

### 24. Estimated Testing Time
2 weeks — the largest testing allocation relative to development time of any Epic, reflecting its hardening purpose.

### 25. Risks
- **Scope-creep risk**: "hardening" can expand indefinitely — mitigated by scoping this Epic strictly to the items explicitly named in the architecture doc's §29/§30/§31 (materialized views, partitioning readiness, read-replica evaluation, Realtime concurrency, rate limiting, DR drill), with anything discovered beyond that scope logged as a follow-up Epic rather than expanding this one.
- **Realtime ceiling risk**: if the concurrency headroom check reveals a real problem, the mitigation (client-side connection pooling, or a Realtime tier upgrade) could require follow-on work beyond this Epic's estimate — mitigated by this being explicitly flagged as a possible scope trigger for a Epic 11 in the retrospective, not silently absorbed into this Epic's timeline.

### 26. Rollback Strategy
Every change in this Epic is either additive (materialized views, new indexes) or a config/threshold tuning change (rate limits, job schedules) — nothing here touches base-table schemas from prior Epics, so rollback is a config revert in the worst case.

### 27. Deployment Strategy
Rolled out incrementally within the Epic itself (each hardening item is independently toggleable/verifiable), culminating in a formal production-readiness review before declaring general availability.

### 28. Production Checklist
- [ ] DR restore drill completed with documented RPO/RTO
- [ ] Realtime concurrency headroom documented with go/no-go decision
- [ ] Rate limiting verified against brute-force simulation for every sensitive RPC
- [ ] Full cross-Epic adversarial RLS suite green
- [ ] Idempotency retrofit regression passed
- [ ] Materialized view correctness verified against manually-computed baselines
- [ ] **General availability sign-off**

---

## Appendix A — Cross-Epic Testing Discipline

Every Epic's Definition of Done requires re-running the **adversarial RLS suite** (one test per Permission Matrix row touched by that Epic, cumulative across all prior Epics) — this is a standing regression gate, not a one-time activity confined to Epic 1. By Epic 10, this suite covers the entire Permission Matrix (§12/§12.1) in one combined run, which is explicitly part of Epic 10's own Definition of Done.

## Appendix B — What this plan deliberately does not schedule
Per the frozen architecture's own explicitly-deferred items (§17 camera recording/playback, §18 geofencing, true GDPR-style tenant erasure in §8, multi-currency support in §5): none of these appear as Epics in this plan, on purpose. They are future-scoped work the architecture already flagged as intentionally out of v1 — introducing them here would contradict the frozen architecture rather than execute it.
