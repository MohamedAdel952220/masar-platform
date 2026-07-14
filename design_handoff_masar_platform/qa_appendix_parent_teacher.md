# Product QA Appendix A — Parent App & Teacher App (Full Raw Findings)

> Verbatim output from the dedicated sub-review of these two portals. Referenced by `PRODUCT_VALIDATION_REPORT.md`. Severity, Portal, Screen, Description, Business Impact, Recommended Fix are as originally assessed per finding.

---

# Masar — Senior Product QA / UX Audit
## Parent App & Teacher App

---

## PARENT APP

### Screen: Auth (Splash / Onboarding / Login / Forgot Password) — `ParentAuth.jsx`

**Severity:** High
**Portal:** Parent App
**Screen:** Login
**Description:** Login has no error state at all. Entering any phone (≥10 digits) and password (≥4 chars) enables the "Sign in" button and `onLogin` fires unconditionally — there's no concept of wrong credentials, locked accounts, or "phone not registered."
**Business Impact:** Once wired to a real backend, invalid-credential handling, rate limiting/lockout, and account-not-found messaging are completely unspecified in the UI. This is a day-one requirement, not an edge case.
**Recommended Fix:** Add an inline error state below the password field for "incorrect phone or password," a locked-account state after N attempts, and a "no account found" state distinguishing from wrong password.

**Severity:** Medium
**Portal:** Parent App
**Screen:** Forgot Password (OTP step)
**Description:** OTP entry accepts any 4 digits with no concept of an incorrect code — `setStep('reset')` fires as soon as 4 digits are typed. Resend timer resets to 45s locally with no real request being simulated.
**Business Impact:** Wrong-OTP handling, resend abuse throttling, and max-attempt lockout are unaddressed; this is a common attack surface for account-recovery flows.
**Recommended Fix:** Add invalid-OTP messaging, an attempts counter, and a hard lockout/cooldown state.

**Severity:** Low
**Portal:** Parent App
**Screen:** Login
**Description:** "Contact your nursery" (no account) is a plain unclickable-looking span with no `onClick` — a dead link.
**Business Impact:** New parents without existing credentials have no actual path to onboard themselves; they hit a wall.
**Recommended Fix:** Wire it to a real contact/support flow, or clarify that nursery admin issues accounts (no self-service signup), and give a concrete CTA (call/WhatsApp support).

**Severity:** Low
**Portal:** Parent App
**Screen:** Onboarding
**Description:** No progress persistence — user data entered (e.g., phone in Forgot Password) is lost if the app is killed mid-flow; no "remember me" or biometric login option is offered anywhere.
**Business Impact:** Parents will re-enter phone+password every session; competitor apps typically offer biometric/session persistence, and this is a needed baseline expectation in 2026.
**Recommended Fix:** Specify session persistence and biometric unlock (Face ID / fingerprint) requirements to the backend/security team before build.

---

### Screen: Home — `ParentApp.jsx`

**Severity:** Medium
**Portal:** Parent App
**Screen:** Home (Day path)
**Description:** "Updated 10:24" timestamp is hardcoded and never changes regardless of real time or data state; there's no loading indicator anywhere in the whole app — every screen renders as if data arrived instantly.
**Business Impact:** Once connected to live data with real network latency, users will see stale/frozen content with no way to tell if the app is fetching, has failed, or is genuinely idle. This is a core trust issue for a child-safety product.
**Recommended Fix:** Add a shared skeleton/loading state component (referenced nowhere in `masar-ui.jsx`) and a real "last updated" timestamp bound to actual data-fetch events, plus pull-to-refresh.

**Severity:** High
**Portal:** Parent App
**Screen:** Home / global
**Description:** No error/offline state exists anywhere in the app. No component handles network failure, timeout, or empty API responses gracefully (aside from a couple of manually seeded "empty" cards like "No passes yet"). If backend calls fail, there is no defined UI.
**Business Impact:** Parents rely on this app for child-safety-critical info (bus location, pickup, camera). Silent failures or blank screens on network loss will erode trust and generate support burden.
**Recommended Fix:** Define and build a standard error/retry component and an offline banner pattern; apply consistently across Home, Bus, Cameras, Payments, Chat.

**Severity:** Medium
**Portal:** Parent App
**Screen:** Home (Quick actions / schedule)
**Description:** "Today's schedule → All" link (`action={ar?'الكل':'All'}`) in `SectionTitle` has no `onAction` handler wired — clicking does nothing.
**Business Impact:** Dead UI element that implies a fuller schedule view exists but doesn't; users will click and get no feedback.
**Recommended Fix:** Either implement a full-schedule detail view or remove the "All" affordance until built.

---

### Screen: Cameras — `ParentApp.jsx`

**Severity:** Medium
**Portal:** Parent App
**Screen:** Cameras / Camera modal
**Description:** No indication of stream failure/buffering. Volume and Maximize buttons in `CameraModal` have no `onClick` handlers at all — pure decoration.
**Business Impact:** Live camera is a headline safety feature; a broken/hanging feed with no error affordance ("camera offline," "reconnecting…") will alarm parents. Dead mute/fullscreen buttons are confusing UI debt once video is wired.
**Recommended Fix:** Wire real playback controls or explicitly mark them TODO for backend integration; add a stream-error state distinct from the "Offline" (camera hardware down) state already shown in the grid.

**Severity:** Low
**Portal:** Parent App
**Screen:** Cameras
**Description:** Only 4 fixed cameras per child, hardcoded per-child in `CHILDREN` data; no way to know how many classroom cameras a real nursery has, no pagination/scroll pattern considered for nurseries with more cameras/zones.
**Business Impact:** Real nurseries will have variable camera counts; a fixed 2-column grid with no scroll/pagination spec risks breaking layout at scale.
**Recommended Fix:** Design the grid to handle N cameras gracefully (scroll, filter by zone, or "favorite cameras" concept).

---

### Screen: Bus Tracking — `ParentApp.jsx`

**Severity:** Critical
**Portal:** Parent App
**Screen:** Bus Tracking
**Description:** The entire bus screen is driven by a manual "Simulate the day" Prev/Next stepper (`BUS_PHASES`, `setPhaseIdx`) that the **parent controls themselves** — this is presentation-only scaffolding with no analog to real backend push events (bus GPS ping, driver confirmation, reception confirmation). There is no concept of what happens if the driver never confirms boarding, or the bus is delayed/breaks down.
**Business Impact:** This is the single highest-stakes feature in the app (child safety, live GPS). The demo stepper reveals that real-time state transition logic (WebSocket/polling triggers, delay/incident states, "no bus today" state) has not been designed at all — this will require significant rework once wired to real telemetry.
**Recommended Fix:** Before backend integration, design real state-transition triggers (push notification-driven), a delay/incident state, a "driver hasn't started trip" state, and remove the manual stepper from production builds (dev-only toggle).

**Severity:** High
**Portal:** Parent App
**Screen:** Bus Tracking
**Description:** No "child not on bus today" (e.g., parent drop-off day) state. `BUS_PHASES` assumes every child takes the bus both ways, every day. Multi-child households — where one child rides the bus and the other doesn't — aren't modeled either.
**Business Impact:** Many nursery families use bus for pickup only, or not at all on some days. Building the whole tracking screen around a single fixed daily bus itinerary will require rework to support per-day/per-leg opt-outs.
**Recommended Fix:** Model bus usage per child per leg (AM/PM) as data-driven, with a clear "not using bus today" screen state.

**Severity:** Medium
**Portal:** Parent App
**Screen:** Bus Tracking
**Description:** "Call" button next to the driver has no `onClick` — doesn't call `tel:` or open a dialer.
**Business Impact:** In an urgent situation (child not on bus, wrong stop), a non-functional call button is a real safety gap in the design intent.
**Recommended Fix:** Wire to `tel:` link with the driver's actual number (masked/proxied per privacy policy).

---

### Screen: Pickup Pass — `ParentApp.jsx`

**Severity:** High
**Portal:** Parent App
**Screen:** Pickup Pass (QR)
**Description:** The QR "expires in 04:58" countdown is a static string — it never actually counts down, and there's no visible expiry policy control (the backend context specifies "with relation type, ID photo, expiry" but the UI never lets the parent set or see a real expiry duration/date). There's also no way to revoke/deactivate an already-generated pass early, and no history of past (expired/used) passes — only "Active"/"Expired" badges with no audit trail.
**Business Impact:** This is a security-critical cross-portal flow (parent creates pass → reception scans it). A pass with a fake, non-functioning countdown and no revoke option is a real safety loophole once connected to reception scanning — a lost phone showing an "active" QR with no remote revoke is a serious risk.
**Recommended Fix:** Add real-time countdown bound to actual expiry timestamp from backend, a "Revoke pass" action, and a full history list of passes (used/expired/revoked) with timestamps of when/where scanned (ties to reception scan event).

**Severity:** Medium
**Portal:** Parent App
**Screen:** Pickup Pass
**Description:** No indication anywhere of what happens after the pass is scanned at the gate (no "used" status, no notification confirming the authorized person actually picked up the child). This is the parent-side half of a cross-portal flow whose confirmation loop is entirely missing.
**Business Impact:** Parents create a pass then get no visibility into whether/when the pickup happened — undermining the core safety value proposition of the QR pass feature.
**Recommended Fix:** Add a "Pass used — picked up by [X] at [time]" notification/state pushed back from reception scan, visible in the pass detail and in the notification center.

**Severity:** Low
**Portal:** Parent App
**Screen:** Pickup Pass (Create)
**Description:** No relation-type-specific validation or duplicate-person detection; ID photo has no minimum quality/size check, and there's no field to specify per-pass validity window (single day vs recurring authorized person like a nanny).
**Business Impact:** Real use cases include recurring pickup by a nanny/driver vs one-off pickup by a rarely-seen relative — treating all passes as generic "single use" (per `PassView`'s hardcoded "Single use" Type row) doesn't match real business needs described in the backend spec.
**Recommended Fix:** Add a pass-type selector (one-time vs standing authorization) and basic photo validation.

---

### Screen: Payments — `ParentPayments.jsx`

**Severity:** High
**Portal:** Parent App
**Screen:** Payments
**Description:** No installment plan UI exists at all, despite the backend explicitly supporting "installment plans." All billing here is itemized one-off due items (tuition, books, bus) with a single amount and due date — no plan schedule, no partial-payment progress, no "X of Y installments paid."
**Business Impact:** Installment plans are a named backend feature with zero frontend representation — parents on installment plans (very common for nursery tuition) will have no way to see their schedule, next installment amount, or plan progress. This is a full missing screen, not a small gap.
**Recommended Fix:** Add an "Installment plan" view per fee item showing schedule, paid/upcoming installments, and per-installment pay actions.

**Severity:** Medium
**Portal:** Parent App
**Screen:** Payments (Pay flow)
**Description:** Every payment method flow (`BankFlow`, `InstaPayFlow`, `WalletFlow`, `FawryFlow`) ends in guaranteed success once the user clicks the final confirm button — there is no failed-payment, declined-transaction, or "receipt rejected by admin" state anywhere. Bank transfer receipt upload has no actual validation (any click on the upload zone marks `receipt=true` without a real file being required).
**Business Impact:** Real payments fail — wrong wallet PIN, insufficient funds, rejected/blurry receipts, expired Fawry codes. None of these are modeled, so the eventual failure/rejection UX will need to be designed from scratch, not adapted.
**Recommended Fix:** Add failure states per payment method (declined, expired code, rejected receipt with reason, retry flow) and require an actual file selection to enable "Confirm."

**Severity:** Medium
**Portal:** Parent App
**Screen:** Payments
**Description:** "Pay all" button combines all due items into a single payment object client-side, but if items have different due dates/categories this may not map to how backend invoicing/ledger reconciliation actually works (e.g., partial payment across multiple fee categories, VAT/tax handling — `vat = 0` is hardcoded in `InvoiceSheet`).
**Business Impact:** Backend billing/ledger systems generally require line-item-level payment reconciliation; a single lump "pay all" transaction may not reconcile cleanly against 3 separate itemized dues, and VAT is a legal requirement in Egypt for many transaction types.
**Recommended Fix:** Confirm with finance/backend whether "pay all" should be single or split transactions server-side, and add real VAT/tax line-item support if applicable.

**Severity:** Low
**Portal:** Parent App
**Screen:** Payments (Wallet flow)
**Description:** Wallet PIN input has no "wrong PIN" / resend-code state, and the flow silently succeeds on any 6-digit input.
**Business Impact:** Minor but part of the broader "no failure state" pattern seen across all payment methods.
**Recommended Fix:** Same recommendation as above — add explicit failure handling.

---

### Screen: Chat — `ParentChat.jsx`

**Severity:** Medium
**Portal:** Parent App
**Screen:** Chat
**Description:** No read receipts, delivery status, typing indicators, or "message failed to send" state. Messages sent via `sendChat` are appended to local state instantly and always assumed delivered.
**Business Impact:** Parents may message about urgent matters (child not on bus, health concern); there's no way to know if a message actually reached the teacher, especially under poor connectivity.
**Recommended Fix:** Add sent/delivered/read states and a retry-on-failure affordance for message sending.

**Severity:** Medium
**Portal:** Parent App
**Screen:** Chat
**Description:** Only one chat thread per subject exists (`messageTeacher` keys chats by `subjectId`), meaning a parent with 2+ children in different classes taught by the same teacher would still see one merged conversation, and there's no explicit distinction of which child a message thread is about beyond the subject.
**Business Impact:** For multi-child households (explicitly a backend feature — "multi-child switcher"), conflating chat context by subject rather than by child+subject could cause real confusion ("is this about Yousef or Lina's English?").
**Recommended Fix:** Scope chat threads by child+subject combination, and show the child's name/avatar prominently in the thread header.

**Severity:** Low
**Portal:** Parent App
**Screen:** Chat
**Description:** No way to attach photos/files/voice notes in the parent-teacher chat, despite being a natural expectation (e.g., sharing a doctor's note, a photo of a rash, homework confusion).
**Business Impact:** Limits chat usefulness for common real-world nursery communication needs.
**Recommended Fix:** Add attachment support (image at minimum) to the chat composer.

---

### Screen: Notifications — `ParentNotify.jsx`

**Severity:** Medium
**Portal:** Parent App
**Screen:** Notifications
**Description:** No "mark all as read," no per-category filter, no way to delete/dismiss/clear notifications, and no empty state defined if `groups` were ever empty (component assumes always-populated data).
**Business Impact:** Standard notification-center hygiene actions are missing; over time the panel will just accumulate indefinitely with no way to manage it.
**Recommended Fix:** Add mark-all-read, per-notification dismiss, and an empty-state illustration/message.

**Severity:** Low
**Portal:** Parent App
**Screen:** Notifications vs Settings
**Description:** Settings has 6 granular notification category toggles (bus, reports, messages, events, payments, cameras) but the backend context specifies **per-category channel preferences** (push/WhatsApp/SMS/email/in-app toggles per category) — the UI only has a single on/off toggle per category, not per-channel.
**Business Impact:** This is a named backend capability (multi-channel preference matrix) with no corresponding UI — parents can't choose "SMS for bus alerts but push-only for camera motion," which the backend is built to support.
**Recommended Fix:** Redesign the notification settings as a matrix (category × channel) rather than single toggles, or clarify with backend team if channel selection is meant to be global rather than per-category.

---

### Screen: Settings — `ParentSettings.jsx`

**Severity:** Medium
**Portal:** Parent App
**Screen:** Settings → Change Password
**Description:** No "current password incorrect" failure state — `ChangePasswordSheet` calls `onSaved` unconditionally once client-side validation (length, match) passes; there's no server round-trip modeled.
**Business Impact:** Same systemic "no failure state" issue — real password changes can fail (wrong current password, reused password rejected by policy).
**Recommended Fix:** Add explicit incorrect-current-password and policy-violation error states.

**Severity:** Low
**Portal:** Parent App
**Screen:** Settings
**Description:** Phone number is shown as "Locked"/non-editable in Edit Profile with no explanation of how a parent would ever update their phone number (e.g., after losing a SIM) — no "request phone change" flow exists.
**Business Impact:** Phone number is the login identifier; a real-world need to change it (lost SIM, new number) has no path in the product.
**Recommended Fix:** Add a "Change phone number" flow (likely requiring OTP verification + admin approval) or explicitly document that this must go through nursery admin/support.

**Severity:** Low
**Portal:** Parent App
**Screen:** Settings → Logout
**Description:** Logout has no confirmation dialog — a single tap on "Log out" immediately signs the user out (`onLogout` fires directly from the `Row onClick`).
**Business Impact:** Accidental taps cause unwanted logouts, mildly annoying but avoidable friction, especially since re-login requires phone+password re-entry (no persisted session).
**Recommended Fix:** Add a confirm dialog before executing logout, consistent with typical destructive-action UX patterns.

---

### Cross-Cutting / App-Wide (Parent App)

**Severity:** High
**Portal:** Parent App
**Screen:** Global (multi-child)
**Description:** Multi-child switcher exists (`ChildSwitcher`) but is scoped only to Home/Subjects/Events/Cameras/Bus/Pickup — Payments (`BILLING[child.id]`) and Chat context switch correctly per active child, but there's no consolidated "all children" view anywhere (e.g., a combined bus status, a combined payments-due total across all kids, a combined notification feed labeled by child). Every screen is single-child-at-a-time.
**Business Impact:** Parents with 2+ children (a named use case) must manually flip the switcher to check each child separately for every feature — no at-a-glance multi-child summary exists, which will feel like a regression compared to expectations for a multi-child household product.
**Recommended Fix:** Consider adding a consolidated "family" dashboard view (e.g., "2 pending payments across your children," "both children checked in") in addition to the per-child screens.

**Severity:** Medium
**Portal:** Parent App
**Screen:** Global
**Description:** No pagination anywhere — Payment history, Chat lists, Notification lists, Events lists all render fixed small hardcoded arrays with no "load more"/infinite scroll pattern considered.
**Business Impact:** Real accounts will accumulate years of payment history and hundreds of notifications; unpaginated lists will need rework for performance and usability once real data volume hits.
**Recommended Fix:** Design pagination/infinite-scroll or date-range filtering for all historical list views before backend wiring.

**Severity:** Low
**Portal:** Parent App
**Screen:** Global
**Description:** No device-token/push-permission request UI is shown anywhere (expected per backend spec to be silent, but there's also no in-app fallback messaging if push permission is denied by the OS, which would silently break all push-driven flows like bus alerts).
**Business Impact:** If a parent denies push notifications at the OS level, they'd get no in-app indication that they're missing bus/pickup alerts — a silent, safety-relevant failure mode.
**Recommended Fix:** Add an in-app banner/settings indicator when push permissions are denied, directing users to enable notifications in device settings.

---

## TEACHER APP

### Screen: Auth — `TeacherAuth.jsx`

**Severity:** High
**Portal:** Teacher App
**Screen:** Login / Forgot Password
**Description:** Identical issue set to Parent App: no wrong-credential state, no OTP failure state, "Contact admin" link is a non-interactive span.
**Business Impact:** Same as parent app — day-one requirement gap for teacher account access, which is arguably even higher-stakes since teachers manage child safety data.
**Recommended Fix:** Same as Parent App auth recommendations.

---

### Screen: Classes (Home) — `TeacherApp.jsx`

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Classes (Home)
**Description:** Stat strip shows hardcoded "28 Students" and "4 To evaluate" regardless of actual roster/eval state — these numbers don't derive from `ROSTER` or `lessons` state at all, and don't update as the teacher completes evaluations.
**Business Impact:** A dashboard stat that never updates as real work is completed misleads teachers about their remaining workload — undermines trust in the "to evaluate" count once real data is wired.
**Recommended Fix:** Derive stats from live roster/evaluation state rather than hardcoded numbers.

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Classes (Home)
**Description:** Only one teacher/subject is modeled (`TEACHER` constant, "English Teacher"), and `RosterScreen`'s student count/stats (`present`, `ROSTER.length - present`, "4" to-eval) are hardcoded to a single global `ROSTER` regardless of which class card was tapped — clicking into "KG2 · Tulip" or "KG1 · Daisy" shows the exact same Sunflower roster and title fallback text.
**Business Impact:** This isn't just placeholder data — the roster screen literally cannot show a different class's students, which is core, load-bearing functionality for a teacher managing 3 classes. This will require real rework, not just data-wiring, to make the roster class-aware.
**Recommended Fix:** Make `ROSTER` data keyed by class ID (like `lessons` already correctly is), and ensure `RosterScreen` fully reflects the selected class's actual student list and stats.

---

### Screen: Roster / Student Profile — `TeacherApp.jsx`, `TeacherReports.jsx`

**Severity:** Critical
**Portal:** Teacher App
**Screen:** Roster → Evaluate Student
**Description:** Real bug (not just a UX gap): in `TeacherApp.jsx` line 351 — `{evalStudent && <StudentEvalSheet lang={lang} student={evalStudent} lesson={ar ? lesson.ar : lesson.en} onClose={...} onFlag={...} />}` — `lesson` is not defined anywhere in the `TeacherApp` component scope (it exists only inside `RosterScreen`/`LessonEditSheet`). This will throw a `ReferenceError` and crash the app the moment a teacher taps "Evaluate today" on any student, since `StudentEvalSheet` is the core evaluation entry point.
**Business Impact:** This is the single most important teacher workflow (per-student daily evaluation, which everything else — parent daily reports, monthly reports — depends on) and it is currently broken/crashing in the prototype as written. If shipped as-is, evaluation would be completely unusable.
**Recommended Fix:** Pass the correct lesson object — likely `lessons[cls.id] || cls.lesson` from the currently open class — into `StudentEvalSheet`, threading `cls`/`lessons` state down to where `evalStudent` is set.

**Severity:** High
**Portal:** Teacher App
**Screen:** Student Profile Sheet
**Description:** `StudentProfileSheet`'s "Message parent" sub-label is hardcoded to "Private chat for English" regardless of the actual subject taught or which student/class context is open.
**Business Impact:** Cosmetic now, but reveals the single-subject/single-class assumption baked throughout — will show wrong subject labels once multiple subject-teachers or classes are wired in.
**Recommended Fix:** Derive the subject label from the actual teacher profile/subject context dynamically.

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Roster
**Description:** No way to mark a student present/absent from within the app — attendance (`present: true/false`) is static seed data with no toggle or attendance-taking flow anywhere in the roster screen.
**Business Impact:** Attendance-taking is fundamental daily teacher work; if the backend expects teachers to record attendance, there's no UI to actually set it.
**Recommended Fix:** Add an attendance-taking flow (e.g., tap avatar/status dot to toggle present/absent) — clarify with backend whether attendance is teacher-set or auto-derived from bus/gate check-in.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Student Eval Sheet
**Description:** "Media" button (attach photo/video to evaluation) has no `onClick` handler — decorative only.
**Business Impact:** Implies a feature (media attachment to daily evaluation) that doesn't work; minor but consistent with other dead buttons in the kit.
**Recommended Fix:** Implement or remove until ready.

---

### Screen: Bulk Evaluation — `TeacherApp.jsx`

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Bulk Evaluation
**Description:** `BulkSheet` only lets the teacher select students and write one shared summary note — there's no way to set the actual understanding/participation/behavior/homework ratings in bulk, despite this being explicitly a backend feature ("bulk evaluation").
**Business Impact:** "Bulk evaluation" as built only sends a shared text note, not a real bulk rating action — this doesn't match what bulk evaluation typically means and will likely need a redesign once backend bulk-eval semantics are defined.
**Recommended Fix:** Clarify with product/backend what "bulk evaluation" should set (ratings vs. note vs. both), then add the missing rating inputs to `BulkSheet`.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Bulk Evaluation
**Description:** "Send to N parents" button has no success confirmation or loading state — `onClose` fires immediately with no feedback that the bulk send succeeded.
**Business Impact:** Teacher has no confirmation that a batch action affecting many families actually completed.
**Recommended Fix:** Add a success toast/confirmation after bulk send.

---

### Screen: Reports — `TeacherReports.jsx`

**Severity:** High
**Portal:** Teacher App
**Screen:** Monthly Reports
**Description:** No "schedule for later" option despite backend explicitly supporting "schedule or send now" for monthly reports — `ReportDraftSheet` only has a single "Send report to parent" action; no date/time picker, no draft-save-without-sending, and once sent (`sentReports`), there is no resend/delete/export action anywhere, despite the backend explicitly listing "resend/delete/export" as supported.
**Business Impact:** Three named backend capabilities (schedule-send, resend, delete, export) have zero corresponding UI. Teachers who make a mistake in a sent report, need to resend to a parent who missed it, or need an export for records, currently have no way to do so.
**Recommended Fix:** Add a schedule picker, and for `sent` reports add a detail view with resend/delete/export actions.

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Reports
**Description:** `REPORT_STUDENTS` is a fixed list of 5 students unrelated to the actual class roster (`ROSTER` has 8 students) — student IDs don't consistently map between the two datasets.
**Business Impact:** Confirms the "single fixed dataset" pattern will require real data-model rework — reports should cover the full active roster, not a separate hardcoded subset.
**Recommended Fix:** Derive `REPORT_STUDENTS` from the live roster with per-student report-readiness computed from actual evaluation completeness.

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Reports (AI draft)
**Description:** `aiDraftReport`/`aiPolishNote` silently fall back to a canned template if `window.claude.complete` isn't available, with **no visual indication to the teacher** that the "AI-drafted" text is actually a static template vs. a real AI generation. There's also no error/retry state if the AI call itself fails.
**Business Impact:** Teachers may believe they're sending a genuinely personalized AI summary when it's actually a generic fallback string; this could produce awkward or repetitive parent-facing content at scale.
**Recommended Fix:** Show a distinct state/badge when a fallback template (vs. real AI) is used, and add a visible retry action on AI failure rather than silent `null` fallback.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Reports
**Description:** No confirmation dialog before "Send report to parent" — a materially important, one-way action fires immediately on tap.
**Business Impact:** Accidental sends of incomplete/wrong reports to families are possible with no undo.
**Recommended Fix:** Add a confirm step, especially given deletion/undo isn't otherwise available.

---

### Screen: Requests — `TeacherRequests.jsx`

**Severity:** Medium
**Portal:** Teacher App
**Screen:** New Request
**Description:** No edit or cancel/withdraw action for a request the teacher already submitted — `RequestsScreen` only displays status (pending/approved/rejected) read-only.
**Business Impact:** Realistic scenario (wrong date/price typed) has no correction path other than presumably contacting admin out-of-band, undermining the purpose of a structured request system.
**Recommended Fix:** Add "Edit" (while pending) and "Withdraw" actions to submitted requests.

**Severity:** Low
**Portal:** Teacher App
**Screen:** New Request
**Description:** Date/time fields are free-text inputs rather than real date/time pickers, with no format validation.
**Business Impact:** Free-text date entry is error-prone and inconsistent, which will cause downstream parsing/display issues once tied to real calendars.
**Recommended Fix:** Replace with native date/time pickers.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Requests
**Description:** Rejection reason is shown, but there's no way to resubmit a corrected version of a rejected request.
**Business Impact:** Minor friction; loses context between the rejected request and any resubmission.
**Recommended Fix:** Add a "resubmit" action pre-filled from the rejected request's data.

---

### Screen: Chat — `TeacherRequests.jsx`

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Chat
**Description:** Unlike the Parent App, the Teacher App's `ChatThread` has **no escalate action at all** — a teacher who can't resolve something with a parent has no way to loop in administration from the chat UI, even though the Parent side explicitly supports escalation and the teacher gets a notification when a parent escalates.
**Business Impact:** This is an asymmetric/incomplete cross-portal flow: parents can escalate to admin, but teachers have no equivalent tool.
**Recommended Fix:** Add a teacher-side "escalate to admin" action in `ChatThread`, mirroring the parent app's `EscalateSheet` pattern.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Chat
**Description:** Same as parent app — no read receipts, delivery/failure states, or attachments in teacher chat.
**Business Impact:** Same reasoning as parent-side finding.
**Recommended Fix:** Same as parent-side recommendation.

---

### Screen: Lesson Edit — `TeacherNotify.jsx`

**Severity:** Low
**Portal:** Teacher App
**Screen:** Lesson Edit
**Description:** No validation preventing an empty/whitespace-only lesson title from being saved beyond falling back to the previous value silently — teacher gets no feedback that their entry was rejected/ignored.
**Business Impact:** Minor confusion if a teacher's edit silently doesn't take effect.
**Recommended Fix:** Show inline validation feedback rather than silent fallback.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Lesson Edit
**Description:** "You are the subject teacher for this session" messaging implies role/permission logic exists, but there's no actual permission check visible in the prototype.
**Business Impact:** If backend enforces this restriction, the UI should reflect denied states for non-owning teachers, currently unaddressed.
**Recommended Fix:** Add a read-only/disabled variant of the lesson view for non-owning teachers, and confirm with backend how session-teacher assignment is validated.

---

### Screen: Requests — Missing Feature vs Backend Spec

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Requests
**Description:** Backend spec explicitly limits teacher-submitted exams to "weekly/monthly examKind only" — correctly enforced in the UI. However, there is no UI anywhere for a teacher to *view* mid-term/end-of-year exam schedules set by administration (only a text notification "Mid-term dates published" with `go: null`, meaning tapping it does nothing).
**Business Impact:** Teachers need visibility into all exam dates to plan lessons around them — currently a dead-end notification with no destination screen.
**Recommended Fix:** Add a full school exam calendar view teachers can browse, and wire the notification's `go` target to it.

---

### Screen: Settings — `TeacherSettings.jsx`

**Severity:** High
**Portal:** Teacher App
**Screen:** Settings
**Description:** "Change password," "Help & support," and "Terms & privacy" rows in `TeacherSettingsScreen` are all wired to empty `onClick={() => {}}` handlers — completely non-functional, unlike the Parent App where these same features are fully built and working.
**Business Impact:** Significant, easily fixable parity gap — teachers cannot change their password, get help, or view terms at all from within their own app.
**Recommended Fix:** Port `ChangePasswordSheet`, `HelpSheet`, and `TermsSheet` (or teacher-specific equivalents) into `TeacherSettings.jsx` and wire them up.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Settings
**Description:** No logout confirmation dialog (same issue as parent app).
**Business Impact:** Same as parent-side finding.
**Recommended Fix:** Same as parent-side recommendation.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Settings
**Description:** Profile shows "· 3 classes" hardcoded text regardless of actual class count.
**Business Impact:** Will display wrong class count for any teacher with a different number of classes.
**Recommended Fix:** Compute this dynamically from the teacher's actual class list.

---

### Cross-Cutting / App-Wide (Teacher App)

**Severity:** High
**Portal:** Teacher App
**Screen:** Global (staff features)
**Description:** Backend spec explicitly lists "staff leave visibility (own)" and "staff feedback visibility (own, non-anonymous only)" as teacher-relevant backend features — **neither has any corresponding screen, tab, or entry point anywhere in the Teacher App.**
**Business Impact:** Two named backend features have zero frontend representation — this isn't a partial gap, it's a fully missing pair of screens.
**Recommended Fix:** Design and build "My leave" and "My feedback" screens, even as simple read-only views if that matches backend scope.

**Severity:** Medium
**Portal:** Teacher App
**Screen:** Global
**Description:** No pagination anywhere (chat list, requests list, reports list) — same systemic issue as Parent App.
**Business Impact:** Same reasoning as parent-side finding.
**Recommended Fix:** Same as parent-side recommendation.

**Severity:** Low
**Portal:** Teacher App
**Screen:** Global
**Description:** No way to switch between multiple classes' rosters/context from a persistent element.
**Business Impact:** For a teacher managing 3 classes throughout the day, constantly returning to the Classes tab to switch context is more friction than necessary.
**Recommended Fix:** Consider a persistent class switcher/dropdown similar to the parent app's `ChildSwitcher` pattern.

---

## SUMMARY (as assessed by this sub-review)

**Total findings: 47** — Critical: 2, High: 10 (11 individually listed above), Medium: 22, Low: 13

**Gut assessment — Production readiness:**
- **Parent App: ~55%.**
- **Teacher App: ~45%.**
