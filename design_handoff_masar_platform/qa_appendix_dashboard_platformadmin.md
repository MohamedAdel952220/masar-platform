# Product QA Appendix C — Nursery Dashboard & Platform Admin (Full Raw Findings)

> Verbatim output from the dedicated sub-review of these two portals. Referenced by `PRODUCT_VALIDATION_REPORT.md`.

---

## NURSERY DASHBOARD

### Cross-cutting / Shared (DForms, Bus, Children, Teachers)

**Severity: Critical**
**Portal:** Nursery Dashboard
**Screen:** Shared account-creation flow (`DForms.AccountCreatedDialog`, `DForms.makeAccount`, `DashboardBus.DriverCredentials`) — used by Children (parent account), Teachers/Reception (staff account), Bus (driver account)
**Description:** Every "account created" flow generates a plaintext password client-side (`genPassword()`) and displays it in the UI ("Temporary password: XXXX-XXXX"), with buttons to share it raw via WhatsApp, SMS, or copy-to-clipboard. True for parent, teacher/reception, and driver accounts alike.
**Business Impact:** Directly contradicts the frozen backend design (activation-link provisioning, never a plaintext password). Naive wiring would leak credentials into WhatsApp/SMS logs, clipboard history, and screenshots — a serious security/compliance regression for a product handling child-safety data.
**Recommended Fix:** Replace the "temporary password" pattern everywhere with an "activation link sent" confirmation (no secret shown in the UI). Share actions should send/copy an invite link, not a password. Apply identically to `AccountCreatedDialog`, `DForms.makeAccount`, and `DriverCredentials`.

**Severity: High**
**Portal:** Nursery Dashboard
**Screen:** All list/table views (Children, Teachers, Payments, Attendance, Cameras, Bus, Reports history, Approvals)
**Description:** No pagination, virtualization, or "load more" exists anywhere — every table renders the full in-memory array.
**Business Impact:** A real nursery with 94+ children or a term's worth of payment history will produce unbounded DOM tables, hurting performance and usability.
**Recommended Fix:** Add pagination/infinite-scroll plus server-side filtering to Children, Teachers, Payments, Reports history, and similar lists before backend integration.

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** All async actions (save child/teacher/bus/camera, send report, notify parents, mark payment, etc.)
**Description:** No loading/spinner state for any mutation — `masar-ui.jsx` has no skeleton/spinner primitive; every save handler mutates local state synchronously with an instant toast.
**Business Impact:** Real API latency and failure (network drop, validation error, timeout) aren't modeled; users may believe an action succeeded when it will actually fail once wired to a real backend.
**Recommended Fix:** Add a shared loading/disabled-button state and a shared error-toast/error-banner primitive so every save/send/notify flow can show pending + failure states.

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** `DashboardViews.jsx` (dead/duplicate `BusView`, `TeachersView`, `ClassroomsView`, `ReportsView`)
**Description:** `DashboardViews.jsx` defines full alternate implementations of four core screens with different (older, hardcoded, non-interactive) data. These are silently shadowed at runtime only because of file load order (later files reassign the same globals).
**Business Impact:** Fragile — a load-order change would silently revert four core screens to non-functional versions with no warning. Also dead code bloating the bundle today.
**Recommended Fix:** Delete the duplicate view definitions from `DashboardViews.jsx`, keeping only `ApprovalsView` and `AnnounceModal`.

---

### Overview

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Overview
**Description:** The topbar global search field has no `onChange`/state wired — inert on every screen.
**Business Impact:** Users will type a query expecting global search and get nothing — reads as broken rather than absent.
**Recommended Fix:** Either wire real global search (children/staff/payments) or remove the input until implemented.

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Overview → Notifications panel
**Description:** "Mark all read" has no `onClick`; the bell's unread dot never clears after opening the panel.
**Business Impact:** Minor but visible dead control.
**Recommended Fix:** Wire "Mark all read" to clear notification state and the bell badge.

---

### Approvals

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** Approvals
**Description:** Approve/Reject are instant one-click actions with no confirmation, and no way to attach a rejection reason for the teacher.
**Business Impact:** A misclick rejects a legitimate request with no undo and no explanation delivered to the requesting teacher.
**Recommended Fix:** Add a confirm (at least for Reject) with an optional reason field attached to the teacher notification.

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Approvals → exam paper preview
**Description:** "Download" button in the preview modal has no handler.
**Business Impact:** Dead button in a core verification workflow.
**Recommended Fix:** Wire to real file download once backend storage exists, or hide until implemented.

---

### Children

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** Children → Add/Edit child form
**Description:** No format validation for phone/national ID, no DOB sanity check, no duplicate-enrollment detection.
**Business Impact:** Bad data enters records that drive billing, bus routing, and emergency contacts — real safety and financial consequences.
**Recommended Fix:** Add format validation, DOB range check appropriate to age bands, and duplicate-enrollment warning.

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Children → profile drawer
**Description:** "Suspend" confirm-dialog copy asserts a specific parent-side behavior ("parents keep app access but child is marked inactive") that the Dashboard can't itself verify is what the Parent app actually shows.
**Business Impact:** Risk of staff giving parents guarantees that don't hold if the two sides diverge.
**Recommended Fix:** Confirm and document the exact suspended-state parent experience, adjust copy to match reality.

---

### Teachers / Reception

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** Teachers → Remove teacher
**Description:** Removing a teacher immediately unassigns their classes with no reassignment/substitute-teacher flow (contrast with "Schedule leave," which does support a covering teacher).
**Business Impact:** Removing an active teacher silently orphans their classes/subjects, surfacing as "no teacher" states elsewhere the next day.
**Recommended Fix:** Require picking replacement coordinators/subject owners on teacher removal, mirroring the leave flow's covering-teacher concept.

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Teachers → work report
**Description:** "Export report" button has no handler.
**Business Impact:** Dead control in a feature HR/managers would rely on for reviews.
**Recommended Fix:** Wire to PDF/CSV export or hide until implemented.

---

### Classrooms

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Classrooms → capacity bar
**Description:** Capacity visualization is derived from a static seeded count, not kept in sync with the live Children roster.
**Business Impact:** Manager sees an out-of-date "seats free" number, risking over-enrollment past physical/legal capacity.
**Recommended Fix:** Derive classroom occupancy live from the children list filtered by classroom.

---

### Cameras

**Severity: High**
**Portal:** Nursery Dashboard
**Screen:** Cameras
**Description:** Cameras have a single boolean `online` flag toggled by one menu action, conflating device reachability with an administrator's explicit disable override — no way to represent "hardware online but admin-disabled" vs. "hardware unreachable."
**Business Impact:** The backend's explicit two-state model is collapsed into one. Staff can't distinguish "camera is broken" from "camera is intentionally off," and the Parent-app-visible feed can't be correctly gated either.
**Recommended Fix:** Split into two independent fields (device reachability + admin-disabled flag), show both distinctly, and gate the parent-visible feed on "online AND NOT admin-disabled."

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** Cameras → Add/Edit camera form
**Description:** No validation on the Stream IP/RTSP field beyond non-empty, no duplicate-IP detection.
**Business Impact:** Typo'd stream addresses silently produce broken feeds discovered only when someone tries to view them.
**Recommended Fix:** Add IP/RTSP URL format validation and duplicate-address warning.

---

### Attendance

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** Attendance
**Description:** "Notify all" (bulk, every parent in the school) has no confirmation, while narrower per-classroom "Notify parents" actions do use a confirm dialog — inverted risk-to-friction ratio.
**Business Impact:** The riskiest/broadest version of the action is the one with no safety check.
**Recommended Fix:** Add a confirm dialog to "Notify all," showing the recipient count.

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Attendance → date picker
**Description:** No visible path to correct a mistaken past attendance record.
**Business Impact:** Staff who mis-marked attendance have no documented correction path.
**Recommended Fix:** Either explicitly state attendance is immutable after send, or add an edit/correction flow with an audit trail.

---

### Bus

**Severity: High**
**Portal:** Nursery Dashboard
**Screen:** Bus → Add bus / rider assignment
**Description:** Capacity-locking prevents growth past capacity, but reducing a bus's declared capacity below its already-assigned rider count is not blocked or reconciled.
**Business Impact:** A manager could shrink capacity below actual assigned riders, producing an inconsistent "16/10 seats" state with no forced reassignment.
**Recommended Fix:** When editing capacity down, block the save (or force de-selecting excess riders) if assigned riders exceed the new capacity.

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** Bus → fleet overview
**Description:** "Add route" terminology in the dead `DashboardViews.BusView` implies a routes-vs-buses model the live `BusView` doesn't have (a bus IS the route) — naming inconsistency between live and dead code.
**Business Impact:** Minor; resolved automatically once dead code is deleted (see cross-cutting finding).
**Recommended Fix:** Resolved by deleting the dead `DashboardViews.BusView`.

---

### Payments

**Severity: High**
**Portal:** Nursery Dashboard
**Screen:** Payments → Installment plan / invoice drawer
**Description:** "Mark paid" is a single undifferentiated state flip with no distinction between manual cash collection, bank transfer, or gateway callback, and no "pending verification" state anywhere.
**Business Impact:** Direct gap against the backend's required reconciliation design (manual cash-marking distinct from gateway/bank verification; stale pending-verification payments must be findable). Financial reconciliation can't be built cleanly on top of this UI as-is.
**Recommended Fix:** Add a payment-method/verification-source field when marking paid (Cash / Bank transfer / Gateway), record who marked it, and add a "Pending verification" tab/filter.

**Severity: Medium**
**Portal:** Nursery Dashboard
**Screen:** Payments → Fee items
**Description:** Deleting a fee item removes it immediately with only a menu click — no confirmation, unlike every other destructive action in this portal.
**Business Impact:** Accidentally deleting a revenue-critical line item (e.g., "Monthly Tuition") for every enrolled family with a single misclick and no undo.
**Recommended Fix:** Route fee-item deletion through the same `ConfirmDialog` pattern used elsewhere in this portal.

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Payments → Invoice drawer
**Description:** "Download," "Notify price to parents," and similar flows are all faked with instant toasts, indistinguishable from a real network call.
**Business Impact:** Several critical financial actions have no error path modeled.
**Recommended Fix:** Covered by the cross-cutting loading/error-state recommendation.

---

### AI Reports

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** AI Reports → Delete report
**Description:** Deleting a sent/scheduled batch has a confirm dialog, but no way to notify parents that an already-sent report was retracted.
**Business Impact:** If a report was sent in error and then deleted, parents who already received it are never informed of a correction.
**Recommended Fix:** For already-sent batches, either disable delete or add a "notify parents this report was retracted" option.

---

### Settings

**Severity: Low**
**Portal:** Nursery Dashboard
**Screen:** Settings → Change password
**Description:** "Current password" field has no failure-state modeling — the flow always succeeds once new/confirm fields validate.
**Business Impact:** No failure path modeled, consistent with the cross-cutting error-state finding.
**Recommended Fix:** Add an error state for incorrect current password once backend-connected.

---

## PLATFORM ADMIN

### Cross-cutting / Identity & Permissions

**Severity: Critical**
**Portal:** Platform Admin
**Screen:** Entire app (`PlatformAdmin.jsx`, `PlatformAuth.jsx`)
**Description:** No representation whatsoever of the three-tier permission model (owner/admin/support). Login is a single generic form with no role selection; post-login the sidebar hardcodes the identity as "Tarek Owner"/"Platform Owner" with no branching logic. Every nav item and every destructive action (suspend, reactivate, plan changes, refunds) is rendered and enabled identically regardless of who "logged in."
**Business Impact:** The single most severe finding in either portal. The backend's explicit least-privilege design (support = read-only/triage, cannot suspend/change plans/refund) has zero frontend representation — risk of a broken/confusing experience for non-owner admins, or worse, a real support-agent-overreach risk if any endpoint is under-guarded server-side.
**Recommended Fix:** Model an explicit `role` on the authenticated Platform Admin user. Gate suspend/reactivate/plan-change/refund/broadcast controls behind role checks; for `support` role, render those controls as disabled/hidden with a "requires admin access" affordance. Add a role indicator in the sidebar.

---

### Schools

**Severity: Critical**
**Portal:** Platform Admin
**Screen:** Schools → School detail drawer (`SchoolDetail`)
**Description:** "Suspend" a tenant is a single click with zero confirmation dialog, unlike the Nursery Dashboard, which consistently confirms comparably (or far less) destructive actions.
**Business Impact:** Suspending a tenant instantly and irreversibly (from the UI's perspective) cuts off an entire paying customer's operations — Dashboard, Parent app, Teacher app, Driver app — with a single misclick and no undo. The highest-blast-radius action in the whole system has the least friction protecting it.
**Recommended Fix:** Add a confirmation step (school name typed or explicit "yes, suspend X") before suspend, mirroring the Dashboard's own established pattern for far lower-stakes deletions.

**Severity: High**
**Portal:** Platform Admin
**Screen:** Schools → Add school wizard, step 3 (Provision)
**Description:** No credentials/activation-link display or explicit "invite sent" confirmation for the new tenant's owner account — provisioning silently assumes success with no failure path and no positive confirmation of how the owner will get access.
**Business Impact:** Ambiguous whether/how the new tenant's owner actually receives sign-in access; guaranteed "I can't log in" support tickets with no way to check what was sent.
**Recommended Fix:** Add an explicit confirmation step/toast stating an activation email was sent to the owner's address.

**Severity: Medium**
**Portal:** Platform Admin
**Screen:** Schools list / detail
**Description:** No refund action exists anywhere, despite refunds being an explicitly stated backend billing capability.
**Business Impact:** A stated backend capability has no corresponding UI; finance/support refund workflows have no home in the product.
**Recommended Fix:** Add a refund action (owner/admin-gated) in the school billing panel or Billing tab, with amount, reason, and confirmation.

**Severity: Low**
**Portal:** Platform Admin
**Screen:** Schools → filter/search
**Description:** Search only matches school name, not city, contact, slug, or email.
**Business Impact:** Minor friction for support/ops staff who often search by contact person or domain.
**Recommended Fix:** Broaden search to match contact, email, slug, and city.

---

### Billing

**Severity: Medium**
**Portal:** Platform Admin
**Screen:** Billing
**Description:** "Collect" only sends an invoice/notice — no way to record that a payment was actually received against a tenant's subscription balance.
**Business Impact:** Real payments would have to be reconciled outside this screen, defeating its purpose as a billing command center.
**Recommended Fix:** Add a "Record payment" action on overdue rows (owner/admin-gated) that reduces the balance and updates payment status.

---

### Support Tickets

**Severity: Medium**
**Portal:** Platform Admin
**Screen:** Support
**Description:** No assignment field/action exists, despite "assign" being an explicitly stated backend ticket capability — status transitions implicitly conflate "I'm working on it" with formal assignment.
**Business Impact:** With multiple support/admin staff, there's no way to see who owns a ticket, leading to duplicate work or orphaned tickets.
**Recommended Fix:** Add an explicit "Assignee" field/column and an "Assign to…" action distinct from status changes.

**Severity: Low**
**Portal:** Platform Admin
**Screen:** Support
**Description:** No search/filter by school or ticket ID, only by status tab.
**Business Impact:** Becomes painful once ticket volume grows across many tenants.
**Recommended Fix:** Add a search box (ticket ID, school name, subject).

---

### System Health

**Severity: Low**
**Portal:** Platform Admin
**Screen:** System health
**Description:** No "down" state example is ever exercised, and the hero banner's degradation copy is hardcoded to name one specific service rather than generalized.
**Business Impact:** If multiple services degrade simultaneously, or a true "down" state occurs, the hero banner's copy would be wrong/misleading.
**Recommended Fix:** Generalize the hero banner to dynamically enumerate all non-"up" services.

---

### Broadcast

**Severity: Medium**
**Portal:** Platform Admin
**Screen:** Broadcast
**Description:** Audience segmentation recipient counts are hardcoded, disconnected from the actual live schools/overdue/trial data shown elsewhere in the app.
**Business Impact:** The recipient count shown before sending a broadcast can simply be wrong — dangerous for a feature whose entire value is knowing exactly who receives it.
**Recommended Fix:** Derive audience counts live from the shared schools state used by Overview/Schools/Billing.

**Severity: Low**
**Portal:** Platform Admin
**Screen:** Broadcast
**Description:** No history of past broadcasts is retained/shown, unlike the Dashboard's AI Reports history pattern.
**Business Impact:** Platform operators can't audit what was broadcast to schools previously.
**Recommended Fix:** Add a broadcast history list similar to the Dashboard Reports-history pattern.

---

### Audit Log

**Severity: Low**
**Portal:** Platform Admin
**Screen:** Audit log
**Description:** Client-side search over a fixed small seed array with no date-range filter, no actor filter, no pagination — for what is meant to be the platform's compliance/security record.
**Business Impact:** Undermines its purpose as a compliance tool once real entry volume exists.
**Recommended Fix:** Add date-range and actor filters, and server-side pagination.

---

## Summary (as assessed by this sub-review)

**Total findings: 27** — Critical: 3, High: 5, Medium: 12, Low: 7

**Gut assessment — Production readiness:**
- **Nursery Dashboard: ~55%.**
- **Platform Admin: ~35%.**
