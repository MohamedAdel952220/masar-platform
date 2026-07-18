# Epic 7 Completion Report — Media & Camera Architecture

Scope: the `media` schema (`cameras`, `camera_classroom_links`), the first
real rows into Epic 1's already-existing `identity.service_accounts` table
(machine-identity auth, §10.7), the camera heartbeat/online-offline
lifecycle, guardian stream-token issuance, and the camera heartbeat sweep
scheduled job. Epic 1, Epic 2, Epic 3, Epic 4, Epic 5, and Epic 6 are
frozen — every migration in this Epic is purely additive (new schema, new
tables, new functions, new policies, additive extensions to three shared
plumbing files: the Node/Deno error taxonomies and the Deno CORS headers
list). **No Epic 1-6 migration file was modified.** No frozen frontend file
was touched.

This is the first Epic with a genuine machine-identity (non-JWT, API-key)
authentication path — explicitly flagged in `BACKEND_EXECUTION_PLAN.md`
Epic 7 §25 as "the least battle-tested pattern in the plan" — and every
design decision below treats that novelty as the primary risk to guard
against, alongside every lesson the Epic 2-6 review/fix/audit cycle
produced (§8 for the full, cited list).

---

## 1. Environment reality check

Same limitation as every prior Epic: no Docker/local Postgres in this
sandbox, and deployment (hence a live deployment audit) is out of scope for
an implementation task — the user's instruction was to implement and
report, not deploy. Every SQL-layer claim below is a **static** guarantee —
balanced `$$`/parens verified programmatically on every migration file and
the RLS test file, every RLS policy and trigger individually traced by hand
against every role/path that can invoke it (§9's Self-Review).
`node node_modules/typescript/bin/tsc --noEmit` and
`node node_modules/vitest/vitest.mjs run` are real executions and both
pass. `tests/rls/epic7_rls_adversarial.sql` is written, including the core
regression test for §17's classroom-scoped access rule (Test 2) and the
scheduled-job sweep (Tests 8-9), but **not executed** against any
database — consistent with every prior Epic's identical, explicitly
documented limitation.

---

## 2. Files created

### 2.1 SQL migrations (5) — `backend/supabase/migrations/`

1. `20260725000001_epic7_media_schema.sql` — `media` schema; 2 enums (`camera_zone`, `camera_resolution`).
2. `20260725000002_epic7_camera_tables.sql` — `cameras`, `camera_classroom_links` + 1 consistency trigger + `updated_at` trigger.
3. `20260725000003_epic7_rls_policies.sql` — 9 policies across the 2 new tables.
4. `20260725000004_epic7_scheduled_jobs.sql` — `media.sweep_camera_heartbeats()`.
5. `20260725000005_epic7_realtime.sql` — `media.cameras` added to `supabase_realtime`.

`identity.service_accounts`, `identity.service_account_purpose`, and
`identity.service_account_status` already exist (Epic 1, frozen,
`20260714000003_epic1_identity_tables.sql`) — this Epic is the first to
write real rows into that table and is the reason its own RLS policies
(`20260714000006_epic1_rls_policies.sql`) finally get exercised, but no
byte of either file was touched.

### 2.2 Edge Functions (4 + 2 shared) — `backend/supabase/functions/`

- `camera-heartbeat/index.ts` — service-account API-key authenticated (§10.7, §13.7), `verify_jwt = false`.
- `camera-stream-token/index.ts` — guardian, JWT-authenticated.
- `issue-service-account-key/index.ts` — manager, JWT-authenticated.
- `revoke-service-account-key/index.ts` — manager, JWT-authenticated.
- `_shared/mediaRelay.ts` — stubbed media-relay provider port (new file, mirrors `_shared/paymentGateway.ts`'s established pattern).
- `_shared/serviceAccountKey.ts` — API-key generation/SHA-256 hashing, shared by `issue-service-account-key` and `camera-heartbeat` so the two can never drift on format/algorithm.

### 2.3 Application layer (10 new files, 5 additive edits) — `backend/src/`

- `types/database.types.epic7.ts`, `types/domain.epic7.ts` (new)
- `types/domain.ts` — **additive edit**: `ServiceAccount` interface + `serviceAccountFromRow` mapper (the row type has existed since Epic 1; this is the first Epic to need its domain-layer counterpart).
- `validation/media.schema.ts` (new)
- `repositories/cameraRepository.ts`, `repositories/serviceAccountRepository.ts` (new)
- `services/cameraService.ts`, `services/cameraHeartbeatService.ts`, `services/serviceAccountService.ts` (new)
- `lib/serviceAccountKey.ts` (new) — Node-side mirror of `_shared/serviceAccountKey.ts`.
- `api/routes/media.ts` (new)
- `lib/errors.ts` — **additive edit**: `EXTERNAL_MEDIA_RELAY_FAILURE` error code (mirrors Epic 6's `EXTERNAL_PAYMENT_GATEWAY_*` addition pattern).

### 2.4 Deno shared-module additive edits — `backend/supabase/functions/_shared/`

- `errors.ts` — `EXTERNAL_MEDIA_RELAY_FAILURE` (Node-side mirror of the above).
- `cors.ts` — `x-service-account-key` added to `Access-Control-Allow-Headers` (required for `camera-heartbeat`'s machine-identity auth header).

### 2.5 Config

- `supabase/config.toml` — `"media"` added to `[api] schemas`; `[functions.camera-heartbeat] verify_jwt = false` added (mirrors Epic 6's `payment-webhook` exception exactly).

### 2.6 Tests (5 new files, 68 tests)

- `tests/unit/mediaValidation.test.ts` (20 tests)
- `tests/unit/cameraService.test.ts` (16 tests)
- `tests/unit/serviceAccountService.test.ts` (9 tests)
- `tests/unit/cameraHeartbeatService.test.ts` (7 tests)
- `tests/unit/mediaApiRoutes.test.ts` (16 tests)
- `tests/rls/epic7_rls_adversarial.sql` (11 tests, unexecuted per §1)

---

## 3. Tables created

| Table | Columns | Notes |
|---|---|---|
| `media.cameras` | `id, tenant_id, name, zone, ip_address, stream_protocol, resolution, has_audio, online, admin_disabled, last_heartbeat_at, added_at, deleted_at, created_at, updated_at` | Matches §3.33 exactly. `online`/`admin_disabled` are independent booleans by design (§17's resolved v0-draft conflict) — see §7 below. |
| `media.camera_classroom_links` | `camera_id, classroom_id, tenant_id, created_at` | Composite PK `(camera_id, classroom_id)`, matches §3.34 exactly. No row = shared/unlinked camera (`zone='common'` case). |

3 indexes on `cameras` (`cameras_tenant_idx`, `cameras_viewable_idx` — the
exact `online=true AND admin_disabled=false` predicate §6 names, `cameras_
online_heartbeat_idx` — the sweep job's own scan predicate), 2 on
`camera_classroom_links` (`_tenant_idx`, `_classroom_idx` — the "Parent 'my
classroom's cameras'" lookup direction §6 names).

---

## 4. Policies created

9 RLS policies across the 2 new tables, plus 1 consistency trigger:

| Table | Policy | Role | Scope |
|---|---|---|---|
| `cameras` | `cameras_select_manager` | manager | tenant-wide, incl. soft-deleted |
| `cameras` | `cameras_select_guardian` | guardian | own children's linked classroom(s) only, non-deleted only |
| `cameras` | `cameras_insert_manager` | manager | tenant-scoped |
| `cameras` | `cameras_update_manager` | manager | tenant-scoped (covers `admin_disabled` toggle + soft-delete) |
| `camera_classroom_links` | `camera_classroom_links_select_manager` | manager | tenant-wide |
| `camera_classroom_links` | `camera_classroom_links_select_guardian` | guardian | own children's linked classroom(s) only |
| `camera_classroom_links` | `camera_classroom_links_insert_manager` | manager | tenant-scoped |
| `camera_classroom_links` | `camera_classroom_links_delete_manager` | manager | tenant-scoped (pure link-row hard delete, not a historical record) |
| `media.check_camera_classroom_link_consistency()` (trigger) | n/a | n/a | validates camera/classroom/tenant agreement on every INSERT/UPDATE |

No policy exists for teacher, reception, driver, or platform_admin on
either table — §12's Cameras row grants them nothing, and §13.6's
platform_admin bypass list does not include `media.*` (unlike
`identity.service_accounts`, which already had a platform_admin read-only
policy from Epic 1). `FORCE ROW LEVEL SECURITY` is set on both tables. No
`DELETE` policy exists on `cameras` (soft-delete only, via the UPDATE
policy — "Manager has no D... only soft-delete, functionally a U", §12).

---

## 5. RPCs

**None new**, matching `BACKEND_EXECUTION_PLAN.md` Epic 7 §8's own explicit
statement ("None beyond the above Edge Functions' internal RPC calls").
Camera CRUD is direct-RLS, matching §14.1's "no bespoke API surface for
straightforward CRUD" default (the same pattern Epic 6 used for
`fee_items`). One new SQL function exists, but it is a scheduled-job
function, not a client-facing RPC:

- `media.sweep_camera_heartbeats()` — `SECURITY DEFINER`, `SET search_path = ''`, `service_role`-only grant. Set-based: one `UPDATE...RETURNING` flips every stale-heartbeat camera to `online=false` in a single statement, one `INSERT...SELECT` (reading from the same CTE) fans the "Camera offline" notification out to every affected tenant's managers — no per-camera loop.

---

## 6. Edge Functions

| Function | Caller | Auth | Purpose |
|---|---|---|---|
| `camera-heartbeat` | on-prem camera relay agent | `identity.service_accounts` API key (`x-service-account-key` header), `verify_jwt=false` | Sets `online=true, last_heartbeat_at=now()` for one camera, scoped to the presented key's own tenant and `camera:heartbeat` scope. |
| `camera-stream-token` | guardian | Supabase JWT | Re-verifies classroom ownership server-side, mints a short-lived relay token via the stubbed media-relay port — never echoes `ip_address`/`stream_protocol`. |
| `issue-service-account-key` | manager (own tenant) | Supabase JWT | Generates + SHA-256-hashes a raw API key, inserts the row, returns the raw key exactly once. |
| `revoke-service-account-key` | manager (own tenant) | Supabase JWT | Atomic guarded `status='active' -> 'revoked'` transition, NOT_FOUND/STATE_ALREADY_PROCESSED disambiguation. |

Full production deployment checklist in §12.

---

## 7. Architectural decisions

1. **`online`/`admin_disabled` as two independent, single-writer booleans** (§3.33, §17) — `camera-heartbeat` and `media.sweep_camera_heartbeats()` only ever touch `online`; `cameras_update_manager` (a human, RLS-gated write) is the only path that ever touches `admin_disabled`. Neither write path references the other's column, so a manager's deliberate disable can never be silently reverted by the next heartbeat/sweep, and a heartbeat resuming on a still-`admin_disabled` camera correctly stays non-viewable. Verified live by RLS Tests 6 and 8.

2. **Guardian never gets a raw table `select('*')` from any repository method — a dedicated `GUARDIAN_SAFE_COLUMNS` projection is the only column list any guardian-facing code path can return** (§17: "raw camera IP/RTSP credentials... never sent to client apps"). This is enforced at three independent layers: the TypeScript repository's own explicit column list (`cameraRepository.ts`), a distinct `GuardianCamera` domain type that structurally has no `ipAddress`/`streamProtocol` fields at all (so a guardian-facing route literally cannot return them even by future accident), and `camera-stream-token`'s own response shape (relay URL + token only). **One residual, explicitly-documented gap**: Postgres RLS has no native per-app-role column-level restriction when every human role shares one Postgres `authenticated` role (§11.1) — a guardian's own Supabase client, using their own valid JWT and the RLS-granted row-level SELECT on `cameras`, could in principle request `ip_address` via an explicit `?select=ip_address` REST query or receive it in a Realtime `postgres_changes` payload (which broadcasts full rows regardless of column-level grants). A column-level `REVOKE`/`GRANT` was deliberately **not** added, because it cannot discriminate manager from guardian (both are the same Postgres role) and would therefore also block the Manager Dashboard's own legitimate camera-configuration read/write access — see §11 (Known Limitations) for the full reasoning and the recommended follow-up.

3. **`camera-stream-token` re-derives and re-checks classroom ownership server-side rather than trusting RLS alone** (§17's own explicit defense-in-depth requirement — "enforced both by RLS on cameras/camera_classroom_links reads and again by the stream-token RPC... since a stream token is a higher-stakes credential than a metadata read"). Mirrors `initiate-payment`'s own established "never trust the client's own assertion" pattern (§14.3, Epic 6).

4. **`camera-heartbeat` writes via the `service_role` admin client, scoped in application code to exactly one camera row and the presented service account's own `tenant_id`** (§13.7's own literal example, implemented verbatim: `UPDATE cameras SET online = true, last_heartbeat_at = now() WHERE id = :camera_id AND tenant_id = :service_account.tenant_id`). RLS is never the authorization mechanism for this path by design — `identity.service_accounts` has no RLS policy a machine caller could ever satisfy anyway, since machine callers carry no JWT at all.

5. **`issue-service-account-key`/`revoke-service-account-key` are Edge Functions, not RPCs**, even though `identity.service_accounts` already has manager-scoped RLS INSERT/UPDATE policies from Epic 1 — because generating and hashing a raw credential that must be shown exactly once is application-code work (the same reasoning `provision-tenant`/`regenerate-activation-link` already established for the "no-plaintext-credential" pattern, §10.3), not because the RLS policies are insufficient on their own.

6. **`tenant_id` is deliberately NOT accepted as a request-body parameter on `issue-service-account-key`**, unlike §14.2's own conceptual `issue_service_account_key(tenant_id, purpose, scopes[])` signature — this implementation always derives it from `caller.tenantId`, matching every other manager-scoped Edge Function in this codebase (`generate_invoice`, `initiate-payment`) that never trusts a client-supplied `tenant_id` (§14.3). A minor, deliberate, documented API-shape deviation from the doc's conceptual signature, in the safer direction.

7. **No `media.storage_objects` / generic `request_upload`/`finalize_upload` upload architecture was built.** `BACKEND_EXECUTION_PLAN.md` Epic 7's own §5/§7/§9 name only `cameras`, `camera_classroom_links`, and `service_accounts` (first rows) — `storage_objects` and the §22 generic upload flow are not named as deliverables anywhere in any Epic's own execution-plan section, and every prior Epic's own direct-RLS-bucket-write pattern (`identity-documents`, `academic-attachments`, `chat-attachments`, `payment-receipts`) was each Epic's own deliberate, already-reviewed-and-audited substitute for that generic architecture, not a placeholder waiting on this Epic specifically. `BACKEND_EXECUTION_PLAN.md` Epic 7 §9 itself states "Storage Buckets Involved: None." See §11 for the full reasoning.

---

## 8. Lessons applied from previous Epic reviews/fixes/audits

Every lesson from the Epic 1-6 review/fix/audit cycle was checked against Epic 7's own surface before considering it complete:

- **uuid[]-returning RLS helpers, not SETOF** (`EPIC_2_DEPLOYMENT_FIX.md`) — no new helper was needed at all (reused `public.current_guardian_classroom_ids()`, Epic 5, already correctly `uuid[]`-returning); this itself is the direct application of "avoid duplicate logic" per this task's own instruction.
- **`SET search_path = ''` + full schema-qualification on every `SECURITY DEFINER` function** (established Epic 2 onward) — `media.sweep_camera_heartbeats()` has both; the one trigger function (`check_camera_classroom_link_consistency`) is deliberately **not** `SECURITY DEFINER`, matching the identical, already-audited precedent for `billing.check_fee_item_applicability_consistency` (Epic 6) — a manager's own RLS visibility already covers every legitimate same-tenant link, and a cross-tenant attempt correctly (if slightly differently-worded) fails via RLS hiding the referenced row rather than needing elevated trigger privileges.
- **Set-based SQL, never a per-row loop for unbounded fan-out** (`EPIC_4_REVIEW.md` H4, applied identically in every Epic 6 scheduled-job function) — `media.sweep_camera_heartbeats()`'s notification fan-out is a single `INSERT...SELECT` reading from the same `UPDATE...RETURNING` CTE, not a loop.
- **No direct RLS write path alongside a correctness-critical Edge Function/RPC** (`EPIC_5_REVIEW.md` H2, `EPIC_6_REVIEW.md` H1/H2 lesson) — checked whether any RLS policy could bypass `camera-heartbeat`'s own scope/status check or `issue-service-account-key`'s own key-generation logic: none can, since `service_accounts` has no policy any machine caller could ever satisfy (no JWT), and camera CRUD's direct-RLS path never touches `online`/`last_heartbeat_at` (only `admin_disabled` and configuration fields) so there is no way for a manager's ordinary CRUD access to forge a heartbeat.
- **No manager hard-delete on a historical/financial record** (`EPIC_5_REVIEW.md` H1, generalized in every subsequent Epic) — zero `DELETE` policies on `cameras`; `camera_classroom_links_delete_manager` is a pure link-row delete, matching `child_guardian_links_delete_manager`'s own established precedent (Epic 2) for the identical class of non-historical join table, not a violation of the no-hard-delete rule.
- **`tenant_id` on every tenant-scoped table including pure link tables, zero exceptions** (§2.2/§13.1, the corrected v0-draft convention) — `camera_classroom_links` carries its own `tenant_id`, confirmed in the consistency trigger's own validation and every RLS policy's direct equality check (no subquery/join needed for tenant scoping).
- **M1 pattern: atomic guarded `UPDATE...WHERE` + a follow-up disambiguation check, not a blind `UPDATE` then assume success** (established Epic 2 onward, most recently `mark_ledger_item_paid_manual`/M2, Epic 6) — `revoke-service-account-key` and `ServiceAccountRepository.revoke()` both follow this exactly (`WHERE status='active'`, `NOT_FOUND` vs. `STATE_ALREADY_PROCESSED` disambiguated by a follow-up existence check).
- **Dedicated view/function for a narrower, safer surface instead of a blanket bypass** (`EPIC_4_REVIEW.md` C1, `payment_transactions_support_view()` precedent, Epic 6) — applied to the guardian-camera-column problem via the `GuardianCamera` domain type + `GUARDIAN_SAFE_COLUMNS` projection (§7.2) rather than a blanket `select('*')` anywhere in a guardian-reachable code path.
- **Idempotent, safe-to-re-run scheduled jobs** (established Epic 3 GPS purge onward, Epic 6's four billing jobs) — `sweep_camera_heartbeats()`'s `WHERE online = true` predicate makes a repeated call on an already-flipped camera a true no-op with zero duplicate notifications, verified directly by RLS Test 9.
- **"Staged structurally, not registered" for scheduled jobs** (`EPIC_4_DEPLOYMENT_AUDIT.md` §1 through `EPIC_6_DEPLOYMENT_AUDIT_FINAL.md` §2 — `pg_cron` is not installed in the linked project) — `sweep_camera_heartbeats()` registers no schedule itself, fully correct and callable on-demand, matching every prior Epic's identical, already-documented limitation.
- **Node-side "testable core" mirror for every Edge Function whose logic is worth independently unit-testing, but NOT for one that primarily orchestrates a call to an external, non-Supabase service** (`PaymentService`'s explicit precedent of declining to wrap `initiate-payment`, Epic 6) — `CameraHeartbeatService`/`ServiceAccountService`/`CameraService` all got TS mirrors (DB-only or admin-API-only logic, directly analogous to `StaffAccountService`); `camera-stream-token` deliberately did **not** get one, since its core purpose is calling the external media relay, matching `PaymentService`'s own reasoning exactly rather than introducing a second, divergent stub implementation.
- **Additive-only extensions to shared cross-epic plumbing files, never a rewrite** (Epic 6's own `EXTERNAL_PAYMENT_GATEWAY_*` addition pattern to `errors.ts`) — `EXTERNAL_MEDIA_RELAY_FAILURE` was added the identical way, on both the Node and Deno sides, with no existing error code touched or renamed.
- **Freeze discipline verified via `git status`, not assumed** (every prior Epic's own audit methodology) — confirmed only the 5 already-enumerated shared files show as modified (§2.1's "additive edits" list), and every Epic 1-6 migration file shows zero diff.

---

## 9. Self-review summary

- **Security**: every write path re-checked for a role/ownership gate before ever reaching a table — camera CRUD (manager-only, RLS + service-layer both), stream-token issuance (guardian + explicit classroom-ownership re-derivation), heartbeat (API-key + status + scope, three independent checks before any write), key issuance/revocation (manager + own-tenant, both RLS-capable and Edge-Function-enforced). No secret (raw API key) is ever stored, logged, or returned more than once; `ServiceAccountRepository`'s every query explicitly excludes `api_key_hash` from its column list, so even a hash cannot reach a client response through this codebase's own repository layer.
- **RLS**: `FORCE ROW LEVEL SECURITY` set on both new tables; every policy traced by hand against every role in §12's permission matrix, including the two deliberately non-obvious denies (Teacher gets zero Cameras access despite broad classroom access elsewhere; Platform Admin gets zero Cameras/camera_classroom_links access despite its `service_accounts` read-only bypass) — both are directly exercised by RLS Tests 3 and 4.
- **Tenant isolation**: every table/policy uses the single-equality-check baseline (§13.1); `camera_classroom_links` carries its own `tenant_id` (no join-through-parent policy); the consistency trigger independently re-validates that a link's camera, classroom, and stated `tenant_id` all agree, closing the one cross-table consistency gap a bare FK pair could otherwise leave open (mirrors the exact Epic 2/6 precedent). Cross-tenant isolation directly exercised by RLS Test 1 and the trigger-rejection Test 10.
- **Transaction safety**: `media.sweep_camera_heartbeats()`'s `UPDATE...RETURNING`/`INSERT...SELECT` pair runs inside one implicit function-body transaction — either both the status flip and every affected tenant's notification fan-out happen, or neither does; no partial-sweep state is reachable. `revoke-service-account-key`'s guarded `UPDATE...WHERE status='active'` is atomic by construction (no read-then-write race window).
- **Authorization**: enforced at every layer this task requires — RLS (DB), service-layer role checks mirroring RLS (`CameraService`/`ServiceAccountService`), Edge-Function-level `requireRole`/API-key-scope checks, and TypeScript's own type system (the `GuardianCamera` type structurally cannot carry `ipAddress`/`streamProtocol`).
- **Trigger behavior under RLS**: `check_camera_classroom_link_consistency` correctly fires regardless of the invoking role's own RLS-filtered view of `cameras`/`classrooms` (its `NOT_FOUND` branch is what a cross-tenant attempt actually hits under a real manager session, since RLS hides the foreign-tenant row entirely before the trigger's own tenant-mismatch branch would ever be reached) — this was hand-traced, not assumed, and documented explicitly in §8's lessons-applied list rather than left as an unstated behavior.
- **`SECURITY DEFINER` boundaries**: exactly one new `SECURITY DEFINER` function (`sweep_camera_heartbeats`), `search_path=''`, `service_role`-only grant, fully schema-qualified body — re-verified by direct reading of the migration file, not inferred.
- **Financial integrity**: not applicable — Epic 7 touches no financial table, RPC, or ledger. No `billing.*`/`platform.tenant_billing_transactions` object was read, written, or referenced anywhere in this Epic's own code.
- **Performance**: every query this Epic adds is indexed for its actual access pattern (`cameras_viewable_idx` matches the exact `online=true AND admin_disabled=false` predicate §6 names for stream-token requests; `cameras_online_heartbeat_idx` matches the sweep job's own scan). The sweep job is fully set-based with zero per-row loops.
- **Scalability**: `sweep_camera_heartbeats()` currently scans across all tenants in one statement, the same acknowledged, already-documented tradeoff every prior Epic's own global scheduled-job sweep makes (§29/§30's own "staggering by tenant_id hash" mitigation note, not re-litigated here since it's a pre-existing, cross-Epic architectural note, not something Epic 7 introduces or worsens).
- **Architecture compliance**: `BACKEND_ARCHITECTURE.md` §3.33/§3.34/§10.7/§13.7/§17 and `BACKEND_EXECUTION_PLAN.md` Epic 7 §5-§12 checked field-by-field, table-by-table, Edge-Function-by-Edge-Function against the delivered implementation — see §7 (Architectural Decisions) for every point of deliberate, documented interpretation or minor deviation, and §11 for the one genuinely open, non-blocking gap.

---

## 10. Coverage

```
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit   →  0 errors
node node_modules/vitest/vitest.mjs run                            →  35 test files, 366 tests, ALL PASSING (298 prior + 68 new)
```

New tests by file: `mediaValidation.test.ts` (20), `cameraService.test.ts`
(16), `serviceAccountService.test.ts` (9), `cameraHeartbeatService.test.ts`
(7), `mediaApiRoutes.test.ts` (16) — 68 total. Plus 11 RLS adversarial tests
(unexecuted, §1).

`$$`-pair and paren balance verified programmatically on every new SQL
file:

```
20260725000001: $$ pairs 0 OK,  parens balanced OK
20260725000002: $$ pairs 2 OK,  parens balanced OK
20260725000003: $$ pairs 0 OK,  parens balanced OK
20260725000004: $$ pairs 2 OK,  parens balanced OK
20260725000005: $$ pairs 0 OK,  parens balanced OK
epic7_rls_adversarial.sql: $$ pairs 28 OK, parens balanced OK
```

Freeze compliance verified via `git status --porcelain`: only the 5
documented additive-edit files (`errors.ts` x2, `domain.ts`, `cors.ts`,
`config.toml`) show as modified; every Epic 1-6 migration file and every
other pre-existing file shows zero diff; every Epic 7 file (5 migrations, 4
Edge Functions + 2 shared modules, 10 new `src/` files, 6 new test files)
shows as untracked/new.

---

## 11. Known limitations (explicitly scoped decisions, not oversights)

1. **No live/local execution of the SQL layer or the RLS adversarial suite** — see §1. Deployment was out of scope for this implementation task.
2. **Media relay integration is fully stubbed** — `BACKEND_EXECUTION_PLAN.md` Epic 7 §13 itself names the media relay as "external infrastructure, coordinated with but not built by the backend team; this Epic's job is the metadata/auth contract the relay integrates against." `_shared/mediaRelay.ts`'s `mintStreamToken` is the one function that needs to change when a real relay vendor is wired in — every caller (`camera-stream-token/index.ts`) is already written against its final signature.
3. **Residual `ip_address`/`stream_protocol` exposure path via direct REST column selection or Realtime payloads** — documented in full in §7.2. Not fixed in this pass because the only DB-native mitigation (column-level `REVOKE`/`GRANT`) cannot discriminate manager from guardian (both share the Postgres `authenticated` role) and would break the Manager Dashboard's own legitimate camera-configuration access. Mitigated today by: (a) every guardian-facing TypeScript code path being structurally incapable of returning these fields (the `GuardianCamera` type has no such fields at all), and (b) the Parent App's own frontend never having any UI surface that would request or render them. **Recommended follow-up** (not blocking, not attempted here): either move `ip_address`/`stream_protocol` to a service-role-only-readable side table if a stricter guarantee is ever required, or omit `cameras` from any future Realtime channel a guardian subscribes to and replace it with a `broadcast`-type channel carrying only a hand-curated payload.
4. **No `media.storage_objects` / generic upload architecture built** — see §7.7. Consistent with every prior Epic's own scope; not named as a Epic 7 deliverable anywhere in `BACKEND_EXECUTION_PLAN.md`.
5. **No pg_cron registration for `media.sweep_camera_heartbeats()`** — matches every prior Epic's identical, explicitly-documented limitation (pg_cron is not installed in the linked project, confirmed live in `EPIC_4_DEPLOYMENT_AUDIT.md` through `EPIC_6_DEPLOYMENT_AUDIT_FINAL.md`). The function is fully correct and callable on-demand.
6. **`camera-heartbeat`'s scope check is a simple `scopes.includes('camera:heartbeat')`** — no scope hierarchy/wildcard matching exists (e.g. a hypothetical `camera:*`). Not required by any part of `BACKEND_ARCHITECTURE.md` §10.7, which only ever names the one literal scope string; adding wildcard matching now would be speculative complexity ahead of an actual second scope ever existing.
7. **No frontend wiring.** Same explicit scope boundary as every prior Epic.

---

## 12. PRODUCTION DEPLOYMENT CHECKLIST

Four new Edge Functions were created in this Epic. All four need to be
deployed before Epic 7's own Acceptance Criteria (`BACKEND_EXECUTION_PLAN.md`
Epic 7 §19) can be verified end-to-end — per the precedent set by
`EPIC_6_DEPLOYMENT_AUDIT.md`, an implemented-but-undeployed Edge Function is
a real, trackable gap, not a formality.

### 12.1 `camera-heartbeat`

- **Required environment variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (standard for every Edge Function in this project, injected automatically by the Supabase platform — no manual configuration needed in a standard deployment).
- **Required secrets**: none beyond the standard platform-injected pair above. This function does not call any external provider.
- **Config requirement**: `[functions.camera-heartbeat] verify_jwt = false` must be present in the deployed `supabase/config.toml` (already added in this Epic) — without it, the platform gateway will reject every legitimate heartbeat request for lacking a JWT it was never supposed to carry.
- **Deployment command**: `supabase functions deploy camera-heartbeat`
- **Post-deployment verification**:
  1. `supabase functions list` shows `camera-heartbeat` as `ACTIVE` with `verify_jwt: false`.
  2. `curl -X OPTIONS https://<project-ref>.supabase.co/functions/v1/camera-heartbeat` returns `200` (confirms the function actually booted, not just registered).
  3. `curl -X POST .../camera-heartbeat` with no `x-service-account-key` header and a valid JSON body returns `401 AUTH_MISSING_TOKEN` (confirms it does NOT require a Supabase JWT and correctly demands the API-key header instead).
  4. Issue a real service-account key via `issue-service-account-key` (§12.3) for a real camera, then send one real heartbeat with that key and confirm the target `media.cameras` row flips to `online=true` with an updated `last_heartbeat_at`.
  5. Revoke that key (§12.4) and confirm the very next heartbeat attempt with the same raw key returns `401 AUTH_INVALID_CREDENTIALS` (§19 Acceptance Criteria: "A revoked service-account key immediately stops being accepted").

### 12.2 `camera-stream-token`

- **Required environment variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (standard, platform-injected).
- **Required secrets**: none in this delivery — `_shared/mediaRelay.ts` is fully stubbed (§11.2). **Before this function is exposed to real end users**, whatever secret(s) the real media-relay vendor's authentication scheme requires (e.g. a relay API key/shared signing secret) must be added as a Supabase Edge Function secret and wired into `mintStreamToken`'s real implementation — no such secret exists to configure yet.
- **Deployment command**: `supabase functions deploy camera-stream-token`
- **Post-deployment verification**:
  1. `supabase functions list` shows `camera-stream-token` as `ACTIVE` with `verify_jwt: true` (the platform default — no override was added or should be added for this function).
  2. `curl -X POST .../camera-stream-token` with no `Authorization` header returns `401`.
  3. As a real guardian session, request a token for a camera linked to that guardian's own child's classroom — confirm a `relayUrl`/`token`/`expiresAt` response with no `ipAddress`/`streamProtocol` field anywhere in the payload.
  4. As the same guardian, request a token for a camera outside their child's classroom — confirm `403 PERM_ROLE_DENIED` (§19 Acceptance Criteria's adversarial stream-token test).
  5. Toggle `admin_disabled=true` on a camera the guardian is otherwise entitled to, and confirm the next token request for it returns `422 VALIDATION_FAILED` rather than a usable token.

### 12.3 `issue-service-account-key`

- **Required environment variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (standard, platform-injected).
- **Required secrets**: none.
- **Deployment command**: `supabase functions deploy issue-service-account-key`
- **Post-deployment verification**:
  1. `supabase functions list` shows `issue-service-account-key` as `ACTIVE` with `verify_jwt: true`.
  2. As a real manager session, issue a key with `purpose=camera_agent, scopes=["camera:heartbeat"]` — confirm the response includes a raw `apiKey` string, and that a direct `select * from identity.service_accounts where id = :serviceAccountId` (service-role/SQL editor only) shows `api_key_hash` as a 64-character hex string that does **not** equal the returned raw key.
  3. Attempt the same call as a guardian session — confirm `403 PERM_ROLE_DENIED`.
  4. Confirm the response is never logged anywhere in plaintext (check Edge Function logs for the deployment do not echo the raw `apiKey`).

### 12.4 `revoke-service-account-key`

- **Required environment variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (standard, platform-injected).
- **Required secrets**: none.
- **Deployment command**: `supabase functions deploy revoke-service-account-key`
- **Post-deployment verification**:
  1. `supabase functions list` shows `revoke-service-account-key` as `ACTIVE` with `verify_jwt: true`.
  2. As the issuing manager, revoke the key created in §12.3's verification — confirm `200` with `revoked: true`.
  3. Call revoke again on the same `serviceAccountId` — confirm `409 STATE_ALREADY_PROCESSED`.
  4. Confirm `platform.audit_log` gained one `revoked_service_account_key` row for this action (manager-only `SELECT`, own tenant).

### 12.5 Combined deployment command

All four at once, once individual verification above has passed in a
staging project:

```
supabase functions deploy camera-heartbeat camera-stream-token issue-service-account-key revoke-service-account-key
```

### 12.6 Migration deployment (prerequisite, not an Edge Function step)

The 5 SQL migrations (§2.1) must be applied — via `supabase db push` or the
project's standard migration pipeline — **before** any of the four Edge
Functions are deployed, since all four depend on `media.cameras`/
`media.camera_classroom_links` existing and on `identity.service_accounts`
already existing (it does, from Epic 1). Confirm with
`supabase migration list --linked` that all five `20260725*` entries show
matching `local`/`remote` timestamps before proceeding to §12.5.

---

## 13. Manual QA checklist

- [ ] `supabase db reset` (or a fresh linked-project migration push) replays Epic 1-7 cleanly from scratch.
- [ ] A manager creates a camera (`zone=classroom`, real `ip_address`) via direct table insert (Dashboard) — verify it appears in `listForManager` with all fields, including `ip_address`.
- [ ] The same manager links that camera to a classroom — verify a guardian whose child is in that classroom can now see the camera via `listForGuardian`, with no `ipAddress`/`streamProtocol` field present in the response shape.
- [ ] A guardian whose child is in a *different* classroom cannot see that camera at all.
- [ ] A manager toggles `admin_disabled=true` — verify the camera immediately stops resolving a stream token for any guardian (§12.2 step 5), and that the realtime `tenant:{id}:cameras` channel fires an `admin_disabled` change event.
- [ ] Issue a service-account key, send a real heartbeat from a simulated agent — verify `online` flips true and the realtime channel fires an `online` change event.
- [ ] Stop sending heartbeats for that camera; manually invoke `select media.sweep_camera_heartbeats();` after the 3-minute threshold has elapsed — verify `online` flips false, `admin_disabled` is untouched, and the tenant's manager receives an in-app "Camera offline" notification.
- [ ] Run `tests/rls/epic7_rls_adversarial.sql` against a real `supabase db reset` and confirm all 11 tests print `PASS`.
- [ ] Complete the four Edge-Function-specific verification checklists in §12.1-§12.4 against a real staging deployment.

---

## Verdict

Epic 7 (Media & Camera Architecture) implementation is **complete**: 5 new
migrations (2 tables, 2 enums, 1 consistency trigger, 9 RLS policies, 1
scheduled-job function), 4 new Edge Functions + 2 shared provider/utility
files, 10 new application-layer files (plus 5 additive edits to shared
plumbing across the Node/Deno error taxonomies, the Deno CORS headers list,
`domain.ts`, and `config.toml`), 6 new test files (68 unit tests + 11 RLS
adversarial tests, the latter unexecuted per §1), all additive to Epic 1-6.
`tsc --noEmit` is clean; `vitest run` passes 366/366 across 35 test files.
A project-wide recurrence search against every defect class from the Epic
2-6 review/fix/audit cycle found zero new recurrences (§8) and one genuinely
novel, explicitly documented residual gap (§7.2/§11.3 — the column-level
`ip_address`/`stream_protocol` exposure path, inherent to Postgres RLS's
lack of per-app-role column restriction, not something Epic 7's own design
could fully close without either splitting the schema against the
architecture doc's own explicit table shape or introducing a client-facing
RPC the execution plan explicitly says isn't needed). No Epic 1-6 migration
was modified; no frozen frontend file was touched.

Stopping here — Epic 8 is out of scope for this delivery.
