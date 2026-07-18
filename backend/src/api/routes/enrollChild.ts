import { enrollChildSchema } from '../../validation/academic.schema.js';
import { AppError } from '../../lib/errors.js';
import type { ChildEnrollmentService, EnrollChildResult } from '../../services/childEnrollmentService.js';
import type { CallerContext } from '../../types/domain.js';

export async function enrollChildRoute(
  service: ChildEnrollmentService,
  caller: CallerContext,
  rawBody: unknown,
): Promise<EnrollChildResult> {
  if (caller.role !== 'manager' || !caller.tenantId) {
    throw new AppError('PERM_ROLE_DENIED', 'Only a manager can enroll a child.', 'فقط المدير يمكنه تسجيل طفل.');
  }

  const parsed = enrollChildSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', parsed.error.issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
  }

  return service.enroll(parsed.data, caller.tenantId, caller.userId);
}
