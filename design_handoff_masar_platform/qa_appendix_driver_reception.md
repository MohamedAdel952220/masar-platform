# Product QA Appendix B — Driver App & Reception App (Full Raw Findings)

> Verbatim output from the dedicated sub-review of these two portals. Referenced by `PRODUCT_VALIDATION_REPORT.md`. Note: the sub-review's own summary tally (Critical: 5) does not perfectly match the sum of in-body severity labels (Critical: 4, since Finding 24 is labeled "High" in its own entry but was miscounted as Critical in the sub-review's summary) — the master report resolves this by trusting each finding's own stated severity.

---

## DRIVER APP

### Screen: TripScreen (main trip flow)

**1. Severity: Critical**
Portal: Driver App
Screen: TripScreen
Description: Tapping "Pick up"/"Drop off" for a student fires the parent notification immediately and irreversibly — there is no confirmation step, no undo, and no way to correct a mis-tap.
Business Impact: In a child-safety product, an errant "picked up" notification tells a parent their child is safely on the bus when they are not — or an errant "dropped off" notification could make a parent think their child was delivered home when they weren't. This is the single highest-risk interaction in the entire app.
Recommended Fix: Add a lightweight confirm step (e.g., press-and-hold, or a 1-tap confirm sheet showing the child's photo/name) before firing the notification, plus a short (5-10s) "Undo" toast after tapping.

**2. Severity: Critical**
Portal: Driver App
Screen: TripScreen
Description: No offline/connectivity handling anywhere in the trip flow. Start trip, per-child pickup, and arrival confirmation all assume network is instantly available; there's no queued/pending state, no retry indicator.
Business Impact: Drivers operate on buses moving through areas with poor cellular coverage. If a pickup confirmation silently fails to reach the backend, the parent never gets notified and the driver has no way of knowing — a serious custody/safety gap.
Recommended Fix: Add explicit sync states per action (pending/sent/failed), a persistent "X actions waiting to sync" indicator when offline, local queuing with auto-retry, and a manual retry affordance.

**3. Severity: High**
Portal: Driver App
Screen: TripScreen
Description: The "leg" toggle (AM pickup / PM drop-off) is only disabled once `started` is true, but there's no guard preventing the driver from starting the wrong leg (e.g., starting "PM drop-off" at 7am) — no time-of-day sanity check or warning.
Business Impact: A driver who fat-fingers the wrong leg toggle will send "dropped off" notifications for children who haven't even been to nursery yet, or vice versa.
Recommended Fix: Add a soft warning/confirmation if the selected leg doesn't match the expected time window.

**4. Severity: High**
Portal: Driver App
Screen: TripScreen
Description: There is no way to mark a child as "absent/no-show" or "not picked up" — the only path through a stop is "pick up," so a driver with a genuine no-show is stuck unable to progress past that stop without falsely marking the absent child as picked up.
Business Impact: A common everyday scenario (kid is sick, parent forgot) forces drivers to either falsely tap "picked up" for an absent child or get stuck unable to complete the route.
Recommended Fix: Add a "Mark absent / not at stop" secondary action per student that logs a distinct non-pickup event and lets the route continue.

**5. Severity: High**
Portal: Driver App
Screen: TripScreen
Description: The route/stop order is entirely static with no way to reorder stops, skip a stop, or handle a stop being unreachable (road closure, etc.).
Business Impact: Real bus routes get disrupted (traffic, road closures). A driver with no way to skip/reorder a stop is stuck following a route the backend already knows is stale.
Recommended Fix: Add a "skip stop" / "reorder" affordance, or clarify that GPS re-routing is automatic and reflected live.

**6. Severity: Medium**
Portal: Driver App
Screen: TripScreen
Description: Sibling grouping in the map collapses siblings into one pin, but the pickup flow still processes one child at a time as two full stop cycles, with no "confirm both siblings" bulk action.
Business Impact: Unnecessary friction and risk of the driver moving the bus before completing the second sibling's confirmation.
Recommended Fix: Present co-located children together with individual per-child confirm buttons or a "confirm all at this stop" option.

**7. Severity: Medium**
Portal: Driver App
Screen: TripScreen
Description: No "call nursery" or "call reception" quick action exists anywhere — only per-child "call parent."
Business Impact: In genuine emergencies (breakdown, accident, severe delay) the driver has no fast in-app way to alert the nursery/dispatch.
Recommended Fix: Add a persistent "Report issue" or "Call dispatch/nursery" button reachable regardless of trip phase.

**8. Severity: Medium**
Portal: Driver App
Screen: TripScreen
Description: The "LIVE" chip implies GPS broadcast is active, but there's no indicator of GPS signal strength/accuracy, nor handling for "GPS lost" or "location permission denied."
Business Impact: If GPS is unavailable, parents watching live tracking see a stale/frozen bus position with no explanation.
Recommended Fix: Add a GPS-lost banner/state on the driver's map, and a permission-check on trip start.

**9. Severity: Low**
Portal: Driver App
Screen: TripScreen
Description: "New trip" reset button appears after arrival is confirmed with nothing preventing accidental reset of the visual completion state.
Business Impact: Minor risk of confusion about whether the trip was actually recorded.
Recommended Fix: Disable/hide "New trip" for a few seconds after arrival, and make clear the completed trip is safely recorded in History.

### Screen: StudentsScreen

**10. Severity: Medium**
Portal: Driver App
Screen: StudentsScreen
Description: Manifest is entirely read-only with no student photo for identity verification, no pre-trip absence visibility, and no search/filter for larger rosters.
Business Impact: For larger buses, an unsearchable flat list is unwieldy, and without pre-trip absence visibility the driver can't plan around known no-shows.
Recommended Fix: Surface pre-marked absences on this screen and add search for larger rosters.

### Screen: HistoryScreen

**11. Severity: Medium**
Portal: Driver App
Screen: HistoryScreen
Description: Trip history entries are static/non-interactive with no per-trip drill-down (which children were on it, per-stop timestamps, incidents).
Business Impact: History as decoration rather than an audit trail undermines a safety product where "prove what happened and when" matters.
Recommended Fix: Make each history row tappable into a trip detail view with per-child timestamps and anomalies.

**12. Severity: Low**
Portal: Driver App
Screen: HistoryScreen
Description: No date filter, pagination, or "load more" — only 4 static rows shown.
Business Impact: Will need to handle potentially hundreds of trips over time.
Recommended Fix: Add date-range filtering and pagination/infinite scroll.

### Screen: DriverApp shell / Notifications panel

**13. Severity: Medium**
Portal: Driver App
Screen: DNotifPanel (bell icon sheet)
Description: The unread dot logic is permanently true after the first notification of the day and never clears — opening the panel doesn't mark items read.
Business Impact: A persistently "on" indicator trains drivers to ignore it, defeating its purpose.
Recommended Fix: Track a "last viewed" pointer, or don't show an unread badge on what is actually a sent-items log.

**14. Severity: High**
Portal: Driver App
Screen: DNotifPanel / whole app
Description: The bell/panel only shows outgoing notifications the driver triggered — there is no inbound notification/inbox for the driver (route changes, roster changes, admin announcements), yet Settings has toggles implying these categories should exist and be viewable.
Business Impact: Settings promises notification categories the app has no way to display.
Recommended Fix: Split into two panels/tabs: "Sent to parents" and "My notifications" (inbound admin/system alerts).

**15. Severity: Low**
Portal: Driver App
Screen: Trip/Bottom nav
Description: Profile avatar tap duplicates the bottom-nav Settings tab entry point with no differentiation.
Business Impact: Low — minor design consistency note.
Recommended Fix: Optional — keep as is, or make the avatar tap open a lighter "account quick menu."

### Cross-cutting / whole Driver App

**16. Severity: High**
Portal: Driver App
Screen: Whole app (login/logout, DriverApp shell)
Description: Logging out mid-trip silently resets trip progress to initial state with zero warning, even if a trip is in progress.
Business Impact: Accidental mid-route logout wipes visible pickup progress, risking duplicate/missed pickup confirmations on re-login.
Recommended Fix: Warn before logout if a trip is active, and persist/rehydrate trip state server-side rather than resetting client-side.

**17. Severity: Medium**
Portal: Driver App
Screen: DriverAuth (Login/Forgot password)
Description: OTP flow has no visible error state for a wrong code — any 4 digits proceed to reset.
Business Impact: Once wired to a real backend, incorrect/expired/lockout OTP states need real UX design, not just backend wiring.
Recommended Fix: Design an OTP-error state (incorrect code, attempts-remaining, lockout).

**18. Severity: Low**
Portal: Driver App
Screen: DriverAuth (Login)
Description: "Contact admin" text is styled as a link but has no `onClick` handler.
Business Impact: A locked-out driver has no actual path to reach admin from this touchpoint.
Recommended Fix: Wire to a real action or remove the link styling.

**19. Severity: Low**
Portal: Driver App
Screen: DriverSettings
Description: "Vehicle" section is a static read-only card with no maintenance/inspection status, no capacity-vs-roster comparison, no "report vehicle issue" action.
Business Impact: Capacity-checking is a stated backend feature but invisible to the driver.
Recommended Fix: Show roster count vs. seat capacity, and add a "report vehicle issue" action.

**20. Severity: Low**
Portal: Driver App
Screen: DriverSettings notifications
Description: Notification toggles are purely local UI state with no save confirmation/persistence indication.
Business Impact: Inconsistent feedback patterns; users can't tell if a preference actually saved.
Recommended Fix: Add the same toast/save-confirmation pattern used elsewhere in the app.

---

## RECEPTION APP

### Screen: ScanScreen (QR pickup verification)

**21. Severity: Critical**
Portal: Reception App
Screen: ScanScreen
Description: Scan result taxonomy is strictly binary (valid/invalid), collapsing the backend's four distinct outcomes (valid / invalid_expired / invalid_unknown / invalid_revoked) into one generic "Invalid code" screen. No differentiated messaging for a *revoked* pass — the most safety-critical case.
Business Impact: A revoked pass (custody dispute, fired nanny, restraining order) looks identical to a routinely-expired one. Reception staff need to react very differently (possible security alert vs. routine reissue) but the UI can't distinguish them.
Recommended Fix: Implement all four states with distinct visual treatment and instructions, including a one-tap "Alert admin" action for revoked passes.

**22. Severity: High**
Portal: Reception App
Screen: ScanScreen
Description: On a *valid* scan, no actual full-size ID/authorization photo is displayed for comparison — only a generic avatar — despite on-screen guidance explicitly telling staff to "match the ID photo to the person."
Business Impact: Without a real photo, the core point of "verify identity" is undermined; a stolen/borrowed valid QR code could pass with no strong photographic check.
Recommended Fix: Render an actual registered ID photo prominently once the backend supplies one, and add a "flag mismatch" action distinct from cancelling.

**23. Severity: High**
Portal: Reception App
Screen: ScanScreen
Description: No handling for a *valid* QR that's already been used today (duplicate pickup attempt) — the pass data model has no "already used" state.
Business Impact: A child could theoretically be "confirmed handed over" twice, or a second late-arriving authorized person waved through when the child already left.
Recommended Fix: Add a distinct "already picked up" result state (who, when) that blocks/warns before a second handover is confirmed.

**24. Severity: High**
Portal: Reception App
Screen: ScanScreen
Description: "Confirm handover" fires immediately with no secondary confirmation step, identical to the driver app's pickup-confirm issue.
Business Impact: A mis-tap or premature tap sends a false "your child was picked up by X" notification to a parent.
Recommended Fix: Add a brief confirm step or an undo window before the notification is dispatched.

**25. Severity: Medium**
Portal: Reception App
Screen: ScanScreen
Description: The "Simulate invalid code" button and random-pass-selection logic are demo scaffolding baked directly into the production-shaped component, with no camera permission flow, no camera-unavailable fallback, and no manual code-entry fallback.
Business Impact: Wiring to a real backend/camera will require substantial rework; no fallback exists for common real-world scenarios (dead phone, cracked screen, no smartphone).
Recommended Fix: Design a manual-entry fallback path alongside camera scanning, plus camera-permission-denied and camera-unavailable states.

**26. Severity: Medium**
Portal: Reception App
Screen: ScanScreen
Description: No offline handling — if reception's device loses connectivity mid-scan or mid-confirm, there's no indication the validation/confirmation succeeded or is queued.
Business Impact: A silently-failed sync means the parent never gets notified and the activity log has a gap.
Recommended Fix: Add pending/offline states with local queuing and retry.

**27. Severity: Low**
Portal: Reception App
Screen: ScanScreen
Description: "Cancel" on a valid result discards the whole scan with no logging that a valid pass was scanned but not completed.
Business Impact: No audit trail for near-miss/edge cases.
Recommended Fix: Optionally log cancellations distinctly for audit purposes.

### Screen: BusScreen (arrival/departure confirmation)

**28. Severity: Critical**
Portal: Reception App
Screen: BusScreen
Description: "Select all" is a single toggle with no bus picker/selector anywhere on the screen — only a static "Bus 3 · Mr. Tarek" header. If a nursery runs multiple buses, reception has no way to select which bus they're confirming, risking confirming arrivals against the wrong bus's roster and instantly notifying the wrong parents.
Business Impact: The exact "mis-tap select-all on the wrong bus" risk scenario, and the UI doesn't even present a bus-switcher to get it right in the first place.
Recommended Fix: Add an explicit bus selector before showing the child checklist, scope "Select all" visibly to the named bus, and add a final review step before confirming.

**29. Severity: High**
Portal: Reception App
Screen: BusScreen
Description: "Confirm arrival/departure & notify parents" fires immediately with all-children-checked as the only gate — no secondary "are you sure" before a bulk notification blast.
Business Impact: A single accidental tap sends real-time safety notifications to potentially dozens of parents with no undo.
Recommended Fix: Add a confirmation step summarizing "Notify N parents that their children have arrived/departed?"

**30. Severity: High**
Portal: Reception App
Screen: BusScreen
Description: The confirm button is disabled until literally every child is checked, with no path to confirm a *partial* arrival/departure (e.g., a child pre-marked absent that day).
Business Impact: A completely realistic scenario blocks reception from ever completing bus confirmation, forcing staff to either falsely check an absent child or leave the flow permanently incomplete.
Recommended Fix: Allow confirming with a subset checked, with an explicit "these N were NOT on the bus" summary, and don't require 100% to unlock confirm.

**31. Severity: Medium**
Portal: Reception App
Screen: BusScreen
Description: No discrepancy-handling if reception's physical count doesn't match the driver's own confirmed manifest — no cross-reference or reconciliation step at all.
Business Impact: A gap between "children who boarded" (driver-confirmed) and "children who got off" (reception-confirmed) is exactly the kind of gap that matters most for child safety (a child left on the bus).
Recommended Fix: Cross-reference the driver's confirmed roster against reception's count in real time, with a hard warning on divergence.

**32. Severity: Medium**
Portal: Reception App
Screen: BusScreen
Description: Switching the arrival/departure mode toggle wipes any in-progress checklist with no warning.
Business Impact: Real risk of data-loss during a time-pressured task.
Recommended Fix: Warn before switching modes if any children are already checked.

**33. Severity: Low**
Portal: Reception App
Screen: BusScreen
Description: "New count" reset after a completed confirmation gives no indication of whether it starts a genuinely new bus event or risks re-triggering notifications for the same event.
Business Impact: Low-moderate risk of duplicate notification triggers if staff misunderstand the reset.
Recommended Fix: Clarify copy and/or require picking which bus a new count is for.

### Screen: RHomeScreen

**34. Severity: Medium**
Portal: Reception App
Screen: RHomeScreen
Description: "On site" stat card shows a hardcoded value (24) with no connection to any real data model.
Business Impact: A hardcoded, never-changing headcount that looks live is misleading and matters for safety/fire-drill accountability.
Recommended Fix: Wire to a real running count of children checked in but not yet checked out.

**35. Severity: Low**
Portal: Reception App
Screen: RHomeScreen
Description: "Recent activity" shows only 5 recent entries with no "view all" link to the full Log tab.
Business Impact: Minor navigation friction.
Recommended Fix: Add a "View all" link to the Log tab.

### Screen: LogScreen

**36. Severity: Medium**
Portal: Reception App
Screen: LogScreen
Description: Flat, unfiltered, unsearchable list with no date grouping, type filter, or per-entry drill-down.
Business Impact: As the audit trail for custody events, this needs to support after-the-fact investigation (a parent disputes who picked up their child) — a flat unsearchable feed is inadequate.
Recommended Fix: Add filters (type/date/child), search, and per-entry drill-down.

**37. Severity: Low**
Portal: Reception App
Screen: LogScreen / RHomeScreen
Description: Log and notifications both reset to empty on logout — a demo artifact confirming neither is backed by real persistence in the current design.
Business Impact: Per-session data loss is unacceptable for an audit log.
Recommended Fix: Ensure log/notifications are fetched from backend per-session, not reset on logout.

### Cross-cutting / whole Reception App

**38. Severity: Medium**
Portal: Reception App
Screen: Whole app / RNotifPanel
Description: "Sent notifications" panel only shows the two bulk bus notifications — pickup/handover confirmations from the scan flow are never logged there.
Business Impact: Inconsistent/incomplete audit trail — staff reviewing "sent notifications" get a false sense of what's been communicated to parents.
Recommended Fix: Wire scan-confirm to also push into the notifications panel.

**39. Severity: Medium**
Portal: Reception App
Screen: Cross-app naming
Description: Terminology is inconsistent between Driver and Reception apps for the same concept (bus arrival), and confirm-action labels differ with no visible reconciliation between the two apps' independent confirmations of the same event.
Business Impact: Real product-cohesion issue; reduces trust and increases training/support burden.
Recommended Fix: Standardize terms across both portals via a shared copy/terminology guide.

**40. Severity: Medium**
Portal: Reception App
Screen: Whole app (logout mid-flow)
Description: Logging out while mid-scan or mid-count silently wipes in-progress state with no warning.
Business Impact: A receptionist mid-handover-confirmation who is logged out loses in-progress custody-sensitive workflow state with no recovery path.
Recommended Fix: Warn before logout if a scan/count is in progress, and persist state server-side.

**41. Severity: Low**
Portal: Reception App
Screen: ReceptionAuth / ReceptionSettings
Description: Same "Contact admin" dead link and OTP-error-taxonomy gaps as the driver app.
Business Impact: Same as driver app.
Recommended Fix: Same fix as driver app, ideally via a shared component given the near-identical auth gates.

**42. Severity: Low**
Portal: Reception App
Screen: ReceptionSettings
Description: "Visitor alerts" notification toggle has zero corresponding screen or workflow anywhere else in the app (no visitor log/check-in flow).
Business Impact: A settings toggle promising an unbuilt feature category is either scope creep or dead configuration.
Recommended Fix: Build a minimal visitor check-in/log screen to match, or remove the toggle.

---

## Cross-Portal / Backend-Alignment Findings

**43. Severity: High**
Portal: Both
Screen: DriverApp TripScreen / ReceptionApp BusScreen
Description: The backend separates "run AM/PM legs" (driver) from "bus arrival/departure bulk confirmation" (reception) as two independent confirmation sources for the same physical event. Neither app shows any awareness of the other side's confirmation status.
Business Impact: Two independently-confirming, non-cross-referencing systems for the same safety event risks duplicate or conflicting parent notifications.
Recommended Fix: Define which confirmation is authoritative/parent-facing, or merge into one event with two contributing confirmations, surfacing the other party's status in each app.

**44. Severity: Medium**
Portal: Both
Screen: Whole apps
Description: Neither app has a way to see or search today's roster changes/exceptions (one-off address changes, temporary pickup-authorization exceptions) — all data is static/hardcoded with no "last synced" indicator or refresh mechanism.
Business Impact: Given rosters/authorizations are admin/parent-set, both apps need clear "this data may be stale" affordances.
Recommended Fix: Add a visible "last synced" indicator and pull-to-refresh on manifest/roster screens.

---

## Summary (as assessed by this sub-review)

Total distinct findings: 44 (Critical: 4 by in-body label / 5 per the sub-review's own summary tally — see note at top; High: ~13; Medium: 17; Low: 12)

**Gut assessment — Production readiness:**
- **Driver App: ~55%.**
- **Reception App: ~45%.**
