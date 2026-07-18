// BillingLedgerService — testable core behind billing_ledger_items reads
// and mark_installment_paid_manual (§14.2). Ownership (does this child
// belong to this guardian) is left to RLS, per EPIC_3_REVIEW.md M10's
// resolution (re-deriving it here would just replicate the identical
// RLS-filtered result).
import { AppError } from '../lib/errors.js';
import type { BillingLedgerRepository } from '../repositories/billingLedgerRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { BillingLedgerItem, InstallmentScheduleEntry } from '../types/domain.epic6.js';
import type { MarkInstallmentPaidManualInput, MarkLedgerItemPaidManualInput } from '../validation/billing.schema.js';

export class BillingLedgerService {
  constructor(private readonly ledger: BillingLedgerRepository) {}

  async listForChild(childId: string, caller: CallerContext): Promise<BillingLedgerItem[]> {
    if (caller.role !== 'guardian' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view this billing ledger.', 'غير مصرح لك بعرض سجل الرسوم هذا.');
    }
    return this.ledger.listForChild(childId);
  }

  async listInstallmentEntriesForChild(childId: string, caller: CallerContext): Promise<InstallmentScheduleEntry[]> {
    if (caller.role !== 'guardian' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view this installment schedule.', 'غير مصرح لك بعرض جدول الأقساط هذا.');
    }
    return this.ledger.listInstallmentEntriesForChild(childId);
  }

  async markInstallmentPaidManual(input: MarkInstallmentPaidManualInput, caller: CallerContext): Promise<InstallmentScheduleEntry> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can mark an installment as manually paid.', 'فقط المدير يمكنه وضع علامة "مدفوع يدويًا" على القسط.');
    }
    return this.ledger.markInstallmentPaidManual(input);
  }

  async markLedgerItemPaidManual(input: MarkLedgerItemPaidManualInput, caller: CallerContext): Promise<BillingLedgerItem> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can mark a ledger item as manually paid.', 'فقط المدير يمكنه وضع علامة "مدفوع يدويًا" على بند الرسوم.');
    }
    return this.ledger.markLedgerItemPaidManual(input);
  }
}
