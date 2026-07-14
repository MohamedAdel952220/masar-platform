// API handlers for suspend / reactivate / revoke-sessions — mirrors the
// three corresponding Edge Functions (§14.2).
import { suspendStaffSchema, reactivateStaffSchema, revokeSessionsSchema } from '../../validation/staff.schema.js';
import { AppError } from '../../lib/errors.js';
import type { StaffAccountService } from '../../services/staffAccountService.js';
import type { CallerContext } from '../../types/domain.js';

export async function suspendStaffAccountRoute(service: StaffAccountService, caller: CallerContext, rawBody: unknown): Promise<{ ok: true }> {
  const parsed = suspendStaffSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', parsed.error.issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
  }
  await service.suspend(parsed.data.staffId, caller, parsed.data.reason);
  return { ok: true };
}

export async function reactivateStaffAccountRoute(service: StaffAccountService, caller: CallerContext, rawBody: unknown): Promise<{ ok: true }> {
  const parsed = reactivateStaffSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', parsed.error.issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
  }
  await service.reactivate(parsed.data.staffId, caller);
  return { ok: true };
}

export async function revokeSessionsRoute(
  service: StaffAccountService,
  caller: CallerContext,
  rawBody: unknown,
  resolveTargetTenantId: (userId: string) => Promise<string | null>,
): Promise<{ ok: true }> {
  const parsed = revokeSessionsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', parsed.error.issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
  }
  const targetTenantId = await resolveTargetTenantId(parsed.data.userId);
  await service.revokeSessions(parsed.data.userId, targetTenantId, caller);
  return { ok: true };
}
