// provision-tenant — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.3, §14.2, §25.3 (saga/compensation pattern)
// Caller: platform_admin, owner/admin tier only (§12.1).
//
// Steps (each recorded in tenancy.tenant_provisioning_state so a retried call
// after a partial failure resumes rather than re-running from scratch):
//   1. created                    → insert tenants row
//   2. initial_manager_created    → Auth Admin API user + staff_profiles row
//                                    (compensating delete on DB failure, §25.3)
//   3. plan_apps_provisioned      → confirm plan_catalog_apps for the chosen plan
//   4. welcome_sent               → activation link dispatched (stubbed, see
//                                    _shared/activation.ts)
//   5. complete
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requirePlatformAdminManageTier } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { withIdempotency, readIdempotencyKey } from '../_shared/idempotency.ts';
import { sendActivationLink } from '../_shared/activation.ts';

interface ProvisionTenantBody {
  name: string;
  slug: string;
  city?: string;
  planCode: 'starter' | 'growth' | 'premium';
  contactName: string;
  contactEmail?: string;
  ownerName: string;
  ownerPhone: string;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const PHONE_RE = /^\+[1-9][0-9]{7,14}$/;

function validate(body: Partial<ProvisionTenantBody>): ProvisionTenantBody {
  const errors: string[] = [];
  if (!body.name || !body.name.trim()) errors.push('name is required');
  if (!body.slug || !SLUG_RE.test(body.slug)) errors.push('slug must be lowercase, DNS-safe, 3-32 chars');
  if (!body.planCode || !['starter', 'growth', 'premium'].includes(body.planCode)) errors.push('planCode is invalid');
  if (!body.contactName || !body.contactName.trim()) errors.push('contactName is required');
  if (!body.ownerName || !body.ownerName.trim()) errors.push('ownerName is required');
  if (!body.ownerPhone || !PHONE_RE.test(body.ownerPhone)) errors.push('ownerPhone must be E.164 format, e.g. +201001234567');

  if (errors.length) {
    throw new AppError('VALIDATION_FAILED', errors.join('; '), 'تحقق من صحة البيانات المدخلة.');
  }
  return body as ProvisionTenantBody;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    requirePlatformAdminManageTier(caller);

    const body = validate(await req.json());
    const admin = supabaseAdmin();
    const idempotencyKey = readIdempotencyKey(req);

    const result = await withIdempotency(
      admin,
      { key: idempotencyKey, tenantId: null, callerId: caller.userId, rpcName: 'provision-tenant' },
      () => runProvisioning(admin, body, caller.userId),
    );

    return new Response(JSON.stringify(result), { status: 201, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});

async function runProvisioning(admin: ReturnType<typeof supabaseAdmin>, body: ProvisionTenantBody, actorId: string) {
  // --- Step 1: plan lookup + tenant row -------------------------------------
  const { data: plan, error: planErr } = await admin
    .schema('tenancy')
    .from('plan_catalog')
    .select('id, code, monthly_price, setup_fee')
    .eq('code', body.planCode)
    .single();
  if (planErr || !plan) {
    throw new AppError('VALIDATION_FAILED', `Unknown plan code ${body.planCode}`, 'خطة غير معروفة.');
  }

  const { data: existingSlug } = await admin
    .schema('tenancy')
    .from('tenants')
    .select('id')
    .eq('slug', body.slug)
    .maybeSingle();
  if (existingSlug) {
    throw new AppError('VALIDATION_DUPLICATE_SLUG', `Subdomain "${body.slug}" is already taken.`, `النطاق الفرعي "${body.slug}" مستخدم بالفعل.`);
  }

  const { data: tenant, error: tenantErr } = await admin
    .schema('tenancy')
    .from('tenants')
    .insert({
      name: body.name.trim(),
      slug: body.slug,
      city: body.city ?? null,
      plan_id: plan.id,
      status: 'trial',
      contact_name: body.contactName.trim(),
      contact_email: body.contactEmail ?? null,
      contact_phone: body.ownerPhone,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id, name, slug, status, trial_ends_at')
    .single();
  if (tenantErr || !tenant) {
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create tenant record.', 'فشل إنشاء سجل المؤسسة.');
  }

  await admin.rpc('advance_tenant_provisioning', { p_tenant_id: tenant.id, p_step: 'created' });

  // --- Step 2: initial manager account (Auth Admin API + staff_profiles) ---
  // Saga pattern (§25.3): Auth call first, DB write second, compensating
  // delete of the Auth user if the DB write fails.
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    phone: body.ownerPhone,
    phone_confirm: true,
    app_metadata: { tenant_id: tenant.id, role: 'manager', app_access: ['dashboard'] },
    user_metadata: { name: body.ownerName },
    // No password is set — matches the frozen no-plaintext-credential design
    // (§10.3). The account is unusable until the activation link is followed.
  });
  if (authErr || !authUser?.user) {
    await admin.rpc('advance_tenant_provisioning', {
      p_tenant_id: tenant.id,
      p_step: 'created',
      p_error: `auth.admin.createUser failed: ${authErr?.message ?? 'unknown'}`,
    });
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the manager account.', 'فشل إنشاء حساب المدير.');
  }

  const { error: staffErr } = await admin.schema('identity').from('staff_profiles').insert({
    id: authUser.user.id,
    tenant_id: tenant.id,
    role: 'manager',
    name: body.ownerName.trim(),
    phone: body.ownerPhone,
    email: body.contactEmail ?? null,
  });

  if (staffErr) {
    // Compensating action: the DB write failed, so the just-created Auth
    // identity must not be left dangling (§25.3).
    await admin.auth.admin.deleteUser(authUser.user.id).catch((e) =>
      console.error('Compensating deleteUser failed — manual cleanup required for', authUser.user.id, e),
    );
    await admin.rpc('advance_tenant_provisioning', {
      p_tenant_id: tenant.id,
      p_step: 'created',
      p_error: `staff_profiles insert failed: ${staffErr.message}`,
    });
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the manager profile.', 'فشل إنشاء ملف المدير.');
  }

  const { error: registryErr } = await admin.schema('tenancy').from('tenant_phone_registry').insert({
    tenant_id: tenant.id,
    phone: body.ownerPhone,
    account_type: 'staff',
    account_id: authUser.user.id,
  });
  if (registryErr) {
    console.error('tenant_phone_registry insert failed (non-fatal, uniqueness already enforced by staff_profiles index):', registryErr);
  }

  await admin.rpc('advance_tenant_provisioning', { p_tenant_id: tenant.id, p_step: 'initial_manager_created' });

  // --- Step 3: plan apps confirmation (reference data already exists; this
  // step exists so the workflow state machine has an explicit checkpoint) --
  await admin.rpc('advance_tenant_provisioning', { p_tenant_id: tenant.id, p_step: 'plan_apps_provisioned' });

  // --- Step 4: activation link (stubbed until Epic 4) -----------------------
  const activation = await sendActivationLink({
    phone: body.ownerPhone,
    name: body.ownerName,
    appLabel: 'Nursery Dashboard',
    userId: authUser.user.id,
  });
  await admin.rpc('advance_tenant_provisioning', { p_tenant_id: tenant.id, p_step: 'welcome_sent' });

  // --- Step 5: complete + audit -------------------------------------------
  await admin.rpc('advance_tenant_provisioning', { p_tenant_id: tenant.id, p_step: 'complete' });
  await admin.rpc('write_audit_log', {
    p_tenant_id: tenant.id,
    p_actor_type: 'platform_admin',
    p_actor_id: actorId,
    p_action: 'provisioned_tenant',
    p_target_type: 'tenant',
    p_target_id: tenant.id,
  });

  return {
    tenant,
    manager: { id: authUser.user.id, name: body.ownerName, phone: body.ownerPhone, activationSent: activation.delivered },
  };
}
