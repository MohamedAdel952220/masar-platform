# Frontend Phase 1 — Foundation Completion Report

**Scope:** production-grade frontend foundation only. No application screens, no business logic, no feature-level backend integration.
**Source of truth:** `FRONTEND_ARCHITECTURE.md`.
**Backend:** untouched and frozen — nothing under `backend/` was read for modification or written to.

**Status: complete. All four verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, 0 errors, 0 warnings |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps built |

---

## 1. What was delivered

A pnpm + Turborepo monorepo at `frontend/`, sibling to the frozen `backend/`, containing **4 shared packages** and **6 application shells** — 126 source files.

```
frontend/
├─ package.json  pnpm-workspace.yaml  turbo.json
├─ tsconfig.base.json  .eslintrc.cjs  .prettierrc  .prettierignore  .gitignore  .npmrc
├─ .husky/pre-commit
├─ packages/
│  ├─ design-system/   (24 files)  tokens, 10 components, 2 layouts, 2 providers
│  ├─ api-client/      (20 files)  client, env, errors, types, queryKeys,
│  │                               reads/ rpc/ edge-functions/ realtime/ storage/
│  ├─ auth/            (8 files)   AuthProvider, claims, 3 route guards
│  └─ i18n/            (10 files)  I18nProvider, en/ar resources, direction
└─ apps/               (17 files each)
   parent · teacher · reception · driver · dashboard · platform-admin
```

## 2. Toolchain

| Tool | Version | Note |
|---|---|---|
| Node | 18.12.0 | Pinned the stack to what this runtime supports |
| pnpm | 8.15.9 | `packageManager` field; see §8 for how it is invoked here |
| Turborepo | 2.0.9 | Task graph + caching |
| React | 18.3.1 | Matches the existing design system |
| TypeScript | 5.4.5 | `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` |
| Vite | 5.4.0 | Vite 6/7 require Node 20+, so 5.x is the correct choice here |
| TanStack Query | 5.51.15 | |
| React Router | 6.26.0 | Data router |
| Zustand | 4.5.4 | Shell UI state only |
| React Hook Form + Zod | 7.52.1 / 3.23.8 | Wired as dependencies; no forms built yet |
| supabase-js | 2.45.0 | Only inside `@masar/api-client` |
| i18next / react-i18next | 23.12.2 / 14.1.3 | |
| ESLint / Prettier | 8.57.0 / 3.3.3 | |
| husky / lint-staged | 9.0.11 / 15.2.7 | |

## 3. Design system migration

Ported to `packages/design-system` **with no visual change**.

- **Tokens copied verbatim.** `colors.css`, `fonts.css`, `spacing.css`, `typography.css` were copied byte-for-byte and **verified identical with `diff` after formatting ran** — all four are listed in `.prettierignore` precisely so Prettier can never silently reflow the design handoff. An `index.css` barrel was added as the single import surface.
- **All 10 components ported JSX → TSX**: `Avatar`, `Badge`, `Button`, `Card`, `Icon`, `Input` (core); `StatCard` (data); `Tabs` (navigation); `DayPath`, `StatusPill` (status). Every style object, class, DOM structure, and default prop value is unchanged. Types were taken from the existing `.d.ts` contracts rather than re-invented.
- Strict-mode adaptations were made **without altering rendered output**: `w[0] ?? ''` for initials, a `?? fallback` on the deterministic avatar palette lookup, `as const` on tone/status maps so tuple destructuring is type-safe, a typed `window.lucide` global for `Icon`, and a stable `useState` id seed in `Input` (replacing a `Math.random()` call that ran on every render — same output, no longer regenerated per render).
- Added: `AppShell` and `CenteredLayout` layouts, `ThemeProvider`, `UIStoreProvider`.

**Non-destructive migration.** The original `components/`, `tokens/`, and `ui_kits/` directories were **left in place**. They are still loaded by the Babel-in-browser prototypes (`ui_kits/*/index.html`), and deleting them would break working artifacts I was not asked to remove. `packages/design-system` is now the canonical production home; the originals can be retired once the prototypes are.

## 4. API client architecture

`packages/api-client` was created with exactly the specified directories, encoding the backend's real dual model — **PostgREST + RLS for reads, RPC for writes, Edge Functions for external boundaries**.

| Directory | Contents |
|---|---|
| `reads/` | `from(schema, relation)` restricted to the 13 exposed schemas, `unwrap()` error normaliser |
| `rpc/` | `callRpc()`, `newIdempotencyKey()`, and the **`NON_IDEMPOTENT_RPCS` registry** |
| `edge-functions/` | All **19** deployed function names as a union type + `invokeEdgeFunction()` |
| `realtime/` | All **11** §15 channel-name builders + `subscribeToChanges()` returning an unsubscribe |
| `storage/` | All **7** buckets + per-bucket signed-URL TTLs + `createSignedUrl()` |
| `queryKeys/` | Canonical tenant-scoped key registry across all domains |
| `errors/` | `AppError` + `parseBackendError()` implementing the §25.2 bilingual contract |
| `types/` | Exposed schemas, roles, admin tiers, portals, pagination primitives |
| `providers/` | `QueryProvider` with the §12/§13 stale-time and retry policy |

Three backend realities are encoded structurally, not left to memory:

1. **`analytics` is absent** from `EXPOSED_SCHEMAS`, so a read against it is a type error.
2. **The 7 non-idempotent RPCs are enumerated** with `isNonIdempotentRpc()`, and mutations are configured `retry: false` globally — the frontend mitigation for `BACKEND_CERTIFICATION.md` §7.1.
3. **Uploads are deliberately not implemented.** `storage/` ships read-only signed-URL access with a comment explaining that inventing a client-side path convention would put tenant isolation in client code. Upload helpers land when the backend §22.1 subsystem does.

## 5. Providers, routing, and layouts

Composition order, outermost first: **I18n → Theme → Query → Auth → UIStore**.

- `I18nProvider` owns the locale and derives `direction`; `ThemeProvider` consumes it and sets `dir`/`data-theme` once at the document root, so RTL is applied in exactly one place.
- `AuthProvider` sits *inside* `QueryProvider` because sign-out must be able to clear the query cache.
- `UIStoreProvider` creates a per-provider Zustand store instance rather than a module singleton, so each portal owns isolated shell state and tests get a clean store per render.
- Routing: `createBrowserRouter` with a `RootLayout` (wrapping `AppShell`), an index `Placeholder`, a catch-all `NotFound`, and an `errorElement` boundary.
- Guards `RequireAuth`, `RequirePortal`, `RequireRole` exist in `@masar/auth`, documented as **navigational, not security** — RLS remains authoritative.

Each app's `Placeholder` renders live session status, locale, and direction with a locale toggle — a smoke screen proving the whole provider stack, design system, routing, and i18n mount together.

## 6. Guardrails wired into the toolchain

- **`no-restricted-imports` blocks `@supabase/supabase-js` everywhere except `@masar/api-client` and `@masar/auth`**, mechanically enforcing the architecture's "apps never talk to Supabase directly" rule.
- Strict TypeScript across the board, including `noUncheckedIndexedAccess`.
- `consistent-type-imports` enforced.
- Prettier + ESLint run on staged files via husky `pre-commit` → lint-staged.
- Turborepo caches `build`/`typecheck`/`lint`; verified working (`>>> FULL TURBO`, 483 ms replay).

## 7. Explicitly NOT implemented (per instruction)

Feature screens · business logic · authentication flow (login/OTP/MFA/reset) · CRUD · realtime subscriptions · AI · payments · file uploads · per-entity read builders and RPC wrappers · Capacitor shells · tests.

`AuthProvider` is the one nuanced case: it holds **session state** (restore on load, react to auth events, expose claims) because that *is* the provider's foundational job, but it contains no sign-in, sign-up, OTP, MFA, or password-reset logic. That arrives in the roadmap's Stage 3.

## 8. Deviations and decisions worth surfacing

1. **Monorepo lives at `frontend/`,** not repo root. `FRONTEND_ARCHITECTURE.md` sketched a `masar/` root, but the repo root already holds `backend/`, `components/`, `tokens/`, and `ui_kits/`. `frontend/` is symmetric with `backend/` and avoids collisions.
2. **pnpm is not installed on this machine and could not be installed.** `corepack enable` fails with `EPERM` (no write access to `C:\Program Files\nodejs`). Everything is therefore run via `npx pnpm@8.15.9 …`, which works correctly and produced a real pnpm workspace with a proper lockfile. On a developer machine with pnpm installed, the plain `pnpm …` scripts work unchanged.
3. **husky hooks use `core.hooksPath`.** The git root is the repository root while the workspace is in `frontend/`, so `husky install` cannot manage hooks from there. I created `frontend/.husky/pre-commit` and set `git config core.hooksPath frontend/.husky`. **This is the one change made outside `frontend/`** — a local git config setting, no tracked file altered.
4. **Workspace packages are consumed as TypeScript source**, not pre-built. Each app's Vite config aliases `@masar/*` to the package `src/`. This removes a per-package build step and keeps types exact; it is why `rootDir` was removed from the package tsconfigs (it forbids cross-package source imports and is meaningless under `noEmit`).
5. **`import.meta.env` is read through a local cast** in `api-client/src/env.ts` rather than a global `ImportMeta` augmentation. A global augmentation is only visible within its own tsconfig, so every consuming package failed to typecheck; the local cast keeps the package self-contained.
6. **Turbo `globalDependencies` had to include `.eslintrc.cjs`.** An ESLint config change was initially masked by a replayed cache — a real cache-correctness bug, now fixed by declaring the config files as global inputs.
7. **Rollup emits `Can't resolve original location of error` warnings** for `@tanstack/react-query` during build. These are cosmetic sourcemap-resolution warnings from that dependency's published sourcemaps; all six builds complete successfully. Sourcemaps were kept enabled because their debugging value outweighs the log noise.

## 9. Verification evidence

```
typecheck  → Tasks: 10 successful, 10 total        (0 errors)
lint       → Tasks: 10 successful, 10 total        (0 errors, 0 warnings)
format     → All matched files use Prettier code style
build      → Tasks:  6 successful,  6 total
tokens     → colors/fonts/spacing/typography .css  all byte-identical to /tokens
```

Each app emits `dist/index.html` + hashed JS/CSS assets. Initial bundle is ~385 KB raw / **~118 KB gzipped**, comfortably inside the architecture's <200 KB gzipped mobile budget before any route-level code splitting (which arrives with real routes).

## 10. Ready for Phase 2

The foundation supports the roadmap's next stages without rework:

- **Stage 2** — per-domain read builders and typed RPC wrappers drop into the existing `reads/`/`rpc/` directories; the query-key registry and error contract are already in place.
- **Stage 3** — auth screens attach to the existing `AuthProvider` and guards.
- **Stage 4** — Platform Admin is the first portal to receive real routes, per the risk-ascending order.

Two prerequisites remain outside this phase and are unchanged: the **seeded staging dataset** (blocks E2E and the 11 backend RLS suites) and the **backend storage subsystem** (blocks uploads).

---

**Frontend Phase 1 foundation is complete and compiles cleanly. No application screens, business logic, or backend feature integrations were implemented, per instruction. Stopping here.**
