// camera-heartbeat — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.7, §13.7, §17; BACKEND_EXECUTION_PLAN.md Epic 7 §7
// Caller: identity.service_accounts machine identity (purpose=camera_agent),
// authenticated via a static API key sent as the x-service-account-key
// header — NEVER a Supabase Auth JWT (§10.7). This is the one deliberate
// exception in this project's Edge Function set that has no human caller at
// all; config.toml's [functions.camera-heartbeat] verify_jwt = false
// override exists precisely so the platform gateway doesn't reject a
// request that (correctly) carries no Authorization JWT.
//
// §13.7: "RLS is not the authorization mechanism for this path — the Edge
// Function's own scope/tenant check is." This function verifies the
// presented key against identity.service_accounts.api_key_hash, checks
// status='active', that 'camera:heartbeat' is within scopes, AND (fix for
// EPIC_7_REVIEW.md H2) that this specific service account is bound to the
// requested camera via media.camera_service_account_links — before this
// fix, any active camera:heartbeat-scoped key could forge a heartbeat for
// ANY camera in its own tenant, not just the physical device it was issued
// for. It then writes via the service_role admin client, scoped in code to
// exactly the one camera row named in the request body — it never gets
// blanket table access.
//
// Sync note (fix for EPIC_7_REVIEW.md M1): this authorization sequence
// (hash lookup -> status check -> scope check -> camera-binding check) is
// independently mirrored in backend/src/services/cameraHeartbeatService.ts
// for Node-side testability (tests/unit/cameraHeartbeatService.test.ts). If
// you change the sequence here, change it there too — nothing enforces the
// two stay in sync beyond this comment pair and code review discipline.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { hashApiKey } from '../_shared/serviceAccountKey.ts';

interface Body {
  cameraId: string;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const apiKey = req.headers.get('x-service-account-key');
    if (!apiKey) {
      throw new AppError('AUTH_MISSING_TOKEN', 'A service-account API key is required.', 'مطلوب مفتاح API لحساب الخدمة.');
    }

    const body = (await req.json()) as Partial<Body>;
    if (!body.cameraId || !uuidRe.test(body.cameraId)) {
      throw new AppError('VALIDATION_FAILED', 'cameraId must be a valid UUID', 'يجب أن يكون cameraId معرّف UUID صحيحًا');
    }

    const admin = supabaseAdmin();
    const keyHash = await hashApiKey(apiKey);

    // service_accounts has no RLS policy that would let a keyed caller read
    // it anyway (§13.7) — this lookup always runs via the service_role
    // admin client, never a caller-scoped one, since there is no caller JWT.
    const { data: account, error: accountErr } = await admin
      .schema('identity')
      .from('service_accounts')
      .select('id, tenant_id, status, scopes')
      .eq('api_key_hash', keyHash)
      .maybeSingle();
    if (accountErr) throw accountErr;

    if (!account || account.status !== 'active') {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'This service-account key is invalid or has been revoked.', 'مفتاح حساب الخدمة هذا غير صالح أو تم إلغاؤه.');
    }
    if (!Array.isArray(account.scopes) || !account.scopes.includes('camera:heartbeat')) {
      throw new AppError('PERM_ROLE_DENIED', 'This service account is not authorized for camera heartbeats.', 'حساب الخدمة هذا غير مصرح له بإرسال نبضات الكاميرا.');
    }

    // Fix for EPIC_7_REVIEW.md H2: this key must be explicitly bound to the
    // requested camera. A service account with zero camera_service_account_
    // links rows can never pass this check — closing the "any active key
    // heartbeats any camera in the tenant" impersonation gap.
    const { data: link, error: linkErr } = await admin
      .schema('media')
      .from('camera_service_account_links')
      .select('camera_id')
      .eq('service_account_id', account.id)
      .eq('camera_id', body.cameraId)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) {
      throw new AppError('PERM_ROLE_DENIED', 'This service account is not authorized for this camera.', 'حساب الخدمة هذا غير مصرح له بهذه الكاميرا.');
    }

    // Scoped in code to exactly this one camera row, within this service
    // account's own tenant (§17: "UPDATE cameras SET online = true,
    // last_heartbeat_at = now() WHERE id = :camera_id AND tenant_id =
    // :service_account.tenant_id" — the architecture doc's own literal
    // example, implemented verbatim, now additionally gated by the
    // camera-binding check above). Never touches admin_disabled.
    const { data: camera, error: cameraErr } = await admin
      .schema('media')
      .from('cameras')
      .update({ online: true, last_heartbeat_at: new Date().toISOString() })
      .eq('id', body.cameraId)
      .eq('tenant_id', account.tenant_id)
      .is('deleted_at', null)
      .select('id, tenant_id, name, online, admin_disabled, last_heartbeat_at')
      .maybeSingle();
    if (cameraErr) throw cameraErr;
    if (!camera) {
      throw new AppError('NOT_FOUND', 'Camera not found for this service account.', 'لم يتم العثور على الكاميرا لحساب الخدمة هذا.');
    }

    // Best-effort, non-blocking — a failure here must never fail the
    // heartbeat itself (mirrors the established "secondary bookkeeping
    // write is non-fatal" convention, e.g. idempotency_store in
    // withIdempotency, _shared/idempotency.ts).
    //
    // Fix for EPIC_7_REVIEW.md M2: a bare `.then((success) => ...)` only
    // catches an error returned *inside* a resolved response — it does not
    // catch the promise itself rejecting (a network-level failure before
    // any response is parsed). A trailing `.catch()` closes that gap,
    // matching the Node-side mirror's own `.catch()` in
    // CameraHeartbeatService.recordHeartbeat exactly.
    admin
      .schema('identity')
      .from('service_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', account.id)
      .then(({ error }) => {
        if (error) console.error('service_accounts.last_used_at update failed:', error);
      })
      .catch((err: unknown) => {
        console.error('service_accounts.last_used_at update failed (network):', err);
      });

    return new Response(JSON.stringify({ camera }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
