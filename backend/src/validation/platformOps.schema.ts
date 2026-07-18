import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const supportTicketCategorySchema = z.enum(['technical', 'how_to', 'request', 'billing']);
export const supportTicketSeveritySchema = z.enum(['high', 'med', 'low']);
export const supportTicketStatusSchema = z.enum(['open', 'in_progress', 'resolved']);
export const billingTransactionKindSchema = z.enum(['subscription_charge', 'setup_fee', 'refund']);

export const createSupportTicketSchema = z.object({
  subject: nonEmptyString('subject').max(200),
  body: nonEmptyString('body').max(5000),
  category: supportTicketCategorySchema,
  severity: supportTicketSeveritySchema,
  idempotencyKey: uuidSchema.optional(),
});
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export const updateSupportTicketSchema = z
  .object({
    ticketId: uuidSchema,
    status: supportTicketStatusSchema.optional(),
    assignedTo: uuidSchema.optional(),
    idempotencyKey: uuidSchema.optional(),
  })
  .refine((v) => v.status !== undefined || v.assignedTo !== undefined, {
    message: 'At least one of status or assignedTo must be provided',
    path: ['ticketId'],
  });
export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;

export const listSupportTicketsSchema = z.object({
  status: supportTicketStatusSchema.optional(),
});
export type ListSupportTicketsInput = z.infer<typeof listSupportTicketsSchema>;

// Matches platform.tenant_billing_transactions.currency's implicit ISO-4217
// shape (default 'EGP') — three uppercase letters.
const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code').optional();

// 'refund' is deliberately excluded here — recording a refund goes through
// refundTenantBillingTransactionSchema/refund_tenant_billing_transaction
// instead (matches the RPC's own explicit rejection of p_kind='refund').
export const issueTenantBillingTransactionSchema = z.object({
  tenantId: uuidSchema,
  amount: z.number().positive('amount must be greater than zero'),
  kind: z.enum(['subscription_charge', 'setup_fee']),
  currency: currencySchema,
  providerReference: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: uuidSchema.optional(),
});
export type IssueTenantBillingTransactionInput = z.infer<typeof issueTenantBillingTransactionSchema>;

export const refundTenantBillingTransactionSchema = z.object({
  originalTransactionId: uuidSchema,
  reason: z.string().trim().max(1000).optional(),
  idempotencyKey: uuidSchema.optional(),
});
export type RefundTenantBillingTransactionInput = z.infer<typeof refundTenantBillingTransactionSchema>;

export const listTenantBillingTransactionsSchema = z.object({
  tenantId: uuidSchema.optional(),
});
export type ListTenantBillingTransactionsInput = z.infer<typeof listTenantBillingTransactionsSchema>;

export const listActivityLogSchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ListActivityLogInput = z.infer<typeof listActivityLogSchema>;

export const listAuditLogSchema = z.object({
  tenantId: uuidSchema.optional(),
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ListAuditLogInput = z.infer<typeof listAuditLogSchema>;
