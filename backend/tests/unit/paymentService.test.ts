import { describe, it, expect, vi } from 'vitest';
import { PaymentService } from '../../src/services/paymentService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { PaymentTransaction } from '../../src/types/domain.epic6.js';

function makePayment(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: 'payment-1',
    tenantId: 'tenant-1',
    childId: 'child-1',
    invoiceId: 'invoice-1',
    method: 'bank_transfer',
    amount: 1500,
    status: 'pending_verification',
    providerReference: 'bank-transfer-abc',
    receiptObjectId: 'receipt-1',
    receiptFilePath: 'payment-receipts/tenant-1/guardian-1/receipt.png',
    initiatedAt: '2026-09-01T08:00:00Z',
    settledAt: null,
    ...overrides,
  };
}

function buildHarness() {
  const payments = {
    listForChild: vi.fn(async () => [makePayment()]),
    listForTenant: vi.fn(async () => [makePayment()]),
    verify: vi.fn(async () => makePayment({ status: 'succeeded', settledAt: '2026-09-02T08:00:00Z' })),
    refund: vi.fn(async () => makePayment({ status: 'refunded' })),
  };
  // deno-lint-ignore no-explicit-any
  const service = new PaymentService(payments as any);
  return { service, payments };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const platformAdminCaller: CallerContext = { userId: 'admin-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'support' };

describe('PaymentService.verify', () => {
  it('allows a manager to verify a payment as succeeded', async () => {
    const h = buildHarness();
    const result = await h.service.verify({ paymentTransactionId: 'payment-1', decision: 'succeeded' }, managerCaller);
    expect(result.status).toBe('succeeded');
  });

  it('rejects a guardian verifying a payment', async () => {
    const h = buildHarness();
    await expect(h.service.verify({ paymentTransactionId: 'payment-1', decision: 'succeeded' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.payments.verify).not.toHaveBeenCalled();
  });
});

describe('PaymentService.refund', () => {
  it('allows a manager to refund a payment', async () => {
    const h = buildHarness();
    const result = await h.service.refund({ paymentTransactionId: 'payment-1' }, managerCaller);
    expect(result.status).toBe('refunded');
  });

  it('rejects a platform admin refunding a payment directly (support tier is read-only reconciliation, not RUA)', async () => {
    const h = buildHarness();
    await expect(h.service.refund({ paymentTransactionId: 'payment-1' }, platformAdminCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('PaymentService.listForChild / listForTenant', () => {
  it('allows a guardian to list their own child\'s payments', async () => {
    const h = buildHarness();
    await h.service.listForChild('child-1', guardianCaller);
    expect(h.payments.listForChild).toHaveBeenCalledWith('child-1');
  });

  it('allows a manager to list all payments for their tenant', async () => {
    const h = buildHarness();
    await h.service.listForTenant(managerCaller);
    expect(h.payments.listForTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects a guardian listing tenant-wide payments', async () => {
    const h = buildHarness();
    await expect(h.service.listForTenant(guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
