// enroll-child — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.3, §14.2, §25.3 (saga/compensation pattern)
// Caller: manager, own tenant only.
//
// Steps:
//   1. Look up an existing guardian by phone in this tenant (sibling case —
//      §5's guardian-identity-collision risk, EPIC_2_ARCHITECTURE_REVIEW.md
//      §13: check tenant_phone_registry FIRST, never insert-then-catch).
//   2. If none exists: Auth Admin API guardian user (no password) + DB row +
//      phone registry (saga pattern §25.3 — compensating delete on DB
//      failure, mirroring provision-tenant exactly).
//   3. Capacity-locked child insert + guardian link, ATOMICALLY, via the
//      enroll_child_with_guardian RPC (fix for EPIC_2_REVIEW.md C3 — see
//      that RPC's comment in migration 7 for the full failure-mode analysis
//      this replaced).
//   4. Activation link — only dispatched for a NEWLY created guardian; an
//      existing (sibling) guardian already has a usable account.
//
// Note: if step 3 fails (e.g. classroom at capacity) after a NEW guardian
// was created in steps 1-2, the guardian account is intentionally left in
// place rather than compensated away — it is a valid, activatable account on
// its own, and a retried enrollment call will find it via the phone lookup
// in step 1 instead of creating a duplicate. This is a deliberate, narrower
// compensation boundary than provision-tenant's (which compensates the
// Auth user because a tenant with no manager is meaningless; a guardian
// account with no child yet is not). Step 3 itself, however, is now a single
// atomic RPC call, so ITS internal two writes (child + link) can no longer
// partially fail against each other.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { withIdempotency, readIdempotencyKey } from '../_shared/idempotency.ts';
import { sendActivationLink } from '../_shared/activation.ts';
import { toAppError } from '../_shared/rpcError.ts';
import { z } from 'https://esm.sh/zod@3.23.8';

// Fix for EPIC_2_REVIEW.md M3: this schema now mirrors
// src/validation/academic.schema.ts's childFieldsSchema/guardianFieldsSchema
// field-for-field (same ranges, same length caps), using the same zod
// library (imported here via esm.sh rather than duplicated hand-rolled
// checks) — closing the validation-drift gap where this Edge Function (the
// actual deployed runtime) enforced measurably less than its parallel
// Node/testable schema (no address lat/lng range checks, no length caps).
const phoneSchema = z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'must be in E.164 format, e.g. +201001234567');

const childFieldsSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  nameAr: z.string().trim().max(200).optional(),
  dob: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'dob must be a valid date'),
  gender: z.enum(['male', 'female']),
  bloodType: z.string().trim().max(10).optional(),
  allergies: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  package: z.enum(['full_day', 'half_day']),
  addressLine: z.string().trim().max(300).optional(),
  building: z.string().trim().max(100).optional(),
  area: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  addressLat: z.number().min(-90).max(90).optional(),
  addressLng: z.number().min(-180).max(180).optional(),
  emergencyContactName: z.string().trim().max(200).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  emergencyContactRelation: z.string().trim().max(100).optional(),
  fatherName: z.string().trim().max(200).optional(),
  fatherPhone: z.string().trim().max(30).optional(),
  fatherJob: z.string().trim().max(200).optional(),
  fatherNationalId: z.string().trim().max(20).optional(),
  motherName: z.string().trim().max(200).optional(),
  motherPhone: z.string().trim().max(30).optional(),
  motherJob: z.string().trim().max(200).optional(),
  motherNationalId: z.string().trim().max(20).optional(),
});

const guardianFieldsSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  phone: phoneSchema,
  email: z.string().email().optional(),
  relation: z.enum(['father', 'mother', 'guardian']),
});

const enrollChildBodySchema = z.object({
  classroomId: z.string().uuid(),
  child: childFieldsSchema,
  guardian: guardianFieldsSchema,
});

type EnrollChildBody = z.infer<typeof enrollChildBodySchema>;

function validate(body: unknown): EnrollChildBody {
  const parsed = enrollChildBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new AppError('VALIDATION_FAILED', message, 'تحقق من صحة البيانات المدخلة.');
  }
  return parsed.data;
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
      { key: idempotencyKey, tenantId: caller.tenantId, callerId: caller.userId, rpcName: 'enroll-child' },
      () => runEnrollChild(admin, body, caller.tenantId as string, caller.userId),
    );

    return new Response(JSON.stringify(result), { status: 201, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});

async function runEnrollChild(admin: ReturnType<typeof supabaseAdmin>, body: EnrollChildBody, tenantId: string, actorId: string) {
  // --- Step 1: existing-guardian lookup (sibling case) — check FIRST, never
  // insert-then-catch (EPIC_2_ARCHITECTURE_REVIEW.md §13). -------------------
  const { data: existingPhoneRow } = await admin
    .schema('tenancy')
    .from('tenant_phone_registry')
    .select('account_id, account_type')
    .eq('tenant_id', tenantId)
    .eq('phone', body.guardian.phone)
    .maybeSingle();

  let guardianId: string;
  let guardianIsNew = false;

  if (existingPhoneRow) {
    if (existingPhoneRow.account_type !== 'guardian') {
      throw new AppError(
        'VALIDATION_DUPLICATE_PHONE',
        'This phone number is already registered to a non-guardian account in your tenant.',
        'رقم الهاتف هذا مسجّل بالفعل لحساب من نوع آخر في مؤسستك.',
      );
    }
    guardianId = existingPhoneRow.account_id;
  } else {
    // --- Step 2: new guardian — saga pattern (§25.3), same shape as
    // provision-tenant's manager-creation step. ------------------------------
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      phone: body.guardian.phone,
      phone_confirm: true,
      app_metadata: { tenant_id: tenantId, role: 'guardian', app_access: ['parent'] },
      user_metadata: { name: body.guardian.name },
      // No password is set — matches the frozen no-plaintext-credential design (§10.3).
    });
    if (authErr || !authUser?.user) {
      throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the guardian account.', 'فشل إنشاء حساب ولي الأمر.');
    }

    const { error: guardianErr } = await admin.schema('identity').from('guardian_profiles').insert({
      id: authUser.user.id,
      tenant_id: tenantId,
      name: body.guardian.name.trim(),
      phone: body.guardian.phone,
      email: body.guardian.email ?? null,
      created_by: actorId,
    });

    if (guardianErr) {
      await admin.auth.admin.deleteUser(authUser.user.id).catch((e) =>
        console.error('Compensating deleteUser failed — manual cleanup required for', authUser.user.id, e),
      );
      throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the guardian profile.', 'فشل إنشاء ملف ولي الأمر.');
    }

    const { error: registryErr } = await admin.schema('tenancy').from('tenant_phone_registry').insert({
      tenant_id: tenantId,
      phone: body.guardian.phone,
      account_type: 'guardian',
      account_id: authUser.user.id,
    });
    if (registryErr) {
      console.error('tenant_phone_registry insert failed (non-fatal, uniqueness already enforced by guardian_profiles index):', registryErr);
    }

    guardianId = authUser.user.id;
    guardianIsNew = true;
  }

  // --- Step 3: capacity-locked child insert + guardian link, ATOMICALLY
  // (fix for EPIC_2_REVIEW.md C3 — see migration 7's enroll_child_with_guardian
  // comment). Error mapping now goes through toAppError (fix for M4) instead
  // of fragile substring matching on the raw exception message. -------------
  const { data: child, error: childErr } = await admin.rpc('enroll_child_with_guardian', {
    p_tenant_id: tenantId,
    p_classroom_id: body.classroomId,
    p_child: body.child,
    p_created_by: actorId,
    p_guardian_id: guardianId,
    p_relation: body.guardian.relation,
    p_is_primary_contact: true,
  });
  if (childErr) {
    throw toAppError(childErr, 'Failed to enroll the child.', 'فشل تسجيل الطفل.');
  }

  // --- Step 4: activation link (new guardians only) ---------------------------
  let activationSent = false;
  if (guardianIsNew) {
    const activation = await sendActivationLink({
      phone: body.guardian.phone,
      name: body.guardian.name,
      appLabel: 'Parent App',
      userId: guardianId,
    });
    activationSent = activation.delivered;
  }

  // Fix for EPIC_2_REVIEW.md L3: the audit-log write's result is now
  // checked. A failure is non-fatal (the enrollment itself already
  // succeeded and must not be rolled back over a logging write, matching
  // §23's own "must never be allowed to corrupt the audit trail with a
  // partial write" framing) but is no longer silently swallowed.
  const { error: auditErr } = await admin.rpc('write_audit_log', {
    p_tenant_id: tenantId,
    p_actor_type: 'staff',
    p_actor_id: actorId,
    p_action: 'enrolled_child',
    p_target_type: 'children',
    p_target_id: child.id,
  });
  if (auditErr) {
    console.error('write_audit_log failed for enrolled_child (non-fatal — enrollment already succeeded):', auditErr);
  }

  return {
    child,
    guardian: { id: guardianId, name: body.guardian.name, phone: body.guardian.phone, isNew: guardianIsNew, activationSent },
  };
}
