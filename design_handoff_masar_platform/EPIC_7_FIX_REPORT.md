# Epic 7 Fix Report

Implements every finding in `EPIC_7_REVIEW.md` (approved). Epic 7's migrations had not been deployed to any live project, so every SQL fix below was applied by editing the existing Epic 7 migration files directly (`backend/supabase/migrations/20260725000002_epic7_camera_tables.sql`, `20260725000003_epic7_rls_policies.sql`) rather than by adding forward-only patch migrations for those two — per this task's own instruction, forward-only patching is required only when a change would touch a *frozen* Epic's migration, and Epic 7 is not frozen (it is what this task fixes). One genuinely new migration (`20260725000006_epic7_camera_rpc.sql`) was added for a new RPC the fix pass required. **No Epic 1, Epic 2, Epic 3, Epic 4, Epic 5, or Epic 6 migration was modified.**

**The Critical finding, both High findings, all four Medium findings, and all six Low findings are fixed.**

---

## 1. Findings fixed

### Critical

| ID | Finding | Fix |
|---|---|---|
| C1 | `media.cameras` carried `ip_address`/`stream_protocol` directly and was added to the `supabase_realtime` publication guardians are required to subscribe to (§15) — Supabase Realtime's `postgres_changes` broadcasts the full row regardless of RLS column scoping, so these two fields (§17: "never sent to client apps") leaked to every linked-classroom guardian on every heartbeat, automatically, as ordinary feature use | The two sensitive columns were moved onto a new table, `media.camera_connections` (1:1 with `media.cameras`, `camera_id` both PK and FK), with manager-only RLS and **never** added to `supabase_realtime`. `media.cameras` keeps every other column and stays in the publication, now safe to broadcast in full. Since creating a camera became a two-table write, a new RPC (`public.create_camera`, migration 6) provides atomicity — deliberately `SECURITY INVOKER`, not `SECURITY DEFINER`, so it adds transactional atomicity only, never elevated privilege (both underlying `INSERT`s remain individually RLS-gated exactly as before). |

### High

| ID | Finding | Fix |
|---|---|---|
| H1 | `camera-stream-token` never checked `cameras.online` before minting a viewing token — only `admin_disabled` — so §3.33's own "viewable iff `online = true AND admin_disabled = false`" rule was only half-enforced | `camera-stream-token/index.ts` now selects `online` and gates on `!camera.online \|\| camera.admin_disabled`. The decision logic itself was additionally factored into a new, directly-unit-tested function (`authorizeCameraStreamRequest`, fix for L2 below) so this exact rule has a real regression test. |
| H2 | Service-account keys were not bound to a specific camera — any active `camera:heartbeat`-scoped key could forge a heartbeat (and, post-C1-fix, is still gated correctly since the token isn't affected, but pre-fix would have triggered the C1 leak) for **any** camera in its own tenant, not just the physical device it was issued for | New table `media.camera_service_account_links` (camera_id, service_account_id, tenant_id) binds a `camera_agent` key to the specific camera(s) it may heartbeat for. `issue-service-account-key` now requires at least one `cameraId` for any `camera_agent` key and creates the link rows. `camera-heartbeat` (both the Deno Edge Function and its Node mirror, `CameraHeartbeatService`) now checks this binding before ever touching `media.cameras` — a key with zero bindings, or a binding that doesn't include the requested camera, is rejected with `PERM_ROLE_DENIED`. A consistency trigger additionally enforces the linked service account is actually `purpose='camera_agent'`. |

### Medium

| ID | Finding | Fix |
|---|---|---|
| M1 | Duplicated, independently-maintained authorization logic between `camera-heartbeat/index.ts` (Deno) and `CameraHeartbeatService` (Node), the codebase's least-battle-tested auth path | Added explicit cross-reference comments in both files, each pointing at the other and stating "if you change the sequence here, change it there too" — the recommended fix from the review (a shared, dependency-free extracted function isn't feasible across the Deno/Node split this codebase already established). |
| M2 | Fire-and-forget `last_used_at` update in `camera-heartbeat/index.ts` used `.then()` with no `.catch()`, risking an unhandled promise rejection on a network-level failure | Added a trailing `.catch()`, matching `CameraHeartbeatService.recordHeartbeat`'s own `.catch()` exactly. |
| M3 | `issue-service-account-key` never cross-validated `purpose` against `scopes` — a `purpose=integration_other` key could still carry `camera:heartbeat` and function identically to a real `camera_agent` key | Both `issueServiceAccountKeySchema` (Zod, via `.refine()`) and the Edge Function's own `validate()` now require: `camera_agent` ⟹ at least one `camera:*` scope; `integration_other` ⟹ no `camera:*` scope. Combined with H2's `cameraIds` requirement, this closes both the scope-mismatch and the camera-binding gaps together. |
| M4 | `current_guardian_classroom_ids()` (frozen Epic 5) doesn't exclude soft-deleted classrooms, only soft-deleted children — a latent gap in its own lower-stakes original context, newly relied on by this Epic's higher-stakes camera-viewing decision | `cameras_select_guardian` and `camera_classroom_links_select_guardian` (migration 3) now add their own explicit `academic.classrooms ... deleted_at is null` check as defense-in-depth, independent of the frozen helper. `camera-stream-token/index.ts` was fixed identically with its own hand-rolled query. The frozen helper itself is correctly left unmodified. |

### Low

| ID | Finding | Fix |
|---|---|---|
| L1 | `ServiceAccountRepository.findActiveByKeyHash`'s name implied a `status='active'` filter the query never actually applied | Renamed to `findByKeyHash`; the enforcement remains correctly downstream in `CameraHeartbeatService`'s own explicit `status !== 'active'` check. |
| L2 | `camera-stream-token` had zero automated test coverage of its own authorization decision logic | Factored the decision (classroom ownership + online/admin_disabled gating) into a new pure function, `authorizeCameraStreamRequest` (`src/services/cameraStreamAuthorizationService.ts`), fully covered by `tests/unit/cameraStreamAuthorizationService.test.ts` — including direct regression tests for both H1 and the M4 contract. The external-relay-calling part of `camera-stream-token` remains deliberately un-mirrored (matches `PaymentService`'s own established precedent for `initiate-payment`). |
| L3 | `cameras_viewable_idx` was not used by any implemented query path | Left in place (a plausible future "list only viewable cameras" query would use it) but its comment was corrected to state it's not yet exercised by any current code path, rather than implying current usage. |
| L4 | No pagination on `CameraRepository.listForManager`/`listForGuardian` | Added a default page size (500 rows, via `.range()`) to both methods, with optional `limit`/`offset` parameters — a real, enforced cap beyond PostgREST's own project-wide `max_rows` default. |
| L5 | No constraint preventing duplicate `ip_address` values within a tenant | Added `camera_connections_tenant_ip_key`, a unique index on `(tenant_id, ip_address)` on the new `media.camera_connections` table. |
| L6 | `CameraRepository.update()`/`softDelete()` didn't exclude already-soft-deleted rows | Both methods now add `.is('deleted_at', null)` to their filter chain — a manager can no longer edit or re-soft-delete an already-removed camera. |

---

## 2. Project-wide recurrence checks performed

Per the task's "perform a project-wide recurrence check for every defect class discovered during the review" instruction, each defect *class* was searched for across the entirety of Epic 7 (not just the specific reported location) before considering any finding closed:

- **C1-class (a table combining a Realtime-published surface with a column the architecture doc treats as more sensitive than ordinary tenant/ownership data)**: checked every other Epic 7 table. `media.camera_classroom_links` and the two new tables (`media.camera_connections`, `media.camera_service_account_links`) are **not** in the `supabase_realtime` publication (confirmed — migration 5 names only `media.cameras`) — no recurrence found beyond the one already fixed.
- **H1-class (a compound documented invariant only half-enforced in code)**: re-checked every other place `online`/`admin_disabled` are read together. Only `camera-stream-token` makes a viewability decision from them; the heartbeat sweep (`media.sweep_camera_heartbeats()`) and `camera-heartbeat` itself only ever *write* `online`, never branch on the compound condition. No other recurrence found.
- **H2-class (a machine-identity credential with no binding to the specific resource it operates on)**: `identity.service_accounts.purpose='integration_other'` is the only other credential class this Epic issues, and it has no camera-like "which resource" concept to bind to at all (by design — see M3's fix, which explicitly forbids `camera:*` scopes on this purpose). No recurrence found.
- **M1-class (duplicated Deno/Node authorization logic)**: every other Epic 7 Edge Function with a Node mirror was re-compared line-by-line against its mirror. `issue-service-account-key`/`ServiceAccountService.issueKey` and `revoke-service-account-key`/`ServiceAccountService.revokeKey` were found to already match closely (both now additionally updated for H2/M3 in lockstep as part of this same fix pass); only `camera-heartbeat`/`CameraHeartbeatService` had a comment gap, now closed. `camera-stream-token` has no Node mirror by design (L2's own scope), so it was not a candidate for this specific class.
- **M2-class (fire-and-forget `.then()` with no `.catch()`)**: searched every `.then(` call across all four Epic 7 Edge Functions. Only the one instance in `camera-heartbeat/index.ts` existed; `issue-service-account-key`, `revoke-service-account-key`, and `camera-stream-token` use `await` throughout with no bare `.then()` chains.
- **M3-class (unvalidated cross-field correlation between a discriminant field and a dependent field)**: checked every other Epic 7 input shape with more than one field. `createCameraSchema`/`updateCameraSchema`/`updateCameraConnectionSchema`/`linkCameraClassroomSchema` have no comparable discriminant/dependent pair (their fields are independent by nature). Only `issueServiceAccountKeySchema`'s `purpose`/`scopes`/`cameraIds` triple had this shape.
- **M4-class (a read path relying on `current_guardian_classroom_ids()` without an additional classroom-`deleted_at` check)**: searched every Epic 7 query site using this helper or an equivalent hand-rolled classroom-ownership check. Found and fixed three: `cameras_select_guardian`, `camera_classroom_links_select_guardian` (both migration 3), and `camera-stream-token/index.ts`'s own query. No other Epic 7 code path reads `academic.classrooms` for a guardian-facing decision.
- **L1-class (a repository method name implying a filter it doesn't apply)**: re-read every method name against its actual query in `cameraRepository.ts` and `serviceAccountRepository.ts`. Only `findActiveByKeyHash` had this mismatch.
- **L4-class (an unbounded `select('*')`-style list query)**: checked every Epic 7 repository list method. `listClassroomLinks` and `listLinkedCameraIds` both return small, inherently-bounded result sets (a single camera's classroom links, a single service account's camera bindings — never a tenant-wide unbounded scan), so pagination was not added there; only `listForManager`/`listForGuardian` (genuinely tenant-wide scans) needed it.
- **L6-class (a repository update/delete method not excluding already-soft-deleted rows)**: checked every Epic 7 repository mutation method. `updateConnection` operates on `media.camera_connections`, which has no `deleted_at` column of its own (it's owned/cascaded by its camera's own delete) — not applicable there. `unlinkClassroom`/`linkClassroom` operate on a table with no `deleted_at` column at all (a pure link table). Only `update()`/`softDelete()` on `cameras` itself needed the fix.

No additional recurrence of any reviewed defect class was found beyond the locations already fixed above. No defect class from `EPIC_1_REVIEW.md` through `EPIC_6_REVIEW.md` (SETOF-in-policy, unhardened `search_path`, missing tenant-consistency triggers, missing idempotency envelopes, manager hard-delete on a historical record, a direct-RLS-write path bypassing a correctness-critical RPC, asymmetric Zod refines) was found reintroduced anywhere in this fix pass.

---

## 3. Files modified

### SQL migrations (Epic 7's own, edited directly where undeployed — plus one new file)
- `20260725000002_epic7_camera_tables.sql` — **edited**: C1 (removed `ip_address`/`stream_protocol` from `media.cameras`; added `media.camera_connections` + its consistency trigger + `updated_at` trigger + the L5 unique index); H2 (added `media.camera_service_account_links` + its consistency trigger, which also enforces `purpose='camera_agent'`).
- `20260725000003_epic7_rls_policies.sql` — **edited**: C1 (RLS for `media.camera_connections`, manager-only, no guardian policy); H2 (RLS for `media.camera_service_account_links`, manager-only); M4 (`cameras_select_guardian`/`camera_classroom_links_select_guardian` gained an explicit classroom-`deleted_at` check).
- `20260725000006_epic7_camera_rpc.sql` — **new**: `public.create_camera`, the C1 fix's atomicity mechanism.
- `20260725000001_epic7_media_schema.sql`, `20260725000004_epic7_scheduled_jobs.sql`, `20260725000005_epic7_realtime.sql` — unchanged (no finding required a change to schema/enum creation, the heartbeat-sweep function, or the realtime publication statement itself — `media.cameras`' own Realtime membership was already correct once C1's schema split removed the sensitive columns from that table).

### Edge Functions
- `camera-heartbeat/index.ts` — H2 (camera-binding check), M1 (cross-reference comment), M2 (`.catch()`).
- `camera-stream-token/index.ts` — H1 (`online` check), M4 (classroom-`deleted_at` check), L2 (comment pointing at the new factored/tested authorization function).
- `issue-service-account-key/index.ts` — H2 (`cameraIds` requirement + link-row creation), M3 (`purpose`/`scopes` cross-validation).
- `revoke-service-account-key/index.ts` — unchanged (no finding applied to this function).

### TypeScript
- `backend/src/types/database.types.epic7.ts` — C1 (`CameraRow` loses `ip_address`/`stream_protocol`; new `ManagerCameraRow`, `CameraConnectionRow`, `CameraServiceAccountLinkRow`).
- `backend/src/types/domain.epic7.ts` — C1 (`GuardianCamera`/`guardianCameraFromRow` removed — no longer needed now that the base `Camera` type is guardian-safe by construction; new `ManagerCamera`, `CameraConnection`, `CameraServiceAccountLink` types + mappers).
- `backend/src/validation/media.schema.ts` — C1 (`updateCameraSchema` loses `ipAddress`/`streamProtocol`; new `updateCameraConnectionSchema`); H2/M3 (`issueServiceAccountKeySchema` gains `cameraIds` + three cross-field `.refine()`s).
- `backend/src/repositories/cameraRepository.ts` — C1 (`listForManager`/`findByIdForManager` now join `camera_connections`; `create()` now calls the `create_camera` RPC; new `updateConnection()`); L4 (pagination); L6 (`deleted_at is null` filters).
- `backend/src/repositories/serviceAccountRepository.ts` — L1 (rename); H2 (`listLinkedCameraIds()`; `create()` gains `cameraIds` + link-row insertion).
- `backend/src/services/cameraService.ts` — C1 (`ManagerCamera`/`Camera` return types; new `updateConnection()`).
- `backend/src/services/serviceAccountService.ts` — H2 (`cameraIds` passthrough).
- `backend/src/services/cameraHeartbeatService.ts` — H2 (camera-binding check); L1 (rename); M1 (cross-reference comment).
- `backend/src/services/cameraStreamAuthorizationService.ts` — **new**: L2's factored, tested authorization function.
- `backend/src/api/routes/media.ts` — C1 (new `updateCameraConnectionRoute`; `ManagerCamera`/`Camera` return types).

### Tests
- `backend/tests/unit/cameraService.test.ts` — updated for `ManagerCamera`/`Camera` split; new `updateConnection` tests.
- `backend/tests/unit/cameraHeartbeatService.test.ts` — updated for the `findByKeyHash` rename; 3 new tests for the H2 camera-binding check.
- `backend/tests/unit/serviceAccountService.test.ts` — 1 new test for H2's `cameraIds` passthrough.
- `backend/tests/unit/mediaValidation.test.ts` — updated `updateCameraSchema`/`issueServiceAccountKeySchema` tests; new `updateCameraConnectionSchema` describe block; 6 new cross-validation tests (M3/H2).
- `backend/tests/unit/mediaApiRoutes.test.ts` — new `updateCameraConnectionRoute` describe block; updated `issueServiceAccountKeyRoute` tests for `cameraIds`.
- `backend/tests/unit/cameraStreamAuthorizationService.test.ts` — **new**: 6 tests (L2), including direct H1 and M4-contract regression tests.
- `backend/tests/rls/epic7_rls_adversarial.sql` — fixtures updated for the schema split + H2 bindings; Tests 1, 2, 4, 5 extended with new-table assertions; 5 new tests (12–15: `create_camera` atomicity + manager-only enforcement, the L5 unique-IP constraint, the H2 purpose-mismatch trigger rejection, and the M4 soft-deleted-classroom regression).

---

## 4. Database changes

**New tables:** `media.camera_connections` (`camera_id` PK/FK to `media.cameras`, `tenant_id`, `ip_address`, `stream_protocol`, `created_at`, `updated_at`); `media.camera_service_account_links` (`camera_id`, `service_account_id`, `tenant_id`, `created_at`, composite PK).
**Changed table:** `media.cameras` — `ip_address`/`stream_protocol` columns removed (moved to `media.camera_connections`).
**New indexes:** `camera_connections_tenant_idx`; `camera_connections_tenant_ip_key` (unique, L5); `camera_service_account_links_tenant_idx`; `camera_service_account_links_account_idx`.
**New triggers:** `trg_camera_connections_updated_at`; `trg_camera_connections_consistency` (tenant/camera agreement); `trg_camera_service_account_links_consistency` (tenant/camera/service-account agreement + `purpose='camera_agent'` enforcement).
**New RLS policies:** `camera_connections_select_manager`, `camera_connections_insert_manager`, `camera_connections_update_manager`; `camera_service_account_links_select_manager`, `camera_service_account_links_insert_manager`, `camera_service_account_links_delete_manager`. No guardian, teacher, reception, driver, or platform_admin policy exists on either new table.
**Changed RLS policies:** `cameras_select_guardian`, `camera_classroom_links_select_guardian` — both gained an explicit `academic.classrooms ... deleted_at is null` check (M4).
**New function:** `public.create_camera(p_name, p_zone, p_ip_address, p_stream_protocol, p_resolution, p_has_audio)` — `SECURITY INVOKER` (not `DEFINER`), atomically inserts one `media.cameras` row and its `media.camera_connections` row.
**Realtime:** unchanged — `media.cameras` remains the only Epic 7 table in `supabase_realtime`; neither new table was ever added to it.

---

## 5. Security improvements

- Closed a systemic confidentiality leak that fired automatically, on ordinary use of the live camera-status feature, broadcasting real on-premise network addresses to every guardian with a linked-classroom camera — the highest-severity finding in this review, and the one most directly contradicting an explicit, repeated architecture requirement (C1).
- Closed a real camera-impersonation vector: a single leaked or misconfigured service-account key can no longer forge a heartbeat for every camera in its tenant — only the specific camera(s) it was deliberately bound to at issuance (H2).
- Restored the full, documented viewability invariant (`online AND !admin_disabled`) to the one function whose entire purpose is enforcing it, closing a gap where a client could receive a working-looking stream token for a camera that was never actually online (H1).
- Closed a credential-purpose integrity gap where a non-camera key could silently function identically to a real camera-agent key (M3), which also closes the door on a `camera_agent`-purpose key ever being issued without an explicit camera binding (H2's other half).
- Strengthened guardian-visibility correctness for a higher-stakes decision (camera viewing) than the shared helper's original, lower-stakes context (event visibility) was ever audited against (M4) — verified live by a direct regression test (RLS Test 15).
- Closed an unhandled-promise-rejection risk on the machine-authentication path specifically (M2), and reduced future-maintenance risk on the same path via explicit cross-reference documentation (M1).

---

## 6. Performance improvements

- Added enforced pagination (500-row default, `.range()`-based) to both camera-listing repository methods, closing the only unbounded-list-query gap this review found (L4).
- The new `camera_connections_tenant_ip_key` unique index (L5) is a small, cheap write-path check that prevents a data-integrity mistake before it accumulates, rather than a performance concern in itself.
- No regression: `media.cameras`' own indexes (`cameras_tenant_idx`, `cameras_viewable_idx`, `cameras_online_heartbeat_idx`) are unchanged; the heartbeat-sweep scheduled job's set-based, single-statement shape is untouched by this fix pass.

---

## 7. New tests added

- `backend/tests/unit/cameraStreamAuthorizationService.test.ts` (new file, 6 tests): allows a valid request; `NOT_FOUND` for a missing camera; `PERM_ROLE_DENIED` for an unlinked classroom; `VALIDATION_FAILED` for offline (H1 direct regression); `VALIDATION_FAILED` for admin-disabled; `PERM_ROLE_DENIED` when the camera's classroom was excluded upstream (M4 contract documentation).
- `backend/tests/unit/cameraHeartbeatService.test.ts`: 3 new tests — rejects a correctly-scoped key not bound to the requested camera (H2 direct regression), rejects a key with zero bindings, accepts a multi-camera-bound key for one of its own cameras.
- `backend/tests/unit/serviceAccountService.test.ts`: 1 new test — `cameraIds` threads through to the repository.
- `backend/tests/unit/mediaValidation.test.ts`: 1 new describe block (`updateCameraConnectionSchema`, 4 tests) + 6 new cross-validation tests on `issueServiceAccountKeySchema` (H2/M3) + 1 new test confirming `updateCameraSchema` strips a stray `ipAddress` field.
- `backend/tests/unit/cameraService.test.ts`: 2 new tests (`updateConnection` allowed for manager, denied for guardian) + 1 updated test confirming `ManagerCamera` carries connection fields.
- `backend/tests/unit/mediaApiRoutes.test.ts`: 2 new tests (`updateCameraConnectionRoute`) + 1 new test (`issueServiceAccountKeyRoute` rejects a `camera_agent` body with no `cameraIds`).
- `backend/tests/rls/epic7_rls_adversarial.sql`: 5 new tests (12–15, with 12 split into an atomicity assertion and an adversarial-guardian-denial assertion) covering `create_camera`'s atomicity and manager-only enforcement, the L5 unique-IP constraint, the H2 consistency-trigger's `purpose='camera_agent'` enforcement, and the M4 soft-deleted-classroom regression (the direct SQL-level test for a finding this fix pass specifically introduced) — plus 4 existing tests (1, 2, 4, 5) extended with assertions against the two new tables.

---

## 8. Verification performed

```
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit   →  0 errors
node node_modules/vitest/vitest.mjs run                            →  36 test files, 392 tests, ALL PASSING (366 prior + 26 new)
```

- **SQL balance verified programmatically** on every touched or new SQL file:
  ```
  20260725000001: $$ pairs 0 OK,  parens balanced OK   (unchanged)
  20260725000002: $$ pairs 6 OK,  parens balanced OK
  20260725000003: $$ pairs 0 OK,  parens balanced OK
  20260725000004: $$ pairs 2 OK,  parens balanced OK   (unchanged)
  20260725000005: $$ pairs 0 OK,  parens balanced OK   (unchanged)
  20260725000006: $$ pairs 2 OK,  parens balanced OK
  epic7_rls_adversarial.sql: $$ pairs 46 OK, parens balanced OK
  ```
- **Freeze compliance verified**: `git status --porcelain` shows only the same 5 pre-existing, already-documented additive-edit files as modified (`backend/src/lib/errors.ts`, `backend/src/types/domain.ts`, `backend/supabase/config.toml`, `backend/supabase/functions/_shared/cors.ts`, `backend/supabase/functions/_shared/errors.ts`) — none of which were touched *during this fix pass* (they predate it, from the original Epic 7 delivery). `git diff --stat` against every `20260714*`–`20260723*` migration file (Epic 1–6) returns empty. Every Epic 7 file this fix pass touched or created shows as untracked/new, consistent with Epic 7 never having been committed.
- **Deployment order re-verified**: migration 6 (`create_camera`) correctly depends on and is sequenced after migration 2 (`media.cameras`/`media.camera_connections` must exist) and migration 3 (RLS policies the RPC's own `INSERT`s rely on); migrations 4 (scheduled jobs) and 5 (realtime) both reference only `media.cameras`, unaffected by the schema split, and remain correctly sequenced after migration 2. No migration was renumbered; the six-file sequence (`...0001` through `...0006`) applies cleanly in order.
- **`SECURITY DEFINER`/`search_path` audit re-run**: `public.create_camera` was confirmed **not** `SECURITY DEFINER` (deliberately — see §1's C1 fix rationale); `media.sweep_camera_heartbeats()` (unchanged) re-confirmed `SECURITY DEFINER` with `search_path=''`; all three new/changed trigger functions (`check_camera_connection_consistency`, `check_camera_service_account_link_consistency`, and the unchanged `check_camera_classroom_link_consistency`) re-confirmed **not** `SECURITY DEFINER`, matching the established plain-trigger-under-RLS pattern.
- **Direct project-wide re-grep for each fixed defect class** performed per §2 above — no surviving or additional recurrence found.

---

## 9. Remaining limitations

- **The RLS adversarial suite has not been executed against a live database in this session** — this sandbox has no Docker/live Postgres access. Every new and modified assertion was hand-traced against the post-fix migration text, but static tracing is not a substitute for an executed run. Running it remains a required step before Epic 7 can be considered fully, empirically verified.
- **`camera-stream-token`'s external-relay-calling code remains without direct Edge-Function-level test coverage** — L2's fix closes the coverage gap for the *authorization decision* specifically (now fully unit-tested), but the Edge Function itself (header/body parsing, the relay call, response shaping) is still untested by any automated suite, consistent with every other Edge Function in this codebase.
- **`issue-service-account-key`'s account-row-creation and link-row-creation remain two sequential, non-transactional writes** (both in the Edge Function and its Node mirror) — a failure between them leaves an active-but-under-linked service account. This is an accepted, documented tradeoff (§1's H2 fix description): the consequence is fully contained by `camera-heartbeat`'s own binding check, which safely rejects any heartbeat from an under-linked account rather than over-trusting it, so no security property depends on this being atomic — only convenience (an operator would need to notice and re-link or reissue).
- **Camera-agent service accounts issued before this fix pass, if any existed in a real deployment, would have zero camera bindings** and would therefore fail every heartbeat under the new H2 check until a manager explicitly links them via a future re-issuance or a manual `camera_service_account_links` insert — not a concern for this delivery (Epic 7 was never deployed), but worth noting as an operational migration step for any environment that had already issued keys before this fix.

---

## Verdict

Every Critical, High, Medium, and Low finding in `EPIC_7_REVIEW.md` is fixed. A project-wide recurrence search confirmed each fixed defect class had no additional instances anywhere else in Epic 7. No Epic 1–6 migration was modified; no frozen frontend file was touched; all changes are additive to the frozen epics and, for Epic 7's own undeployed migrations, corrected in place per this task's own explicit allowance. `node node_modules/typescript/bin/tsc --noEmit` is clean; `node node_modules/vitest/vitest.mjs run` passes 392/392 (26 new tests). SQL balance and deployment order were both re-verified programmatically. The one item still open — live execution of the RLS adversarial suite — is the same standing, explicitly-documented limitation carried by every prior Epic in this sandbox, not a gap introduced by this fix pass. Stopping here per this task's instruction.
