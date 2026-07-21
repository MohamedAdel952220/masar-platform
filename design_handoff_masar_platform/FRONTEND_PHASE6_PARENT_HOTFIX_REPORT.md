# Frontend Phase 6 — Parent Portal Hotfix Report

**Task:** bug-fix only. Correct the Parent portal's live-trip predicate, then audit the remaining portals for identical hard-coded enum literal mismatches and fix any found.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, **0 errors, 0 warnings** |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps |
| Backend files changed | ✅ **0** |
| Shared package files changed | ✅ **0** |
| New features / refactors / architecture changes | ✅ **none** |

**6 defects fixed across 5 files in 4 portals.** One of them (Dashboard payment verification) is more severe than the reported bug.

---

## 1. The reported defect

**`frontend/apps/parent/src/lib/parent.ts`** — live trip tracking never activated.

```diff
- export const LIVE_TRIP_STATUSES = ['in_progress', 'started'] as const;
+ export const LIVE_TRIP_STATUSES: readonly TripStatus[] = ['moving', 'arrived'];
```

`'in_progress'` and `'started'` are not members of `transport.trip_status`, so `isTripLive()` always returned `false`, `liveTrip` was always `null`, the GPS subscription never mounted, and the screen never left its empty state.

`moving` (en route) and `arrived` (at the nursery, children being collected) are the two states a guardian can meaningfully watch. `scheduled` has not begun; `completed`/`cancelled` are closed.

**The type annotation is the actual fix.** `readonly TripStatus[]`, where `TripStatus = Database['transport']['Enums']['trip_status']`, makes any literal outside the enum a compile error. Without it the corrected values would be just as unverified as the wrong ones were.

---

## 2. Audit method

Three mechanical passes over all six portals, driven by the generated types rather than by reading:

1. **Literal-vs-column** — harvested all 70 deployed enums and the 61 enum-typed columns, then flagged every `col === 'literal'` / `p_col: 'literal'` whose literal is not a member of that column's enum.
2. **Exhaustive listing** — same scan, but printing valid comparisons too (160 of them), so completeness could be eyeballed rather than trusted.
3. **Mixed arrays** — any array literal where *some* members are deployed enum values and some are not. This is the signature of a *partial* mismatch, which is more dangerous than a total one because it works for the overlapping values.

Pass 3 was what caught the Teacher defects; passes 1 and 2 missed them because the array's name did not resemble a column name.

---

## 3. Defects found and fixed

### 3.1 Dashboard — payment verification was completely broken 🔴 most severe

**`frontend/apps/dashboard/src/routes/BillingRoute.tsx`**

```diff
- p_decision: 'verified' as PaymentDecision,     // Verify button
+ p_decision: 'succeeded',
- p_decision: 'rejected' as PaymentDecision,     // Reject button
+ p_decision: 'failed',
```

`verify_payment(p_decision billing.payment_status)` accepts only `initiated | pending_verification | succeeded | failed | refunded`, and the function body narrows further:

```sql
if p_decision not in ('succeeded', 'failed') then
  raise exception ... 'VALIDATION_FAILED'
```

`'verified'` and `'rejected'` are not members of the enum at all, so Postgres would have rejected the input before that check even ran. **A manager pressing Verify or Reject on a payment got an error every time.**

The `as PaymentDecision` casts are what hid this. `PaymentDecision` was correctly defined as `Payment['status']` — the cast forcibly silenced the exact error that would have caught it. Both casts are now removed so the literals are type-checked, with an in-file note not to reintroduce them.

Also in the same file, `paymentTone()` tested for `'verified'`, `'settled'` and `'rejected'` — none of which exist — so a **succeeded payment rendered neutral instead of green**. Corrected to `succeeded` / `pending_verification` / `failed`, preserving the original tone intent exactly.

### 3.2 Teacher — two day-path states rendered no status 🟠 partial mismatch

**`frontend/apps/teacher/src/routes/HomeRoute.tsx`** and **`StudentsRoute.tsx`**

Both held a list of the design system's `ChildStatus` values and tested `children.day_path_status` against it:

```diff
- const DAY_PATH_STATUSES = ['at-home','in-bus','arrived','classroom','playing','nap','left','delivered']
+ const DAY_PATH_PILL: Record<string, ChildStatus> = {
+   at_home: 'at-home', in_bus: 'in-bus', classroom: 'classroom',
+   playing: 'playing', nap: 'nap', delivered: 'delivered',
+ };
```

The deployed enum is snake_case (`at_home`, `in_bus`); `ChildStatus` is kebab-case and adds two presentation-only states (`arrived`, `left`) that no column ever produces. Four of six values happen to be spelled identically in both, so the code worked for `classroom`, `playing`, `nap` and `delivered` — and silently failed for `at_home` and `in_bus`, which fell through to a raw badge (Home) or rendered **nothing at all** (Students).

A mapping is required rather than a corrected list, because `StatusPill` will not accept the DB spelling. The render structure is otherwise unchanged.

### 3.3 Parent & Reception — notification severity was never indicated 🟠

**`frontend/apps/parent/src/routes/NotificationsRoute.tsx`**
**`frontend/apps/reception/src/routes/NotificationsRoute.tsx`**

```diff
- if (severity === 'critical' || severity === 'high') return 'amber';
- if (severity === 'normal') return 'info';
+ if (severity === 'urgent') return 'amber';
+ if (severity === 'attention') return 'info';
  return 'neutral';
```

`comms.notification_severity` is `info | attention | urgent`. None of `critical`, `high` or `normal` exist, so **every** notification fell to the neutral default and severity was never conveyed. The Reception copy inherited this when I derived that screen from the Parent one.

The Teacher portal's equivalent function was already correct and served as the reference for intent.

---

## 4. Confirmed false positives — deliberately not changed

The scan raised 25 further hits. All were verified against their definitions and left alone:

| Pattern | Sites | Why it is correct |
|---|---|---|
| `status === 'loading' \| 'authenticated'` | 6 AuthGates | `useAuth().status` is `AuthStatus`, a session state — not a DB column |
| `status === 'on_leave' \| 'terminated'` | Dashboard TeachersRoute | Parameter is named `status` but receives `row.employment_status`; both values are valid `employment_status` members |
| `code === 'PERM_ROLE_DENIED' \| 'RATE_LIMITED'` | 5 sites | `AppError.code`; the column-name heuristic collided with `plan_code` |
| `role === 'guardian' \| 'platform_admin'` | 5 sites | `MasarClaims.role` is `Role` (`guardian, teacher, reception, manager, driver, platform_admin`), not `staff_role` |
| `role === 'all'` | Dashboard TeachersRoute | Local filter state, not a column |

The Driver portal produced **no findings** in any pass.

---

## 5. Why these passed the original gates

Every one of these is a **value** error, not a type error:

- A status compared against `readonly string[]` type-checks regardless of content.
- An unmatched value yields an empty list or a default branch — **indistinguishable from "no data today"**.
- `as` casts (Dashboard) actively suppressed the one error TypeScript would have raised.
- The staging database is empty, so every screen renders its empty state and nothing looks wrong.

Three of the six defects failed *silently and totally*; two failed *partially*, which is worse — they looked correct for the values that happened to overlap.

**Structural recommendation** (not implemented — out of scope for a hotfix): enum-derived literals should be annotated with their generated type, as `LIVE_TRIP_STATUSES` now is. That converts this entire bug class from a runtime silence into a compile error. A lint rule banning `as` on RPC argument literals would close the Dashboard variant specifically.

---

## 6. Files changed

```
frontend/apps/parent/src/lib/parent.ts                     live-trip predicate + TripStatus annotation
frontend/apps/parent/src/routes/NotificationsRoute.tsx     severity literals
frontend/apps/teacher/src/routes/HomeRoute.tsx             day-path enum → pill mapping
frontend/apps/teacher/src/routes/StudentsRoute.tsx         day-path enum → pill mapping
frontend/apps/dashboard/src/routes/BillingRoute.tsx        verify/reject decisions + payment tones
frontend/apps/reception/src/routes/NotificationsRoute.tsx  severity literals
```

No other files touched. No backend, shared package, architecture, or feature changes.

---

## 7. Verification evidence

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              parent 161.56 kB · dashboard 162.73 kB · teacher 159.51 kB
              reception 156.99 kB · platform-admin 157.80 kB · driver 117.57 kB (gzip)

enum audit pass 1 (literal vs column)  → 0 real mismatches remaining
enum audit pass 2 (exhaustive, 160 valid comparisons listed) → 0 real mismatches remaining
enum audit pass 3 (mixed arrays)       → 0 real mismatches remaining
backend files changed                  → 0
shared package files changed           → 0
```

---

**Hotfix complete. Stopping here.**

**One thing to flag:** §3.1 is a payment-path defect in an already-signed-off portal, materially more severe than the trip-status bug that prompted this task. Since it was found by audit rather than by deployment, the Dashboard's payment verification flow has most likely never been exercised end-to-end against the live database. I would treat that as unverified until someone runs it.
