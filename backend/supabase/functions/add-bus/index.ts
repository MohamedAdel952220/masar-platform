// add-bus — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.3, §14.2, §25.3 (saga/compensation pattern)
// Caller: manager, own tenant only.
//
// Direct extension of add-staff's proven saga pattern (Epic 2), generalized
// to identity.driver_profiles + transport.buses. Same no-plaintext-
// credential pattern (§10.3): no password is ever set or returned, an
// activation link is dispatched to the new driver's own phone. Unlike
// enroll-child (EPIC_2_REVIEW.md C3), there is no second write to
// atomically compose after the Auth step — create_bus_with_driver_row
// (migration 6) sets driver_id in the same INSERT as the bus row, so the DB
// half of this saga is atomic by construction.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { withIdempotency, readIdempotencyKey } from '../_shared/idempotency.ts';
import { sendActivationLink } from '../_shared/activation.ts';

interface AddBusBody {
  number: string;
  plate: string;
  capacity: number;
  serviceArea?: string;
  driver: {
    name: string;
    nameAr?: string;
    phone: string;
    nationalId?: string;
  };
}

const PHONE_RE = /^\+[1-9][0-9]{7,14}$/;

function validate(body: Partial<AddBusBody>): AddBusBody {
  const errors: string[] = [];
  if (!body.number || !body.number.trim()) errors.push('number is required');
  if (body.number && body.number.trim().length > 50) errors.push('number must be at most 50 characters');
  if (!body.plate || !body.plate.trim()) errors.push('plate is required');
  if (body.plate && body.plate.trim().length > 50) errors.push('plate must be at most 50 characters');
  if (!Number.isInteger(body.capacity) || (body.capacity as number) <= 0) errors.push('capacity must be a positive integer');
  if (body.serviceArea && body.serviceArea.trim().length > 200) errors.push('serviceArea must be at most 200 characters');

  const driver = body.driver ?? ({} as AddBusBody['driver']);
  if (!driver.name || !driver.name.trim()) errors.push('driver.name is required');
  if (driver.name && driver.name.trim().length > 200) errors.push('driver.name must be at most 200 characters');
  if (!driver.phone || !PHONE_RE.test(driver.phone)) errors.push('driver.phone must be E.164 format, e.g. +201001234567');
  if (driver.nationalId && driver.nationalId.trim().length > 20) errors.push('driver.nationalId must be at most 20 characters');
  if (driver.nameAr && driver.nameAr.trim().length > 200) errors.push('driver.nameAr must be at most 200 characters');

  if (errors.length) {
    throw new AppError('VALIDATION_FAILED', errors.join('; '), 'تحقق من صحة البيانات المدخلة.');
  }
  return body as AddBusBody;
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
      { key: idempotencyKey, tenantId: caller.tenantId, callerId: caller.userId, rpcName: 'add-bus' },
      () => runAddBus(admin, body, caller.tenantId as string, caller.userId),
    );

    return new Response(JSON.stringify(result), { status: 201, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});

async function runAddBus(admin: ReturnType<typeof supabaseAdmin>, body: AddBusBody, tenantId: string, actorId: string) {
  const { data: existingPhone } = await admin
    .schema('tenancy')
    .from('tenant_phone_registry')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', body.driver.phone)
    .maybeSingle();
  if (existingPhone) {
    throw new AppError('VALIDATION_DUPLICATE_PHONE', 'This phone number is already registered in your tenant.', 'رقم الهاتف هذا مسجّل بالفعل في مؤسستك.');
  }

  // Saga pattern (§25.3): Auth call first, DB write second, compensating
  // delete of the Auth user if the DB write fails.
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    phone: body.driver.phone,
    phone_confirm: true,
    app_metadata: { tenant_id: tenantId, role: 'driver', app_access: ['driver'] },
    user_metadata: { name: body.driver.name },
    // No password is set — matches the frozen no-plaintext-credential design (§10.3).
  });
  if (authErr || !authUser?.user) {
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the driver account.', 'فشل إنشاء حساب السائق.');
  }

  const { error: driverErr } = await admin.schema('identity').from('driver_profiles').insert({
    id: authUser.user.id,
    tenant_id: tenantId,
    name: body.driver.name,
    name_ar: body.driver.nameAr ?? null,
    phone: body.driver.phone,
    national_id: body.driver.nationalId ?? null,
    created_by: actorId,
  });

  if (driverErr) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch((e) =>
      console.error('Compensating deleteUser failed — manual cleanup required for', authUser.user.id, e),
    );
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the driver profile.', 'فشل إنشاء ملف السائق.');
  }

  // create_bus_with_driver_row (migration 6) sets driver_id in the same
  // INSERT as the bus row — atomic by construction, no separate "link" RPC
  // needed (unlike enroll_child_with_guardian's two-write composition).
  const { data: bus, error: busErr } = await admin.rpc('create_bus_with_driver_row', {
    p_tenant_id: tenantId,
    p_number: body.number,
    p_plate: body.plate,
    p_capacity: body.capacity,
    p_service_area: body.serviceArea ?? null,
    p_driver_id: authUser.user.id,
  });

  if (busErr) {
    // Fix for EPIC_3_REVIEW.md H4: identity.driver_profiles.id references
    // auth.users(id) ON DELETE RESTRICT (Epic 1) — calling deleteUser
    // before removing the just-created driver_profiles row made this
    // compensation fail every time (caught by a bare .catch() that only
    // logged, never surfaced), leaving an orphaned Auth user + driver
    // profile with no bus. Delete the driver_profiles row first, then the
    // Auth user, so the saga actually unwinds on this failure branch —
    // same two-step compensation order enroll-child's saga already gets
    // right for its own second-write failure case.
    const { error: cleanupErr } = await admin.schema('identity').from('driver_profiles').delete().eq('id', authUser.user.id);
    if (cleanupErr) {
      console.error('Compensating driver_profiles delete failed — manual cleanup required for', authUser.user.id, cleanupErr);
    } else {
      await admin.auth.admin.deleteUser(authUser.user.id).catch((e) =>
        console.error('Compensating deleteUser failed — manual cleanup required for', authUser.user.id, e),
      );
    }
    throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the bus.', 'فشل إنشاء الحافلة.');
  }

  const { error: registryErr } = await admin.schema('tenancy').from('tenant_phone_registry').insert({
    tenant_id: tenantId,
    phone: body.driver.phone,
    account_type: 'driver',
    account_id: authUser.user.id,
  });
  if (registryErr) {
    console.error('tenant_phone_registry insert failed (non-fatal, uniqueness already enforced by driver_profiles index):', registryErr);
  }

  const activation = await sendActivationLink({
    phone: body.driver.phone,
    name: body.driver.name,
    appLabel: 'Driver App',
    userId: authUser.user.id,
  });

  const { error: auditErr } = await admin.rpc('write_audit_log', {
    p_tenant_id: tenantId,
    p_actor_type: 'staff',
    p_actor_id: actorId,
    p_action: 'added_bus',
    p_target_type: 'buses',
    p_target_id: bus.id,
  });
  if (auditErr) {
    console.error('write_audit_log failed for added_bus (non-fatal — bus/driver already created):', auditErr);
  }

  return {
    bus,
    driver: { id: authUser.user.id, name: body.driver.name, phone: body.driver.phone, activationSent: activation.delivered },
  };
}
