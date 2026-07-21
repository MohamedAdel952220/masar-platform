# Frontend Phase 8 — Driver App, Completion Report

**Scope:** the Driver App only — the sixth and final application portal.
**Built on:** Phase 1 foundation, Phase 2 backend integration, and the five completed portals — all consumed as-is.

---

## 1. Summary

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, **0 errors, 0 warnings** |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps (driver: 541 KB raw / **160 KB gzipped**) |
| Source files changed outside `apps/driver` | ✅ **0** |
| Files changed under `backend/` or `packages/` | ✅ **0** |
| Shared-package changes required | ✅ **none** — see §3 |
| Direct table writes | ✅ **0** |
| Direct Supabase imports | ✅ **0** |
| Unchecked enum casts | ✅ **0** |

32 files. All 12 scope areas delivered.

```
src/
├─ styles.css  main.tsx  App.tsx  app/providers.tsx
├─ lib/  enums.ts ⭐  driver.ts  format.ts
│        tripContext.ts + TripProvider.tsx
│        useGpsTracker.ts ⭐  useChildStatus.ts  useDriverChildren.ts
├─ components/  PageHeader · States · StatusStrip · RiderCard
└─ routes/
   ├─ router.tsx  DriverShell.tsx  NotFound.tsx  MoreRoute.tsx
   ├─ auth/            AuthGate.tsx  LoginRoute.tsx
   ├─ HomeRoute        (1  Home)
   ├─ TripsRoute       (2  Today's Trips)
   ├─ TripRoute        (3  Active Trip · 9 Route Status entry)
   ├─ ManifestRoute    (4  Rider Manifest · 6 Boarding · 7 Drop-off · 8 Child Status)
   ├─ BusRoute         (5  Assigned Bus)
   ├─ RouteRoute       (9  Route Status)
   ├─ GpsRoute         (10 GPS Status)
   ├─ NotificationsRoute (11 Notifications)
   └─ SettingsRoute    (12 Settings)
```

---

## 2. Architecture decisions

### The trip context sits above the router

`TripProvider` wraps the entire authenticated app, holding the active trip, the GPS tracker, and both realtime subscriptions.

This is the single most consequential decision in the portal. **GPS tracking is bound to trip activity, not to screen mount.** A driver who opens the manifest to mark a child aboard must not silently stop transmitting position — parents are watching that bus move on a map. Mounting the tracker inside a route would tie the fleet's live location to whichever tab happened to be open.

It also makes "one logical subscription per resource" structural rather than conventional: screens read from context and cannot open a second channel even by accident.

### Boarding and drop-off are one screen, not two

Which action the rider cards offer is derived from the trip's leg via `LEG_PRIMARY_ACTION` — morning boards, afternoon drops off. Two separate routes would let a driver open the wrong one and mark a child `picked_up` on the way home.

### `lib/enums.ts` is the only place an enum literal appears

Every enum value in this portal is declared once, with its generated type. See §8 — this is the direct response to the defect class found in the Parent hotfix.

### No trip history

§12 grants a driver `RU (own trip, own bus)`. Today's Trips shows today only. A screen quietly accumulating months of movement history would turn a work tool into a personal-tracking archive for whoever picks up the phone.

---

## 3. Backend integration

**Every backend call this app makes**, in full:

| Call | Kind | Where |
|---|---|---|
| `buses`, `trips` | read | TripProvider |
| `trip_child_status` | read | Trip, Manifest |
| `trip_stops`, `trip_stop_riders` | read | Route |
| `bus_riders` | read | Bus |
| `driver_profiles`, `notification_preferences`, `notifications` | read | Settings, Notifications, Home |
| `academic.children_driver_safe()` | **server-gated view fn** | useDriverChildren |
| `start_trip` | RPC write | Home |
| `record_gps_ping` | RPC write | useGpsTracker |
| `update_child_trip_status` | RPC write · **non-idempotent** | useChildStatus |
| `complete_trip` | RPC write | Trip |
| `update_notification_preferences` | RPC write | Settings |

No Edge Functions (the driver's §12 row needs none). No `.insert()`, `.update()`, `.upsert()` or `.delete()` anywhere — grep-verified. No invented endpoints, RPCs, or fields.

### The one integration subtlety: `children_driver_safe`

§12 grants the driver `R (own bus riders, **minimal fields**)`. That is enforced server-side, not by client redaction: `academic.children_driver_safe()` returns exactly `id, tenant_id, name, name_ar, classroom_id, photo_object_id, address_line, address_lat, address_lng, area, building, city` — no allergies, blood type, DOB, parent names, phones, national IDs, jobs, or notes.

**`academic.children` is never queried in this app.** Reading the base table and dropping columns in the client would put a privacy boundary where a future edit can quietly widen it; letting the database decide means the sensitive columns never leave the server.

**No shared-package change was needed to reach it.** `callRpc` is typed `keyof Database['public']['Functions']`, and this function lives in the `academic` schema — so it is not reachable through the public RPC wrapper. Rather than widen a frozen package, the api-client's own documented escape hatch is used: `academic.raw().rpc('children_driver_safe')`. That is still the shared client, still fully typed by the generated `Database`, and still routed through `parseBackendError` so the bilingual error contract holds. This is recorded here because it was the one point where a shared change looked tempting.

---

## 4. GPS implementation

Real `navigator.geolocation.watchPosition`. **Nothing is simulated, replayed, or interpolated** — a fabricated coordinate on a screen a parent is watching would be worse than an honest gap.

### Three independent rates, tuned separately

| Rate | Value | Why |
|---|---|---|
| Device sampling | OS-decided | Not ours to control |
| **Server cadence** | 1 ping / **7 s** | §18 specifies 5–10 s; 7 s sits mid-band |
| **UI render** | ≤ **1 / s** | §15/§29 — ping frequency is a backend decision, render frequency is a UI one, and the architecture is explicit they must not be coupled |

### Battery, treated as a first-order constraint (§29)

- **Movement threshold (25 m)** — a bus parked at a gate for ten minutes does not transmit 85 identical coordinates.
- **…but a heartbeat still runs (60 s)** — skipping forever would make a parked bus indistinguishable from a crashed app. Silence must mean something.
- **`maximumAge: 5000`** — lets the OS return a recent cached fix instead of powering the radio.
- **The watch is torn down the moment no trip is active** — the single largest saving available. No trip, no GPS hardware.

Skipped and sent counts are both surfaced on the GPS screen, so the battery saving is visible rather than a silent behaviour.

### Status signals, kept separate

Trip status, location permission, movement state and connectivity are four independent readings, shown separately in the always-visible status strip and never merged into one badge. "Offline", "location blocked" and "trip finished" have completely different remedies; collapsing them would tell the driver to fix the wrong thing.

Movement state derives from reported speed where the device provides it, falling back to displacement between fixes.

### Offline — exactly what §14 specifies, and nothing more

> *"Offline detection with an explicit banner; queued actions are not silently replayed against non-idempotent endpoints."*

So: an explicit full-width banner, a dropped-ping counter, and **no queue**. When connectivity returns, sharing resumes from the current position.

This is not a shortcut. A backlog of stale coordinates flushed on reconnect would draw a bus moving through positions it left ten minutes ago — actively misleading to a parent watching a map. The architecture's prohibition on inventing sync and the correct product behaviour agree here. **No offline sync, no queued writes, no background reconciliation was built.**

---

## 5. Realtime implementation

Two subscriptions, both in `TripProvider`, both through the existing reference-counted registry:

| Channel | Condition |
|---|---|
| `trip:{id}:status` | while a trip is active |
| `user:{id}:notifications` | while signed in |

- **One logical subscription per resource.** `NotificationsRoute` originally subscribed as well; the registry would have deduped it by channel name, but the duplicate was removed anyway — that principle is worth holding structurally rather than relying on the registry to clean up after a habit.
- **No GPS-position subscription.** This app *writes* pings; subscribing to hear its own writes echoed back would be pointless traffic.
- **Teardown** is handled by `useRealtimeSubscription` on unmount, and `unsubscribeAllChannels()` runs on sign-out in `@masar/auth`. The GPS watch and both timers are cleared in their effect cleanups, including any pending trailing update.

---

## 6. Mobile UX decisions

Capacitor-first, one-handed, in motion, possibly gloved:

- **Targets exceed the §21 floor.** 44px is a minimum for a stationary user. The tab bar is 64px, primary actions 56–64px, More rows 64px.
- **Five tabs, no nesting on the hot path.** Home · Trip · Riders · Route · More. Everything touched while moving is one tap deep.
- **The status strip is chrome.** "Is the nursery still seeing me?" never requires navigating.
- **The offline banner is a full-width bar**, not a badge — losing signal changes what the app can do.
- **No text input anywhere on the trip path.** Every action is a tap; the only typed field in the app is the login form.
- **No confirmation dialogs on rider actions.** A dialog on a moving bus is a second thing to aim at. The safeguard is that a failed action is *withdrawn*, not that it is hard to press.
- **Outstanding riders sort first.** On a bus at a stop the useful question is "who is still to do"; making a driver scroll past twenty completed rows is how children get missed.
- Safe-area insets respected throughout; no desktop layout is reused.

---

## 7. Driver safety constraints

**RLS is the only authorization boundary. No client-side security filtering exists in this app.**

| Requirement | How it holds |
|---|---|
| No children outside assigned trips | Manifest reads `trip_child_status` for the active trip; RLS limits rows to trips on `current_driver_bus_ids()`. Child records come from the gated function. |
| No historical trips | Today only, by design (§2). |
| No buses outside assigned driver | `buses` is queried with **no driver filter** — RLS returns only their own. |
| No other drivers | No driver read of any kind exists except the signed-in user's own profile. |
| No tenant-wide data | Nothing outside the driver's §12 row is read: no attendance, evaluations, concerns, billing, chat, cameras, AI reports, pickup passes, activity log. |

The trip-id and bus-id comparisons in the manifest are **join keys, not access checks**. Re-implementing tenant or driver filtering client-side would duplicate the authorization boundary somewhere it can drift — and a client filter that *disagrees* with RLS is worse than none, because it looks like security while enforcing nothing.

All four driver RPCs additionally re-check `current_role() = 'driver'` **and** `bus_id = ANY(current_driver_bus_ids())` server-side, so the client-side `canRunTrip`/`canUpdateChildStatus` helpers are UX affordances only.

### Non-idempotent handling

`update_child_trip_status` is one of the seven. `useRpcMutation` hard-codes `retry: false`; it is not on `OPTIMISTIC_SAFE_RPCS` so no optimistic path is even type-possible; and **after a failure the control is not re-armed** — the rider enters a "needs checking" state until the driver refreshes. `retry: false` stops the *client* retrying; it does nothing about a driver tapping again because nothing visibly happened. A double tap sends the family two "picked up" notifications.

`start_trip` and `complete_trip` are *not* on the seven-RPC list and correctly need no such guarding: both are idempotent by construction (`INSERT … ON CONFLICT DO NOTHING`; `UPDATE … WHERE status NOT IN ('completed','cancelled')`).

---

## 8. Enum audit

Ran the full Parent-hotfix procedure — three mechanical passes plus a cast scan — against `apps/driver`, then re-ran it across all six portals for regression.

### Preventive design

`lib/enums.ts` holds every enum value this portal uses, each annotated with its generated type. **No route file writes a bare enum literal.** Three properties follow:

1. `readonly TripStatus[]` makes a wrong literal a **compile error**, not a runtime silence.
2. Label and tone maps are `Record<TheEnum, …>` — **exhaustive by construction**. Adding a value to a database enum breaks the build until a label is supplied.
3. `asTripStatus` / `asTripLeg` / `asChildTripStatus` / `asNotificationSeverity` narrow via `hasOwnProperty` and return `null` for unknowns, so an unrecognised value renders raw rather than being mislabelled.

### Findings

| Pass | Result |
|---|---|
| 1 — literal vs enum column | 4 hits, **all false positives** (`AppError.code` vs `plan_code`; `MasarClaims.role` vs `staff_role`) |
| 2 — exhaustive (7 valid comparisons listed) | 2 hits, **both false positives** (`useAuth().status` is `AuthStatus`, not a DB column) |
| 3 — mixed enum/non-enum arrays | 2 hits, **both false positives** (a doc comment quoting the old bug; router path strings) |
| **Cast scan** | **1 real finding — fixed** |

**The one real finding was mine.** `HomeRoute.tsx` had `TRIP_LEG_LABEL[activeTrip.leg as TripLeg]` — an unchecked cast, exactly the pattern that hid the Dashboard payment defect. It was harmless in practice because of a `?? ` fallback, but it violated the rule this portal is built around. Replaced with `asTripLeg()`.

The four remaining `as` expressions all live inside `lib/enums.ts` and are **guarded narrowings** — each preceded by a `hasOwnProperty` check — not unchecked assertions. That distinction is the whole difference between the two patterns.

### Regression across all six portals

15 mismatches workspace-wide, all previously triaged false positives: `AuthStatus` session state (13) and `employment_status` compared through a parameter named `status` (2). **No new real mismatch anywhere.**

---

## 9. Limitations

1. **Unverifiable against real data.** The staging database is still empty, so every screen renders its empty state. The trip lifecycle, manifest, GPS write path and RLS scoping are structurally correct but **not empirically confirmed**. The seeded dataset remains the outstanding prerequisite from Phase 1 — and the Parent hotfix demonstrated exactly what that gap hides.
2. **Web geolocation, not background geolocation.** `watchPosition` only runs while the page is alive and foregrounded. True background GPS needs the Capacitor shell and a native plugin — Stage 10's "adds: background geolocation" is not satisfiable in a Vite web build. **A driver who backgrounds the app or locks the phone stops transmitting.** This is the single most important item before real use.
3. **No offline cache.** §13 permits an encrypted native cache holding the driver's manifest; that is a Capacitor capability and is not built. Offline behaviour here is banner + no-queue, exactly as §14 specifies.
4. **No map.** A tile provider is not in this phase's dependency set. Route Status is an ordered stop list; position is a coordinate readout. A fabricated map would be worse than an honest list.
5. **Stops are roster order, not an optimised route** — there is no routing engine in v1 (EPIC_3 known limitations). The screen says so, because a driver who assumes otherwise will drive it wrong and blame the app.
6. **`reached_at` is read-only** — no `mark_stop_reached` RPC is deployed. Displayed where the backend populates it; never written, and never inferred from GPS proximity.
7. **Marking a notification read is not implemented** — no `mark_notification_read` RPC exists. Same finding as Phases 5–7.
8. **The manifest is a start-time snapshot.** `start_trip` copies `bus_riders` into `trip_stop_riders`; a child added mid-run does not join the run under way. That is the backend's semantics, reflected rather than papered over.
9. **Profile is read-only** — no driver-facing profile update RPC exists.
10. **No push notifications** — requires the Capacitor shell.
11. **No tests** — out of scope for this phase.
12. **`--surface-app` workaround persists** (the frozen design system paints a token that does not exist; the real one is `--bg-app`). Sixth and final portal to work around it.
13. **`PageHeader` and `States` are now duplicated across all six portals** — §3 sets the promotion threshold at three. With every portal built, this refactor is maximally justified and maximally cheap to verify.

---

## 10. Verification

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              driver: 540.56 kB │ gzip: 160.42 kB

enum audit pass 1 (literal vs column)     → 0 real findings
enum audit pass 2 (exhaustive)            → 0 real findings
enum audit pass 3 (mixed arrays)          → 0 real findings
cast scan                                 → 1 found, 1 fixed, 0 remaining
guarded narrowings (hasOwnProperty)       → 4, all in lib/enums.ts
six-portal regression                     → 0 new mismatches

direct table writes (.insert/.update/.upsert/.delete)  → none
direct Supabase imports                                → none
academic.children base-table reads                     → none (gated fn only)
useOptimisticRpcMutation                               → none
client-forbidden RPCs                                  → none
edge functions                                         → none
realtime channels                                      → 2, both in TripProvider
non-idempotent RPCs                                    → 1, retry:false + not re-armed
source files changed outside apps/driver               → 0
backend / shared package files changed                 → 0
```

---

## 11. Files changed

All 32 files are new, all under `frontend/apps/driver/src/`:

```
styles.css  main.tsx  App.tsx  vite-env.d.ts  app/providers.tsx

lib/         enums.ts  driver.ts  format.ts
             tripContext.ts  TripProvider.tsx
             useGpsTracker.ts  useChildStatus.ts  useDriverChildren.ts

components/  PageHeader.tsx  States.tsx  StatusStrip.tsx  RiderCard.tsx

routes/      router.tsx  DriverShell.tsx  NotFound.tsx  MoreRoute.tsx
             HomeRoute.tsx  TripRoute.tsx  TripsRoute.tsx
             ManifestRoute.tsx  RouteRoute.tsx  BusRoute.tsx
             GpsRoute.tsx  NotificationsRoute.tsx  SettingsRoute.tsx
             auth/AuthGate.tsx  auth/LoginRoute.tsx
```

Deleted: the Phase 1 placeholders `routes/Placeholder.tsx` and `routes/RootLayout.tsx`.

**Nothing outside `apps/driver/` was modified.** No shared-package change was required — see §3 for the one place it was nearly needed and how it was avoided.

---

**The Driver App is complete and verified. All six portals are now implemented.**

**Stopping here** — no integration, E2E, QA, deployment, or production-readiness work started, as instructed.

**One item to carry forward:** limitation #2. Background geolocation is a native capability this web build cannot provide, and a driver who locks their phone stops transmitting position. That is a functional gap in the product promise, not a polish item, and it should be resolved in the Capacitor stage before the Driver App is used on a real route.
