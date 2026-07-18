import { addBusSchema } from '../../validation/transport.schema.js';
import { AppError } from '../../lib/errors.js';
import type { AddBusService, AddBusResult } from '../../services/addBusService.js';
import type { CallerContext } from '../../types/domain.js';

export async function addBusRoute(service: AddBusService, caller: CallerContext, rawBody: unknown): Promise<AddBusResult> {
  if (caller.role !== 'manager' || !caller.tenantId) {
    throw new AppError('PERM_ROLE_DENIED', 'Only a manager can add a bus.', 'فقط المدير يمكنه إضافة حافلة.');
  }

  const parsed = addBusSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', parsed.error.issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
  }

  return service.add(parsed.data, caller.tenantId, caller.userId);
}
