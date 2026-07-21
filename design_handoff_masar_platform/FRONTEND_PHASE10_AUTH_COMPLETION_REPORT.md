# Frontend Phase 10 — Authentication & Account Lifecycle, Completion Report

**Scope:** authentication screens only. No portal was redesigned; no backend, `api-client` or design-system file was touched.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, **0 errors, 0 warnings** |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps (160–166 KB gzipped) |
| Files changed under `backend/`, `packages/` | ✅ **0** |
| New backend calls invented | ✅ **0** — auth screens call only `@masar/auth` |
| Unreachable screens | ✅ **0** |

---

## 1. A finding that shapes this whole phase

**The activation link the backend dispatches today cannot activate anything.**

`backend/supabase/functions/_shared/activation.ts` is an explicit, documented stub:

```ts
function buildActivationUrl(userId: string): string {
  const base = Deno.env.get('ACTIVATION_LINK_BASE_URL') ?? 'https://app.masar.app/activate';
  const token = crypto.randomUUID();          // stored nowhere, verifies against nothing
  return `${base}/${userId}?token=${token}`;
}
// …
console.info('[activation-link:stub]', { to: phone, activationUrl });   // logged, not sent
```

Its own header says it is *"STUBBED in Epic 1 by explicit architecture decision … explicitly not shipped to production until Epic 4 replaces the stub."* All four provisioning functions (`provision-tenant`, `add-staff`, `add-bus`, `enroll-child`) call it.

So no real Supabase auth link is generated anywhere, the token is a random UUID with no server-side counterpart, and nothing is transmitted. **Building only a link-landing page would have produced a screen that can never succeed against the deployed backend.**

This did not block the phase, because a second, fully deployed path reaches the same end state:

> A provisioned account is a real phone identity that simply has **no password yet**. Verifying a one-time code on that phone establishes a session exactly as it would for a password reset — and the account then sets its first password. Activation and reset differ in user *intent*, not in mechanism.

That path uses three already-existing auth-package functions (`requestPhonePasswordReset` → `verifyPhoneOtp` → `setPassword`) and nothing new. **It is what makes the blocker from the integration audit genuinely resolvable today.**

Both paths are implemented: the link landing page handles the standard Supabase contract Epic 4 will produce, and the OTP path works now.

---

## 2. Implemented screens

### Activation — 5 tenant portals

| Screen | State | Behaviour |
|---|---|---|
| Landing | `checking` | Classifies the URL while the session resolves |
| Password creation | `session` | Link established a session → `completeActivation` |
| Success | `done` | Confirmation → sign in |
| Expired link | `expired` | `error_code=otp_expired` → offer OTP path |
| Invalid link | `invalid` | Malformed/unrecognised → surfaces the server's description |
| **Stubbed link** | `legacy-stub` | Detects the deployed stub's URL shape and routes to the working OTP path |
| No link | `none` | Arrived directly → offer OTP path |

The `legacy-stub` state exists so someone holding a link that *cannot work* is told so and given a path that does, instead of being cycled through "invalid link → request another → invalid link".

### Forgot password — 5 tenant portals (phone)

`request` → `verify` → `password` → `done`, with failure handling at each step.

The request-step failure message names the likely cause honestly: `flows.ts` warns that a single WhatsApp/SMS provider gates this platform-wide, and `config.toml` currently has `[auth.sms.twilio] enabled = false` (wiring is per-environment via secrets). Blaming the user's phone number for a provider outage would send them to the wrong remedy.

### Forgot password — Platform Admin (email)

`request` → `sent` → `password` → `done`, plus `expired` / `invalid`.

`redirectTo` is the console's own origin + `/reset`, so the returning link lands back in the app rather than on a Supabase-hosted page. Resetting a password does **not** clear an enrolled TOTP factor — the AAL2 challenge still applies on the next sign-in, which is correct: a password reset must not be a second-factor bypass.

### Platform Admin MFA

Enrollment, QR display, secret fallback and TOTP verification **already existed** and were verified working against `enrollTotp` / `verifyTotpEnrollment` / `challengeTotp`. This phase added the missing piece:

**MFA recovery** (`MfaRecoveryRoute`) — lists registered factors, allows removing one, and offers re-enrolment. Reachable from the challenge screen ("Lost your authenticator?") and after a satisfied session.

Recovery is split honestly in two, because the deployed API only permits one of them:

- **Still signed in** (replacing a device before losing it) — solvable in-app via `unenrollTotp`, and made easy, because handling it in advance prevents the other case entirely.
- **Already locked out** — *not solvable in-app, by construction.* AAL2 is required before any authenticated call, so `unenrollTotp` is itself unreachable. Supabase TOTP has no backup codes, and the backend has no MFA-reset RPC or Edge Function (`revoke-sessions` ends sessions but leaves the factor; `regenerate-activation-link` reissues a password link and does not touch AAL2). The screen states this plainly and directs the admin to another owner-tier admin with project access.

Offering a "recover" button that would return an error was the alternative. Telling someone the truth is better.

### Session states — all 6 portals

`SessionEndedRoute` distinguishes two outcomes:

- **"You're signed out"** — deliberate.
- **"Your session ended"** — involuntary: timeout, failed refresh, or a server-side revocation (§10.6 `revoke_sessions` / `suspend_staff_account`).

**How the distinction is made without modifying `AuthProvider`:** the provider reduces every auth event to `authenticated | unauthenticated` and does not expose the underlying event — and this phase may not change that contract. So intent is recorded instead: `useSignOut()` sets a tab-scoped `sessionStorage` flag before signing out, and *any other* authenticated → unauthenticated transition is, by elimination, involuntary. The flag is consumed on read so it cannot leak into a later session.

Naming an involuntary end specifically "revoked" would be a guess — expiry and revocation are indistinguishable from the client. The screen describes what is certain (the session ended, it was not you) and what to do next, and mentions that the nursery may have ended it for security, so a suspended user contacts the office instead of retrying a password they believe is broken.

---

## 3. Flows

```
ACTIVATION (tenant)          FORGOT PASSWORD (tenant)      FORGOT PASSWORD (admin)
  link → session                 phone → OTP sent              email → link sent
    ↓ completeActivation           ↓ verifyPhoneOtp              ↓ (email → ?code=)
  choose password                choose password               choose password
    ↓ setPassword                  ↓ setPassword                 ↓ setPassword
  success → sign in              success → sign in             success → sign in

  link expired/invalid  ──────────►  OTP path (works today)

MFA (admin)                                    SESSION END (all)
  enrollmentRequired → QR + secret → verify      deliberate  → "You're signed out"
  challengeRequired  → 6-digit code              otherwise   → "Your session ended"
        └─ "Lost your authenticator?" → recovery
```

---

## 4. Routing

**No portal's router was modified.** This is deliberate, and worth explaining.

Every portal mounts its react-router tree *inside* `AuthGate`, which renders the login screen instead of the router whenever there is no session. Consequently **no react-router route can ever match while signed out** — an unauthenticated `/activate` URL never reaches the router at all. Adding `/activate` and `/reset` as router entries would have produced routes that are unreachable precisely when they are needed.

Restructuring six routers to hoist auth above the gate would be the redesign this phase forbids. Instead, the unauthenticated surface owns a small view state (`UnauthenticatedFlow`), and `AuthGate` renders it in place of `LoginRoute` — a one-line change per portal. Deep links are honoured by reading the URL on mount:

| Entry | Resolves to |
|---|---|
| `/activate…` | Activation |
| `/reset`, `/forgot` | Password reset |
| `?code=` / `?token=` / `?error=` on any path | Activation (tenant) · reset (admin) |
| anything else | Sign in |

A session that has just ended takes precedence over any deep link, so a user whose session was revoked mid-session is told what happened rather than dropped into a form.

Both new entry points are also reachable from every sign-in screen: **"Forgot your password?"** and **"First time here? Activate your account"** (tenant portals), **"Forgot your password?"** (admin).

---

## 5. UX, RTL and accessibility

- **No new visual language.** `AuthShell` extracts the exact heading/intro/alert/action rhythm already used by `LoginRoute`, over the design system's own `CenteredLayout`. Every screen uses existing components and tokens only.
- **RTL:** all layout uses flex/grid and logical spacing; direction comes from the document root via `I18nProvider` (§20). Credential and code fields carry `dir="ltr"` — phone numbers, emails, OTPs and TOTP secrets are LTR sequences even in an Arabic UI, matching the existing login screens.
- **Accessibility:** failure alerts are `role="alert"` (announced immediately), success/info are `role="status"`. Every interactive target is ≥44px (§21). Inputs use correct `autoComplete` (`new-password`, `one-time-code`, `username`) and `inputMode`, so password managers and SMS autofill work. Forms are `noValidate` with inline field errors rather than browser-native bubbles.
- **Bilingual errors:** every failure renders `AppError.localized(locale)`, so the backend's `human_message_en` / `human_message_ar` reaches the user (§25.2). Raw Postgres text is never shown.

---

## 6. Limitations

1. **Activation links are not delivered** (backend stub, §1). Until Epic 4 replaces `_shared/activation.ts`, the link path is untestable end-to-end and the OTP path is the working route. The landing page is written against the standard Supabase contract, so it should work unchanged once the stub is replaced — but that is an expectation, not a verified fact.
2. **Phone OTP delivery depends on an unconfigured provider.** `[auth.sms.twilio] enabled = false` in `config.toml`; wiring is per-environment via project secrets, which I cannot inspect. If no provider is configured in the linked project, `requestPhonePasswordReset` fails at the first step. **This is the one thing to check before declaring the blocker closed.**
3. **Email reset is the most likely to work today** — `resetPasswordForEmail` needs only Supabase's built-in email or configured SMTP.
4. **Locked-out MFA recovery is impossible in-app**, by construction (§2). Closing this needs a backend capability that does not exist — an admin-tier MFA-reset Edge Function — and inventing one was out of scope.
5. **Platform Admin has no activation screen**, deliberately: §10.3 provisioning covers tenant-side identities only, and platform admins have no provisioning Edge Function at all. A screen describing a flow that does not exist would be worse than its absence. The first platform admin is still created manually against the project.
6. **`app_access` is still not enforced** — unchanged from the integration audit (I4), and correctly out of scope here.
7. **Nothing is verified against real data.** No account has been activated, no OTP received, no link followed. Every flow is structurally correct and compiles; none has been exercised. Same environmental ceiling as every prior phase.
8. **The auth kit is duplicated per portal** (9 files × 5 tenant portals, 6 × admin), following this codebase's established pattern. With `PageHeader`/`States` already duplicated six ways, promoting a shared auth kit into the design system or a new `@masar/auth-ui` package is now clearly worth doing — but creating a package was outside this phase's scope.

---

## 7. Verification

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              parent 164.73 · dashboard 166.30 · teacher 162.38
              driver 163.51 · reception 160.11 · platform-admin 160.95 (KB gzip)

auth APIs consumed          → 14, all pre-existing in @masar/auth
new RPCs / Edge Functions   → 0
callRpc/invoke in auth dir  → 0 (auth screens call only @masar/auth)
backend files changed       → 0
packages/ files changed     → 0
unreachable auth screens    → 0 (every screen wired and referenced)
```

**Flow-by-flow structural verification:**

| Flow | Verified |
|---|---|
| Activation (link) | ✅ 6 states wired; `completeActivation` on session |
| Activation (OTP) | ✅ reachable from expired/invalid/stub/none |
| Password reset (phone) | ✅ 4 steps + failure at each |
| Password reset (email) | ✅ 4 steps + expired/invalid; `redirectTo` = app origin |
| MFA enrollment | ✅ pre-existing; QR + secret fallback |
| MFA challenge | ✅ pre-existing; recovery entry point added |
| MFA recovery | ✅ list, remove, re-enrol; lockout stated honestly |
| Logout | ✅ marks intent, purges cache, tears down channels |
| Session expiry | ✅ involuntary end distinguished from sign-out |
| Revoked session | ✅ presented as involuntary (indistinguishable from expiry — stated) |
| Role routing | ✅ unchanged; each `AuthGate` still gates on `claims.role` |
| Portal routing | ✅ unchanged; routers untouched |

---

## 8. Files changed

**New — tenant auth kit** (identical in `parent`, `teacher`, `reception`, `driver`, `dashboard`, under `src/routes/auth/`):

```
authShell.tsx            AuthShell · AuthAlert · AuthLink
authLink.ts              URL classification (session/expired/invalid/legacy-stub)
password.ts              password, phone and OTP schemas
SetPasswordForm.tsx      shared password creation form
ActivateRoute.tsx        activation, 7 states
ResetPasswordRoute.tsx   phone OTP reset, 4 steps
SessionEndedRoute.tsx    expired vs deliberate sign-out
useSessionEndReason.ts   intent tracking + markDeliberateSignOut()
UnauthenticatedFlow.tsx  signed-out surface + deep-link entry
```

**New — Platform Admin** (`platform-admin/src/routes/auth/`):

```
authShell.tsx  authLink.ts  password.ts  SetPasswordForm.tsx
SessionEndedRoute.tsx  useSessionEndReason.ts
ResetPasswordRoute.tsx   email reset, 6 states
MfaRecoveryRoute.tsx     factor list / remove / re-enrol
UnauthenticatedFlow.tsx  signed-out surface (no activation — see §6.5)
```

**Modified:**

```
apps/*/src/routes/auth/LoginRoute.tsx    entry points added (6 portals)
apps/*/src/routes/auth/AuthGate.tsx      renders UnauthenticatedFlow (6 portals)
apps/*/src/lib/useSignOut.ts             marks deliberate sign-out (6 portals)
apps/platform-admin/src/routes/auth/MfaRoute.tsx   optional onRecover entry point
```

No backend, `api-client`, `design-system`, `auth` or `i18n` file was modified. No additive design-system component was required.

---

**The authentication lifecycle is complete and verified. No QA, Playwright or deployment work was started.**

**Before this blocker can be called closed**, confirm that the linked Supabase project has an SMS provider configured (limitation #2). Every screen is built and compiles, but the phone OTP path — the one that makes activation work today — depends on a provider that `config.toml` shows disabled and whose per-environment secret I cannot read.
