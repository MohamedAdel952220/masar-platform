# Masar Platform — Frontend Architecture (Phase 2)

**Status:** Architecture only. No frontend code is produced by this document.
**Constraint:** the backend is frozen and certified (`BACKEND_CERTIFICATION.md`). This architecture consumes the backend **exactly as implemented and deployed** — every contract below was verified against the live project, not assumed.

---

## 0. Starting position

What already exists:

| Asset | Location | State |
|---|---|---|
| Design tokens | `tokens/` (`colors.css`, `fonts.css`, `spacing.css`, `typography.css`) | Complete, plain CSS custom properties |
| Component library | `components/{core,data,navigation,status}` — `Avatar, Badge, Button, Card, Icon, Input, StatCard, Tabs, DayPath, StatusPill` | Complete React JSX + `.d.ts` + per-component `.prompt.md` |
| Portal UI kits | `ui_kits/{parent-app, teacher-app, reception-app, driver-app, nursery-dashboard, platform-admin}` | Complete screen-level JSX |
| Shared runtime | `ui_kits/_shared/` (`masar-ui.jsx`, `supabaseClient.epic1.js`, `env.epic1.js`) | Prototype-grade |
| Backend | 67 migrations, 71 RLS-forced tables, 19 Edge Functions, 11 Realtime channels, 7 buckets | Frozen & certified |

The current frontend is a **Babel-in-browser prototype**: no bundler, no build step, `window.*` globals, JSX transpiled at runtime, `supabaseClient.epic1.js` wired only to Epic 1's surface. Phase 2 productionises this **without discarding the design system**, which is the single largest existing frontend investment.

**Six portals** ship, matching the six UI kits and the `app_access` JWT claim:

| Portal | Role | Form factor |
|---|---|---|
| Parent App | `guardian` | Mobile |
| Teacher App | `teacher` | Mobile |
| Reception App | `reception` | Mobile (QR scanner) |
| Driver App | `driver` | Mobile (background GPS) |
| Nursery Dashboard | `manager` | Web |
| Platform Admin | `platform_admin` (`owner`/`admin`/`support`) | Web |

---

## 1. Technology stack recommendation

| Concern | Recommendation | Why this, given the existing assets |
|---|---|---|
| Framework | **React 18 + TypeScript** | The entire design system and all six UI kits are already React DOM JSX. Any other framework discards them. TypeScript is added because the components already ship `.d.ts` files and the backend has a large, precisely-typed contract surface. |
| Build | **Vite** | Fast, first-class React+TS, trivial multi-app config. Replaces Babel-in-browser. |
| Rendering | **SPA (client-rendered)**, not SSR/Next.js | Every screen is behind authentication and RLS-scoped to the caller; there is no SEO surface and no anonymous content. SSR would add a server tier that must re-implement auth context for zero benefit, and would sit awkwardly against a PostgREST+RLS model where the user's JWT *is* the authorization. A static SPA on CDN also matches the existing wildcard-subdomain deployment model. |
| Server state | **TanStack Query v5** | PostgREST is a REST cache-friendly surface; TanStack Query supplies caching, deduplication, background refetch, optimistic updates, and pagination primitives that map 1:1 onto the backend's read model. |
| Client state | **Zustand** (small stores only) | Session, active tenant, locale/direction, UI shell state. Deliberately minimal — nearly all state is server state. |
| Routing | **React Router v6** (data routers) | Mature, supports nested layouts + route-level guards, works identically inside the Capacitor shells. |
| Forms | **React Hook Form + Zod** | Zod schemas mirror the backend's own validation schemas one-for-one (`backend/src/validation/*.schema.ts`), so client validation and server validation cannot silently diverge. |
| Backend SDK | **`@supabase/supabase-js` v2** | Already the integration path; provides PostgREST querying, Auth, Realtime, Storage, and Edge Function invocation in one client. |
| Styling | **Existing CSS custom properties + CSS Modules** | The design tokens are already plain CSS. Do **not** migrate to Tailwind or CSS-in-JS — that would rewrite a finished design system for no functional gain and break token parity with the handoff. |
| Mobile shell | **Capacitor** wrapping the same React build | The four mobile portals need native camera (QR), background geolocation, and push. Capacitor grants these while running the *existing React DOM components unchanged*. React Native would require rewriting every component and UI kit — a total loss of the design-system investment for capability the web shell plus Capacitor already provides. |
| Monorepo | **pnpm workspaces + Turborepo** | Six apps sharing four packages; needs hoisting, task graph caching, and one dependency source of truth. |
| i18n | **i18next + react-i18next** | Mature RTL/plural/interpolation support; see §20. |
| Testing | Vitest + React Testing Library + Playwright | Vitest matches the backend's existing test runner, keeping one mental model. |

### Explicitly rejected
- **Next.js / SSR** — no anonymous or SEO surface; adds a server tier that duplicates auth.
- **React Native / Flutter** — discards the complete React DOM design system and all six UI kits.
- **Redux Toolkit** — the server-state problem is solved by TanStack Query; a global mutable store would mostly duplicate the cache.
- **A bespoke REST wrapper service in front of Supabase** — the reconciled architecture (`ARCHITECTURE_RECONCILIATION_REPORT.md`) established PostgREST+RLS as the read path; interposing a server would bypass RLS and force re-implementation of every policy.

---

## 2. Folder structure

```
masar/
├─ package.json                    # pnpm workspace root
├─ turbo.json
├─ packages/
│  ├─ design-system/               # migrated from components/ + tokens/
│  │  ├─ src/tokens/               # colors, fonts, spacing, typography (CSS vars)
│  │  ├─ src/core/                 # Avatar, Badge, Button, Card, Icon, Input
│  │  ├─ src/data/                 # StatCard, (Table, Chart added in Phase 2)
│  │  ├─ src/navigation/           # Tabs, (AppBar, BottomNav, SideNav)
│  │  ├─ src/status/               # DayPath, StatusPill
│  │  ├─ src/primitives/           # Stack, Grid, Spacer, VisuallyHidden
│  │  └─ src/index.ts              # single public entry
│  ├─ api-client/                  # the ONLY module that talks to Supabase
│  │  ├─ src/client.ts             # singleton supabase-js client
│  │  ├─ src/reads/                # PostgREST query builders, per domain
│  │  ├─ src/rpc/                  # typed RPC wrappers (writes)
│  │  ├─ src/functions/            # typed Edge Function invocations (19)
│  │  ├─ src/realtime/             # channel factories (11 channels)
│  │  ├─ src/storage/              # bucket helpers, signed URL access
│  │  ├─ src/errors/               # AppError, RPC error-contract parser
│  │  ├─ src/types/                # DB row types + domain types
│  │  └─ src/queryKeys.ts          # canonical TanStack Query key registry
│  ├─ auth/                        # session, JWT claims, guards, role helpers
│  └─ i18n/                        # en/ar resources, direction, formatters
├─ apps/
│  ├─ parent/
│  ├─ teacher/
│  ├─ reception/
│  ├─ driver/
│  ├─ dashboard/
│  └─ platform-admin/
│     └─ src/
│        ├─ routes/                # route modules (one folder per route)
│        ├─ features/              # feature slices: components + hooks + schemas
│        ├─ layouts/
│        ├─ app.tsx
│        └─ main.tsx
└─ e2e/                            # Playwright, cross-portal journeys
```

**Rule:** an app never imports `@supabase/supabase-js` directly. All backend access flows through `@masar/api-client`. This is what makes the backend contract enforceable and mockable in one place.

---

## 3. Component architecture

Four layers, strictly one-directional (each layer may import only from layers above it):

1. **Tokens** — CSS custom properties. No JS. Consumed by everything.
2. **Primitives** (`packages/design-system`) — presentational, stateless, no data access, no i18n keys, no backend awareness. Props in, DOM out. This is the existing `components/` set, migrated verbatim to TS.
3. **Composites** (`packages/design-system`) — combinations with internal UI state only (`Tabs`, `DayPath`, data table, date picker). Still backend-agnostic.
4. **Feature components** (`apps/*/src/features`) — bound to data via hooks, aware of roles and permissions, own the loading/error/empty states.

**Container/presentational split at the feature layer:** every feature exposes a *view* component (pure props, storybook-able, unit-testable without a network) and a *container* hook that supplies data. This keeps the design system reusable across six portals whose visual language is shared but whose data shapes differ.

**Cross-portal sharing rule:** a component graduates from an app into `packages/design-system` only when a **third** portal needs it. Two usages is a coincidence; three is a pattern. This prevents premature abstraction of the six intentionally-distinct portal UIs.

---

## 4. State management

Four distinct categories, deliberately separated:

| Category | Owner | Examples |
|---|---|---|
| **Server state** | TanStack Query | Every row, list, and aggregate from the backend. ~90% of all state. |
| **Session state** | `@masar/auth` (Zustand + Supabase Auth) | Access token, `tenant_id`, `role`, `platform_admin_tier`, `app_access`. Derived from the JWT, never hand-maintained. |
| **UI shell state** | Zustand, per app | Nav open/closed, active tab, toasts, modal stack, locale/direction. |
| **Form state** | React Hook Form, component-local | Never lifted to a global store. |

**No global mutable domain store.** The server is the source of truth; TanStack Query's cache is the client's replica of it. This matters specifically because RLS means *what a user can see is a server-side decision* — caching domain data in a hand-rolled global store risks showing a row the server would no longer authorize.

**Realtime writes into the query cache** rather than into a parallel store (§10), so a live update and a refetched update converge on one representation.

---

## 5. API client architecture

`@masar/api-client` encodes the backend's actual dual model: **PostgREST + RLS for reads, RPC for writes, Edge Functions for external-boundary operations.**

### 5.1 Reads — PostgREST, RLS-scoped
```
reads/academic.ts   → listChildren(), getChild(), listAttendance()
reads/platform.ts   → listSupportTickets(), listActivityLog()
reads/analytics.ts  → childAttendanceSummary(), tenantBillingSummary()
```
- Query the **13 exposed schemas** only: `public, tenancy, identity, academic, transport, safety, comms, approvals, billing, media, reports, platform, jobs`. The `analytics` schema is **not** exposed — its data is reached exclusively through the three access-controlled views (`academic.v_child_attendance_summary`, `platform.v_tenant_billing_summary`, `platform.v_tenant_health_summary`). Any client attempt to reach `analytics` directly returns `PGRST106` by design.
- **Column selection is explicit, never `select('*')`** on entities containing sensitive fields (§28 PII minimisation) — a reception bus roster requests name/photo only, even though RLS would permit more.
- **Embedded resources** (`select=*,classroom(*)`) are used for list+relation screens instead of client-side fan-out (§29 N+1 avoidance).
- No client ever supplies `tenant_id` as a filter for security purposes; RLS applies it. Passing it is permitted only as a *narrowing* convenience on cross-tenant Platform Admin surfaces.

### 5.2 Writes — RPC only
```
rpc/academic.ts   → markAttendance(), submitEvaluation()
rpc/billing.ts    → verifyPayment(), generateInvoice()
rpc/platform.ts   → createSupportTicket(), updateSupportTicket()
```
- Every wrapper is typed against the deployed signature and returns a domain object.
- **Idempotency:** wrappers for the 36 RPCs that accept `p_idempotency_key` generate a client-side UUID v4 per user-initiated action, hold it for the lifetime of that action (including retries), and surface `CONFLICT_IDEMPOTENCY_KEY_REUSED` distinctly. **The 7 RPCs that do not accept an idempotency key** (`mark_installment_paid_manual`, `mark_ledger_item_paid_manual`, `confirm_handover`, `update_child_trip_status`, `withdraw_child`, `escalate_conversation`, `advance_tenant_provisioning` — see `BACKEND_CERTIFICATION.md` §7.1) are flagged in the client as **non-retryable**: no automatic retry, submit buttons hard-disable on first dispatch, and a failed call surfaces "verify before retrying" rather than a retry affordance. This is a frontend mitigation of known backend debt, not a fix.
- Writes are never issued directly against a table via PostgREST, even where RLS would allow it — the backend deliberately provides no direct-write policy alongside a correctness-critical RPC.

### 5.3 Edge Functions — external boundaries (19)
Typed invocations for provisioning (`provision-tenant`, `enroll-child`, `add-staff`, `add-bus`), account lifecycle (`suspend-staff-account`, `reactivate-staff-account`, `revoke-sessions`, `regenerate-activation-link`), service accounts (`issue-service-account-key`, `revoke-service-account-key`), media (`camera-heartbeat`, `camera-stream-token`), billing (`initiate-payment`, `payment-webhook`, `generate-invoice-pdf`, `resend-invoice`), comms (`notification-dispatch`), and AI (`ai-draft-report`, `ai-polish-note`).

### 5.4 Error contract
A single parser implements §25.2. Every RPC raises with `DETAIL` carrying `{code, human_message_en, human_message_ar}`. The client parses this into:
```
AppError { code, messageEn, messageAr, httpStatus, retryable }
```
UI renders `messageEn`/`messageAr` by active locale — **the backend is the source of bilingual error copy**, so error UX is never the one untranslated surface. `code` drives behaviour (`PERM_ROLE_DENIED` → route away; `VALIDATION_FAILED` → field mapping; `STATE_ALREADY_PROCESSED` → refetch and inform; `CONFLICT_IDEMPOTENCY_KEY_REUSED` → treat as success-already-applied).

---

## 6. Authentication flow

Grounded in §10.2 as deployed:

| Role | Identity | Factor |
|---|---|---|
| guardian / teacher / reception / manager / driver | `phone` | phone + password |
| platform_admin | `email` | email + password **+ mandatory MFA** |

- **Login** → `supabase.auth.signInWithPassword`. Session persisted by supabase-js (localStorage on web; Capacitor Preferences on native), auto-refresh enabled.
- **Claims** come from `raw_app_meta_data`, which is **server-set and immutable to the client**: `tenant_id`, `role`, `app_access`. The client decodes but never trusts these for security — they mirror what RLS already enforces. `raw_user_meta_data` (name, photo) is display-only.
- **Portal gate:** on session establishment the shell checks `app_access` contains this portal's identifier; a mismatch signs the user out with a clear message rather than rendering an empty RLS-filtered shell.
- **Activation (§10.3):** no credential ever arrives through the UI. New accounts receive a one-time activation link to their own phone; the frontend implements only the *consume-link → set-password* screen.
- **Password reset:** OTP via WhatsApp/SMS. The UI must surface the §31 single-provider risk gracefully (clear "try again later" path), since an outage blocks reset platform-wide.
- **MFA (platform admin):** enrolment gate at first login; unenrolled admins are routed to enrolment before any data screen.
- **Session revocation (§10.6):** suspension revokes sessions server-side. The client treats any `401`/`invalid_token` as immediate, non-negotiable logout — no silent retry loop — because a revoked session is a security decision, not a transient error.
- **Token refresh:** handled by supabase-js; a refresh failure is a logout, and the entire TanStack Query cache is cleared on logout to prevent cross-account data bleed.

---

## 7. Authorization strategy

**Three layers, with an explicit statement of which is authoritative.**

1. **RLS (authoritative).** The database decides what any request returns. The frontend never has the final say.
2. **Route guards (navigational).** `role` + `app_access` gate which routes mount. Prevents a user landing on a screen that would render empty.
3. **Capability gates (presentational).** A `useCan(capability)` hook derived from the §12 Permission Matrix and the §12.1 tier split hides actions the user cannot perform — e.g. a `support`-tier Platform Admin sees no "suspend tenant" or "issue refund" control, because `is_platform_admin_manager_tier()` would reject it server-side.

**Design rule:** capability gates exist to prevent *dead-end UX*, never to enforce security. Every gated action must still fail correctly server-side if invoked directly. The adversarial RLS suites already prove the server side; the frontend's job is to not present impossible affordances.

**Tier handling:** `platform_admin_tier` (`owner`/`admin`/`support`) is read from the session and drives the Platform Admin console's action visibility, mirroring §12.1 exactly.

---

## 8. Routing architecture

- **Tenant resolution by subdomain.** `{slug}.masar.app` (§9, wildcard DNS+TLS already provisioned). The slug is resolved at bootstrap to confirm the tenant exists and is active; the *authoritative* tenant binding remains the JWT's `tenant_id`. A mismatch between subdomain slug and token tenant is a hard error, never a silent switch — this closes the obvious tenant-confusion vector.
- **Platform Admin** runs on its own origin (no tenant subdomain), consistent with its cross-tenant scope.
- **Route shape** (nested data routers):
```
/                      → redirect by role
/auth/*                → login, activate, reset, mfa-enrol   (public)
/app/*                 → authenticated shell
   ├─ per-portal feature routes
/errors/{403,404,500}  → terminal states
```
- **Guards** run as route loaders: session present → claims valid → `app_access` allows portal → role allows route. Failure redirects rather than rendering.
- **Deep links** matter operationally: notifications carry `deep_link` values (`app://attendance/{id}`, `app://support/{id}`, `app://platform/audit?actor=…&ip=…`). A URL translation layer maps `app://` deep links to in-app routes for both web and Capacitor, so a tapped notification lands on the right screen.
- **Code splitting** per route module; each portal ships only its own routes.

---

## 9. Design System mapping

The existing assets migrate as follows — **no visual redesign, no token renaming.**

| Existing | Becomes | Change |
|---|---|---|
| `tokens/*.css` | `packages/design-system/src/tokens/*.css` | Verbatim. Remains CSS custom properties. |
| `components/core/*.jsx` + `.d.ts` | `packages/design-system/src/core/*.tsx` | JSX → TSX, using the existing `.d.ts` as the authoritative prop contract. |
| `components/{data,navigation,status}` | same paths under `src/` | As above. |
| `components/*.prompt.md` | co-located docs / Storybook stories | Preserved as component documentation. |
| `ui_kits/{portal}/*.jsx` | `apps/{portal}/src/features/**` | Screens decompose into feature view + container hook. Markup preserved; data wiring replaces mock data. |
| `ui_kits/_shared/masar-ui.jsx` | absorbed into `packages/design-system` | The `window.*` global convention is dropped in favour of ES module imports. |
| `ui_kits/_shared/supabaseClient.epic1.js` | superseded by `packages/api-client` | Retired; its Epic-1-only surface is replaced by full typed coverage. |
| `_ds_manifest.json`, `_adherence.oxlintrc.json` | retained as CI adherence gates | Lint rules that enforce token usage continue to run. |

**Gaps to fill in Phase 2** (components the backend requires but the kit lacks): data table with cursor pagination, chart/sparkline for analytics summaries, file dropzone, QR scanner viewport, map/route view for GPS, date/time pickers with Arabic calendar support, toast/notification centre, empty/skeleton states.

**Adherence rule:** new components must consume tokens only — no hardcoded colour, spacing, or font values. The existing oxlint adherence config is the enforcement mechanism in CI.

---

## 10. Realtime architecture

Implements the §15 matrix exactly (11 published tables). Channels are **RLS-scoped, not separately authorized** — a parent subscribing to another child's trip simply receives nothing.

| Channel | Consumer portals |
|---|---|
| `trip:{trip_id}:position` | Parent, Dashboard |
| `trip:{trip_id}:status` | Parent, Dashboard, Reception |
| `classroom:{id}:day_path` | Parent |
| `conversation:{id}:messages` | Parent, Teacher |
| `user:{id}:notifications` | All |
| `tenant:{id}:cameras` (+ `:heartbeat` subset) | Dashboard, Parent |
| `tenant:{id}:activity` | Dashboard |
| `tenant:{id}:approvals` | Dashboard, Teacher |
| `platform:service_health`, `platform:tenants`, `platform:support_tickets` | Platform Admin |

**Rules:**
- **Subscription lifecycle is tied to component mount**, and channels are torn down on unmount and on logout. Never a tenant-wide firehose — always the narrowest filter (`trip_id`, `conversation_id`), per §29.
- **Events write into the TanStack Query cache** (`setQueryData` / targeted `invalidateQueries`), so realtime and refetch converge on one representation.
- **GPS is throttled in the UI to ≤1 render/second** regardless of ping cadence — an explicit §15 implementation note, since ping frequency is a backend decision.
- **A single multiplexed socket per app instance**; channel subscriptions are reference-counted so two components watching one trip share one subscription.
- **Reconnection:** on socket resume, affected queries are invalidated (not merely resumed), because events during the gap were missed.
- **Realtime is an accelerator, never the sole source.** Every realtime-fed view must render correctly from a plain fetch alone; this keeps the UI correct when the socket is unavailable and matches the §30 concern about peak-window connection ceilings.

---

## 11. Forms architecture

- **React Hook Form** for state, **Zod** for schema.
- **Schema parity is a hard rule:** each form's Zod schema mirrors the corresponding backend schema in `backend/src/validation/*.schema.ts` (field names, bounds, enums, uuid formats). Client validation is a UX accelerator; the server's validation is authoritative and its `VALIDATION_FAILED` response maps back onto form fields by name.
- **Bilingual validation messages** resolve through i18n keys; server-supplied messages already arrive bilingual.
- **Submission discipline:** one in-flight submission per form; idempotency key generated once per attempt and reused across retries; on success the relevant queries are invalidated. For the seven non-idempotent RPCs (§5.2), the submit control disables permanently on dispatch and offers no retry.
- **Unsaved-changes guard** on navigation for long forms (child enrolment, staff onboarding, invoice creation).
- **Multi-step flows** (enrolment, provisioning) keep step state local and submit once at the end, matching the Edge Functions' single-call transactional shape.
- **RTL-aware inputs**: numeric, phone, and currency fields keep LTR text direction inside an RTL layout (see §20).

---

## 12. Data fetching strategy

- **TanStack Query** for everything server-derived. One canonical `queryKeys.ts` registry prevents key drift.
- **Key shape:** `['domain', 'entity', scopeParams]` — always including tenant scope for cache correctness across account switches.
- **Cursor pagination everywhere for large lists** (§14.3): messages, notifications, activity log, GPS history, audit log — using `useInfiniteQuery` with `(created_at, id)` composite cursors. *Note:* the Epic 1–9 repositories use offset pagination server-side (`BACKEND_CERTIFICATION.md` §7.5); the frontend adopts cursor semantics where the endpoint supports it and must not assume stable offsets on high-write tables.
- **Prefetching** on hover/route-intent for predictable navigations (child row → child detail).
- **Parallel over waterfall:** independent queries issued concurrently; dependent queries use `enabled` gating rather than nested awaits.
- **Mutations** use optimistic updates only where the server outcome is deterministic (mark-read, toggle); anything with server-side branching (payments, approvals, refunds) waits for the authoritative response.
- **Analytics surfaces** read the three exposed views. Because `pg_cron` is not enabled, these materialized views are not refreshed on a schedule (`BACKEND_CERTIFICATION.md` §6.1) — every analytics view therefore **renders its `computed_at` timestamp as a visible freshness indicator**, and the UI must not present these figures as live. This is a required UX affordance, not optional polish.

---

## 13. Caching strategy

| Data class | `staleTime` | Rationale |
|---|---|---|
| Reference (plan catalog, fee items, subjects) | 1 h | Rarely changes |
| Profile/roster (children, staff, classrooms) | 5 min | Changes via explicit admin action |
| Operational (attendance, trips, requests) | 30 s | Frequently mutated during the day |
| Realtime-backed (messages, notifications, GPS) | 0 (socket-driven) | Socket is the refresh mechanism |
| Analytics views | 5 min + visible `computed_at` | Underlying MV refresh is not scheduled |

- **Cache is cleared entirely on logout and on account switch** — non-negotiable, because RLS makes visibility identity-dependent.
- **`gcTime`** longer than `staleTime` to keep back-navigation instant.
- **Persistence:** session-scoped in memory. Deliberately **no** cross-session disk persistence of domain data on web (children's health notes, financial records, chat). On native, any offline cache (§15/§16) is encrypted at rest and holds only the driver's manifest and the reception roster — never medical, financial, or chat content.
- **Signed URLs are cached below their TTL** (§16) and never persisted.

---

## 14. Error handling

Four tiers:

1. **Field errors** — `VALIDATION_FAILED` mapped onto form fields.
2. **Action errors** — toast/inline using the backend's bilingual message, keyed on `code` (`PERM_ROLE_DENIED`, `NOT_FOUND`, `STATE_ALREADY_PROCESSED`, `CONFLICT_IDEMPOTENCY_KEY_REUSED`).
3. **Route errors** — React Router error boundaries render a recoverable screen with retry.
4. **App errors** — top-level boundary; report and offer reload.

**Rules:**
- `401`/revoked token → immediate logout, cache purge (§6).
- `403`/`PERM_ROLE_DENIED` → route to a permission screen; never a blank page. A 403 reaching the UI signals a capability-gate gap (§7) and is logged as a UX defect.
- `PGRST106` (schema not exposed) → developer error, surfaced loudly in dev, generic in production. It should be unreachable if §5.1 is respected.
- **Never surface raw Postgres text.** Only the parsed `{code, human_message_*}` contract reaches users.
- **Retry policy:** network/5xx retried with exponential backoff; **4xx never retried**; the seven non-idempotent RPCs never auto-retried under any condition.
- **Offline detection** with an explicit banner; queued actions are not silently replayed against non-idempotent endpoints.

---

## 15. Loading strategy

- **Skeletons matching final layout** for initial loads — no spinners for full pages (prevents layout shift).
- **Inline/optimistic** for mutations; buttons show pending state and disable.
- **Background refetch is silent** — a stale-while-revalidate update never flashes a loader over already-rendered content.
- **Route-level suspense boundaries** so a slow panel never blocks the shell.
- **Empty ≠ loading ≠ error ≠ forbidden**: four distinct states, always. Under RLS an empty result is frequently a *permission* outcome, so empty states must be worded to avoid implying data loss.
- **Native splash** hand-off to the first authenticated screen in the Capacitor shells.

---

## 16. File uploads

**This section is explicitly provisional, because the backend subsystem it depends on does not exist.**

`BACKEND_ARCHITECTURE.md` §21/§22.1 specify that `storage_objects` is the ownership/metadata source of truth, that no client constructs a Storage path, and that uploads flow through an RPC/Edge Function returning a pre-signed, tenant-prefixed upload URL, finalised by `finalize_upload`. **None of this is implemented** — `storage_objects`, `finalize_upload`, and orphan cleanup are absent, and 9 `*_object_id` columns exist across the schema with no foreign key (`BACKEND_CERTIFICATION.md` §7.3).

**Consequence and recommendation:**
- The frontend must **not** invent a client-side path convention to work around this. Doing so would place tenant isolation in client code — precisely what the architecture forbids.
- **Upload-dependent features should be sequenced after the backend subsystem lands** (roadmap Stage 8): child/staff photos, pickup-pass ID photos, payment receipts, academic attachments, chat attachments.
- Where a portal must ship earlier, the interim path is **read-only consumption of existing objects via signed URLs** (invoice PDFs, exported reports from `generated-documents`, which are Edge-Function-generated and unaffected), with upload affordances hidden rather than stubbed.
- Once the subsystem exists, the client contract is: request pre-signed URL → direct PUT to Storage → call `finalize_upload` → invalidate the owning entity's query. Signed-URL TTLs are honoured per §21 (profile ~1 h, identity documents ~5 min, generated documents ~24 h), with identity documents never cached to disk.

---

## 17. AI integration

- **Surfaces:** `ai-polish-note` (teacher, note refinement) and `ai-draft-report` (teacher/manager, per-child report drafting) Edge Functions; drafts land in `reports.ai_report_drafts` with `draft → scheduled → sent` lifecycle RPCs (`schedule_report_draft`, `send_report_draft`, `resend_report_draft`, `delete_report_draft`, `export_report_draft`).
- **Latency model:** LLM calls are slow and variable. `ai-polish-note` is treated as an interactive request with an explicit pending state and cancel affordance; `ai-draft-report` for a whole classroom is a **long-running batch** — the UI dispatches it, shows in-progress state, and relies on the notification channel for completion rather than holding a request open.
- **Usage caps (§19):** `ai_usage_counters` enforces a plan cap server-side. The UI reads remaining quota, displays it *before* the user composes, and renders cap-exceeded as an explainable state naming the plan limit — never a generic failure.
- **Human-in-the-loop is mandatory:** AI output is always a *draft*. No AI-generated content reaches a guardian without an explicit staff send action. The UI must make the draft/sent distinction unmistakable.
- **Cost/abuse:** rate limiting on `ai_polish_note` is specified in §28 but **not implemented** (`BACKEND_CERTIFICATION.md` §7.2). Until it is, the client applies its own debounce and in-flight lock as a courtesy control — explicitly *not* a security boundary.

---

## 18. Camera integration

- **Video never flows through Postgres or Supabase Realtime** (§17). Only camera *metadata* (`online`, `admin_disabled`, `last_heartbeat_at`) does, via `tenant:{id}:cameras`.
- **Stream access:** the client calls the `camera-stream-token` Edge Function, which authorizes against the caller's role/classroom linkage and returns a short-lived token for the external media relay (RTSP→WebRTC/HLS gateway). The player connects to the relay, not to Supabase.
- **Viewability rule** mirrors the backend exactly: a camera is viewable only when `online = true AND admin_disabled = false`. These are independent booleans and the UI must distinguish them — "offline" (heartbeat lost) and "disabled by manager" are different states with different remedies (§17).
- **Parent scope:** only cameras linked to the parent's own child's classroom; enforced by RLS and mirrored by capability gates.
- **Native:** Capacitor for full-screen playback and lifecycle handling; streams are torn down on background to avoid battery/bandwidth drain.
- **QR scanning (Reception)** uses the native camera via Capacitor and calls `scan_pickup_pass`, querying strictly by exact `qr_token` — the UI never offers a "browse all passes" path, an intentional two-layer control per §13.4.

---

## 19. Payment integration

- **Guardian flow:** `initiate-payment` Edge Function → PSP redirect/SDK → PSP calls `payment-webhook` server-side → the client **never** confirms payment from its own return URL. The UI polls or awaits the notification/realtime signal, then reflects the server-confirmed state. Treating the browser return as authoritative would be a trust boundary violation.
- **Manager flow:** `verify_payment` (reconcile a submitted transaction) and `mark_installment_paid_manual` / `mark_ledger_item_paid_manual` for cash/in-person. **Both manual RPCs lack idempotency** (`BACKEND_CERTIFICATION.md` §7.1) — the highest-risk instance of that debt, since a double-submit records a duplicate payment. The UI therefore: disables submit permanently on dispatch, requires an explicit confirmation step, never auto-retries, and on ambiguous failure directs the manager to refresh and verify before re-entering.
- **Invoices:** `generate-invoice-pdf` / `resend-invoice`; PDFs are read from `generated-documents` via short-lived signed URLs.
- **Currency:** EGP, formatted per locale with Arabic-Indic numeral support where the locale requires it. Amounts are rendered from server values; the client performs no financial arithmetic beyond display aggregation.
- **Refunds** are Platform-Admin/manager tier-gated per §12.1 and hidden from `support` tier entirely.

---

## 20. Internationalization

**Arabic is a first-class, RTL locale — not a translation afterthought.** Every entity in the backend carries `_ar` fields and every error message arrives bilingual.

- **i18next + react-i18next**, namespaced per feature; `en` and `ar` resource sets.
- **Direction:** `dir="rtl"` on the document for Arabic. Layout uses **logical CSS properties** (`margin-inline-start`, `padding-inline-end`, `inset-inline`) rather than physical left/right, so one stylesheet serves both directions. This is a design-system-level requirement and must be enforced by the existing adherence lint config.
- **Bidirectional content:** phone numbers, currency amounts, and timestamps remain LTR inside RTL text via isolation; Arabic-Indic numerals applied per locale preference.
- **Backend-supplied content** (`name` / `name_ar`, error `human_message_en` / `human_message_ar`) is selected by active locale — the client does not translate domain data.
- **User preference:** `preferred_language` on the profile drives notification/PDF language server-side; the UI honours the same value and lets the user change it, writing through the profile RPC.
- **Formatting:** `Intl` APIs for dates, numbers, currency, and relative time, with the Hijri calendar available where the design calls for it.
- **Asset direction:** directional icons (arrows, chevrons, progress) mirror in RTL; the `DayPath` component in particular must flow right-to-left in Arabic.

---

## 21. Accessibility

Target **WCAG 2.1 AA**.

- **Semantic HTML first**; ARIA only where semantics are insufficient.
- **Keyboard:** every interactive element reachable and operable; visible focus rings from design tokens; focus trapped in modals and restored on close; skip-to-content on web portals.
- **Screen readers:** labelled form controls with programmatic error association (`aria-describedby`), live regions for toasts and realtime arrivals (chat, notifications) — announced politely, never assertively, to avoid interrupting.
- **Colour:** contrast validated at AA against the existing token palette; **status is never colour-only** — the `StatusPill` and `DayPath` components must pair colour with text or icon, which matters directly for attendance/trip states.
- **Targets:** ≥44×44px on the four mobile portals, particularly the Reception QR and Driver controls, which are used one-handed and in motion.
- **Motion:** honour `prefers-reduced-motion`; no essential information conveyed by animation alone.
- **RTL + a11y together:** direction changes must not break focus order or reading order.
- **Testing:** axe automated checks in CI, plus manual screen-reader passes in both languages.

---

## 22. Performance strategy

- **Route-level code splitting**; each portal bundles only its own routes. Target initial JS < 200 KB gzipped for mobile portals.
- **The design system ships tree-shakeable ESM** so a portal importing three components pays for three.
- **List virtualisation** for large collections (children, messages, notifications, GPS history, audit log).
- **Realtime throttling**: GPS ≤ 1 render/s (§15); chat batches rapid arrivals.
- **Image discipline:** responsive sizes, lazy loading below the fold, signed-URL caching within TTL.
- **Query efficiency:** explicit column selection, embedded resources instead of N+1, cursor pagination on the largest tables (§29).
- **Realtime connection budget (§30):** the AM/PM pickup windows are the concurrency peak. Mitigations in order: narrow channel scoping, one multiplexed socket per app with reference-counted subscriptions, and — if the project ceiling is approached — client-side connection pooling before any tier upgrade, exactly the escalation path §30 prescribes.
- **Native:** background GPS on the Driver app must respect the backend's 5–10 s cadence with client-side movement thresholds; battery impact is a first-order design constraint.
- **Budgets enforced in CI**: bundle size, Lighthouse performance, and interaction latency thresholds.

---

## 23. Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Pure logic: formatters, permission/capability helpers, error parsing, Zod schemas |
| Component | Vitest + React Testing Library | Design-system components and feature views in isolation, both locales/directions |
| Contract | Vitest + MSW | `@masar/api-client` against recorded PostgREST/RPC shapes — the guard against backend contract drift |
| Integration | Vitest + RTL | Feature containers with a mocked api-client: loading/empty/error/forbidden paths |
| E2E | Playwright | Cross-portal journeys against a seeded staging project |
| A11y | axe + manual | Automated in CI; manual screen-reader passes per release |
| Visual | Playwright snapshots | Design-system regression, LTR and RTL |

**Priority E2E journeys:** guardian views child day-path and pays an invoice; teacher marks attendance and drafts an AI report; reception scans a pickup pass and confirms handover; driver runs a trip with live GPS; manager reviews an approval and verifies a payment; platform admin handles a support ticket and confirms `support`-tier restrictions.

**Two hard rules:**
1. **Every test asserting authorization must run against real RLS** on a seeded project, not mocks. Mocked authorization tests prove nothing about the security boundary.
2. **The seeded dataset is a prerequisite** — the staging database currently seeds no domain rows (`BACKEND_CERTIFICATION.md` §6.10), which blocks E2E and the 11 backend RLS suites alike. Building it is shared infrastructure, scheduled in Stage 1.

---

## 24. Deployment strategy

- **Web portals** → static build to CDN. Dashboard and the mobile-web builds serve from `*.masar.app` (wildcard DNS + TLS already provisioned, §31); Platform Admin serves from its own origin.
- **Environments** mirror the backend exactly: `local` → `staging` → `production`, each bound to its own Supabase project. No frontend build ever targets two projects.
- **Configuration** is build-time-injected and **public-safe only** — Supabase URL and anon key (safe per §28/§34 because the anon key carries no privilege beyond RLS). The `service_role` key must never appear in any frontend artifact; CI must fail the build if it is detected.
- **CORS:** each environment's origins are registered per §31 — never wildcarded in production.
- **Mobile:** Capacitor builds per portal, versioned in lockstep with the web release; store submission for the four mobile portals; OTA updates for JS-only changes where store policy permits.
- **Release coupling:** the backend is frozen, so frontend releases are independent — but the api-client package pins a backend contract version, and contract tests (§23) gate the release.
- **Rollout:** staged (internal → pilot tenant → general), with Platform Admin first since its users are internal.
- **Observability:** error tracking with tenant/request-id context, mirroring the backend's §31 posture, plus Web Vitals.

---

## 25. Implementation roadmap

Ordered so each stage is independently verifiable and every dependency precedes its consumer. Portals are sequenced by **risk-ascending capability**: each new portal introduces exactly one hard new capability.

### Stage 1 — Foundation *(no portal ships)*
1. Monorepo scaffold (pnpm + Turborepo + Vite + TypeScript), CI with lint/typecheck/test gates.
2. **Seeded staging dataset** — unblocks E2E and the 11 backend RLS suites. Do this first; it is a prerequisite for verifying everything after it.
3. `@masar/design-system`: migrate tokens verbatim, port the 10 components JSX→TSX against their existing `.d.ts`, wire the oxlint adherence config, add Storybook, establish logical-property/RTL rules.
4. `@masar/i18n`: en/ar resources, direction handling, `Intl` formatters.

### Stage 2 — Backend contract layer
5. `@masar/api-client`: singleton client, typed row/domain types, error-contract parser (§25.2), query-key registry.
6. Read builders for the 13 exposed schemas; RPC wrappers with idempotency-key handling and the seven non-retryable RPCs flagged.
7. Typed wrappers for all 19 Edge Functions; realtime channel factories for all 11 channels; storage/signed-URL helpers (read-only initially, per §16).
8. Contract tests (MSW) covering every wrapper.

### Stage 3 — Auth & shell
9. `@masar/auth`: session, JWT claim decoding, `app_access` portal gate, refresh/revocation handling, cache purge on logout.
10. Auth screens: phone+password, email+password, MFA enrolment, activation-link consumption, password reset.
11. App shell: routing skeleton, guards, error boundaries, loading/empty/forbidden states, toast/notification centre.

### Stage 4 — **Platform Admin** *(first portal — lowest risk, internal users)*
12. Overview, Schools, Support tickets, System health, Audit log, Tenant billing.
13. Exercises: auth, RLS reads, RPC writes, the §12.1 tier split, three realtime channels, and the analytics views **including the `computed_at` staleness affordance**.
*Validates the entire foundation with internal-only blast radius.*

### Stage 5 — **Nursery Dashboard** *(largest surface, manager)*
14. Children, classrooms, staff, attendance oversight, approvals, billing, cameras, activity feed, analytics.
15. Adds: complex forms, cross-domain navigation, camera metadata + stream tokens, heaviest data volumes.

### Stage 6 — **Teacher App** *(first mobile shell)*
16. Attendance marking, evaluations, lessons, concerns, chat, AI report drafting.
17. Adds: Capacitor shell, push notifications, AI integration with quota display and human-in-the-loop draft/send.

### Stage 7 — **Parent App** *(highest user count)*
18. Child day-path, live trip tracking, chat, notifications, academics, payments, settings.
19. Adds: high-frequency realtime (GPS throttling), the payment flow with server-authoritative confirmation, camera viewing.

### Stage 8 — **File uploads** *(gated on backend)*
20. **Only after** the `storage_objects` / `finalize_upload` subsystem exists (`BACKEND_CERTIFICATION.md` §7.3). Then enable photo, receipt, ID-document, and attachment uploads across the portals already shipped.

### Stage 9 — **Reception App**
21. QR pickup-pass scanning, handover confirmation, bus roster, today's trips.
22. Adds: native camera QR capture; strict exact-token query discipline (§13.4).

### Stage 10 — **Driver App** *(hardest native capability, last)*
23. Trip start/complete, rider manifest, child status updates, background GPS.
24. Adds: background geolocation, battery/threshold tuning, offline-tolerant manifest.

### Stage 11 — Hardening & release
25. Full a11y pass (both locales/directions), performance budgets, realtime concurrency measurement against the §30 ceiling.
26. Complete E2E journey coverage; visual regression LTR/RTL.
27. Staged rollout, observability wiring, production readiness review.

### Dependencies on backend remediation
Two stages are **blocked by certified backend debt** and must not be forced early:
- **Stage 8 (uploads)** requires the §22.1 storage subsystem.
- **Payment and manual-payment UX (Stages 5, 7)** ships with the non-retryable safeguards described in §5.2/§19 until idempotency is retrofitted onto the two manual-payment RPCs.

Additionally, **rate limiting is unimplemented backend-side** (§7.2). Client-side debounce and in-flight locks are courtesy controls only and must never be described — in code or documentation — as the security boundary.

---

## Summary

This architecture preserves the completed design system and all six UI kits by standardising on React + TypeScript + Vite, consumes the frozen backend exactly as deployed (PostgREST + RLS for reads, RPC for writes, 19 Edge Functions, 11 RLS-scoped Realtime channels), and treats RLS as the sole authoritative authorization layer — with client-side capability gates existing purely to prevent dead-end UX. It is explicit about the three places where certified backend debt constrains frontend design (uploads, payment idempotency, rate limiting) rather than silently working around them, and it sequences delivery so that each portal introduces exactly one new hard capability against a foundation already proven by the preceding one.
