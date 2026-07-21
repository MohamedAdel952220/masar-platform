# Frontend Phase 3 — Platform Admin Portal, Completion Report

**Scope:** the Platform Admin portal only. No other portal was started.
**Built on:** the Phase 1 foundation and the Phase 2 backend integration layer, both consumed as-is.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, 0 errors, 0 warnings |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps built (platform-admin: 532 KB raw / **158 KB gzipped**) |
| Files changed outside `apps/platform-admin` | ✅ **0 source files** (only Turbo cache logs) |
| Files changed under `backend/` | ✅ **0** |

---

## 1. What was built

24 files in `apps/platform-admin/src`, composed entirely from existing packages.

```
src/
├─ styles.css                  portal chrome (tokens only)
├─ main.tsx  App.tsx  app/providers.tsx
├─ lib/
│  ├─ format.ts                locale-aware date/number/currency + staleness age
│  └─ tier.ts                  §12.1 tier predicates
├─ components/
│  ├─ PageHeader.tsx           title / subtitle / actions / meta slot
│  ├─ DataTable.tsx            dense table, cursor pagination, RTL-safe
│  ├─ States.tsx               Loading · Empty · Error · TierRestricted · QueryState
│  └─ StalenessIndicator.tsx   the required computed_at affordance
└─ routes/
   ├─ router.tsx  ConsoleLayout.tsx  NotFound.tsx
   ├─ auth/  AuthGate.tsx  LoginRoute.tsx  MfaRoute.tsx
   ├─ OverviewRoute.tsx        dashboard shell
   ├─ ServiceHealthRoute.tsx
   ├─ SystemHealthRoute.tsx
   ├─ SupportTicketsRoute.tsx
   ├─ TenantBillingRoute.tsx
   ├─ AnalyticsRoute.tsx
   └─ ActivityLogRoute.tsx
```

### Scope coverage

| # | Required | Delivered |
|---|---|---|
| 1 | Routing | `createBrowserRouter`, nested under `AuthGate` → `ConsoleLayout`, error boundary, catch-all |
| 2 | Layout | Sticky top bar + side nav + content region, logical properties throughout |
| 3 | Authentication flow | Email + password (`signInWithEmail`), sign-out, session restore via `AuthProvider` |
| 4 | MFA flow | Enrolment (QR/secret → verify) **and** challenge, separated by `getMfaStatus()` |
| 5 | Navigation | 7-item primary nav with active state |
| 6 | Dashboard shell | `OverviewRoute` — 5 stat tiles + 3 section cards, live |
| 7 | Service Health | `platform.service_health_status`, live |
| 8 | Support Tickets | `platform.support_tickets`, live, status transitions |
| 9 | Activity Log | `platform.activity_log` + `platform.audit_log`, tabbed |
| 10 | Tenant Billing | `platform.tenant_billing_transactions` + refund (tier-gated) |
| 11 | Analytics pages | Both summary views with staleness indicator |
| 12 | System Health pages | `jobs.scheduled_job_runs` + `jobs.background_job_queue` |

---

## 2. Constraints honoured

### Platform Admin tier split (§12.1) — applied where it actually diverges

The split is **not** uniform, and the portal reflects that precisely:

| Surface | owner / admin | support | Portal behaviour |
|---|---|---|---|
| Tenant billing | CRUD | **read-only** | Refund control rendered only when `canManageBilling()`; support additionally sees a `TierRestricted` notice explaining why |
| Support tickets | CRUD, assign | CRUD, assign | **No gate** — §12.1 explicitly records "no divergence, this is support's core job" |
| Audit log | R (all) | R (all) | No gate |
| Service health | R | R | No gate |

Getting this right meant *not* gating support tickets, which a naive "support tier is read-only" reading would have done incorrectly.

### RLS is the only authorization boundary

Every tier check in `lib/tier.ts` is documented as a UX affordance. `refund_tenant_billing_transaction` calls `is_platform_admin_manager_tier()` internally and rejects a support-tier caller regardless of what the UI renders; the analytics views gate on `is_platform_admin()` server-side and return zero rows to anyone else — which is why `AnalyticsRoute` carries no tier check of its own. The portal hides controls to avoid dead ends, never to enforce.

`ErrorState` renders `PERM_ROLE_DENIED` distinctly from a failure ("Not permitted", no retry button), and empty states are worded so an RLS-filtered result never reads as data loss.

### Analytics `computed_at` indicator — required, not decorative

`StalenessIndicator` appears on `AnalyticsRoute` (both tabs) and on the Overview tenant-snapshot card. It shows the snapshot age, and past 60 minutes it escalates to an amber badge plus the explicit sentence: *"Not live — refreshed by a scheduled job, which is not currently registered."* The empty states say the same thing. This is honest about a real deployment condition: `pg_cron` is not enabled, so those materialized views never refresh.

### Realtime

Three channels subscribed, all through `useRealtimeSubscription` so each is torn down on unmount:

| Channel | Page |
|---|---|
| `platform:service_health` | Service Health |
| `platform:support_tickets` | Support Tickets, Overview |
| `platform:tenants` | Overview |

Each handler invalidates the platform query namespace, so realtime and refetch converge on one representation rather than maintaining a parallel store.

### No optimistic updates where forbidden

`useOptimisticRpcMutation` is **not used anywhere in this portal** — verified by grep. Both mutations use `useRpcMutation`, which hard-codes `retry: false`:

- `update_support_ticket` — branches server-side (stamps `resolved_at`, conditionally notifies the reporting manager), so the UI waits for the authoritative row.
- `refund_tenant_billing_transaction` — locks the original row, guards the status transition, inserts an independent refund row. Additionally gated behind an explicit **two-step confirm** before dispatch.

Both pass `idempotent: true`, so a manual retry reuses one key and is safe.

### Nothing outside the portal was modified

Zero source files changed in `packages/*` or `backend/`. Only Turbo cache logs were touched. No design-system component, no api-client contract, no shared package.

---

## 3. Reused, not rebuilt

Everything comes from the existing layers:

- **Design system**: `Badge`, `Button`, `Card`, `CenteredLayout`, `Icon`, `Input`, `StatCard`, `Tabs`.
- **Hooks**: `usePlatformList`, `useInfinitePlatformList`, `useJobsList`, `useTenancyList`, `useRpcMutation`, `useRealtimeSubscription`.
- **RPC wrappers**: via `useRpcMutation` over the generated catalogue.
- **Realtime**: `realtime.platformServiceHealth/SupportTickets/Tenants`.
- **Auth**: `useAuth`, `signInWithEmail`, `signOut`, `getMfaStatus`, `enrollTotp`, `verifyTotpEnrollment`, `challengeTotp`, `listTotpFactors`, `isPlatformAdminManagerTier`.
- **i18n**: `useLocale` for locale/direction, with a language toggle in the top bar.

App-level composites (`DataTable`, `PageHeader`, `States`, `StalenessIndicator`) are **compositions of design-system primitives and existing tokens**, not new design language — the design system has no table or page-header component, and adding one would have meant modifying a frozen package.

---

## 4. Decisions worth surfacing

1. **The portal gates on the `role` claim, not `app_access`.** `app_access` mirrors `tenancy.app_code`, whose enum covers only the five tenant apps (`dashboard`, `parent`, `teacher`, `reception`, `driver`) — the Platform Admin console is not a tenant app and has no code there. Gating on `app_access` would therefore have locked out every legitimate admin. `AuthGate` checks `claims.role === 'platform_admin'` and shows a clear "wrong portal" screen otherwise. RLS remains the real boundary either way. **`RequirePortal` from `@masar/auth` is consequently unused by this portal** — it is correct for the five tenant apps.

2. **`AppShell` from the design system is not used, and this is a defect worth fixing later.** `AppShell` and `CenteredLayout` paint `var(--surface-app)`, which **is not a token that exists** — the paper background token is `--bg-app`. I introduced that error in Phase 1. The design system is frozen for this phase, so rather than modify it I composed the console chrome directly with the correct token and set the page background in the portal's own `styles.css`. `CenteredLayout` *is* still used (auth screens) and renders acceptably because the body background shows through. **Recommendation: fix `--surface-app` → `--bg-app` in `@masar/design-system` when the freeze lifts** (a two-line change in `AppShell.tsx` and `CenteredLayout.tsx`).

3. **All analytics view columns are nullable.** Postgres views produce nullable columns, so the generated types correctly mark every field of `v_tenant_billing_summary` / `v_tenant_health_summary` as `| null`. The pages handle this explicitly rather than casting it away.

4. **`platform.audit_log.ip_address` is `inet`, which generates as `unknown`.** Rendered through a `typeof === 'string'` narrowing rather than a cast.

5. **Ticket creation is deliberately absent.** `create_support_ticket` is manager-only — a *tenant* raises the ticket. Platform Admin triages and resolves, which is what the portal offers.

6. **Overview reads `tenancy.tenants` via `useTenancyList`.** That hook takes a scope argument for cache-key tenancy; the console passes `'platform'` since it is cross-tenant by nature.

---

## 5. Accessibility and i18n

- Semantic `<table>` with `<caption>`, `scope="col"` headers; `<header>`/`<nav>`/`<main>` landmarks; `aria-label="Primary"` on nav.
- `aria-busy` + `aria-live` on loading, `role="alert"` on error surfaces.
- Focus-visible ring from `--border-focus` in `styles.css`.
- Logical properties (`borderInlineEnd`, `insetBlockStart`, `textAlign: start/end`) so one implementation serves LTR and RTL.
- Locale toggle in the top bar; `dir` flows from `I18nProvider` → `ThemeProvider` → document root.
- Numeric/ID/IP cells are pinned `dir="ltr"` inside an RTL layout.
- Status is never colour-only — every `Badge` carries text.

---

## 6. Known limitations

1. **Unverifiable against real data.** The staging database is empty (0 tenants, 0 tickets, 0 transactions), so every page currently renders its empty state. Correctness of the RLS-filtered read paths, the tier split under a real `support` credential, and the realtime handlers can only be confirmed once the **seeded staging dataset** exists — still the outstanding prerequisite from earlier phases.
2. **MFA flow untested end-to-end** for the same reason: no Platform Admin identity exists to enrol.
3. **Refund reason is a fixed string.** `refund_tenant_billing_transaction` accepts `p_reason`; the portal sends a constant rather than prompting. A reason input is a small follow-up.
4. **`issue_tenant_billing_transaction` is not surfaced.** Issuing a new charge needs a tenant picker and amount/kind form; the phase scope named "Tenant Billing" as a review-and-refund surface, so issuance is left for a follow-up rather than half-built.
5. **No tests.** Testing was not in this phase's scope.
6. **Bundle is 158 KB gzipped**, above the 120 KB of an empty shell but within the architecture's <200 KB budget. Route-level code splitting is available if it grows.

---

## 7. Verification evidence

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              platform-admin: 532.32 kB │ gzip: 157.80 kB

grep useOptimisticRpcMutation  → none
grep schema('analytics')       → none
backend files modified         → 0
packages source files modified → 0
```

---

**The Platform Admin portal is complete and compiles cleanly. Dashboard, Teacher, Parent, Reception, and Driver were not started. Stopping here.**
