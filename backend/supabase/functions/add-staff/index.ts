// add-staff — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.3, §14.2, §25.3 (saga/compensation pattern)
// Caller: manager, own tenant only.
//
// Direct extension of provision-tenant's already-proven manager-creation
// step (Epic 1), generalized to role teacher|reception. Same no-plaintext-
// credential pattern (§10.3): no password is ever set or returned, an
// activation link is dispatched to the new staff member's own phone.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { withIdempotency, readIdempotencyKey } from '../_shared/idempotency.ts';
import { sendActivationLink } from '../_shared/activation.ts';

interface AddStaffBody {
  role: 'teacher' | 'reception';
  name: string;
  nameAr?: string;
  phone: string;
  email?: string;
  nationalId?: string;
}

const PHONE_RE = /^\+[1-9][0-9]{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fix for EPIC_2_REVIEW.md M3 (validation-drift consistency pass): email and
// nationalId, when supplied, are now format/length-checked instead of
// passing through unvalidated — matching the rigor already applied to the
// required fields below.
function validate(body: Partial<AddStaffBody>): AddStaffBody {
  const errors: string[] = [];
  if (!body.role || !['teacher', 'reception'].includes(body.role)) errors.push('role must be teacher or reception');
  if (!body.name || !body.name.trim()) errors.push('name is required');
  if (body.name && body.name.trim().length > 200) errors.push('name must be at most 200 characters');
  if (!body.phone || !PHONE_RE.test(body.phone)) errors.push('phone must be E.164 format, e.g. +201001234567');
  if (body.email && !EMAIL_RE.test(body.email)) errors.push('email must be a valid email address');
  if (body.nationalId && body.nationalId.trim().length > 20) errors.push('nationalId must be at most 20 characters');
  if (body.nameAr && body.nameAr.trim().length > 200) errors.push('nameAr must be at most 200 characters');

  if (errors.length) {
    throw new AppError('VALIDATION_FAILED', errors.join('; '), 'تحقق من صحة البيانات المدخلة.');
  }
  return body as AddStaffBody;
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
    const idempotencyKey = readIdempotencyKey(req);

    const result = await withIdempotency(
      admin,
      { key: idempotencyKey, tenantId: caller.tenantId, callerId: caller.userId, rpcName: 'add-staff' },
      () => runAddStaff(admin, body, caller.tenantId as string, caller.userId),
    );

    return new Response(JSON.stringify(result), { status: 201, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});

async function runAddStaff(admin: ReturnType<typeof supabaseAdmin>, body: AddStaffBody, tenantId: string, actorId: string) {
  const { data: existingPhone } = await admin
    .schema('tenancy')
    .from('tenant_phone_registry')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', body.phone)
    .maybeSingle();
  if (existingPhone) {
    throw new AppError('VALIDATION_DUPLICATE_PHONE', 'This phone number is already registered in your tenant.', 'رقم الهاتف هذا مسجّل بالفعل في مؤسستك.');
  }

  // Saga pattern (§25.3): Auth call first, DB write second, compensating
  // delete of the Auth user if the DB write fails.
  const appAccess = body.role === 'teacher' ? ['teacher'] : ['reception'];
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    phone: body.phone,
    phone_confirm: true,
    app_metadata: { tenant_id: tenantId, role: body.role, app_access: appAccess },
    user_metadata: { name: body.name },
    // No password is set — matches the frozen no-plaintext-credential design (§10.3).
  });
  if (authErr || !authUser?.user) {
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the staff account.', 'فشل إنشاء حساب الموظف.');
  }

  const { error: staffErr } = await admin.schema('identity').from('staff_profiles').insert({
    id: authUser.user.id,
    tenant_id: tenantId,
    role: body.role,
    name: body.name.trim(),
    name_ar: body.nameAr ?? null,
    phone: body.phone,
    email: body.email ?? null,
    national_id: body.nationalId ?? null,
    created_by: actorId,
  });

  if (staffErr) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch((e) =>
      console.error('Compensating deleteUser failed — manual cleanup required for', authUser.user.id, e),
    );
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the staff profile.', 'فشل إنشاء ملف الموظف.');
  }

  const { error: registryErr } = await admin.schema('tenancy').from('tenant_phone_registry').insert({
    tenant_id: tenantId,
    phone: body.phone,
    account_type: 'staff',
    account_id: authUser.user.id,
  });
  if (registryErr) {
    console.error('tenant_phone_registry insert failed (non-fatal, uniqueness already enforced by staff_profiles index):', registryErr);
  }

  const activation = await sendActivationLink({
    phone: body.phone,
    name: body.name,
    appLabel: body.role === 'teacher' ? 'Teacher App' : 'Reception App',
    userId: authUser.user.id,
  });

  // Fix for EPIC_2_REVIEW.md L3: audit-log write result is now checked
  // (non-fatal on failure — the staff account already exists and must not
  // be rolled back over a logging write — but no longer silent).
  const { error: auditErr } = await admin.rpc('write_audit_log', {
    p_tenant_id: tenantId,
    p_actor_type: 'staff',
    p_actor_id: actorId,
    p_action: 'added_staff',
    p_target_type: 'staff_profiles',
    p_target_id: authUser.user.id,
  });
  if (auditErr) {
    console.error('write_audit_log failed for added_staff (non-fatal — staff account already created):', auditErr);
  }

  return {
    staff: { id: authUser.user.id, role: body.role, name: body.name, phone: body.phone, activationSent: activation.delivered },
  };
}
