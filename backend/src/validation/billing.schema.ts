import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const feeCycleSchema = z.enum(['monthly', 'per_term', 'once_per_year', 'one_time']);
export const feeScopeSchema = z.enum(['all', 'optional']);
export const paymentMethodSchema = z.enum(['bank_transfer', 'instapay', 'wallet', 'fawry']);
export const verifyDecisionSchema = z.enum(['succeeded', 'failed']);

// Matches every currency column's numeric(10,2) precision (§2.2).
const moneySchema = z.number().min(0).multipleOf(0.01);

export const createFeeItemSchema = z.object({
  name: nonEmptyString('name').max(200),
  nameAr: z.string().trim().max(200).optional(),
  icon: z.string().trim().max(100).optional(),
  cycle: feeCycleSchema,
  scope: feeScopeSchema.default('all'),
  required: z.boolean().default(true),
  price: moneySchema,
});
export type CreateFeeItemInput = z.infer<typeof createFeeItemSchema>;

export const generateInvoiceItemSchema = z
  .object({
    description: nonEmptyString('description').max(500),
    feeItemId: uuidSchema.optional(),
    // Fix for EPIC_6_REVIEW.md C1: the explicit obligation this line pays
    // down, mirroring billing.invoice_lines_at_most_one_obligation_ref
    // (migration 3) — at most one of the two may be set.
    ledgerItemId: uuidSchema.optional(),
    installmentEntryId: uuidSchema.optional(),
    amount: moneySchema,
  })
  .refine((item) => !(item.ledgerItemId && item.installmentEntryId), {
    message: 'ledgerItemId and installmentEntryId cannot both be set on the same invoice line',
    path: ['installmentEntryId'],
  });

export const generateInvoiceSchema = z.object({
  childId: uuidSchema,
  items: z.array(generateInvoiceItemSchema).min(1),
  idempotencyKey: uuidSchema.optional(),
});
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

export const markInstallmentPaidManualSchema = z.object({
  installmentEntryId: uuidSchema,
  note: z.string().trim().max(1000).optional(),
});
export type MarkInstallmentPaidManualInput = z.infer<typeof markInstallmentPaidManualSchema>;

// Fix for EPIC_6_REVIEW.md M2: mirrors markInstallmentPaidManualSchema for
// the ledger-item side of manual "paid" marking.
export const markLedgerItemPaidManualSchema = z.object({
  ledgerItemId: uuidSchema,
  note: z.string().trim().max(1000).optional(),
});
export type MarkLedgerItemPaidManualInput = z.infer<typeof markLedgerItemPaidManualSchema>;

export const verifyPaymentSchema = z.object({
  paymentTransactionId: uuidSchema,
  decision: verifyDecisionSchema,
  note: z.string().trim().max(1000).optional(),
  idempotencyKey: uuidSchema.optional(),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const refundPaymentSchema = z.object({
  paymentTransactionId: uuidSchema,
  reason: z.string().trim().max(1000).optional(),
  idempotencyKey: uuidSchema.optional(),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
