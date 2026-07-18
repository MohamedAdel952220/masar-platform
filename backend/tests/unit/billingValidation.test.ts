import { describe, it, expect } from 'vitest';
import {
  createFeeItemSchema,
  generateInvoiceSchema,
  markInstallmentPaidManualSchema,
  markLedgerItemPaidManualSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
} from '../../src/validation/billing.schema.js';

const childId = '11111111-1111-1111-1111-111111111111';
const feeItemId = '22222222-2222-2222-2222-222222222222';
const installmentEntryId = '33333333-3333-3333-3333-333333333333';
const paymentTransactionId = '44444444-4444-4444-4444-444444444444';
const ledgerItemId = '55555555-5555-5555-5555-555555555555';

describe('createFeeItemSchema', () => {
  it('accepts a valid monthly fee item', () => {
    expect(createFeeItemSchema.safeParse({ name: 'Tuition', cycle: 'monthly', price: 1500 }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(createFeeItemSchema.safeParse({ name: '  ', cycle: 'monthly', price: 1500 }).success).toBe(false);
  });

  it('rejects a negative price', () => {
    expect(createFeeItemSchema.safeParse({ name: 'Tuition', cycle: 'monthly', price: -1 }).success).toBe(false);
  });

  it('rejects a price with more than 2 decimal places', () => {
    expect(createFeeItemSchema.safeParse({ name: 'Tuition', cycle: 'monthly', price: 1500.999 }).success).toBe(false);
  });

  it('defaults scope to "all" and required to true', () => {
    const parsed = createFeeItemSchema.safeParse({ name: 'Tuition', cycle: 'monthly', price: 1500 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.scope).toBe('all');
      expect(parsed.data.required).toBe(true);
    }
  });
});

describe('generateInvoiceSchema', () => {
  it('accepts a valid single-line invoice', () => {
    expect(generateInvoiceSchema.safeParse({ childId, items: [{ description: 'Tuition — Sept', amount: 1500 }] }).success).toBe(true);
  });

  it('rejects an empty items array', () => {
    expect(generateInvoiceSchema.safeParse({ childId, items: [] }).success).toBe(false);
  });

  it('accepts a line referencing a feeItemId', () => {
    expect(generateInvoiceSchema.safeParse({ childId, items: [{ description: 'Tuition', feeItemId, amount: 1500 }] }).success).toBe(true);
  });

  it('rejects a non-uuid childId', () => {
    expect(generateInvoiceSchema.safeParse({ childId: 'nope', items: [{ description: 'Tuition', amount: 1500 }] }).success).toBe(false);
  });

  it('accepts a line referencing a ledgerItemId', () => {
    expect(generateInvoiceSchema.safeParse({ childId, items: [{ description: 'Tuition', ledgerItemId, amount: 1500 }] }).success).toBe(true);
  });

  it('accepts a line referencing an installmentEntryId', () => {
    expect(generateInvoiceSchema.safeParse({ childId, items: [{ description: 'Installment 1', installmentEntryId, amount: 750 }] }).success).toBe(true);
  });

  // Fix for EPIC_6_REVIEW.md C1: a line must reference at most one specific
  // obligation, mirroring billing.invoice_lines_at_most_one_obligation_ref.
  it('rejects a line referencing both a ledgerItemId and an installmentEntryId', () => {
    expect(
      generateInvoiceSchema.safeParse({ childId, items: [{ description: 'Tuition', ledgerItemId, installmentEntryId, amount: 1500 }] }).success,
    ).toBe(false);
  });
});

describe('markInstallmentPaidManualSchema', () => {
  it('accepts a valid payload', () => {
    expect(markInstallmentPaidManualSchema.safeParse({ installmentEntryId }).success).toBe(true);
  });

  it('accepts an optional note', () => {
    expect(markInstallmentPaidManualSchema.safeParse({ installmentEntryId, note: 'Paid in cash at front desk' }).success).toBe(true);
  });

  it('rejects a missing installmentEntryId', () => {
    expect(markInstallmentPaidManualSchema.safeParse({}).success).toBe(false);
  });
});

describe('markLedgerItemPaidManualSchema', () => {
  it('accepts a valid payload', () => {
    expect(markLedgerItemPaidManualSchema.safeParse({ ledgerItemId }).success).toBe(true);
  });

  it('accepts an optional note', () => {
    expect(markLedgerItemPaidManualSchema.safeParse({ ledgerItemId, note: 'Paid in cash at front desk' }).success).toBe(true);
  });

  it('rejects a missing ledgerItemId', () => {
    expect(markLedgerItemPaidManualSchema.safeParse({}).success).toBe(false);
  });
});

describe('verifyPaymentSchema', () => {
  it('accepts a succeeded decision', () => {
    expect(verifyPaymentSchema.safeParse({ paymentTransactionId, decision: 'succeeded' }).success).toBe(true);
  });

  it('accepts a failed decision', () => {
    expect(verifyPaymentSchema.safeParse({ paymentTransactionId, decision: 'failed' }).success).toBe(true);
  });

  it('rejects an invalid decision', () => {
    expect(verifyPaymentSchema.safeParse({ paymentTransactionId, decision: 'refunded' }).success).toBe(false);
  });
});

describe('refundPaymentSchema', () => {
  it('accepts a valid payload', () => {
    expect(refundPaymentSchema.safeParse({ paymentTransactionId, reason: 'Duplicate charge' }).success).toBe(true);
  });

  it('rejects a missing paymentTransactionId', () => {
    expect(refundPaymentSchema.safeParse({ reason: 'Duplicate charge' }).success).toBe(false);
  });
});
