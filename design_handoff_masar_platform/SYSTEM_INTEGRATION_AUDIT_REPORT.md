# Masar Platform — System Integration Audit Report

**Phase 9 — first complete frontend ↔ backend integration.**
Backend: Epics 1–10, frozen. Frontend: six portals, Phases 1–8, complete.

---

## 1. Executive Summary

The two systems integrate correctly. The contract surface — 46 public RPCs, 19 Edge Functions, 13 exposed schemas, 12 realtime channels, ~4,400 lines of generated types — is consumed accurately, and the architectural boundaries (RLS as sole authority, RPCs for writes, no direct table mutation) hold across all six portals without exception.

**Eight issues were found. Three were fixed; five are documented.** Two of the three fixed were serious:

| # | Issue | Severity | Status |
|---|---|---|---|
| I1 | Teacher App called a **manager-only** RPC — send button failed on every press | **High** | ✅ Fixed |
| I2 | §19 human-review gate existed only on that broken button; the Dashboard sent AI reports with **no review gate at all** | **High** | ✅ Fixed |
| I3 | Query cache **never purged on logout** in any portal, contrary to a §13 "non-negotiable" | **High** | ✅ Fixed |
| I4 | `app_access` claim issued by the backend is **never enforced** by any portal | Medium | 📋 Documented |
| I5 | **Activation and password-reset flows are unreachable** — built in `@masar/auth`, no UI anywhere | **High** | 📋 Documented (blocker) |
| I6 | `Portal` union diverges from the deployed `tenancy.app_code` enum | Low | 📋 Documented |
| I7 | Shared guards `RequireAuth`/`RequirePortal`/`RequireRole` are dead code | Low | 📋 Documented |
| I8 | 12 of 19 Edge Functions have no frontend caller | Medium | 📋 Documented |

All gates re-verified after the fixes: **typecheck 10/10, lint 10/10 (0 warnings), format clean, build 6/6.**

The single item preventing production use is **I5**: no provisioned account can complete activation, because no portal exposes the flow. That is a missing frontend feature, not an integration defect, and building it was explicitly out of scope for this phase.

---

## 2. Verified Areas

### 2.1 RPC integration — ✅ correct

23 call sites, 15 distinct RPCs, cross-checked against the deployed catalogue for name, argument keys, required/optional arity, return handling, and classification.

- **Every RPC name and payload is verified by the build itself.** `useRpcMutation<K>` and `callRpc<K>` are keyed on `keyof Database['public']['Functions']`, so a wrong name or a wrong argument shape is a compile error. Typecheck passing *is* the proof for that layer.
- **All 6 client-forbidden RPCs are unreachable**: `write_audit_log`, `idempotency_replay`, `idempotency_store`, `create_bus_with_driver_row`, `enroll_child_row`, `payment_transactions_support_view` — zero call sites.
- **Non-idempotent handling is correct** at all 3 call sites (`confirm_handover`, `update_child_trip_status` ×2): `retry: false` hard-coded, no idempotency key, no optimistic path, and the control is **not re-armed after failure** in every case.
- **`useOptimisticRpcMutation` is used nowhere.** Both optimistic-safe RPCs (`register_device_token`, `update_notification_preferences`) deliberately use the plain mutation.

**Runtime guards — the layer TypeScript cannot see — were extracted from the deployed function bodies and cross-checked against the calling portal:**

| RPC | Server role gate | Called from | Verdict |
|---|---|---|---|
| `start_trip`, `complete_trip`, `record_gps_ping` | ONLY driver | Driver | ✅ |
| `scan_pickup_pass`, `confirm_handover` | ONLY reception | Reception | ✅ |
| `submit_evaluation` | ONLY teacher | Teacher | ✅ |
| `mark_attendance` | teacher, manager | Teacher | ✅ |
| `send_message` | guardian, teacher | Parent, Teacher | ✅ |
| `update_child_trip_status` | driver, reception | Driver, Reception | ✅ |
| `review_request`, `verify_payment` | ONLY manager | Dashboard | ✅ |
| `update_support_ticket` | `is_platform_admin()` | Platform Admin | ✅ |
| `refund_tenant_billing_transaction` | owner/admin tier only | Platform Admin | ✅ tier-gated via `canManageBilling` |
| `send_report_draft` | **ONLY manager** | **Teacher** ❌ + Dashboard ✅ | **I1 — fixed** |

**Value guards** (the defect class behind the Phase 6 hotfix) were checked explicitly:

- `verify_payment`: `p_decision not in ('succeeded','failed')` → frontend sends `'succeeded'`/`'failed'` ✅ *(corrected in the earlier hotfix)*
- `review_request`: `p_decision not in ('approved','rejected')` → frontend sends `'approved'`/`'rejected'` ✅

The `review_request` call uses two `as unknown as` casts. **This is correct and should not be "fixed":** `supabase gen types` mis-maps that parameter (it emits `'PENDING'|'SUCCESS'|'ERROR'` where the deployed signature is `approvals.request_status`). The workaround is isolated to two named constants carrying the correct runtime values, and is documented in-file. This is a code-generator defect, not a frontend one.

### 2.2 Edge Functions — ✅ correct where used

- **All 3 client-forbidden functions are unreachable**: `payment-webhook`, `camera-heartbeat`, `notification-dispatch` — zero call sites. Correct: the first is a PSP server-to-server callback, the second a machine-identity path, the third a scheduled dispatcher.
- **4 functions are called**, all with correct payloads and callers: `initiate-payment` (Parent), `camera-stream-token` (Parent), `ai-polish-note` (Teacher), `ai-draft-report` (Teacher).
- Request/response shapes are enforced by `EdgeFunctionContracts`, so payload mismatches are compile errors.
- 12 remain uncalled — see **I8**.

### 2.3 PostgREST and schema exposure — ✅ correct

- 12 schemas are accessed; all appear in `config.toml`'s `[api].schemas` (13 exposed).
- **`analytics` is never queried directly** — verified by grep across all source. The only matches are route path strings named "analytics".
- All three analytics surfaces go through deployed views: `academic.v_child_attendance_summary` (Dashboard, Parent), `platform.v_tenant_billing_summary`, `platform.v_tenant_health_summary` (Platform Admin).
- Every analytics surface renders `computed_at` via `StalenessIndicator`, as §12 requires.
- **Zero direct Supabase imports in any app.** `getSupabaseClient` appears only inside `@masar/api-client`; `.schema()` is called only in the 12 read builders.

### 2.4 Realtime — ✅ correct, no leaks

- 12 channel factories deployed; 20 subscription sites across 6 portals; all use `useRealtimeSubscription`.
- **Reference counting verified**: the registry keys by channel name, adds listeners to a shared entry, and removes the channel only when the last listener unsubscribes. Several portals subscribe the same factory from two screens — these **share one socket with two listeners**, which is the registry working as designed, not duplicate channels.
- **Teardown on sign-out verified**: `signOut()` calls `unsubscribeAllChannels()` **before** `auth.signOut()`, so no socket outlives the credential that authorized it.
- Filters match the §15 matrix: `trip:{id}:position` filters `trip_id`, `conversation:{id}:messages` filters `conversation_id`, `user:{id}:notifications` filters `recipient_id`.
- Chat and the Driver's GPS subscribe to **one** conversation/trip at a time — the narrowest filter §15 permits.

### 2.5 Generated contracts — ✅ correct

- **No hand-written row types anywhere.** Every domain type derives from the generated helpers (`AcademicRow<'children'>`, `BillingRow<'invoices'>`, `RpcArgs<'review_request'>`, `Database['transport']['Enums']['trip_status']`, …).
- **No duplicate interfaces, no manual payload contracts.** Edge Function payloads come from `EdgeFunctionContracts`; RPC payloads from `RpcArgs<K>`.
- The Driver App's `lib/enums.ts` is the strongest pattern in the codebase: every enum value declared once with its generated type, label maps as `Record<TheEnum, …>` so they are exhaustive by construction. **Recommended as the pattern to adopt in the other five portals.**
- One dead hand-written union found: `DashboardRole = 'manager' | 'teacher'` — declared, never used. See I6.

### 2.6 Authorization — ✅ correct

**RLS is treated as authoritative everywhere. No portal duplicates a security filter.** Verified by pattern search across all source:

- No `.filter(x => x.tenant_id === …)` — zero occurrences.
- No client-side guardian, driver, staff or owner filtering — zero occurrences.
- The two `classroom_id`/`bus_id` filters found (Dashboard Timeline, Driver Bus) are **join keys within already-scoped data**, not access checks, and are documented as such in-file.
- Capability helpers (`canManageBilling`, `isManager`, `canRunTrip`, …) are consistently UX-only: every one has a server-side counterpart that is stricter, and each portal's docs say so.
- Reception's §13.4 two-layer control holds: `pickup_passes` is **never listed**; passes are reachable only by exact `qr_token` through `scan_pickup_pass`.
- The Driver App reads children only through the gated `academic.children_driver_safe()`, never `academic.children` — the minimal-fields rule is enforced server-side, not by client redaction.

### 2.7 Navigation — ✅ correct

- 71 routes across 6 portals. Every `element` resolves to an imported component — **zero orphans**.
- Every internal `<Link to="…">` resolves to a declared route — **zero broken links**.
- Every portal has a `*` → `NotFound` fallback and an `errorElement`.
- Deep links (`notifications.deep_link`) are followed only when the stored value starts with `/`, so a stored value can never navigate off-origin. Handled in Parent and Driver; the other four portals ignore `deep_link` (harmless inconsistency, not a defect).

### 2.8 Backend feature coverage

| Domain | Frontend integration | Status |
|---|---|---|
| Platform | Tenants, billing, support tickets, service health, audit log | ✅ |
| Academic | Children, classrooms, attendance, evaluations, lessons, concerns, day-path | ✅ |
| Transport | Buses, trips, stops, riders, GPS, child status | ✅ |
| Safety | Pickup scan + handover (passes correctly never listed) | ✅ |
| Approvals | Requests, review decisions | ✅ |
| Billing | Invoices, ledger, payments, verification, refunds | ✅ |
| Media | Cameras, stream tokens, `online`/`admin_disabled` independence | ✅ |
| Reports | AI drafts, usage counters, send | ✅ (after I1/I2) |
| Jobs | — | ⚠️ no frontend surface (see §8) |
| Analytics | 3 views + `computed_at` | ✅ |
| Notifications | Read + realtime; preferences | ⚠️ mark-read RPC absent (§4) |
| AI | Polish, draft, quota display | ✅ |
| Payments | Server-authoritative initiate → webhook | ✅ |
| Camera | Token minting, independent status booleans | ✅ |
| Realtime | 12 channels | ✅ |

---

## 3. Integration Issues Found

### I1 — Teacher App called a manager-only RPC 🔴 **High · FIXED**

`apps/teacher/src/routes/ReportsRoute.tsx` rendered an enabled **"Send to family"** button wired to `send_report_draft`. The deployed function opens with:

```sql
if public.current_role() <> 'manager' then
  raise exception ... 'PERM_ROLE_DENIED' — 'Only a manager can send a report draft.'
```

`canSendReports()` returned `claims.role === 'teacher'`, so the gate was inverted relative to the server. **Every press failed.**

§12's AI Reports row is unambiguous: teacher `C (own students), R own`; manager `CRUD (all)`. The backend is right; the UI gate was wrong.

Per §14, a `PERM_ROLE_DENIED` reaching the UI *"signals a capability-gate gap and is logged as a UX defect"* — this is precisely that, and it survived five phases because the staging database is empty, so the button was never pressed against a real session.

**Fix:** `canSendReports()` now returns `false` with the server contract quoted in-file; the send button, its mutation and its error banner are removed from the Teacher App. Teachers still draft and read every draft about their own children; the manager sends.

### I2 — The §19 human-review gate guarded nothing 🔴 **High · FIXED**

This is the more serious half of I1, and only a system-level audit could surface it.

The Phase 5 report described the per-draft acknowledgement gate as the Teacher App's headline safety feature: *"a draft's Send button stays disabled until the teacher has expanded that specific draft and ticked 'I have read this draft and it is accurate'."* That was implemented and it worked — **on the button that could never send anything.**

Meanwhile the Dashboard, where `send_report_draft` actually succeeds, sent with **no review gate whatsoever**:

```tsx
<Button size="sm" disabled={send.isPending} onClick={() => send.mutate({ p_draft_id: row.id })}>
```

Net effect in the deployed system: **AI-generated reports could reach families with no enforced human review at all.** §19 requires the opposite.

**Fix:** the acknowledgement gate now lives where sending happens. The Dashboard's action column offers **"Read draft"**, which opens a panel showing the full body and a per-draft checkbox; **"Send to family"** stays disabled until it is ticked. The acknowledgement is per-draft, so reviewing one report never unlocks another, and it resets after a successful send.

> **Judgement call, flagged for review.** Adding this panel is the one change in this phase that adds UI rather than removing or rewiring it. I judged it in scope because §19 is an architectural requirement that was left unenforced by the misplacement in I1 — relocating an existing control is integration work, and no new backend contract is involved. If you would rather the Dashboard shipped without it, this change is self-contained and easy to revert.

### I3 — Query cache survived logout in all six portals 🔴 **High · FIXED**

§13 states: *"Cache is cleared entirely on logout and on account switch — **non-negotiable**, because RLS makes visibility identity-dependent."*

`@masar/auth`'s `signOut()` tears down realtime channels, and its own doc comment says *"Callers must also clear the query cache (see §13)."* **No caller did** — all 13 sign-out sites across all six portals called bare `signOut()`.

TanStack's `gcTime` is 30 minutes. So on any shared device — a reception terminal, a nursery tablet, a driver's handset — signing out and handing the device over could paint the previous user's children, messages or billing rows on the next user's first render, before any refetch corrected it.

Each portal was individually "correct"; the defect lived in the seam between the shared package's contract and its consumers, which is exactly what this phase exists to find.

**Fix:** a `useSignOut()` helper in each portal signs out, then clears the cache:

```ts
void signOut().finally(() => queryClient.clear());
```

Order is deliberate — signing out first lets `onAuthStateChange` unmount the authenticated tree and cancel in-flight queries; clearing first would leave a window for a resolving query to repopulate the cache under the old identity. All 13 call sites now use it.

### I4 — The `app_access` claim is never enforced 🟠 Medium · documented

All four provisioning Edge Functions set it:

```ts
app_metadata: { tenant_id, role: 'driver',  app_access: ['driver']    }  // add-bus
app_metadata: { tenant_id, role: 'guardian', app_access: ['parent']   }  // enroll-child
app_metadata: { tenant_id, role: body.role, app_access: appAccess     }  // add-staff
app_metadata: { tenant_id, role: 'manager', app_access: ['dashboard'] }  // provision-tenant
```

`claims.appAccess` is parsed, `canOpenPortal()` exists, `RequirePortal` exists. **No portal uses any of them.** Every `AuthGate` checks `claims.role === '…'` only.

Role and app-access are deliberately separate controls: revoking a person's access to one portal without changing their role is expressible in the backend and ignored by the frontend.

**Not fixed, deliberately.** Enforcing it is a two-line change per portal, but with an empty database I cannot verify that every account in a real deployment carries a populated `app_access`. Any account provisioned outside those four functions (seed scripts, manual admin creation, and **platform admins — which have no provisioning Edge Function at all**) would be locked out entirely. Shipping an untestable change that can hard-block every login is not a defensible trade. See §9 for the safe sequence.

### I5 — Activation and password reset are unreachable 🔴 **High · documented — blocker**

`@masar/auth` exports a complete set of flows. **None is referenced by any portal:**

`completeActivation` · `requestPhonePasswordReset` · `requestEmailPasswordReset` · `verifyPhoneOtp` · `setPassword` · `unenrollTotp`

§10.3 is explicit that provisioning **never sets a password**: the Edge Function creates the identity and dispatches a one-time activation link to the new user's own phone, and *"the manager's UI shows confirmation that an activation message was sent, not a password."* `add-staff/index.ts` confirms it in code: *"No password is set — matches the frozen no-plaintext-credential design (§10.3)."*

**Consequence: every account the platform provisions is unreachable.** A new teacher, guardian or driver receives an activation link and lands on a portal with only a phone + password form and no way to set that password. There is no "Forgot password?" anywhere either.

This is a **missing frontend feature**, not an integration defect — the backend contract is complete and correct, and the client-side functions exist. Per this phase's rules ("if a discovered issue requires a new feature, stop and document it"), it is documented rather than built.

### I6 — `Portal` union diverges from the deployed enum 🟡 Low · documented

```ts
// frontend — hand-written, 6 values
export const PORTALS = ['parent','teacher','reception','driver','dashboard','platform-admin'];

// backend — tenancy.app_code, 5 values
'dashboard' | 'parent' | 'teacher' | 'reception' | 'driver'
```

`'platform-admin'` exists only on the frontend. This is a copied-and-extended enum of exactly the kind the constraints forbid, and it is the concrete reason I4 cannot be enforced uniformly: `canOpenPortal(claims, 'platform-admin')` can never be satisfied, because no backend path issues that value.

Also unused: `DashboardRole = 'manager' | 'teacher'` — a hand-written union duplicating generated `Role`, declared and never referenced. Harmless, but it is dead weight that invites drift.

### I7 — Shared auth guards are dead code 🟡 Low · documented

`RequireAuth`, `RequirePortal` and `RequireRole` are exported by `@masar/auth` and used by **no portal** — all six hand-rolled an `AuthGate` instead. The hand-rolled gates work and are more informative (they render a role-specific denial screen), but the duplication is the direct cause of I4: the shared `RequirePortal` would have enforced `app_access` for free.

### I8 — 12 of 19 Edge Functions have no caller 🟠 Medium · documented

| Function | Missing surface |
|---|---|
| `provision-tenant` | Platform Admin: create tenant |
| `enroll-child` | Dashboard: enrolment wizard *(already documented in Phase 4)* |
| `add-staff`, `add-bus` | Dashboard: staff / bus onboarding |
| `suspend-staff-account`, `reactivate-staff-account` | Dashboard: staff lifecycle |
| `revoke-sessions`, `regenerate-activation-link` | Dashboard / Platform Admin: security actions |
| `issue-service-account-key`, `revoke-service-account-key` | Dashboard: service accounts (§10.7) |
| `generate-invoice-pdf`, `resend-invoice` | Dashboard: billing documents |

These are **unbuilt features, not integration defects** — every one is a create/manage flow that no phase was scoped to build. The read surfaces exist (rosters, staff lists, bus lists, billing tables); the write flows do not. Worth stating plainly: **the platform can currently display everything and provision nothing.** Combined with I5, no tenant can be onboarded end-to-end through the UI.

The same applies to 27 of 46 RPCs being uncalled, most for the same reason (`enroll_child_with_guardian`, `assign_bus_rider`, `create_pickup_pass`, `submit_request`, `create_camera`, …).

---

## 4. Backend Issues

**None found in this audit.** Every guard, gate and constraint examined behaved as the architecture documents it, and in each frontend/backend disagreement the backend was correct.

Pre-existing backend debt, already certified and unchanged:

1. **`storage_objects` was never implemented** (`BACKEND_CERTIFICATION.md` §7.3) — 9 `*_object_id` columns have no resolvable path. Blocks all photo display (pickup-pass ID photos, child/staff photos) and all uploads.
2. **`pg_cron` is not installed** — the five §27 scheduled jobs, including the analytics MV refresh, never run. Every analytics figure is a snapshot of unbounded age; the UI discloses this via `computed_at`.
3. **Rate limiting is unimplemented** (§7.2) except inside `scan_pickup_pass`. Client-side debounce is documented as a courtesy control, never a security boundary.
4. **No `mark_notification_read` RPC.** All six portals display read state and cannot mutate it. Writing to `comms.notifications` directly would breach the RPC-for-writes rule, so no portal does.
5. **No `raise_concern` RPC** despite §12 granting teachers `C` on concerns.
6. **No `mark_stop_reached` RPC** — `trip_stops.reached_at` is read-only to the Driver App.
7. **`supabase gen types` mis-maps `review_request.p_decision`** — a code-generator defect, worked around correctly and in one place.

---

## 5. Frontend Issues

Three fixed (I1, I2, I3), four documented (I4, I6, I7, I8). Beyond those:

- **`--surface-app` does not exist.** The design system's `AppShell` paints a non-existent token; the real one is `--bg-app`. All six portals work around it locally. One-line fix whenever the design system is unfrozen.
- **`PageHeader` and `States` are duplicated in all six portals** — §3 sets the promotion threshold at three. Maximally justified now.
- **`Input` does not forward refs**, forcing a remount-with-`autoFocus` workaround in the Reception scanner.
- **Bundle sizes 117–163 KB gzipped**, all within the <200 KB mobile budget.

---

## 6. Shared Issues

- **The `@masar/auth` ↔ portal seam produced two of the three high-severity findings** (I3, I4). In both cases the shared package built the capability, documented the requirement, and left the caller to honour it; no caller did. Where a shared package documents "callers must…", nothing enforces it — that seam deserves the most scrutiny in future work.
- **The generated-types boundary is otherwise excellent.** One dead hand-written union (I6) in ~30,000 lines of portal source.

---

## 7. Environment Limitations

**The staging database is empty. This is the single largest constraint on this audit's confidence, and it is not a defect in either system.**

Everything verified here is *structural*: contract shapes, role gates, guard alignment, subscription lifecycle, type provenance. What could not be verified is *behavioural* — no query has returned a row, no RPC has executed against real data, no realtime event has been received, no RLS policy has been observed narrowing a result.

This is not a theoretical concern. It is precisely why I1 survived five phases: with no data, an empty list and a `PERM_ROLE_DENIED` look identical, and the send button was never pressed against a live session. The same blindness is what allowed the Phase 6 enum defects.

Also environmental:

- **Web build, not Capacitor.** Background GPS, camera QR capture, push notifications and the encrypted offline manifest cache are all native capabilities absent from a Vite build.
- **No map tile provider** in the dependency set — Route Status and live trip tracking show coordinate readouts, not maps.

---

## 8. Operational Limitations

- **`pg_cron` absent** → analytics never refresh; disclosed in the UI rather than hidden.
- **Notification dispatch** depends on the scheduled `notification-dispatch` function, which the same absence prevents from running.
- **`jobs` schema has no frontend surface.** `background_job_queue`, `scheduled_job_runs` and `idempotency_keys` are exposed and readable but unsurfaced. Given that no jobs currently run, an operational job-monitoring view would show an empty, misleading picture — reasonable to defer, worth building when `pg_cron` lands.
- **Platform admin provisioning has no path at all** — no Edge Function, no UI. The first platform admin must be created manually.

---

## 9. Recommended Fixes

**Ordered by what unblocks the most.**

1. **Build the activation + password-reset screens (I5).** ~2 screens per credential type. `completeActivation`, `setPassword`, `verifyPhoneOtp` and both reset functions already exist and are typed. **Nothing else on this list matters until users can log in.**
2. **Seed the staging database, then re-run this audit behaviourally.** Structural verification has reached its ceiling. One realistic tenant — a manager, two teachers, a driver, a reception account, ten children with guardians, a bus, a week of attendance — would convert most of this report from "verified structurally" to "verified".
3. **Build the provisioning surfaces (I8)** — enrolment wizard, staff/bus onboarding, tenant creation. Until these exist the platform can display everything and create nothing.
4. **Enforce `app_access` (I4), in this order:** (a) confirm seed data populates it for all six identity types; (b) add a `platform-admin` member to `tenancy.app_code` **or** exempt platform admins explicitly; (c) switch each `AuthGate` to `canOpenPortal`, or adopt the shared `RequirePortal` guard (which resolves I7 at the same time). Do not do (c) before (a).
5. **Align `PORTALS` with `tenancy.app_code` (I6)** and delete the dead `DashboardRole`.
6. **Promote `PageHeader`/`States` into the design system**, fix `--surface-app`, and add `forwardRef` to `Input` — one coordinated pass when shared packages unfreeze.
7. **Adopt the Driver App's `lib/enums.ts` pattern in the other five portals.** It is the only structural defence against the enum class that has now produced defects twice.
8. **Add the missing RPCs** when backend work resumes: `mark_notification_read`, `raise_concern`, `mark_stop_reached`.

---

## 10. Production Blockers

| # | Blocker | Why it blocks |
|---|---|---|
| **B1** | **No activation or password-reset UI** (I5) | Provisioning never sets a password. No user can complete first login. **Total onboarding failure.** |
| **B2** | **No provisioning surfaces** (I8) | No tenant, staff member, child, guardian or bus can be created through any UI. |
| **B3** | **Unverified against real data** (§7) | No query, RPC, policy or subscription has been exercised against a populated database. I1 demonstrates what this hides. |
| **B4** | **`storage_objects` missing** (backend §7.3) | No photo anywhere resolves, including pickup-pass ID photos at a child-handover desk. |
| **B5** | **`pg_cron` absent** | Analytics never refresh; scheduled notification dispatch never runs. |

B1–B3 are frontend/process; B4–B5 are certified backend debt.

**B1 alone is disqualifying**: a platform where no provisioned account can log in cannot go to production regardless of everything else being correct.

---

## 11. Final Verdict

The integration itself is sound. Across 46 RPCs, 19 Edge Functions, 12 realtime channels, 13 schemas and 71 routes, this audit found **one wrong role gate, one misplaced safety control, and one unhonoured cache contract** — all three now fixed and verified. The architectural boundaries that matter most — RLS as the sole authority, RPCs for every write, generated types as the only contract, forbidden surfaces genuinely unreachable — hold without a single exception.

What is missing is not integration but *reach*: the system cannot onboard a user or create a record through its own interface, and it has never been exercised against real data.

**SYSTEM INTEGRATION COMPLETE WITH MINOR FIXES**

The three integration defects were minor in code and are corrected. The blockers in §10 are missing features and unpopulated environment — real, and disqualifying for production, but categorically not integration failures. The two systems, where they meet, meet correctly.

---

### Verification after fixes

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total

client-forbidden RPCs called            → 0 of 6
client-forbidden Edge Functions called  → 0 of 3
direct table writes                     → 0
direct Supabase imports in apps         → 0
analytics schema queried directly       → 0
client-side authorization filtering     → 0
orphan routes / broken internal links   → 0
send_report_draft callers               → 1 (Dashboard, manager-gated) ✓
sign-out sites purging cache            → 13 of 13 ✓
```

### Files changed

```
frontend/apps/{platform-admin,dashboard,teacher,parent,reception,driver}/src/lib/useSignOut.ts   (new ×6)
frontend/apps/*/src/routes/{ConsoleLayout,DashboardLayout,SettingsRoute,MfaRoute}.tsx            (13 sign-out sites)
frontend/apps/*/src/routes/auth/AuthGate.tsx
frontend/apps/teacher/src/lib/teacher.ts                 (canSendReports → false, contract documented)
frontend/apps/teacher/src/routes/ReportsRoute.tsx        (unreachable send path removed)
frontend/apps/dashboard/src/routes/ReportsRoute.tsx      (§19 review gate added where sending happens)
```

No backend, shared-package, or generated-type files were modified.

---

**Audit complete. No QA, Playwright, or deployment work was started.**
