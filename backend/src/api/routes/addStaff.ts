import { addStaffSchema } from '../../validation/staff.schema.js';
import { AppError } from '../../lib/errors.js';
import type { AddStaffService, AddStaffResult } from '../../services/addStaffService.js';
import type { CallerContext } from '../../types/domain.js';

export async function addStaffRoute(service: AddStaffService, caller: CallerContext, rawBody: unknown): Promise<AddStaffResult> {
  if (caller.role !== 'manager' || !caller.tenantId) {
    throw new AppError('PERM_ROLE_DENIED', 'Only a manager can add a staff member.', 'فقط المدير يمكنه إضافة موظف.');
  }

  // tenantId is taken from the caller's own JWT claim, never trusted from
  // the request body (§13.2) — merged in here rather than accepted as input.
  const parsed = addStaffSchema.safeParse({ ...(rawBody as Record<string, unknown>), tenantId: caller.tenantId });
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', parsed.error.issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
  }

  return service.add(parsed.data, caller.userId);
}
