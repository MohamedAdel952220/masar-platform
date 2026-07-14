# Handoff: Masar — Nursery Management Platform

## Overview
Masar is a bilingual (Arabic RTL / English LTR) nursery & kindergarten management platform covering the full daily lifecycle of a child — enrolment, attendance, academics, transport, secure pickup, live cameras, payments, and communication. It spans **six portals** that share one design system and narrate one connected data flow.

## About the Design Files
The files in this bundle are **design references created in HTML/React (via Babel in-browser)** — high-fidelity interactive prototypes showing intended look, copy, and behavior. **They are not production code to ship directly.** Each portal is a self-contained prototype with its own in-memory seed data; cross-portal flows are simulated *narratively* (the same people/events appear on both sides) but there is **no shared backend**.

The task in Claude Code is to **recreate these designs in a real, production codebase**: a multi-tenant backend + database with per-school isolation, real auth/roles, and live integrations, using the target stack's established patterns. If no codebase exists yet, choose an appropriate stack (suggested below) and implement there.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, RTL mirroring, interactions, and copy (EN + AR) are all present. Recreate UI faithfully using the codebase's component library; pull exact tokens from `styles.css` / `tokens/`.

## The Six Portals

| Portal | Folder | Form factor | Accent | Primary users |
|---|---|---|---|---|
| Parent app | `ui_kits/parent-app/` | Mobile (390×844) | Teal `--role-parent` | Parents/guardians |
| Teacher app | `ui_kits/teacher-app/` | Mobile | Violet `#6B4FB5` | Subject teachers |
| Driver app | `ui_kits/driver-app/` | Mobile | Blue `#2D6CB5` | Bus drivers |
| Reception app | `ui_kits/reception-app/` | Mobile | Terracotta `#C2622E` | Front-desk staff |
| Nursery dashboard | `ui_kits/nursery-dashboard/` | Desktop (1320×820) | Dark teal `--role-manager` | Nursery manager/admin |
| Platform admin | `ui_kits/platform-admin/` | Desktop | Deep violet `#4F46B5` | SaaS operator (your company) |

Every mobile app has: Splash → 3-scene Onboarding → Login (phone + password) → Forgot-password (phone → WhatsApp/SMS OTP → reset). Both desktops have a split-screen/email login. All portals have full Settings (edit profile, change password, notifications, help & support, about, logout) and an EN/ع language toggle with RTL mirroring.

## Portal-by-Portal Screens

### Parent app (`parent-app/`)
- **Home** — child day-path timeline, today's schedule, last activity, quick actions.
- **Subjects** (`ParentAcademics.jsx`) — per-subject cards → detail with **Daily log** (lesson + teacher evaluation: understanding/participation/behavior as dot ratings + note) and **Monthly report** (progress meters, skills, teacher summary, PDF).
- **Events** — tabs: Exams (weekly/monthly/final + countdown + topics), Celebrations (RSVP), Trips (free = register; paid = pay flow → invoice).
- **Cameras** — grid of the child's classroom cameras only; tap → full live view (CCTV-style placeholder). Encrypted-access note.
- **Bus** (`ParentApp.jsx`) — map shows **only while child is on the bus**; otherwise guidance card + notifications. Phases: waiting → on-bus (live map, driver, ETA, seat progress) → arrived (reception-confirmed) → return → home.
- **Pickup** — create QR pass (name, relationship, ID photo) → generated QR + WhatsApp/Share/Copy; list of authorized people.
- **Payments** (`ParentPayments.jsx`) — packages, monthly/yearly, installments; pay via bank transfer / InstaPay / wallet / Fawry; invoice history with downloadable invoices.
- **Chat** (`ParentChat.jsx`) — per-subject-teacher threads; escalate to administration.
- **Notifications** (`ParentNotify.jsx`) — grouped feed; each item deep-links to its screen.

### Teacher app (`teacher-app/`)
- **Home** — classes, "now teaching" lesson banner (feeds daily reports), stat strip.
- **Roster** — per-class students; individual + bulk evaluation (understanding/participation/behavior, homework, note with **AI polish**).
- **Reports** (`TeacherReports.jsx`) — draft daily notes & monthly reports with AI from evaluations; send to parents. **Flag a concern** (academic/behavior/social/health + priority).
- **Requests** (`TeacherRequests.jsx`) — request event / trip / exam (weekly or monthly only; upload exam paper) → goes to dashboard approvals. Note: mid/final exams are set by school admin.
- **Chat** — threads with parents.

### Driver app (`driver-app/`)
- **Trip** (`DriverApp.jsx`) — Start trip → GPS route through stops in order → per-child "Pick up" (parent notified instantly) → Confirm arrival (all parents notified). AM pickup / PM drop-off legs.
- **Students manifest**, **History**, **Settings**.

### Reception app (`reception-app/`)
- **Scan** (`ReceptionApp.jsx`) — scan pickup QR → verify authorized person + child → confirm handover; invalid-code warning path.
- **Bus confirmation** — count children on/off bus → confirm → triggers parent arrival/departure notifications.
- **Home**, **Activity log**, **Settings**.

### Nursery dashboard (`nursery-dashboard/`)
- **Overview** — KPIs, Announce (audience + channels + schedule).
- **Approvals** (`DashboardViews.jsx`) — teacher event/trip/exam requests → approve/reject + preview uploaded exam paper.
- **Children** (`DashboardChildren.jsx`) — table + filter; add/edit full enrolment form (child, guardians, emergency, address + **map pin**), creates parent account; profile drawer; 3-dot: edit / payment reminder / suspend / remove.
- **Teachers** (`DashboardTeachers.jsx`) — add/edit (role: teacher or reception → creates app account), profile = work report, schedule leave, remove.
- **Classrooms** (`DashboardClassrooms.jsx`) — capacity/seats grid, detail page with daily attendance + subjects log + time-travel history + linked cameras; add/edit (name, KG level, age, cameras).
- **Cameras** (`DashboardCameras.jsx`) — school-wide CCTV registry; add camera (zone, linked classroom, IP/RTSP, resolution, audio); links determine which parents see which feed.
- **Attendance** (`DashboardAttendance.jsx`) — per-class present/absent; notify parents with subject-level detail.
- **Bus** (`DashboardBus.jsx`) — multiple buses, driver + phone, assign students by address, live location, per-child pickup state; provisions driver account.
- **AI Reports** (`DashboardReports.jsx`) — pick class/children + topic → AI drafts → review → send/schedule → export.
- **Payments** (`DashboardPayments.jsx`) — configurable fee items (add month/books/services with add-later), per-student paid/unpaid by class, installment plans for specific families, send invoice/email/notice.
- **Settings** (`DashboardSettings.jsx`).

### Platform admin (`platform-admin/`)
- **Overview / Schools** (`PlatformAdmin.jsx`) — all tenant schools, per-school issues & app health, provision new school (creates dashboard + app emails), strict tenant isolation.
- **Billing** — setup + monthly subscription, paid/unpaid, overdue invoice/email/on-dashboard notice.
- **Support / System health / Broadcast / Audit log** (`PlatformExtras.jsx`).

## Cross-Portal Flows (must be wired to one backend)
1. **Enrolment → Parent account**: Dashboard Children add → provision parent login → Parent app.
2. **Staff add → app account**: Dashboard Teachers add (teacher|reception) → Teacher/Reception app login.
3. **QR pickup**: Parent creates pass → Reception scans & verifies → handover confirmed → parent notified.
4. **Bus**: Driver pickup/arrival + Reception count-confirm → parent notifications + live map; Dashboard manages routes.
5. **Academics**: Teacher daily evaluation → Parent daily log + monthly report.
6. **Requests → Events**: Teacher request → Dashboard approval → Parent Events.
7. **AI reports**: Teacher/Dashboard draft → send → Parent.
8. **Concerns/Chat**: Teacher ↔ Parent, escalate → Dashboard.
9. **Payments**: Dashboard fee config/plans → Parent payments + invoices.
10. **Announce/Broadcast**: Dashboard → its apps; Platform → all schools.
11. **Cameras**: Dashboard registry (classroom link) → Parent sees only their child's room.
12. **Provisioning**: Platform → new isolated school dashboard + app emails.

## Design Tokens
Authoritative source: `styles.css` and `tokens/` (colors, spacing, radius, shadows, typography, fonts). Role accents in `tokens/colors.css`: `--role-parent` teal, `--role-teacher` `#6B4FB5`, `--role-driver` `#2D6CB5`, `--role-supervisor` `#C2622E`, `--role-manager` `--teal-900`. Shared UI primitives (Button, Card, Badge, Avatar, Icon, StatCard, StatusPill, Tabs, MasarMark) live in `ui_kits/_shared/masar-ui.jsx`. Icons: Lucide. Fonts: Latin sans + Arabic (`--font-arabic`) + mono for numerals.

## Interactions & Behavior
- RTL/LTR fully mirrored via `dir` + logical properties (`inset-inline-*`, `margin-inline`).
- Sheets slide from bottom (mobile) / modals center (desktop); drawers slide from inline-end.
- Bus map: animated marker along an SVG `offset-path`; map only mounts in on-bus phase.
- Camera feeds: CCTV-style placeholder (scanlines, LIVE chip, timestamp) — replace with real RTSP/WebRTC.
- AI actions call an assistant to draft text — wire to your LLM endpoint.
- Toasts auto-dismiss ~2.4s; forms validate required fields before enabling submit.

## Recommended Production Stack (if none exists)
- Frontend: React (web dashboards) + React Native/Expo (mobile apps), i18n with RTL.
- Backend: multi-tenant API (row-level tenant isolation), Postgres.
- Realtime: WebSocket for bus GPS + notifications; RTSP→WebRTC gateway for cameras.
- Integrations: payment gateway (Fawry/InstaPay/cards), push + SMS + WhatsApp Business API, object storage for photos/exam papers/invoices.

## Files
All prototypes are under `ui_kits/<portal>/index.html` (open standalone). Each `index.html` loads React + Babel and the portal's `.jsx` modules; shared primitives in `ui_kits/_shared/masar-ui.jsx`; tokens in `styles.css` + `tokens/`. This handoff folder contains a copy of the full `ui_kits/`, `styles.css`, and `tokens/` for reference.
