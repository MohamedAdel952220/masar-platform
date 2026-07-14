// revoke-sessions — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §10.6, §14.2
// Standalone forced-logout, independent of suspension (e.g. suspected
// compromised device). Caller: manager (own tenant staff/drivers/guardians)
// or platform_admin (any identity, any tenant).
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

interface Body {
  userId: string;
}

type TargetTable = 'staff_profiles' | 'guardian_profiles' | 'driver_profiles' | 'platform_admins';

async function findTarget(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const tables: TargetTable[] = ['staff_profiles', 'guardian_profiles', 'driver_profiles'];
  for (const table of tables) {
    const { data } = await admin.schema('identity').from(table).select('id, tenant_id, name').eq('id', userId).is('deleted_at', null).maybeSingle();
    if (data) return { table, tenantId: data.tenant_id as string, name: data.name as string };
  }
  const { data: pa } = await admin.schema('identity').from('platform_admins').select('id, name').eq('id', userId).is('deleted_at', null).maybeSingle();
  if (pa) return { table: 'platform_admins' as TargetTable, tenantId: null, name: pa.name as string };
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
      throw new AppError('PERM_ROLE_DENIED', 'You do not have permission to revoke this account\'s sessions.', 'لا تملك صلاحية إلغاء جلسات هذا الحساب.');
    }

    const { error: signOutErr } = await admin.auth.admin.signOut(body.userId, 'global');
    if (signOutErr) {
      throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to revoke sessions.', 'فشل إلغاء الجلسات.');
    }

    await admin.rpc('write_audit_log', {
      p_tenant_id: target.tenantId,
      p_actor_type: isPlatformAdminCaller ? 'platform_admin' : 'staff',
      p_actor_id: caller.userId,
      p_action: 'revoked_sessions',
      p_target_type: target.table,
      p_target_id: body.userId,
    });

    return new Response(JSON.stringify({ userId: body.userId, name: target.name, revoked: true }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
