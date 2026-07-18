// API handlers for fee-items / billing-ledger / installments / invoices /
// payments — mirrors the corresponding RPCs and direct-CRUD paths (§14.2).
import {
  createFeeItemSchema,
  generateInvoiceSchema,
  markInstallmentPaidManualSchema,
  markLedgerItemPaidManualSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
} from '../../validation/billing.schema.js';
import { AppError } from '../../lib/errors.js';
import type { FeeItemService } from '../../services/feeItemService.js';
import type { BillingLedgerService } from '../../services/billingLedgerService.js';
import type { InvoiceService } from '../../services/invoiceService.js';
import type { PaymentService } from '../../services/paymentService.js';
import type { CallerContext } from '../../types/domain.js';
import type { BillingLedgerItem, FeeItem, InstallmentScheduleEntry, Invoice, PaymentTransaction } from '../../types/domain.epic6.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function createFeeItemRoute(service: FeeItemService, caller: CallerContext, rawBody: unknown): Promise<FeeItem> {
  const parsed = createFeeItemSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.create(parsed.data, caller);
}

export async function generateInvoiceRoute(service: InvoiceService, caller: CallerContext, rawBody: unknown): Promise<Invoice> {
  const parsed = generateInvoiceSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.generate(parsed.data, caller);
}

export async function markInstallmentPaidManualRoute(service: BillingLedgerService, caller: CallerContext, rawBody: unknown): Promise<InstallmentScheduleEntry> {
  const parsed = markInstallmentPaidManualSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.markInstallmentPaidManual(parsed.data, caller);
}

export async function markLedgerItemPaidManualRoute(service: BillingLedgerService, caller: CallerContext, rawBody: unknown): Promise<BillingLedgerItem> {
  const parsed = markLedgerItemPaidManualSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.markLedgerItemPaidManual(parsed.data, caller);
}

export async function verifyPaymentRoute(service: PaymentService, caller: CallerContext, rawBody: unknown): Promise<PaymentTransaction> {
  const parsed = verifyPaymentSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.verify(parsed.data, caller);
}

export async function refundPaymentRoute(service: PaymentService, caller: CallerContext, rawBody: unknown): Promise<PaymentTransaction> {
  const parsed = refundPaymentSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.refund(parsed.data, caller);
}
