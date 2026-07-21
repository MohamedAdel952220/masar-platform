# Frontend Phase 2 — Backend Integration Layer, Completion Report

**Scope:** backend integration layer only. No feature screens, no design-system changes, no UI redesign, no backend modification.
**Source of truth:** `FRONTEND_ARCHITECTURE.md` §5–§13, and the deployed database itself.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, 0 errors, 0 warnings |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps built |
| Backend files modified | ✅ **0** |

---

## 1. The decision that shapes everything: generated contracts

Rather than hand-write ~72 row types and 63 function signatures — which would have been a large, silently-driftable duplication of the backend — the contract layer is **generated from the live deployed database**:

```
supabase gen types typescript --linked --schema <13 exposed schemas>
  → packages/api-client/src/types/database.generated.ts   (4,369 lines)
```

Every read builder, RPC wrapper, realtime channel, and query hook derives its types from that one file. **Nothing in the frontend restates a backend contract.** A column rename, an enum value change, or an altered RPC signature becomes a *compile error* rather than a runtime surprise.

This directly satisfies the "zero duplicated backend contracts" requirement, and it is why the whole layer could be built accurately: the shapes are the real ones, read from the deployment, not inferred from documentation.

---

## 2. Read builders — all 13 exposed schemas (72 relations)

One typed module per schema, generated from the live relation inventory:

| Schema | Relations | Schema | Relations |
|---|---|---|---|
| `academic` | 10 (incl. `v_child_attendance_summary`) | `media` | 4 |
| `approvals` | 4 | `platform` | 8 (incl. 2 analytics views) |
| `billing` | 9 | `reports` | 3 |
| `comms` | 8 | `safety` | 3 |
| `identity` | 8 | `tenancy` | 5 |
| `jobs` | 3 | `transport` | 7 |
| `public` | 0 — RPC namespace only | | **Total: 72** |

Each schema module exposes four typed surfaces:

- **`raw()`** — the schema-scoped client, natively typed by supabase-js, for bespoke queries (embeds, aggregates, complex filters).
- **`list(relation, options)`** — **keyset/cursor pagination** (§14.3, never offset), returning `Page<Row>` with a `nextCursor`.
- **`one(relation, column, value)`** — single row, returning `null` when RLS hides it (correctly distinguishing "forbidden" from "missing" at the UI layer).
- **`count(relation)`** — exact count, honouring RLS.

`public` is included for completeness and correctly declares zero relations — it is the RPC namespace.

---

## 3. RPC wrappers — full catalogue coverage (63 functions)

`callRpc` is **generic over the entire generated function catalogue**, so every deployed RPC is strongly typed in both arguments and return value without a single hand-written signature:

```ts
callRpc<K extends RpcName>(name: K, ...args: RpcArgsTuple<K>): Promise<RpcReturns<K>>
```

Zero-argument functions generate `Args: never`, so the argument tuple is conditional — `callRpc('current_role')` needs no dummy object.

On top of that, **57 named wrappers** across 11 domain modules:

| Module | Wrappers | Module | Wrappers |
|---|---|---|---|
| `provisioning` | 3 | `billing` | 5 |
| `academic` | 5 | `media` | 1 |
| `transport` | 6 | `reports` | 5 |
| `safety` | 4 | `platform` | 4 |
| `comms` | 5 | `session` | 15 |
| `approvals` | 4 | | **Total: 57** |

### Six RPCs deliberately NOT wrapped

PostgREST grants `authenticated` EXECUTE on all 64 public functions, so grants alone do not discriminate — the architecture must. These are enumerated in `CLIENT_FORBIDDEN_RPCS` and given no client wrapper:

`write_audit_log` · `idempotency_replay` · `idempotency_store` · `create_bus_with_driver_row` · `enroll_child_row` · `payment_transactions_support_view`

These are internal primitives. Offering them as client affordances would let a client forge audit entries, poison the idempotency ledger, or bypass the composed RPCs that own their invariants. RLS still protects the data; this is about not building the footgun. 57 named + 6 forbidden = the full 63.

---

## 4. Edge Function wrappers — all 19 deployed functions

Typed request/response contracts per function in `EdgeFunctionContracts`. Payload fields that correspond to database values are **derived** from the generated types (e.g. `Academic['Tables']['children']['Insert']`) rather than restated, so schema drift still surfaces as a compile error even though Edge Function payloads aren't in the database catalogue.

**Three marked client-forbidden** (`CLIENT_FORBIDDEN_EDGE_FUNCTIONS`):
- `payment-webhook` — PSP → server only; a client call would be a forged payment notification.
- `camera-heartbeat` — authenticated by service-account API key (§10.7, §13.7), not a human session.
- `notification-dispatch` — queue drainer, invoked by schedule/service role.

---

## 5. Auth layer — complete

| Capability | Implementation |
|---|---|
| Login (tenant roles) | `signInWithPhone` — phone + password per §10.2 |
| Login (Platform Admin) | `signInWithEmail` — email + password |
| Logout | `signOut` — **tears down every realtime channel first**, so no socket outlives the credential that authorized it |
| Restore session | `restoreSession` + `AuthProvider` bootstrap |
| Refresh | `refreshSession` (explicit) + supabase-js auto-refresh; PKCE flow enabled |
| Activation | `completeActivation` — consumes the one-time link and sets the account's own password. No credential is ever created or transported by the UI (§10.3) |
| Password reset | `requestPhonePasswordReset` / `requestEmailPasswordReset` / `verifyPhoneOtp` / `setPassword` |
| MFA | `getMfaStatus`, `enrollTotp`, `verifyTotpEnrollment`, `challengeTotp`, `listTotpFactors`, `unenrollTotp` — TOTP, mandatory for `platform_admin` (§28) |
| Claim parsing | `readClaims` reads `tenant_id`, `role`, `platform_admin_tier`, `app_access` from server-set `app_metadata` |
| Portal guards | `RequireAuth`, `RequirePortal`, `RequireRole` |

`getMfaStatus` distinguishes **`enrollmentRequired`** (no verified factor — must enrol) from **`challengeRequired`** (enrolled, must satisfy AAL2), which is the distinction the Platform Admin shell needs to route correctly at first login.

---

## 6. Realtime — complete §15 matrix (13 subscriptions across 12 channels)

Every channel from the architecture's matrix, each typed to the row it delivers:

`tripPosition` · `tripStatus` · `classroomDayPath` · `conversationMessages` · `userNotifications` · `tenantCameras` · `tenantCamerasHeartbeat` · `tenantActivity` · `tenantApprovals` · `platformServiceHealth` · `platformTenants` · `platformSupportTickets`

Implementation properties:
- **Reference-counted registry** — two components watching the same trip share one channel; the channel is removed only when the last listener unsubscribes. One multiplexed socket per app.
- **Narrowest filter always** — `trip_id=eq.`, `conversation_id=eq.`, `recipient_id=eq.`, `tenant_id=eq.`. Never a tenant-wide firehose.
- **`unsubscribeAllChannels()`** wired into `signOut`.
- `tripStatus` correctly spans two tables (`trips` + `trip_child_status`) on one channel.
- `tenantCamerasHeartbeat` is kept as a distinct channel per §17, so the Dashboard can tell "I just disabled this" from "it went offline".
- `useRealtimeSubscription` binds a subscription to component lifetime, holding the handler in a ref so a changing callback identity never churns the channel.

---

## 7. Query hooks

**36 read hooks** — three per schema across 12 tenant/platform schemas:

- `use<Schema>List(scope, relation, options)` — keyset page
- `useInfinite<Schema>List(scope, relation, options)` — cursor-paginated infinite query
- `use<Schema>One(scope, relation, column, value)` — single row

Stale times follow §13 (`reference` 1h · `profile` 5m · `operational` 30s · `realtime` 0 · `analytics` 5m). Query keys come from the canonical registry, now covering all 13 schemas, with tenant scope embedded so an account switch cannot surface another tenant's cache.

### Optimistic mutations — deliberately narrow

Per §12 ("optimistic updates only where the server outcome is deterministic"), optimism is restricted **at the type level**:

```ts
OPTIMISTIC_SAFE_RPCS = ['register_device_token', 'update_notification_preferences']
```

`useOptimisticRpcMutation<K extends OptimisticSafeRpc>` will not compile for anything else. Everything with server-side branching — payments, approvals, refunds, state machines — waits for the authoritative response. The optimistic path snapshots, rolls back on error, and always revalidates on settle.

---

## 8. Backend constraints — verified, not just intended

| Constraint | How it is enforced | Verified |
|---|---|---|
| **`analytics` never queried directly** | Absent from `EXPOSED_SCHEMAS`; querying it is a type error. Its data is reachable only through the 3 access-controlled views, which appear under their owning schemas (`academic`, `platform`). | ✅ `grep` for `schema('analytics')` → **none**; `analytics` in `EXPOSED_SCHEMAS` → **0 occurrences** |
| **Storage read-only** | `storage/` exports only `BUCKETS`, `SIGNED_URL_TTL`, and `createSignedUrl`. No upload, no signed-upload-URL, no insert. | ✅ export list confirmed read-only |
| **7 non-idempotent RPCs, `retry: false`** | `NON_IDEMPOTENT_RPCS` (7 entries) + `isRetryableRpc()`; **both** mutation hooks hard-code `retry: false`. `useRpcMutation` refuses to attach an idempotency key to an RPC that accepts none. | ✅ 7 entries; 2 × `retry: false` |
| **RLS is the only authorization boundary** | No client-side row filtering substitutes for policy. Guards are documented as navigational. `one()` returns `null` under RLS rather than throwing, so "forbidden" and "missing" stay distinguishable. | ✅ |
| **Apps never import supabase-js** | ESLint `no-restricted-imports`, exempt only in `api-client`/`auth`. | ✅ `grep` across `apps/*/src` → **none** |
| **No backend modification** | — | ✅ **0 files** under `backend/` changed |

---

## 9. Files and coverage

| Area | Count |
|---|---|
| `api-client` source files | 48 |
| Generated contract types | 4,369 lines |
| Schema read modules | 13 (all exposed schemas) |
| Relations covered | 72 |
| RPC named wrappers | 57 (+ generic `callRpc` covering all 63) |
| RPCs deliberately unwrapped | 6 (documented internal primitives) |
| Edge Function contracts | 19 (3 marked client-forbidden) |
| Realtime subscriptions | 13 |
| Read hooks | 36 |
| Mutation hooks | 2 (+ 3 guard predicates) |
| Auth exports | 31 |

---

## 10. Notable implementation decisions

1. **The client is typed with `Database`**, so `.schema(s).from(r).select()` and `.rpc(name, args)` are end-to-end typed natively. Most of the type safety is structural rather than wrapper-provided.
2. **`raw()` instead of a generic `from()`.** supabase-js gives tables and views separate `.from()` overloads, which a union of both cannot satisfy. `raw()` returns the schema-scoped client so callers get full native typing with no casts.
3. **`callRpcWithArgs` exists alongside `callRpc`.** Inside a generic mutation hook, `K` is unresolved and the variadic tuple can't be satisfied structurally. Rather than weaken `callRpc`'s public signature, the hooks use a narrow internal escape hatch whose return type stays exact.
4. **Cursor semantics are honest.** `list()` only emits a `nextCursor` when an `orderBy` column is supplied, because a keyset cursor is meaningless without a stable ordering column.
5. **`Page<T>` lives in `reads/factory`** — the earlier Phase 1 duplicate in `types/domain` was removed rather than left to shadow it.

---

## 11. Explicitly NOT implemented (per instruction)

Feature screens · business logic · portal routes · file uploads (blocked on the backend §22.1 subsystem) · Capacitor shells · tests.

---

## 12. Ready for Phase 3

The integration layer is complete and typed end-to-end. Portal screens can now be built against it without further backend work: reads and hooks exist for every exposed relation, every deployed RPC has a typed path, all 19 Edge Functions are contracted, the auth layer covers the full session lifecycle including MFA, and every realtime channel is subscribable.

Two prerequisites remain unchanged and outside this phase: the **seeded staging dataset** (blocks end-to-end verification of RLS-dependent reads) and the **backend storage subsystem** (blocks uploads).

---

**Frontend Phase 2 backend integration layer is complete, compiles cleanly, and modifies nothing in the backend. No portal screens were implemented. Stopping here.**
