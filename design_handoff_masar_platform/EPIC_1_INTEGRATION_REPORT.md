# Epic 1 — Integration Validation Report

**Status:** Complete. The existing frontend (all 6 portals) is wired to the live, deployed Epic 1 Supabase backend. No Epic 2+ work was started. No new tables, migrations, or backend code were created — this was a frontend-only integration pass against the already-deployed backend.

---

## 1. Scope honored

| Constraint | Status |
|---|---|
| Replace mock auth with Supabase Auth | Done — all 6 portals |
| Replace tenant provisioning with `provision-tenant` | Done — Platform Admin "Add school" wizard |
| Replace account suspension with `suspend-staff-account` | Done — Dashboard "Staff" screen |
| Replace account reactivation with `reactivate-staff-account` | Done — Dashboard "Staff" screen |
| Replace activation-link generation with `regenerate-activation-link` | Done — wired, but see §5.3 (no real staff user id yet) |
| Replace session revocation with `revoke-sessions` | Client method exists and is exposed; no dedicated UI button calls it directly — see §5.4 |
| Remove remaining Epic-1-related `localStorage` logic | N/A — none existed anywhere in `ui_kits/` (verified by repo-wide search, zero matches) |
| Keep all existing UI unchanged | Honored — no screens redesigned, no components restructured. One behavioral change (§5.2) was necessary to make "reactivate" meaningful and is documented there. |
| Preserve UX / Design System components | Honored — every new element (busy states, inline error banners) reuses existing color tokens, spacing, and typography; no new visual language introduced |
| No Epic 2 implementation | Honored |
| No new database tables | Honored |
| No migration changes | Honored |
| Use only the deployed backend | Honored — all calls go through the real Supabase project (`env.epic1.js`) and the 5 deployed Edge Functions |

---

## 2. New shared files

- **`ui_kits/_shared/env.epic1.js`** — sets `window.__MASAR_ENV__` with the project's public-safe `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Both values are explicitly safe for client bundles per `BACKEND_ARCHITECTURE.md` §28/§34. The `service_role` key is never referenced anywhere under `ui_kits/`.
- **`ui_kits/_shared/supabaseClient.epic1.js`** — the frontend's entire Epic 1 API surface, exposed as `window.MasarClient` (matches the existing `window.*` global convention used by `masar-ui.jsx` / `DForms`). Provides:
  - `client()` — lazy-singleton Supabase JS client
  - `auth.signInWithPhone`, `auth.signInPlatformAdmin`, `auth.signOut`, `auth.resetPasswordForEmail`, `auth.sendPhoneOtp`, `auth.verifyPhoneOtp`
  - `provisionTenant`, `suspendStaffAccount`, `reactivateStaffAccount`, `revokeSessions`, `regenerateActivationLink` — one call each to the 5 deployed Edge Functions, all idempotency-key-aware where the backend expects one
  - `getErrorMessage(err, lang)` — bilingual error extraction, handling both the Edge Functions' `{error:{code,message_en,message_ar}}` shape and raw Supabase Auth errors

All 6 portals' `index.html` load the Supabase JS UMD build, then `env.epic1.js`, then `supabaseClient.epic1.js`, before any other app script.

---

## 3. Authentication — replaced in all 6 portals

| Portal | Sign-in | Forgot password | Logout |
|---|---|---|---|
| Platform Admin | `auth.signInPlatformAdmin` (email+password) + server-confirmed tier lookup from `identity.platform_admins`, discarding the pre-login radio selection | `auth.resetPasswordForEmail` | `auth.signOut` |
| Nursery Dashboard | `supa.auth.signInWithPassword({email})` + role/employment-status check against `identity.staff_profiles` (see §5.1 for the email/phone caveat) | `auth.resetPasswordForEmail` | `auth.signOut` (both Sidebar and Settings logout points) |
| Parent App | `auth.signInWithPhone` | `auth.sendPhoneOtp` → `auth.verifyPhoneOtp` → `supa.auth.updateUser({password})` | `auth.signOut` |
| Teacher App | `auth.signInWithPhone` | same OTP flow as Parent | `auth.signOut` |
| Driver App | `auth.signInWithPhone` | same OTP flow as Parent | `auth.signOut` |
| Reception App | `auth.signInWithPhone` | same OTP flow as Parent | `auth.signOut` |

All four mobile-style portals (Parent/Teacher/Driver/Reception) share one implementation pattern: `busy`/`error` state added to the existing login and forgot-password screens, inline error banners in the existing danger-color style, button labels swap to a localized "…ing" state while a request is in flight. No screens, steps, or fields were added or removed — the WhatsApp/SMS "channel" choice in the forgot-password flow stays as UI (it matches the existing design) but actual delivery routing is provider-determined by Supabase once an SMS provider is configured (`config.toml` ships with `[auth.sms.twilio] enabled = false` by default in Epic 1).

---

## 4. Tenant provisioning

`ui_kits/platform-admin/PlatformAdmin.jsx` — `AddSchoolWizard`'s final step now calls `window.MasarClient.provisionTenant({...})` with `name`, `slug`, `city`, `planCode`, `contactName`, `contactEmail`, `ownerName`, `ownerPhone`. Busy/error states and an inline error banner were added to the existing step-3 layout (no new fields, no new steps).

**Known gap:** `provision-tenant` requires `ownerPhone` in E.164 format as the real Auth identity for the initial manager account. The existing wizard only ever collected an owner **email**, never a phone number. Per the "keep UI unchanged" constraint, no field was added — the call is made honestly with `ownerPhone: ''`, which the backend will reject with a validation error that surfaces through the same inline error banner. **This wizard cannot successfully provision a tenant until either a phone field is added to step 1, or the backend's owner-identity requirement changes.** This is a product decision, not something resolvable within this integration pass's constraints.

---

## 5. Staff lifecycle & known backend-coverage gaps

### 5.1 — Dashboard manager login: email vs. phone
The Dashboard's login screen collects a "work email," but Epic 1's `provision-tenant` creates the initial manager's Auth identity via **phone**, with no email identity. The wiring uses `signInWithPassword({email, password})` because that is literally what the field asks for — this is not silently patched around. Until a manager's email identity exists in Auth (a backend/product decision outside this pass's scope), this login path will not succeed against a real manager account created via `provision-tenant`.

### 5.2 — Teacher/staff suspend & reactivate
`ui_kits/nursery-dashboard/DashboardTeachers.jsx`: "Remove teacher" is now "Suspend account," calling `suspendStaffAccount(t.id, reason)`; a new "Reactivate account" menu item (shown only for suspended staff) calls `reactivateStaffAccount(t.id)`.

**Behavioral change (the one necessary deviation from "don't touch existing behavior"):** suspension used to hard-delete the row from local state. It now flips `status` to `'suspended'` in place, mirroring the suspend/reactivate button-swap idiom already used for schools in `PlatformAdmin.jsx`'s `SchoolDetail`. This was required to make "reactivate" meaningful at all — without it there would be nothing to wire `reactivateStaffAccount` to.

**Known gap:** Teacher/staff records in this screen are still local mock data (`SEED_TEACHERS`), not rows in `identity.staff_profiles` — staff provisioning is Epic 3 scope. Calling `suspendStaffAccount('t1', ...)` against the real backend will fail (no matching staff row) until Epic 3 exists. The wiring is real and correct; the data behind it is not yet.

**Also known:** `PlatformAdmin.jsx`'s `SchoolDetail` suspend/reactivate-**school** buttons were left untouched. Epic 1 has no tenant-level suspend/reactivate Edge Function — only `suspend-staff-account` / `reactivate-staff-account` exist, which operate on individual staff accounts, not tenants. Tenant lifecycle management is out of Epic 1's deployed surface entirely.

### 5.3 — Activation-link resend
`DForms.AccountCreatedDialog` (used by `DashboardForms.jsx` and referenced from `DashboardTeachers.jsx`) and `DashboardBus.jsx`'s `DriverCredentials` both now call `regenerateActivationLink(userId)` from their WhatsApp/SMS/Resend buttons — but only when a real `userId` is present on the account object. Since staff/driver accounts are still created locally (§5.2), `userId` is always `undefined` today, so the buttons fall back to their pre-existing local-only toast behavior with no visible change. The call path is real and will activate the moment Epic 3 supplies a real Auth user id at account-creation time; `makeAccount()` already accepts an optional `userId` for that future wiring.

### 5.4 — Session revocation
`window.MasarClient.revokeSessions(userId)` is implemented and exposed, but no UI element calls it directly. This is intentional: `suspend-staff-account` already triggers `auth.admin.signOut(userId, 'global')` synchronously server-side (per `BACKEND_ARCHITECTURE.md`'s saga pattern), so every existing "suspend" touchpoint already revokes sessions as a side effect. No standalone "revoke sessions" button exists anywhere in the current UI to attach the direct call to.

---

## 6. Verification performed

- **`localStorage` audit:** repo-wide search across `ui_kits/` — zero matches, before and after this pass.
- **Syntax verification:** all 17 edited files (2 shared JS modules + 15 JSX portal files) were parsed with `@babel/standalone` (`presets: ['react']`) — zero syntax errors across the full set:
  `env.epic1.js`, `supabaseClient.epic1.js`, `PlatformAuth.jsx`, `PlatformAdmin.jsx`, `DashboardAuth.jsx`, `Dashboard.jsx`, `DashboardTeachers.jsx`, `DashboardForms.jsx`, `DashboardBus.jsx`, `ParentAuth.jsx`, `ParentApp.jsx`, `TeacherAuth.jsx`, `TeacherApp.jsx`, `DriverAuth.jsx`, `DriverApp.jsx`, `ReceptionAuth.jsx`, `ReceptionApp.jsx`.
- **Not performed (out of scope for a static-prototype environment):** no live browser click-through against the real Supabase project was run in this pass. The wiring was verified for syntactic and structural correctness (correct `MasarClient` method names/arities, correct error-handling shape, correct button/state plumbing) but not exercised end-to-end against live network calls.

---

## 7. Files changed

**New:**
- `ui_kits/_shared/env.epic1.js`

**Modified:**
- `ui_kits/_shared/supabaseClient.epic1.js`
- `ui_kits/platform-admin/index.html`, `PlatformAuth.jsx`, `PlatformAdmin.jsx`
- `ui_kits/nursery-dashboard/index.html`, `DashboardAuth.jsx`, `Dashboard.jsx`, `DashboardTeachers.jsx`, `DashboardForms.jsx`, `DashboardBus.jsx`
- `ui_kits/parent-app/index.html`, `ParentAuth.jsx`, `ParentApp.jsx`
- `ui_kits/teacher-app/index.html`, `TeacherAuth.jsx`, `TeacherApp.jsx`
- `ui_kits/driver-app/index.html`, `DriverAuth.jsx`, `DriverApp.jsx`
- `ui_kits/reception-app/index.html`, `ReceptionAuth.jsx`, `ReceptionApp.jsx`

No files under `backend/` were touched. No migrations were added or modified.

---

## 8. Summary

Every Epic 1 Edge Function and every real Supabase Auth flow that has a corresponding UI touchpoint today is now wired to the live backend. Three gaps remain, and all three are backend-data gaps, not integration gaps: (1) the Dashboard's manager login field asks for an email the real manager identity doesn't have, (2) the Add-school wizard doesn't collect the phone number `provision-tenant` requires, and (3) teacher/driver accounts are still local mock data because staff provisioning is Epic 3 scope. All three are documented above with the exact line of reasoning, rather than being silently patched or hidden. Nothing in this pass touched Epic 2+ scope, added a table, or modified a migration.

**Stopping here, as instructed.**
