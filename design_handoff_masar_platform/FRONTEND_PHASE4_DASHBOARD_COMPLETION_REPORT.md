# Frontend Phase 4 — Nursery Dashboard Portal, Completion Report

**Scope:** the Nursery Dashboard portal only. Teacher, Parent, Reception and Driver were not started.
**Built on:** Phase 1 foundation, Phase 2 backend integration layer, and the Phase 3 Platform Admin patterns — all consumed as-is.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, **0 errors, 0 warnings** |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps (dashboard: 560 KB raw / **163 KB gzipped**) |
| Source files changed outside `apps/dashboard` | ✅ **0** |
| Files changed under `backend/` | ✅ **0** |

---

## 1. What was built

30 files in `apps/dashboard/src`, all 14 scope areas delivered.

```
src/
├─ styles.css  main.tsx  App.tsx  app/providers.tsx
├─ lib/
│  ├─ format.ts        locale-aware date/number/currency
│  └─ permissions.ts   manager/teacher gates (§12)
├─ components/         PageHeader · DataTable · States · StalenessIndicator
└─ routes/
   ├─ router.tsx  DashboardLayout.tsx  NotFound.tsx
   ├─ auth/       AuthGate.tsx  LoginRoute.tsx
   ├─ HomeRoute            (1  Dashboard home)
   ├─ ChildrenRoute        (2  Children)
   ├─ ClassroomsRoute      (3  Classrooms)
   ├─ TeachersRoute        (4  Teachers/Staff)
   ├─ AttendanceRoute      (5  Attendance)
   ├─ TimelineRoute        (6  Daily timeline)
   ├─ RecordsRoute         (7  Academic records)
   ├─ ApprovalsRoute       (8  Approvals)
   ├─ BillingRoute         (9  Billing)
   ├─ CamerasRoute         (10 Cameras)
   ├─ NotificationsRoute   (11 Notifications)
   ├─ ReportsRoute         (12 Reports)
   ├─ AnalyticsRoute       (13 Analytics)
   └─ SettingsRoute        (14 Settings)
```

Navigation is grouped into Overview / People / Academic / Operations, with manager-only entries hidden from non-managers.

---

## 2. Constraints honoured

### Manager permissions

Every write is gated through `lib/permissions.ts`, mapped one-to-one onto §12: children, classrooms, staff, attendance override, approvals review, billing, cameras, broadcast, report sending and settings are all manager-only. Non-managers see a `ManagerOnly` explanation rather than a disabled control with no reason.

### Teacher visibility — made legible, not re-implemented

This is the constraint that shaped the portal most. Two decisions:

1. **No client-side scoping is layered on top of RLS.** A teacher opening the Dashboard sees only their own classroom's children, attendance, evaluations and analytics *because the policies say so* (`classroom_id = ANY(current_staff_classroom_ids())`). Re-filtering in the client would duplicate policy and risk drifting from it. The portal filters nothing; it only hides write controls a teacher's role would be rejected for.
2. **The Staff page surfaces each teacher's scope explicitly.** A "Classroom scope" column shows the classroom each teacher is bound to — the exact boundary their RLS applies — so a manager can see at a glance what each teacher can and cannot read. Teacher visibility made visible, rather than an implicit backend detail.

The Analytics page benefits from the Epic 10 fix directly: `v_child_attendance_summary` is grained per **(child, classroom)**, so a teacher never sees a percentage spanning a classroom their RLS forbids.

### RLS as the only authorization boundary

`lib/permissions.ts` documents in its header that every helper is a UX affordance. Billing is the clearest case: a teacher is shown a full-page `ManagerOnly` notice explaining that the database returns them no billing rows at all — the client is not the thing enforcing it.

`ErrorState` renders `PERM_ROLE_DENIED` distinctly from a failure, and empty states are worded so an RLS-filtered result never reads as data loss.

### Realtime — 5 channels

| Channel | Page |
|---|---|
| `tenant:{id}:activity` | Home |
| `tenant:{id}:approvals` | Home, Approvals |
| `classroom:{id}:day_path` | Daily Timeline |
| `tenant:{id}:cameras` | Cameras |
| `tenant:{id}:cameras:heartbeat` | Cameras |

All via `useRealtimeSubscription`, torn down on unmount. The Timeline subscribes to **one classroom at a time** — the narrowest filter §15 allows — and re-subscribes when the selection changes. Cameras subscribes to both channels because §15 keeps them distinct so the Dashboard can tell *"I just disabled this"* from *"it went offline"*; the UI honours that by treating `online` and `admin_disabled` as independent states with different labels and remedies, never collapsing them into one status.

### `computed_at` indicator

`StalenessIndicator` is on the Analytics page. It shows snapshot age and, past 60 minutes, escalates to an amber badge with an explicit *"Not live — refreshed by a scheduled job, which is not currently registered."* The empty state says the same. This is honest about `pg_cron` not being enabled on the deployment.

### `retry: false` mutations, no optimism

Four mutations, all through `useRpcMutation` (which hard-codes `retry: false`). `useOptimisticRpcMutation` appears **nowhere** — verified by grep.

| RPC | Page | Why not optimistic |
|---|---|---|
| `review_request` | Approvals | Promotes the request into an `events` row and notifies — server-side branching |
| `verify_payment` | Billing | Settles the ledger and notifies |
| `broadcast_announcement` | Notifications | Fan-out and channel selection happen server-side |
| `send_report_draft` | Reports | Transitions state and triggers delivery |

All four carry `idempotent: true`, so a manual retry reuses one key and is safe.

**Deliberately NOT surfaced:** `mark_ledger_item_paid_manual` and `mark_installment_paid_manual`. These are two of the seven RPCs that accept no idempotency key (`BACKEND_CERTIFICATION.md` §7.1), where a double-submit records a duplicate manual payment. Exposing them needs the non-retryable submit treatment plus an explicit confirmation flow; shipping them half-guarded on a financial surface was the wrong trade. Recorded as a follow-up.

---

## 3. A backend type-generation bug found and worked around

`review_request`'s decision parameter is deployed as `approvals.request_status` — `'pending' | 'approved' | 'rejected'` — but `supabase gen types` **mis-mapped the enum** and emitted `'PENDING' | 'SUCCESS' | 'ERROR'` into `database.generated.ts`.

Verified directly against the live database:

```
pg_get_function_identity_arguments →
  p_request_id uuid, p_decision approvals.request_status,
  p_rejection_reason text, p_idempotency_key uuid
```

This matters: sending the generated literals would fail at runtime with an invalid enum value, while writing the correct value would fail typecheck. `api-client` is frozen this phase, so `ApprovalsRoute` sends the **correct runtime values** through two narrow, documented constants:

```ts
const DECISION_APPROVED = 'approved' as unknown as ReviewArgs['p_decision'];
const DECISION_REJECTED = 'rejected' as unknown as ReviewArgs['p_decision'];
```

**Recommended fix when api-client unfreezes:** regenerate types (the CLI may have improved) or hand-patch that one signature, then delete the casts. This is the only place in the portal where a generated type is overridden, and it is overridden *toward* the deployed truth, not away from it.

---

## 4. Reused, not rebuilt

- **Design system:** `Avatar`, `Badge`, `Button`, `Card`, `CenteredLayout`, `DayPath`, `Icon`, `Input`, `StatCard`, `StatusPill`, `Tabs`.
- **Hooks:** `useAcademicList`, `useIdentityList`, `useApprovalsList`, `useBillingList`, `useCommsList`, `useMediaList`, `useReportsList`, `useTenancyList`, `useRpcMutation`, `useRealtimeSubscription`.
- **Realtime / auth / i18n:** all from the shared packages.

The **Daily Timeline** is where the design system pays off most: `DayPath` and `StatusPill` are used for exactly what they were designed for — a child's progression through the day, completed steps solid, current step live, bilingual labels.

App-level composites (`DataTable`, `PageHeader`, `States`, `StalenessIndicator`) were **duplicated from the Platform Admin portal rather than promoted into the design system**, following `FRONTEND_ARCHITECTURE.md` §3: a component graduates into the shared package only when a **third** portal needs it. This is the second — the third portal is the right moment to promote them, and that is now a concrete, earned refactor rather than speculation.

---

## 5. Quality notes

**A real bug was fixed rather than suppressed.** Lint initially reported 6 `react-hooks/exhaustive-deps` warnings: `const rows = query.data?.items ?? []` creates a fresh array every render, so the `useMemo`s depending on it never actually memoised. Rather than disable the rule, the extractions themselves were wrapped in `useMemo` — the memoisation now works as intended across Analytics, Approvals, Attendance, Billing and Reports.

**Accessibility & i18n:** semantic tables with captions and `scope="col"`; `<header>`/`<nav>`/`<main>` landmarks; `aria-busy`/`aria-live` on loading and `role="alert"` on errors; logical properties throughout so one implementation serves LTR and RTL; phone numbers and dates pinned `dir="ltr"` inside RTL; status never colour-only.

---

## 6. Known limitations

1. **Unverifiable against real data.** The staging database is still empty, so every page renders its empty state. The RLS-scoped reads, the manager/teacher divergence, and the realtime handlers are structurally correct but **not empirically confirmed** — the seeded dataset remains the outstanding prerequisite from Phase 1.
2. **Manual-payment RPCs not surfaced** (§2) — deliberate, pending the non-retryable treatment.
3. **Attendance override not built.** `mark_attendance` replaces a whole classroom register for a date; a single-child manager override needs its own flow rather than a repurposed bulk call.
4. **Enrolment form not built.** `enroll-child` is a multi-step Edge Function (child + guardian + activation dispatch); the roster and its states are delivered, the wizard is a follow-up.
5. **Settings is read-only.** The deployed catalogue has no tenant-settings RPC, and writing directly to the table would bypass the "RPC for writes" model. The page explains where to go instead.
6. **Camera live view not built.** Requires `camera-stream-token` plus an external-relay player; metadata and state are delivered.
7. **Lessons tab is thin** — `academic.lessons` carries little display-worthy data without joining subjects and classrooms; deliberately minimal rather than padded.
8. **No tests** — out of scope for this phase.
9. **Bundle 163 KB gzipped**, within the <200 KB budget; route-level code splitting is available if it grows.

---

## 7. Verification evidence

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              dashboard: 560.05 kB │ gzip: 162.74 kB

grep useOptimisticRpcMutation        → none
grep schema('analytics')             → none
mutations                            → 4, all useRpcMutation (retry:false, idempotent)
realtime channels                    → 5
source files changed outside app     → 0
backend files changed                → 0
```

---

**The Nursery Dashboard portal is complete and compiles cleanly. Teacher, Parent, Reception and Driver were not started. Stopping here.**
