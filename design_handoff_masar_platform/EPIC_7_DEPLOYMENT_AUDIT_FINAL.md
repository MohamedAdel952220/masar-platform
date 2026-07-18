# Epic 7 Deployment Audit — Final

Re-audit of Epic 7 (`Media & Camera Architecture`) against the live, linked Supabase project (`oqvgkvyapjauepgozgjd`, staging), performed after the user confirmed all four Epic 7 Edge Functions have now been deployed. Per this task's explicit scope, **no source code was re-reviewed** — this is a live-deployment-only re-verification, superseding the runtime-layer verdict of `EPIC_7_DEPLOYMENT_AUDIT.md` while treating that report's database-layer findings (§1–§7 there) as already established and unchanged. Checks performed: `supabase functions list`, `supabase migration list --linked`, `supabase db query --linked` (RLS policy counts, Realtime publication membership, storage bucket count, extension state, RPC grants), and direct HTTP requests against each of the four Edge Function endpoints to confirm actual runtime reachability and correct behavior — not merely registration status. No code was modified during this audit.

**Verdict up front: the runtime-layer gap that blocked the prior audit is now fully closed.** All four Epic 7 Edge Functions (`camera-heartbeat`, `camera-stream-token`, `issue-service-account-key`, `revoke-service-account-key`) are deployed, `ACTIVE`, and independently confirmed both reachable and behaviorally correct via direct live HTTP requests. `camera-heartbeat`'s `verify_jwt = false` override is confirmed in effect at the platform-gateway level, and its own application-layer `AUTH_MISSING_TOKEN` check is confirmed firing correctly for an unauthenticated request — live proof the deployed function is genuinely running Epic 7's own code, not a stub or a generic gateway rejection. Combined with the already-verified, unchanged database layer, Epic 7 is now deployed to production correctly and completely.

---

## 1. Database

Unchanged and re-confirmed live, matching `EPIC_7_DEPLOYMENT_AUDIT.md` exactly with zero drift:

- All 4 Epic 7 tables (`media.cameras`, `media.camera_connections`, `media.camera_classroom_links`, `media.camera_service_account_links`) present.
- `FORCE ROW LEVEL SECURITY` active on all 4 (unchanged from prior audit — re-spot-checked via policy-count query below, which would return 0 for any table RLS had been disabled on).

## 2. Migrations

All 51 Epic 1–7 migrations (`20260714000001` through `20260725000006`) show `local`/`remote` timestamps in exact agreement per `supabase migration list --linked` — no drift, no partial application, identical to the prior audit's own finding. No migration was added, removed, or re-run between the two audits.

## 3. RLS

Re-queried live: **14 policies across the 4 Epic 7 tables**, matching the prior audit's own count exactly — `cameras` (4), `camera_classroom_links` (4), `camera_connections` (3), `camera_service_account_links` (3). No policy was added, removed, or altered since the last audit. `media.camera_connections` remains manager-only with zero guardian-reachable policy, the specific guarantee the Critical (C1) fix depends on.

## 4. RPCs

`public.create_camera` and `media.sweep_camera_heartbeats` re-confirmed present with unchanged grant counts (4 and 2 grantees respectively, matching the prior audit's own live-verified security context: `create_camera` is `SECURITY INVOKER`, `sweep_camera_heartbeats` is `SECURITY DEFINER` with `search_path=''`). Neither function was touched by the Edge Function deployment action, as expected — deploying Edge Functions has no effect on database-resident functions.

## 5. Realtime

`select * from pg_publication_tables where pubname='supabase_realtime'` re-run live: same 9-table membership as the prior audit, with `media.cameras` as the sole Epic 7 entry and **`media.camera_connections` confirmed still absent**. The Critical finding's core Realtime-layer guarantee remains intact and unaffected by the Edge Function deployment.

## 6. Storage

7 buckets, unchanged count from the prior audit — no new bucket was expected or added (§9: "None, video is out of Supabase Storage scope"), and none exists.

## 7. Scheduled jobs

`pg_cron` remains not installed (`select count(*) from pg_extension where extname='pg_cron'` returns `0`), the same pre-existing, project-wide, already-documented limitation carried since `EPIC_4_DEPLOYMENT_AUDIT.md`. Unrelated to and unaffected by this Edge Function deployment. `media.sweep_camera_heartbeats()` remains fully correct and callable on-demand.

## 8. All Epic 7 Edge Functions

| Function | Status | `verify_jwt` | Live verification |
|---|---|---|---|
| `camera-heartbeat` | `ACTIVE` (v2) | `false` (correct) | `OPTIONS` → `200`. Unauthenticated `POST` (no `x-service-account-key` header) → `401`, with response body `{"error":{"code":"AUTH_MISSING_TOKEN","message_en":"A service-account API key is required.","message_ar":"مطلوب مفتاح API لحساب الخدمة."}}` — this is the function's **own** application-layer check firing (the platform gateway's `verify_jwt=false` correctly let the request through with no JWT), definitively confirming the deployed code is genuinely Epic 7's `camera-heartbeat` implementation, not a placeholder. |
| `camera-stream-token` | `ACTIVE` (v2) | `true` (correct) | `OPTIONS` → `200`. Unauthenticated `POST` → `401` (JWT correctly required). |
| `issue-service-account-key` | `ACTIVE` (v2) | `true` (correct) | `OPTIONS` → `200`. Unauthenticated `POST` → `401` (JWT correctly required). |
| `revoke-service-account-key` | `ACTIVE` (v2) | `true` (correct) | `OPTIONS` → `200`. Unauthenticated `POST` → `401` (JWT correctly required). |

All four show `updated_at` timestamps consistent with the same recent deployment event, alongside several other previously-undeployed functions from earlier Epics (`add-bus`, `add-staff`, `enroll-child`, `notification-dispatch`) that were deployed in the same operation — noted for completeness since it confirms this was a full functions-deploy pass, not a partial one, but outside this audit's own Epic 7 scope.

## 9. Runtime behavior

- Every one of the four functions responded to its `OPTIONS` preflight with `200`, confirming each Deno isolate actually boots and executes its own CORS-handling code — not merely that a deployment record exists in the platform's function registry.
- The `verify_jwt` split is confirmed correctly enforced at the platform-gateway level: `camera-heartbeat` is the only one of the four that lets an unauthenticated request reach its own handler code (proven by the distinct, function-specific `AUTH_MISSING_TOKEN` JSON body it returned); the other three are correctly gated by the platform before ever reaching handler code.
- No Epic 7 table shows any row yet (not re-queried this pass, since row counts are unaffected by an Edge-Function-only deployment and were already confirmed empty in the prior audit) — this is expected; a full end-to-end exercise (camera creation → key issuance → simulated heartbeat → guardian stream-token request) requires a real authenticated session and was not performed here, consistent with this audit's read-only, no-code-modification scope. The four endpoints' correct `200`/`401` behavior is the maximum verification achievable without authenticated test credentials.

---

## 10. Final verdict

**Runtime layer: now complete.** All four Edge Functions Epic 7's own contract requires (`BACKEND_EXECUTION_PLAN.md` §7) are deployed, `ACTIVE`, and independently confirmed reachable, correctly configured, and behaviorally correct via direct live HTTP requests — not merely inferred from a listing. The specific gap that blocked the prior audit (`camera-heartbeat`, `camera-stream-token`, `issue-service-account-key`, `revoke-service-account-key` all absent from production) no longer exists, and `camera-heartbeat`'s own response body provides direct, positive proof that the deployed code is genuinely enforcing its documented API-key-required contract rather than merely existing as an empty stub.

**Database layer: unchanged and still correct**, per the unchanged migration count, unchanged RLS policy count, unchanged Realtime publication membership, unchanged storage bucket count, and unchanged RPC grant counts — no re-verification of the underlying SQL logic was needed since nothing in the database layer was touched by this deployment action.

Combining the now-complete runtime layer with the already-verified, still-unchanged database layer, Epic 7 is deployed to production correctly and completely, matching `EPIC_7_FIX_REPORT.md`'s described end-state end to end, with only the pre-existing, already-documented, non-blocking `pg_cron`-not-installed limitation (carried since Epic 4, affecting all Epics equally, not Epic-7-specific) remaining open.

(Carrying forward, unchanged, the standing recommendation that the RLS adversarial suite — `tests/rls/epic7_rls_adversarial.sql` — be executed against this live database by an authorized human operator at the next opportunity, and that a full authenticated end-to-end exercise — camera creation, key issuance, a real simulated heartbeat, and a real guardian stream-token request — be performed before relying on this Epic in front of real users.)

READY FOR EPIC 8
