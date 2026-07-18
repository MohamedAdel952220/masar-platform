// revoke-service-account-key — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.7, §14.2; BACKEND_EXECUTION_PLAN.md Epic 7 §7
// Caller: manager, own tenant only.
//
// Atomic guarded UPDATE...WHERE + a follow-up exists() check to disambiguate
// NOT_FOUND vs. STATE_ALREADY_PROCESSED — the "M1 pattern" established
// since Epic 2 (see e.g. EPIC_6's mark_installment_paid_manual). Once
// revoked, camera-heartbeat's own status='active' check rejects the very
// next heartbeat that presents this key (§19 Acceptance Criteria: "A
// revoked service-account key immediately stops being accepted by
// camera-heartbeat").
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

interface Body {
  serviceAccountId: string;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const body = (await req.json()) as Partial<Body>;
    if (!body.serviceAccountId || !uuidRe.test(body.serviceAccountId)) {
      throw new AppError('VALIDATION_FAILED', 'serviceAccountId must be a valid UUID', 'يجب أن يكون serviceAccountId معرّف UUID صحيحًا');
    }

    const admin = supabaseAdmin();

    const { data: account, error: updateErr } = await admin
      .schema('identity')
      .from('service_accounts')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', body.serviceAccountId)
      .eq('tenant_id', caller.tenantId)
      .eq('status', 'active')
      .select('id, tenant_id, name, status, revoked_at')
      .maybeSingle();
    if (updateErr) throw updateErr;

    if (!account) {
      const { data: existing, error: existingErr } = await admin
        .schema('identity')
        .from('service_accounts')
        .select('id')
        .eq('id', body.serviceAccountId)
        .eq('tenant_id', caller.tenantId)
        .maybeSingle();
      if (existingErr) throw existingErr;

      if (!existing) {
        throw new AppError('NOT_FOUND', 'Service account not found for this tenant.', 'لم يتم العثور على حساب الخدمة لهذه المؤسسة.');
      }
      throw new AppError('STATE_ALREADY_PROCESSED', 'This service-account key has already been revoked.', 'تم إلغاء مفتاح حساب الخدمة هذا بالفعل.');
    }

    await admin.rpc('write_audit_log', {
      p_tenant_id: caller.tenantId,
      p_actor_type: 'staff',
      p_actor_id: caller.userId,
      p_action: 'revoked_service_account_key',
      p_target_type: 'service_accounts',
      p_target_id: account.id,
    });

    return new Response(JSON.stringify({ serviceAccountId: account.id, name: account.name, revoked: true }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
