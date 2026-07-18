// FeeItemService — testable core behind billing.fee_items CRUD (§14.2 "no
// bespoke API for straightforward CRUD"). Defense-in-depth role checks
// matching the RLS policy's own (§28 convention).
import { AppError } from '../lib/errors.js';
import type { FeeItemRepository } from '../repositories/feeItemRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { FeeItem } from '../types/domain.epic6.js';
import type { CreateFeeItemInput } from '../validation/billing.schema.js';

export class FeeItemService {
  constructor(private readonly feeItems: FeeItemRepository) {}

  async listForTenant(caller: CallerContext): Promise<FeeItem[]> {
    if (caller.role !== 'guardian' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view fee items.', 'غير مصرح لك بعرض بنود الرسوم.');
    }
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'A tenant context is required.', 'يلزم سياق مؤسسة.');
    }
    return this.feeItems.listForTenant(caller.tenantId);
  }

  async create(input: CreateFeeItemInput, caller: CallerContext): Promise<FeeItem> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can create a fee item.', 'فقط المدير يمكنه إنشاء بند رسوم.');
    }
    return this.feeItems.create(input, caller.tenantId);
  }
}
