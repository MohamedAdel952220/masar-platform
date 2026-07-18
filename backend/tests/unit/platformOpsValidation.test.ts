import { describe, it, expect } from 'vitest';
import {
  createSupportTicketSchema,
  updateSupportTicketSchema,
  listSupportTicketsSchema,
  issueTenantBillingTransactionSchema,
  refundTenantBillingTransactionSchema,
  listTenantBillingTransactionsSchema,
  listActivityLogSchema,
  listAuditLogSchema,
} from '../../src/validation/platformOps.schema.js';

const ticketId = '11111111-1111-1111-1111-111111111111';
const tenantId = '22222222-2222-2222-2222-222222222222';
const assigneeId = '33333333-3333-3333-3333-333333333333';
const transactionId = '44444444-4444-4444-4444-444444444444';

describe('createSupportTicketSchema', () => {
  it('accepts a valid ticket', () => {
    expect(
      createSupportTicketSchema.safeParse({
        subject: 'Camera offline',
        body: 'Our entrance camera has been offline since this morning.',
        category: 'technical',
        severity: 'high',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty subject', () => {
    expect(createSupportTicketSchema.safeParse({ subject: '  ', body: 'x', category: 'technical', severity: 'high' }).success).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(createSupportTicketSchema.safeParse({ subject: 'x', body: '  ', category: 'technical', severity: 'high' }).success).toBe(false);
  });

  it('rejects an invalid category', () => {
    expect(createSupportTicketSchema.safeParse({ subject: 'x', body: 'x', category: 'nonsense', severity: 'high' }).success).toBe(false);
  });

  it('rejects an invalid severity', () => {
    expect(createSupportTicketSchema.safeParse({ subject: 'x', body: 'x', category: 'technical', severity: 'critical' }).success).toBe(false);
  });

  it('accepts an optional valid-uuid idempotencyKey', () => {
    expect(
      createSupportTicketSchema.safeParse({
        subject: 'x',
        body: 'x',
        category: 'technical',
        severity: 'low',
        idempotencyKey: '99999999-9999-9999-9999-999999999999',
      }).success,
    ).toBe(true);
  });
});

describe('updateSupportTicketSchema', () => {
  it('accepts a status-only update', () => {
    expect(updateSupportTicketSchema.safeParse({ ticketId, status: 'in_progress' }).success).toBe(true);
  });

  it('accepts an assignedTo-only update', () => {
    expect(updateSupportTicketSchema.safeParse({ ticketId, assignedTo: assigneeId }).success).toBe(true);
  });

  it('accepts both fields together', () => {
    expect(updateSupportTicketSchema.safeParse({ ticketId, status: 'resolved', assignedTo: assigneeId }).success).toBe(true);
  });

  it('rejects an update with neither field', () => {
    expect(updateSupportTicketSchema.safeParse({ ticketId }).success).toBe(false);
  });

  it('rejects a non-uuid ticketId', () => {
    expect(updateSupportTicketSchema.safeParse({ ticketId: 'nope', status: 'open' }).success).toBe(false);
  });

  it('rejects an invalid status', () => {
    expect(updateSupportTicketSchema.safeParse({ ticketId, status: 'closed' }).success).toBe(false);
  });
});

describe('listSupportTicketsSchema', () => {
  it('accepts an empty filter', () => {
    expect(listSupportTicketsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid status filter', () => {
    expect(listSupportTicketsSchema.safeParse({ status: 'open' }).success).toBe(true);
  });

  it('rejects an invalid status filter', () => {
    expect(listSupportTicketsSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});

describe('issueTenantBillingTransactionSchema', () => {
  it('accepts a valid subscription_charge', () => {
    expect(
      issueTenantBillingTransactionSchema.safeParse({ tenantId, amount: 7500, kind: 'subscription_charge' }).success,
    ).toBe(true);
  });

  it('rejects kind="refund" (must use the refund action instead)', () => {
    expect(issueTenantBillingTransactionSchema.safeParse({ tenantId, amount: 100, kind: 'refund' }).success).toBe(false);
  });

  it('rejects a zero or negative amount', () => {
    expect(issueTenantBillingTransactionSchema.safeParse({ tenantId, amount: 0, kind: 'setup_fee' }).success).toBe(false);
    expect(issueTenantBillingTransactionSchema.safeParse({ tenantId, amount: -50, kind: 'setup_fee' }).success).toBe(false);
  });

  it('accepts a valid 3-letter currency code', () => {
    expect(issueTenantBillingTransactionSchema.safeParse({ tenantId, amount: 100, kind: 'setup_fee', currency: 'USD' }).success).toBe(true);
  });

  it('rejects an invalid currency code', () => {
    expect(issueTenantBillingTransactionSchema.safeParse({ tenantId, amount: 100, kind: 'setup_fee', currency: 'egp' }).success).toBe(false);
    expect(issueTenantBillingTransactionSchema.safeParse({ tenantId, amount: 100, kind: 'setup_fee', currency: 'EGYPT' }).success).toBe(false);
  });
});

describe('refundTenantBillingTransactionSchema', () => {
  it('accepts a valid refund request', () => {
    expect(refundTenantBillingTransactionSchema.safeParse({ originalTransactionId: transactionId }).success).toBe(true);
  });

  it('accepts an optional reason', () => {
    expect(refundTenantBillingTransactionSchema.safeParse({ originalTransactionId: transactionId, reason: 'Duplicate charge' }).success).toBe(true);
  });

  it('rejects a missing originalTransactionId', () => {
    expect(refundTenantBillingTransactionSchema.safeParse({}).success).toBe(false);
  });
});

describe('listTenantBillingTransactionsSchema / listActivityLogSchema / listAuditLogSchema', () => {
  it('accept empty filters', () => {
    expect(listTenantBillingTransactionsSchema.safeParse({}).success).toBe(true);
    expect(listActivityLogSchema.safeParse({}).success).toBe(true);
    expect(listAuditLogSchema.safeParse({}).success).toBe(true);
  });

  it('accept valid pagination params', () => {
    expect(listActivityLogSchema.safeParse({ limit: 50, offset: 0 }).success).toBe(true);
    expect(listAuditLogSchema.safeParse({ tenantId, limit: 50, offset: 10 }).success).toBe(true);
  });

  it('reject an out-of-range limit', () => {
    expect(listActivityLogSchema.safeParse({ limit: 500 }).success).toBe(false);
    expect(listAuditLogSchema.safeParse({ limit: 0 }).success).toBe(false);
  });
});
