// reactivate-staff-account — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §14.2
// Caller: manager, own tenant only. Reverses suspend-staff-account; does NOT
// touch sessions (there are none to restore — the account simply becomes
// usable again on next login).
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

interface Body {
  staffId: string;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    requireRole(caller, ['manager']);

    const body = (await req.json()) as Partial<Body>;
    if (!body.staffId) throw new AppError('VALIDATION_FAILED', 'staffId is required', 'staffId مطلوب');

    const admin = supabaseAdmin();

    const { data: staff, error: staffErr } = await admin
      .schema('identity')
      .from('staff_profiles')
      .select('id, tenant_id, employment_status, name')
      .eq('id', body.staffId)
      .is('deleted_at', null)
      .single();

    if (staffErr || !staff) {
      throw new AppError('NOT_FOUND', 'Staff member not found.', 'لم يتم العثور على الموظف.');
    }
    if (staff.tenant_id !== caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'This staff member does not belong to your tenant.', 'هذا الموظف لا ينتمي إلى مؤسستك.');
    }
    if (staff.employment_status !== 'terminated') {
      throw new AppError('STATE_ACCOUNT_NOT_SUSPENDED', 'This account is not currently suspended.', 'هذا الحساب غير معلّق حاليًا.');
    }

    const { error: updateErr } = await admin
      .schema('identity')
      .from('staff_profiles')
      .update({ employment_status: 'active' })
      .eq('id', staff.id);
    if (updateErr) throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to update account status.', 'فشل تحديث حالة الحساب.');

    await admin.rpc('write_audit_log', {
      p_tenant_id: staff.tenant_id,
      p_actor_type: 'staff',
      p_actor_id: caller.userId,
      p_action: 'reactivated_staff_account',
      p_target_type: 'staff_profiles',
      p_target_id: staff.id,
    });

    return new Response(JSON.stringify({ id: staff.id, name: staff.name, employmentStatus: 'active' }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
