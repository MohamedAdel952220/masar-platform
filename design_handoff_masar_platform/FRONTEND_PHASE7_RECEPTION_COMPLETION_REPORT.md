# Frontend Phase 7 — Reception App, Completion Report

**Scope:** the Reception App only. Driver was not started.
**Built on:** Phase 1 foundation, Phase 2 backend integration, and the Platform Admin / Dashboard / Teacher / Parent patterns — all consumed as-is.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, **0 errors, 0 warnings** |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps (reception: 530 KB raw / **157 KB gzipped**) |
| Source files changed outside `apps/reception` | ✅ **0** |
| Files changed under `backend/` | ✅ **0** |
| Direct table writes | ✅ **0** — every write is a deployed RPC |

> ⚠️ **This report also records a defect I introduced in Phase 6 (Parent App).** It is real, it is user-visible, and I did not fix it because previous portals are frozen. See §6 — please read that section.

---

## 1. What was built

23 files. All 10 scope areas delivered.

```
src/
├─ styles.css  main.tsx  App.tsx  app/providers.tsx
├─ lib/        format.ts · reception.ts (scope + scan contract) · transport.ts
├─ components/ PageHeader · States
└─ routes/
   ├─ router.tsx  ReceptionShell.tsx  NotFound.tsx  MoreRoute.tsx
   ├─ auth/       AuthGate.tsx  LoginRoute.tsx     (—  Authentication)
   ├─ HomeRoute            (1  Reception home)
   ├─ VisitorsRoute        (2  Today's visitors)
   ├─ PickupRoute          (3  Child pickup)
   ├─ ScanRoute            (4  QR scanner flow)
   │                       (5  Pickup pass validation)
   │                       (6  Guardian verification)
   │                       (7  Handover confirmation)
   ├─ NotificationsRoute   (8  Notifications)
   ├─ LogRoute             (9  Daily log)
   └─ SettingsRoute        (10 Settings)
```

Scope items 4–7 are **one screen, deliberately.** A handover is a single continuous interaction with a person standing at the desk; routing between four steps would discard the scan state on a back-swipe mid-handover, at exactly the moment that matters most. The screen is a four-phase state machine (`idle → scanning → result → confirmed`) rather than four routes.

The shell gives **Scan** the centre tab with a filled treatment rather than a flat icon. Scanning is the one thing this app exists to do, it happens under time pressure with a queue waiting, and it should be reachable without aiming.

---

## 2. The constraint that shaped this portal most: §13.4

**This app never lists `safety.pickup_passes`. Not once.**

§13.4 is unusually explicit, and worth quoting because it is easy to read past:

> The RLS policy for `reception` role on `pickup_passes` is `SELECT`-only, scoped to `tenant_id = current_tenant_id()`, and the frontend only ever queries by exact `qr_token` match (**enforced by never exposing a "list all passes" query path to the reception role at the API layer, even though RLS alone doesn't strictly forbid it** — this is documented as an intentional two-layer control, not solely relying on RLS).

So RLS would permit `SELECT * FROM pickup_passes`. The second layer — withholding the list query path — is *this application's* responsibility, and nothing else enforces it. A pass is reachable only by exact `qr_token` through `scan_pickup_pass`. The token is opaque and high-entropy precisely so reception can validate one pass without being able to enumerate every family's pickup arrangements.

Verified by grep: `useSafetyList` is called exactly twice, both times with `pickup_scan_events`. There is also no route that could host such a list.

**This cost something real, and I paid it rather than working around it.** "Today's visitors" cannot show the collector's name, because names live on `pickup_passes`. A name is resolvable *at scan time*, when the desk is holding the token; it is not resolvable retrospectively by browsing. Losing the name on that screen is the intended price of not being able to enumerate passes.

Which is why **Today's visitors is built from `pickup_scan_events`** — there is no `visitors` table in the deployed schema, and rather than invent one, the screen uses what actually records a person arriving at this desk. That turns out to be the more truthful source anyway: every scan attempt is logged, valid or not (§3.32), so the list doubles as the record of who was *turned away* — exactly what a front desk needs at end of shift.

---

## 3. Server-authoritative handover

`confirm_handover` is one of the **seven non-idempotent RPCs**, and the backend earns that classification honestly:

```sql
update safety.pickup_scan_events
   set handover_confirmed = true
 where id = p_pickup_scan_event_id
   and tenant_id = v_tenant_id
   and result = 'valid'
   and not handover_confirmed
```

An atomic `UPDATE ... WHERE`, so a double-confirm cannot double-hand-over — the second call fails with `STATE_ALREADY_PROCESSED`. The same call also moves the child's day-path to `delivered` and enqueues the guardian notification server-side, which is why the client attempts neither.

The client's whole job is to **ask**. Concretely, that means:

| Rule | How it appears in the code |
|---|---|
| `retry: false` | `useRpcMutation` hard-codes it |
| No idempotency key | Correct — non-idempotent RPCs take none; `idempotent: true` would be ignored |
| **No re-arm after failure** | On error the confirm button is *replaced* by "Do not press confirm again — the handover may already have been recorded. Start a new scan to check." |
| No optimism | `useOptimisticRpcMutation` appears nowhere (grep-verified) |

That third row is the one worth dwelling on. `retry: false` alone only stops *automatic* retries; a re-armed button invites the operator to do the same thing by hand, which is the actual hazard at a physical desk. The same pattern is applied to `update_child_trip_status` on the pickup screen.

Both scan RPCs additionally re-check `current_role() = 'reception'` server-side, so the client-side `canScanPickupPass`/`canConfirmHandover` helpers are UX affordances, never the boundary.

### Guardian verification is enforced, not suggested

The **Confirm handover** button stays disabled until the operator ticks *"I have checked this person's ID and it matches the pass."* The pass shows the collector's name and relation, and the child's name resolved from `academic.children`.

One thing I refused to paper over: the pass may carry `id_photo_object_id`, but that points into `storage_objects` — a subsystem that was **never implemented** (`BACKEND_CERTIFICATION.md` §7.3). There is no path to resolve it to an image. Rather than silently drop an identity check at a *child handover desk*, the screen states the situation and directs the operator to physical ID. A missing photo must not become a missing verification step.

---

## 4. Other constraints honoured

### Reception RLS visibility, and PII discipline

§12 grants reception `R` on children **"all, name/photo/parent only"** — narrower than what the row physically contains. `academic.children` also carries date of birth, blood type, **allergies**, both parents' national IDs and jobs, and the home address. RLS returns those columns; the restriction is on what a front desk has any business displaying.

So `PickupRoute` shows name, day state, and one parent phone — nothing else. The phone is included because §12 names "parent" explicitly and it is the one field a desk genuinely needs (a child uncollected at closing time). Allergies and medical data are deliberately absent: they belong to the teacher supervising the child, not to the person opening the door.

Everything absent from reception's §12 row is absent from this app entirely: no attendance, evaluations, concerns, billing, chat, cameras, or AI reports.

### No direct table writes

Grep-verified: no `.insert()`, `.update()`, `.upsert()`, `.delete()`, or `.raw()` anywhere. Three RPCs and nothing else:

| RPC | Screen | Notes |
|---|---|---|
| `scan_pickup_pass` | Scan | Read-shaped but write-bearing (logs every attempt); called via `callRpc` |
| `confirm_handover` | Scan | **Non-idempotent** · retry:false · not re-armed |
| `update_child_trip_status` | Child pickup | **Non-idempotent** · retry:false · not re-armed |
| `update_notification_preferences` | Settings | Optimistic-safe, plain mutation used anyway |

No Edge Functions are called — reception's §12 row needs none.

`platform.activity_log` is read-only here. Every row was written server-side by `write_audit_log` inside an RPC, and that function is on the **client-forbidden** list precisely so a client cannot forge an entry.

### The scan contract is parsed, not cast

`scan_pickup_pass` is typed `Returns: Json` because PostgREST cannot describe a `jsonb_build_object` shape. Rather than a bare `as`, `parseScanOutcome` validates the shape at runtime. An unchecked cast would turn a backend contract change into a blank screen at a physical handover desk instead of a legible error.

The server also rate-limits scanning to **30 attempts / 60 seconds per operator**; that is documented in `lib/reception.ts` so a busy pickup window produces a real explanation rather than a mystery failure.

### Realtime

Two channels, both via `useRealtimeSubscription`:

| Channel | Screen |
|---|---|
| `user:{id}:notifications` | Home, Notifications |
| `trip:{id}:status` | Child pickup (only while a run is active) |

Reception has **no scan channel** in the §15 matrix, and I did not invent one: scan events are written *by this device*, so the local mutation's invalidation is the fresher signal. Subscribing to hear about one's own writes would be pointless traffic.

---

## 5. Reused, not rebuilt

- **Design system:** `Avatar`, `Badge`, `Button`, `Card`, `CenteredLayout`, `Icon`, `Input`, `StatCard`.
- **Hooks:** `useAcademicList`, `useCommsList`, `useIdentityList`, `usePlatformList`, `useSafetyList`, `useTransportList`, `useRpcMutation`, `useRealtimeSubscription`, `callRpc`.
- **Auth / i18n:** `signInWithPhone`, `signOut`, `useAuth`, `useLocale`.

`PageHeader` and `States` are now duplicated across **five** portals. §3 sets the promotion threshold at three. This is well past overdue and should be the first thing done whenever `@masar/design-system` is unfrozen.

`lib/transport.ts` exists for a specific reason described in §6 below.

---

## 6. ⚠️ A defect I introduced in Phase 6 — please read

While mapping transport enums for this phase, I found that **the Parent App's live trip tracking never works.** It always renders "The bus is not running right now."

```ts
// frontend/apps/parent/src/lib/parent.ts:61  — WRONG
export const LIVE_TRIP_STATUSES = ['in_progress', 'started'] as const;
```

The deployed enum is:

```sql
-- 20260717000002_epic3_fleet_and_trip_tables.sql:19
create type transport.trip_status as enum
  ('scheduled', 'moving', 'arrived', 'completed', 'cancelled');
```

`'in_progress'` and `'started'` **match nothing**. `isTripLive()` always returns `false`, so `liveTrip` is always `null`, so the GPS subscription never mounts and the screen never leaves its empty state. The `useThrottledState` work described in the Phase 6 report is correct but currently unreachable.

**How it got past the gates:** it is a value error, not a type error. `trips.status` is compared against a `readonly string[]`, so TypeScript is satisfied; a status that matches nothing yields an empty result, which looks identical to "no trips today" and never surfaces as an error. With an empty staging database every screen renders its empty state anyway, so nothing looked wrong.

**Why I did not fix it:** the instruction for this phase is explicit — *do not modify previous portals*. Reporting it is the correct action; silently editing a frozen portal is not. **The fix is one line** in `frontend/apps/parent/src/lib/parent.ts`:

```ts
export const LIVE_TRIP_STATUSES = ['moving', 'arrived'] as const;
```

I would recommend authorising that change before the Parent App is used against real data. `apps/reception/src/lib/transport.ts` documents this exact hazard for the same reason.

**This class of bug is likely elsewhere.** Any portal comparing a column against hand-written enum literals has the same failure mode. A short audit of literal-vs-enum comparisons across all six portals would be worth a pass before release — the generated types make the correct values available, but nothing forces their use.

---

## 7. Known limitations

1. **Unverifiable against real data.** The staging database is still empty, so every screen renders its empty state. The scan flow, handover, RLS scoping and realtime handlers are structurally correct but **not empirically confirmed** — the seeded dataset remains the outstanding prerequisite from Phase 1. The defect in §6 is a direct demonstration of why that matters.
2. **No camera-based QR scanner.** The token field is autofocused and submits on Enter, which *is* the correct path for the USB/Bluetooth HID readers used at front desks — they type the code and press Enter. It doubles as manual entry. A camera scanner needs the Capacitor shell, a later roadmap stage.
3. **ID photo cannot be displayed** — `storage_objects` was never implemented (§7.3). Handled as described in §3 rather than dropped.
4. **Marking a notification read is not implemented** — no `mark_notification_read` RPC exists. Same finding as Phases 5 and 6.
5. **Field focus uses a remount key.** The design system's `Input` does not forward a ref and is frozen, so the token field is remounted with `autoFocus` between handovers. It works, but a forwarded ref would be cleaner — add it when the design system reopens.
6. **`create_pickup_pass` / `revoke_pickup_pass` are not surfaced.** Both exist, but §12 assigns pass creation to guardians and revocation to guardians/managers — not reception. Correctly absent.
7. **No visitor log beyond pickups.** There is no `visitors` table; a general visitor book (contractors, prospective parents) would need a backend table that does not exist. Not invented.
8. **Profile is read-only** — no reception-facing profile update RPC exists.
9. **No push notifications** — requires the Capacitor shell.
10. **No tests** — out of scope for this phase.
11. **`--surface-app` workaround persists** (design system paints a token that does not exist; the real one is `--bg-app`). Sixth portal to work around it.
12. **Bundle 157 KB gzipped**, within the <200 KB mobile budget.

---

## 8. Verification evidence

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              reception: 529.82 kB │ gzip: 157.00 kB

grep pickup_passes query path    → NONE (prose references only)
useSafetyList calls              → 2, both 'pickup_scan_events'
direct table writes              → none (.insert/.update/.upsert/.delete/.raw)
RPCs called                      → 4 (2 non-idempotent, both non-re-armed)
grep useOptimisticRpcMutation    → none
client-forbidden RPCs called     → none
edge functions called            → none
realtime channels                → 2
handover gated on ID check       → yes, per-scan acknowledgement
scan response parsed not cast    → parseScanOutcome, runtime-validated
source files changed outside app → 0
backend files changed            → 0
```

---

**The Reception App is complete and compiles cleanly. Driver was not started. Stopping here.**

**One action is requested of you: authorise the one-line Parent App fix in §6, or tell me to leave it.**
