// Caller-identity verification shared by every Edge Function (§14.3: "every
// Edge Function that wraps an RPC re-checks the caller's JWT itself before
// invoking service_role-level operations").
import { AppError } from './errors.ts';
import { supabaseAsCaller } from './supabaseAdmin.ts';

export interface CallerContext {
  userId: string;
  tenantId: string | null;
  role: string | null;
  platformAdminTier: 'owner' | 'admin' | 'support' | null;
}

export async function requireCaller(req: Request): Promise<CallerContext> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new AppError('AUTH_MISSING_TOKEN', 'You must be signed in.', 'يجب تسجيل الدخول أولاً.');
  }

  const client = supabaseAsCaller(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new AppError('AUTH_EXPIRED', 'Your session has expired. Please sign in again.', 'انتهت صلاحية جلستك. برجاء تسجيل الدخول مرة أخرى.');
  }

  const appMeta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const role = typeof appMeta.role === 'string' ? appMeta.role : null;
  const tenantId = typeof appMeta.tenant_id === 'string' ? appMeta.tenant_id : null;

  let platformAdminTier: CallerContext['platformAdminTier'] = null;
  if (role === 'platform_admin') {
    const { data: tierRow } = await client
      .from('platform_admins')
      .select('role')
      .eq('id', data.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    platformAdminTier = (tierRow?.role as CallerContext['platformAdminTier']) ?? null;
  }

  return { userId: data.user.id, tenantId, role, platformAdminTier };
}

export function requireRole(ctx: CallerContext, allowed: string[]): void {
  if (!ctx.role || !allowed.includes(ctx.role)) {
    throw new AppError('PERM_ROLE_DENIED', 'You do not have permission to perform this action.', 'لا تملك صلاحية القيام بهذا الإجراء.');
  }
}

export function requirePlatformAdminManageTier(ctx: CallerContext): void {
  if (ctx.role !== 'platform_admin' || (ctx.platformAdminTier !== 'owner' && ctx.platformAdminTier !== 'admin')) {
    throw new AppError('PERM_ROLE_DENIED', 'This action requires Owner or Admin access.', 'يتطلب هذا الإجراء صلاحية مالك أو مسؤول.');
  }
}

export function requireSameTenant(ctx: CallerContext, tenantId: string): void {
  if (ctx.tenantId !== tenantId) {
    throw new AppError('PERM_TENANT_MISMATCH', 'This resource does not belong to your tenant.', 'هذا المورد لا ينتمي إلى مؤسستك.');
  }
}
