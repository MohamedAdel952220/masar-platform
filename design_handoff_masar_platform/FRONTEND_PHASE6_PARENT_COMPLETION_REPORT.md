# Frontend Phase 6 — Parent App, Completion Report

**Scope:** the Parent App only. Reception and Driver were not started.
**Built on:** Phase 1 foundation, Phase 2 backend integration, and the Platform Admin / Dashboard / Teacher patterns — all consumed as-is.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, **0 errors, 0 warnings** |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps (parent: 553 KB raw / **161 KB gzipped**) |
| Source files changed outside `apps/parent` | ✅ **0** |
| Files changed under `backend/` | ✅ **0** |

---

## 1. What was built

33 files. All 13 scope areas delivered.

```
src/
├─ styles.css  main.tsx  App.tsx  app/providers.tsx
├─ lib/        format.ts · dayPath.ts · parent.ts (guardian scope)
│              selectedChild.ts + SelectedChildProvider.tsx
│              useThrottledState.ts (GPS render cap)
├─ components/ PageHeader · StalenessIndicator · States
└─ routes/
   ├─ router.tsx  ParentShell.tsx  NotFound.tsx  MoreRoute.tsx
   ├─ auth/       AuthGate.tsx  LoginRoute.tsx      (1  Authentication flow)
   ├─ HomeRoute            (2  Parent home)
   ├─ ChildRoute           (3  Child profile)
   ├─ DayPathRoute         (4  Daily timeline / Day Path)
   ├─ AttendanceRoute      (5  Attendance summary)
   ├─ ProgressRoute        (6  Academic progress)
   ├─ TripRoute            (7  Live trip tracking)
   ├─ CamerasRoute         (8  Camera viewing)
   ├─ NotificationsRoute   (9  Notifications)
   ├─ ChatRoute            (10 Chat)
   ├─ ReportsRoute         (11 AI report viewing)
   ├─ BillingRoute         (12 Billing & invoices)
   ├─ PayRoute             (12 Payments)
   └─ SettingsRoute        (13 Settings)
```

### The one new structural idea: an app-wide selected child

A guardian may have several children enrolled, and nearly every screen is scoped to one of them. Rather than thread a child id through every route, `SelectedChildProvider` holds the selection app-wide and `ParentShell` renders a switcher in the chrome — visible only when more than one child exists.

There are deliberately **no `/child/:id` routes**. An id in the URL would imply an addressability that RLS does not grant, and a parent thinks in terms of "my child", not a record id. Scope is decided by the database, not the path.

The provider's own docs are explicit that this is **a convenience selector, not an access control**: the list it selects from is whatever `academic.children` returned, already narrowed by `child_id = ANY(public.current_guardian_child_ids())`. A guardian cannot select a child they cannot see, because such a child never reaches the client.

---

## 2. Constraints honoured

### Guardian RLS visibility and child-only access

**No client-side child filtering is used as authorization anywhere.** Where a screen filters by `selected.id`, it is choosing which of *this guardian's own* children to display — not restricting reach. That reach is already fixed server-side.

Two §12 restrictions are narrower than the rest and shaped their screens rather than being footnotes:

- **Trips and GPS are LIVE ONLY.** Route replay is not a guardian capability. `TripRoute` therefore does not degrade into a history view when no trip is running — it says the bus is not running and stops. The UI agrees with the policy instead of implying data is being withheld.
- **AI reports are SENT ONLY.** A draft under review is invisible by policy; the row never reaches the client.

### AI report viewing — the human-review promise, held from both ends

`ReportsRoute` filters on `status === 'sent' && sent_at !== null`. That guard is **not** the access control — RLS already restricts guardians to sent rows. It is defence in depth (§28): if policy ever loosened by accident, this screen still would not show a parent an unreviewed draft.

The Teacher App enforces that nothing sends without a person reading it. This app is the other half of the same promise, and a promise like that is only worth making if it holds on both sides.

Reports are presented as reports *from the nursery*, because that is what they are — a teacher signed off on the text. Conversely, on `ProgressRoute` the `note_ai_polished` flag **is** surfaced, because there a parent is reading what reads as a personal note about their child, and concealing AI involvement would misrepresent its authorship.

### Server-authoritative payment flow

This is the constraint I took most literally. `PayRoute` can do exactly one thing: **ask** the server to start a payment, via `initiate-payment`. It cannot mark anything paid, and does not try.

What that rules out, explicitly:

| Ruled out | Why |
|---|---|
| Optimistic update | A payment is not on the optimistic-safe list and could not be. Showing a fee paid before money moved is the worst lie this app could tell. |
| Treating the PSP return as proof | The browser knows only that the parent came back — not that payment succeeded. The redirect can be replayed or abandoned. On return the app refetches and shows whatever `payment_transactions.status` says. |
| Calling `verify_payment` | A staff decision RPC. A guardian confirming their own payment defeats the purpose of verification. |
| `mark_*_paid_manual` | Two of the seven non-idempotent RPCs, staff-only. No guardian path exists. |

Status moves only when `payment-webhook` (server-to-server, on the client-forbidden list) or a staff `verify_payment` moves it. The **"we have your payment and are confirming it"** state is therefore a feature, not a gap — it is the honest thing to show, and it resolves on its own.

### Live realtime updates, and the GPS render cap

Five channels, all through `useRealtimeSubscription` (torn down on unmount):

| Channel | Screen |
|---|---|
| `classroom:{id}:day_path` | Home, Day Path |
| `trip:{id}:position` | Trip — **throttled** |
| `trip:{id}:status` | Trip |
| `conversation:{id}:messages` | Chat (open thread only) |
| `user:{id}:notifications` | Home, Notifications |

§15 caps GPS at **one render per second**, and pings arrive several times faster than that. `useThrottledState` enforces it with leading-edge-then-trailing semantics: the first position paints immediately (a parent opening the screen should not wait a second for the bus to appear), values inside the window are coalesced, and the newest paints when the window closes. No position is lost — only superseded ones are dropped, which is exactly right for a position, where only the latest value has meaning. A pending trailing update is cleared on unmount.

### Camera authorization

Two independent server-side gates, both relied on rather than reimplemented: RLS decides which cameras are visible at all; `camera-stream-token` decides whether a token is issued and mints a short-lived one. The token is the actual grant — the button merely asks for it, and the token is held in component state only, never persisted or logged.

§17 is respected precisely: `online` and `admin_disabled` are **independent booleans, never collapsed into one status**. "Not reporting right now" and "turned off by the nursery" are rendered differently, because they mean different things to a parent.

### Analytics freshness (`computed_at`)

`AttendanceRoute` shows the `v_child_attendance_summary` snapshot with a mandatory `StalenessIndicator` — and then shows **live `attendance_records` beside it**. Showing only the snapshot would tell a parent their child was absent today when the teacher marked them present an hour ago. `pg_cron` is not installed on the deployed project, so no refresh currently runs; the recent-days list is what makes that staleness legible rather than merely disclosed. The `analytics` schema is never queried directly.

### `retry: false` mutations, no optimism

Two mutations, both via `useRpcMutation` (which hard-codes `retry: false`). `useOptimisticRpcMutation` appears **nowhere** — verified by grep.

| RPC | Screen | Idempotency |
|---|---|---|
| `send_message` | Chat | Idempotency key |
| `update_notification_preferences` | Settings | On the optimistic-safe list; plain mutation used anyway |

`update_notification_preferences` is one of only two RPCs permitted to update optimistically. As in the Teacher App I used the plain mutation: a settings toggle is not latency-sensitive enough to justify rollback complexity.

Chat's send is worth one note: `send_message` accepts `p_child_id` **or** `p_conversation_id`. Passing the child id lets the RPC resolve-or-create the thread server-side, which is why a parent with no history can simply start typing and why this screen never creates a conversation row itself. `escalate_conversation` is staff-only — a guardian sees that a thread was escalated but cannot escalate it.

---

## 3. Reused, not rebuilt

- **Design system:** `Avatar`, `Badge`, `Button`, `Card`, `CenteredLayout`, `DayPath`, `Icon`, `Input`, `StatCard`, `StatusPill`. The signature `DayPath` component finally appears in the portal it was designed for.
- **Hooks:** `useAcademicList`, `useBillingList`, `useCommsList`, `useIdentityList`, `useMediaList`, `useReportsList`, `useTransportList`, `useRpcMutation`, `useRealtimeSubscription`.
- **Edge Functions:** `camera-stream-token`, `initiate-payment` via the typed `invokeEdgeFunction`.
- **Auth / i18n:** `signInWithPhone`, `signOut`, `useAuth`, `useLocale`.

`PageHeader`, `States` and `StalenessIndicator` were duplicated from the Teacher App — this is now the **fourth** portal to need them, one past the §3 promotion threshold. Promoting them into `@masar/design-system` is overdue and remains the clearest refactor available the next time shared packages are unfrozen.

`lib/dayPath.ts` exists because the database enum (`at_home`) and the design system's `ChildStatus` (`at-home`) disagree on spelling, and `ChildStatus` carries two presentation-only states no column produces. Mapping in one place keeps that mismatch from being re-derived on every screen; aligning `ChildStatus` with the deployed enum would delete the file.

---

## 4. Known limitations

1. **Unverifiable against real data.** The staging database is still empty, so every screen renders its empty state. Guardian scoping, the payment hand-off, the camera grant and the realtime handlers are structurally correct but **not empirically confirmed** — the seeded dataset remains the outstanding prerequisite from Phase 1.
2. **No map on the trip screen.** A tile provider is not in this phase's dependency set. A fabricated map would be worse than an honest readout, so the screen shows position, speed and freshness, and the map is a follow-up rather than a fake.
3. **Camera playback is a grant, not a player.** The screen obtains and displays the authorization; the video element belongs to the Capacitor shell, a later roadmap stage.
4. **Marking a notification read is not implemented** — no `mark_notification_read` RPC exists, and writing to `comms.notifications` directly would bypass the RPC-for-writes model. Read state is displayed but not mutated. (Same finding as Phase 5.)
5. **Raising a concern is not available.** §12 gives guardians visibility of non-escalated concerns, but no guardian-facing concern RPC is deployed. Read-only, as the catalogue permits.
6. **Event RSVP is not surfaced.** `update_rsvp` exists and is a guardian capability, but events were not in the stated Phase 6 scope. Follow-up.
7. **List hooks have no `enabled` option**, so child-scoped screens issue their query and filter the RLS-narrowed result rather than deferring until a child resolves. Correct, marginally wasteful; an `enabled` passthrough in `@masar/api-client` would fix it when that package is next open.
8. **Profile is read-only** — no guardian-facing profile update RPC exists. The screen says so rather than presenting inert edit affordances.
9. **No push notifications** — requires the Capacitor shell.
10. **No tests** — out of scope for this phase.
11. **`--surface-app` workaround persists.** The design system's `AppShell` paints a token that does not exist; the real one is `--bg-app`. Worked around at portal level, as in every previous portal. Still the first thing to fix when the design system is unfrozen.
12. **Bundle 161 KB gzipped**, within the <200 KB mobile budget.

---

## 5. Verification evidence

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              parent: 553.58 kB │ gzip: 161.57 kB

grep useOptimisticRpcMutation    → none
mutations                        → 2, both useRpcMutation (retry:false)
edge functions                   → camera-stream-token, initiate-payment
client-forbidden RPCs called     → none
client-forbidden Edge Functions  → none
realtime channels                → 5
GPS render cap                   → useThrottledState, 1000 ms
AI reports                       → sent-only guard + RLS
payment status mutation in app   → none (server-authoritative)
computed_at surfaced             → AttendanceRoute
source files changed outside app → 0
backend files changed            → 0
```

---

**The Parent App is complete and compiles cleanly. Reception and Driver were not started. Stopping here.**
