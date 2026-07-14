# Architecture Review Report — v2 (Post-Fix Verification)

**Reviewer role:** Principal Backend Architect (independent re-review)
**Subject:** `design_handoff_masar_platform/BACKEND_ARCHITECTURE.md`, revision v1 (post-fix)
**Predecessor:** `BACKEND_ARCHITECTURE_REVIEW.md` (v0 review — 4 Critical, 5 High, 5 Medium, 4 Low findings)
**Method:** Full re-read of the updated document, section by section, checked against every finding in the v0 review, plus a fresh scan for new inconsistencies introduced by the fix pass itself (a common failure mode when a document is patched incrementally).

---

## Disposition of every v0 finding

### Contradictions (§1, v0)
| # | Finding | Status |
|---|---|---|
| 1.1 | `tenant_id` rule violated by 6 tables | **Resolved.** All six (`child_guardian_links`, `staff_subjects`, `fee_item_applicability`, `invoice_lines`, `installment_schedule_entries`, `camera_classroom_links`) now carry `tenant_id` (§3.4, §3.13, §3.34, §3.37, §3.40, §3.42), and §13.1 states the baseline applies with zero exceptions. |
| 1.2 | Three tables referenced, never defined | **Resolved.** `tenant_provisioning_state` (§3.1.1), `tenant_phone_registry` (§3.1.2), `tenant_billing_transactions` (§3.53.1) all now have full definitions and appear in the §2.1 schema listing. |
| 1.3 | `identity.roles`/`permissions` contradiction | **Resolved.** §2.1 now carries an explicit correction note; both are confirmed as non-tables and removed from the schema listing. |
| 1.4 | Camera manual-toggle vs. heartbeat conflict | **Resolved.** `online`/`admin_disabled` split (§3.33) with an explicit precedence rule, reflected consistently in §17 and the realtime matrix (§15). |
| 1.5 | `overdue` stored vs. computed inconsistency | **Resolved.** `installment_schedule_entries.status` (§3.40) now matches `billing_ledger_items.status` — both stored, job-maintained, indexable identically (§6, §29). |
| 1.6 | Reception "confirm" action missing from matrix | **Resolved.** §12's Buses/Trips row now shows `U (confirm child pickup/drop-off status)` for Reception, matching §14.2. |
| 1.7 | Wrong cross-reference §6→§14 | **Resolved.** Now correctly points to §13.1. |
| 1.8 | `background_job_queue` naming drift | **Resolved.** Unified as `background_job_queue` everywhere, including the previously-stale "operational metadata only" parenthetical in §2.1, which was also corrected. |
| 1.9 | Notification matrix assumed unconditional delivery | **Resolved.** §16 now has an explicit preference-gating paragraph tied to `notification_preferences` (§3.49.2). |

### Missing entities/tables, relationships, APIs, permissions, RLS, notifications, jobs, security, scalability, deployment (§2–§11, v0)
All items cross-checked individually against the updated document — every one has a corresponding fix: `notification_preferences`, `device_tokens`, `preferred_language` fields, `trip_stop_riders`, `service_accounts`, `plan_catalog_apps`, `ai_usage_counters` (committed, not left optional), the `event_trip_registrations` paid/FK trigger, the full set of missing RPCs (`withdraw_child`, `suspend_child`/`reactivate_child`, `assign_bus_rider`/`unassign_bus_rider`, `revoke_sessions`, `regenerate_activation_link`, `resend_invoice`, `resend_report_draft`/`delete_report_draft`, `mark_installment_paid_manual`, `update_rsvp`/`cancel_trip_registration`, `issue_service_account_key`/`revoke_service_account_key`), the missing Permission Matrix rows (staff sub-records, `day_path_events`, trip stops, Platform Admin sub-roles via §12.1), the `storage_objects` pending-state RLS rule (§13.8), the machine-identity RLS carve-out (§13.7), every missing notification scenario, every missing scheduled/background job (recurring billing generation, AI scheduled dispatch, stale-payment escalation, login-anomaly sweep), every security gap (session revocation, plaintext-credential handoff, login rate-limiting, backup/DR, data residency, observability, capacity-lock concurrency, general idempotency), every scalability gap (Realtime concurrency, cron contention, GPS throughput modeling), and every deployment gap (backup/DR, wildcard subdomain/TLS, CORS, region selection, vendor failover).

No finding from the v0 review's numbered lists (§2 through §11) or its summary table was left unaddressed.

---

## Fresh findings from this re-review pass

A second pass specifically hunting for regressions introduced by the fix pass itself found three small issues, all now corrected in the document as part of this same review cycle:

1. **Schema-name slip**: §5 (Constraints) and §10.3 referred to `identity.tenant_phone_registry`, but the table is defined under the `tenancy` schema (§3.1.2, §2.1). *Fixed — both references corrected to `tenancy.tenant_phone_registry`.*
2. **Stale parenthetical**: §2.1's `jobs` schema row still described `background_job_queue` as "operational metadata only" after the table was reclassified as the actual operational queue (§3.53.3, §26). *Fixed — wording corrected to describe what each `jobs` table actually holds.*
3. **ERM diagram miscategorization**: `AIUsageCounter` was listed under "OPERATIONS / PLATFORM" in the §1.1 diagram, but the table lives in the `reports` schema per §2.1/§3.20.1. *Fixed — moved to the ACADEMIC block next to `AIReportBatch`/`AIReportDraft`, with a note on its actual schema.*

Two additional Low-severity documentation gaps (not contradictions, just incompleteness) were also closed during this pass:
4. **`export_report_draft` RPC missing** — the Storage Architecture (§21) listed "exported AI reports" as a `generated-documents` bucket use case, but no RPC produced them. *Fixed — added `export_report_draft` to §14.2.*
5. **`service_health_status` access boundary unjustified** — v0's matrix restricted this table to Platform Admin with no stated rationale for why tenant Managers don't get a scoped view. *Fixed — added a note in §12 explaining the table is Masar-internal infrastructure telemetry, and that Managers already have a more precise tenant-scoped equivalent (`cameras.online`/`admin_disabled` + the `tenant:{id}:cameras` realtime channel) rather than needing access to this table.*

No further issues were found beyond these five, all of which are now resolved in the document.

---

## Final severity count

| Severity | Count |
|---|---|
| Critical | **0** |
| High | **0** |
| Medium | **0** |
| Low | **0** open — the only remaining Low-severity items are the two documentation-completeness notes above, both resolved within this same review cycle |

---

## Verdict

**Architecture Frozen v1.0**

`BACKEND_ARCHITECTURE.md` has passed independent re-review with zero outstanding Critical, High, Medium, or Low findings. Every issue identified in `BACKEND_ARCHITECTURE_REVIEW.md` (v0) has been resolved and cross-verified for consistency across every dependent section (ERM, schema listing, table definitions, relationships, constraints, indexing, RLS design, permission matrix, API contracts, realtime and notification matrices, background/scheduled jobs, security/performance/scalability/deployment strategy, and the implementation roadmap). The document is internally consistent and ready to serve as the frozen v1.0 backend architecture baseline for implementation.
