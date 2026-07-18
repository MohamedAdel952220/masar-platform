// issue-service-account-key — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.7, §14.2; BACKEND_EXECUTION_PLAN.md Epic 7 §7
// Caller: manager, own tenant only.
//
// An Edge Function (not an RPC) for the same reason provision-tenant/
// regenerate-activation-link are: generating and hashing a raw credential is
// application-code work, and the "no-plaintext-credential" pattern (§10.3)
// requires the raw value to be returned exactly once and never persisted —
// identity.service_accounts.api_key_hash stores only the SHA-256 hash
// (_shared/serviceAccountKey.ts), mirroring api_key_hash's own column
// comment ("hashed, never stored/returned in plaintext after issuance").
//
// tenant_id is deliberately NOT accepted from the request body — unlike
// §14.2's own conceptual issue_service_account_key(tenant_id, purpose,
// scopes[]) signature, this implementation always derives it from the
// caller's own session (caller.tenantId), matching every other
// manager-scoped Edge Function in this codebase (generate_invoice,
// initiate-payment) that never trusts a client-supplied tenant_id (§14.3).
//
// Fix for EPIC_7_REVIEW.md M3: purpose and scopes are now cross-validated —
// a camera_agent key must carry only camera:* scopes, an integration_other
// key must carry none. Fix for EPIC_7_REVIEW.md H2: a camera_agent key now
// requires at least one cameraId, and this function binds the newly-issued
// service account to each named camera via media.camera_service_account_
// links — camera-heartbeat (fixed alongside this function) rejects any
// heartbeat for a camera the presented key isn't explicitly linked to.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { generateApiKey, hashApiKey } from '../_shared/serviceAccountKey.ts';

type Purpose = 'camera_agent' | 'integration_other';

interface Body {
  name: string;
  purpose: Purpose;
  scopes: string[];
  cameraIds?: string[];
}

const SCOPE_RE = /^[a-z][a-z_]*:[a-z][a-z_]*$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(body: Partial<Body>): Body {
  const errors: string[] = [];
  if (!body.name || !body.name.trim()) errors.push('name is required');
  if (!body.purpose || !['camera_agent', 'integration_other'].includes(body.purpose)) errors.push('purpose must be one of camera_agent, integration_other');
  if (!Array.isArray(body.scopes) || body.scopes.length === 0) errors.push('scopes must be a non-empty array');
  else if (body.scopes.some((s) => typeof s !== 'string' || !SCOPE_RE.test(s))) errors.push('every scope must match the "resource:action" format, e.g. camera:heartbeat');

  // Fix for EPIC_7_REVIEW.md M3: purpose/scopes cross-validation — a
  // mismatched key (e.g. purpose=integration_other carrying camera:heartbeat)
  // previously worked identically to a real camera_agent key, since
  // camera-heartbeat never inspected purpose at all.
  if (body.purpose && Array.isArray(body.scopes)) {
    const hasCameraScope = body.scopes.some((s) => typeof s === 'string' && s.startsWith('camera:'));
    if (body.purpose === 'camera_agent' && !hasCameraScope) {
      errors.push('a camera_agent key must carry at least one camera:* scope');
    }
    if (body.purpose === 'integration_other' && hasCameraScope) {
      errors.push('an integration_other key may not carry a camera:* scope');
    }
  }

  // Fix for EPIC_7_REVIEW.md H2: a camera_agent key must be bound to at
  // least one specific camera at issuance time — closes the "any active
  // key heartbeats any camera in the tenant" impersonation gap.
  if (body.purpose === 'camera_agent') {
    if (!Array.isArray(body.cameraIds) || body.cameraIds.length === 0) {
      errors.push('cameraIds must be a non-empty array for a camera_agent key');
    } else if (body.cameraIds.some((id) => typeof id !== 'string' || !uuidRe.test(id))) {
      errors.push('every cameraId must be a valid UUID');
    }
  } else if (body.cameraIds !== undefined && body.cameraIds.length > 0) {
    errors.push('cameraIds is only accepted for a camera_agent key');
  }

  if (errors.length) throw new AppError('VALIDATION_FAILED', errors.join('; '), 'تحقق من صحة البيانات المدخلة.');
  return body as Body;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    requireRole(caller, ['manager']);
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'Your account is not scoped to a tenant.', 'حسابك غير مرتبط بمؤسسة.');
    }

    const body = validate(await req.json());
    const admin = supabaseAdmin();

    // Fix for EPIC_7_REVIEW.md H2: verify every named camera actually
    // belongs to the caller's own tenant before creating anything — a
    // clean VALIDATION_FAILED here is preferable to relying solely on the
    // link-table's own consistency trigger (migration 2) to reject it
    // after the account row already exists.
    if (body.cameraIds && body.cameraIds.length > 0) {
      const { data: ownedCameras, error: ownedErr } = await admin
        .schema('media')
        .from('cameras')
        .select('id')
        .in('id', body.cameraIds)
        .eq('tenant_id', caller.tenantId)
        .is('deleted_at', null);
      if (ownedErr) throw ownedErr;

      const ownedIds = new Set((ownedCameras ?? []).map((row) => (row as { id: string }).id));
      const missing = body.cameraIds.filter((id) => !ownedIds.has(id));
      if (missing.length > 0) {
        throw new AppError('NOT_FOUND', 'One or more cameras were not found for this tenant.', 'لم يتم العثور على واحدة أو أكثر من الكاميرات لهذه المؤسسة.');
      }
    }

    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);

    const { data: account, error: insertErr } = await admin
      .schema('identity')
      .from('service_accounts')
      .insert({
        tenant_id: caller.tenantId,
        name: body.name.trim(),
        purpose: body.purpose,
        api_key_hash: keyHash,
        scopes: body.scopes,
        status: 'active',
        issued_by: caller.userId,
      })
      .select('id, tenant_id, name, purpose, scopes, status, issued_at')
      .single();
    if (insertErr) throw insertErr;

    // Fix for EPIC_7_REVIEW.md H2: bind the newly-issued key to each named
    // camera. Sequential, non-transactional (matches this codebase's own
    // established convention for lower-criticality auxiliary rows — see
    // EPIC_7_FIX_REPORT.md); a failure here leaves an active but
    // unlinked/under-linked key, which camera-heartbeat's own binding check
    // then safely rejects rather than silently over-trusting.
    if (body.cameraIds && body.cameraIds.length > 0) {
      const { error: linkErr } = await admin
        .schema('media')
        .from('camera_service_account_links')
        .insert(body.cameraIds.map((cameraId) => ({ camera_id: cameraId, service_account_id: account.id, tenant_id: caller.tenantId })));
      if (linkErr) throw linkErr;
    }

    await admin.rpc('write_audit_log', {
      p_tenant_id: caller.tenantId,
      p_actor_type: 'staff',
      p_actor_id: caller.userId,
      p_action: 'issued_service_account_key',
      p_target_type: 'service_accounts',
      p_target_id: account.id,
    });

    // The raw key is returned exactly once, here, and never again (§10.7).
    return new Response(
      JSON.stringify({ serviceAccountId: account.id, apiKey: rawKey, name: account.name, purpose: account.purpose, scopes: account.scopes, cameraIds: body.cameraIds ?? [] }),
      { status: 201, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
