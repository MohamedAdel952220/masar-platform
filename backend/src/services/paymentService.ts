// PaymentService — testable core behind payment_transactions reads,
// verify_payment, refund_payment (§14.2). Payment initiation is handled by
// the initiate-payment Edge Function directly (it needs to call the
// external payment gateway, §14.1) — this service does not wrap it.
import { AppError } from '../lib/errors.js';
import type { PaymentRepository } from '../repositories/paymentRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { PaymentTransaction } from '../types/domain.epic6.js';
import type { VerifyPaymentInput, RefundPaymentInput } from '../validation/billing.schema.js';

export class PaymentService {
  constructor(private readonly payments: PaymentRepository) {}

  async listForChild(childId: string, caller: CallerContext): Promise<PaymentTransaction[]> {
    if (caller.role !== 'guardian' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view these payments.', 'غير مصرح لك بعرض هذه المدفوعات.');
    }
    return this.payments.listForChild(childId);
  }

  async listForTenant(caller: CallerContext): Promise<PaymentTransaction[]> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can list payments for a tenant.', 'فقط المدير يمكنه عرض مدفوعات المؤسسة.');
    }
    return this.payments.listForTenant(caller.tenantId);
  }

  async verify(input: VerifyPaymentInput, caller: CallerContext): Promise<PaymentTransaction> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can verify a payment.', 'فقط المدير يمكنه التحقق من الدفعة.');
    }
    return this.payments.verify(input);
  }

  async refund(input: RefundPaymentInput, caller: CallerContext): Promise<PaymentTransaction> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can refund a payment.', 'فقط المدير يمكنه استرداد الدفعة.');
    }
    return this.payments.refund(input);
  }
}
