// regenerate-activation-link — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.3, §14.2
// Reissues a one-time activation/set-password link (e.g. the original
// expired, or the message was lost) — same no-plaintext-credential pattern
// as provision-tenant. Caller: manager (own tenant) or platform_admin (any).
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendActivationLink } from '../_shared/activation.ts';

interface Body {
  userId: string;
}

async function findTarget(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const tables: Array<{ table: 'staff_profiles' | 'guardian_profiles' | 'driver_profiles'; appLabel: string }> = [
    { table: 'staff_profiles', appLabel: 'Staff App' },
    { table: 'guardian_profiles', appLabel: 'Parent App' },
    { table: 'driver_profiles', appLabel: 'Driver App' },
  ];
  for (const { table, appLabel } of tables) {
    const { data } = await admin.schema('identity').from(table).select('id, tenant_id, name, phone').eq('id', userId).is('deleted_at', null).maybeSingle();
    if (data) return { table, appLabel, tenantId: data.tenant_id as string, name: data.name as string, phone: data.phone as string };
  }
  return null;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    const body = (await req.json()) as Partial<Body>;
    if (!body.userId) throw new AppError('VALIDATION_FAILED', 'userId is required', 'userId مطلوب');

    const admin = supabaseAdmin();
    const target = await findTarget(admin, body.userId);
    if (!target) throw new AppError('NOT_FOUND', 'Account not found.', 'لم يتم العثور على الحساب.');

    const isPlatformAdminCaller = caller.role === 'platform_admin';
    const isManagerOwnTenant = caller.role === 'manager' && target.tenantId === caller.tenantId;
    if (!isPlatformAdminCaller && !isManagerOwnTenant) {
      throw new AppError('PERM_ROLE_DENIED', 'You do not have permission to regenerate this activation link.', 'لا تملك صلاحية إعادة إرسال رابط التفعيل.');
    }

    const activation = await sendActivationLink({
      phone: target.phone,
      name: target.name,
      appLabel: target.appLabel,
      userId: target.id,
    });

    await admin.rpc('write_audit_log', {
      p_tenant_id: target.tenantId,
      p_actor_type: isPlatformAdminCaller ? 'platform_admin' : 'staff',
      p_actor_id: caller.userId,
      p_action: 'regenerated_activation_link',
      p_target_type: target.table,
      p_target_id: target.id,
    });

    return new Response(JSON.stringify({ userId: target.id, name: target.name, activationSent: activation.delivered }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
