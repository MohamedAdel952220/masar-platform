import { describe, it, expect, vi } from 'vitest';
import {
  createFeeItemRoute,
  generateInvoiceRoute,
  markInstallmentPaidManualRoute,
  markLedgerItemPaidManualRoute,
  verifyPaymentRoute,
  refundPaymentRoute,
} from '../../src/api/routes/billing.js';
import type { CallerContext } from '../../src/types/domain.js';

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };

const childId = '11111111-1111-1111-1111-111111111111';
const installmentEntryId = '22222222-2222-2222-2222-222222222222';
const paymentTransactionId = '33333333-3333-3333-3333-333333333333';
const ledgerItemId = '44444444-4444-4444-4444-444444444444';

describe('createFeeItemRoute — validation', () => {
  it('rejects a body missing required fields', async () => {
    const service = { create: vi.fn() } as unknown as import('../../src/services/feeItemService.js').FeeItemService;
    await expect(createFeeItemRoute(service, managerCaller, { name: 'Tuition' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { create: vi.fn(async () => ({ id: 'fee-1' })) } as unknown as import('../../src/services/feeItemService.js').FeeItemService;
    const body = { name: 'Tuition', cycle: 'monthly', price: 1500 };
    await createFeeItemRoute(service, managerCaller, body);
    expect(service.create).toHaveBeenCalled();
  });
});

describe('generateInvoiceRoute — validation', () => {
  it('rejects an empty items array', async () => {
    const service = { generate: vi.fn() } as unknown as import('../../src/services/invoiceService.js').InvoiceService;
    await expect(generateInvoiceRoute(service, managerCaller, { childId, items: [] })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.generate).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { generate: vi.fn(async () => ({ id: 'invoice-1' })) } as unknown as import('../../src/services/invoiceService.js').InvoiceService;
    const body = { childId, items: [{ description: 'Tuition', amount: 1500 }] };
    await generateInvoiceRoute(service, managerCaller, body);
    expect(service.generate).toHaveBeenCalledWith(body, managerCaller);
  });
});

describe('markInstallmentPaidManualRoute — validation', () => {
  it('rejects a missing installmentEntryId', async () => {
    const service = { markInstallmentPaidManual: vi.fn() } as unknown as import('../../src/services/billingLedgerService.js').BillingLedgerService;
    await expect(markInstallmentPaidManualRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.markInstallmentPaidManual).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { markInstallmentPaidManual: vi.fn(async () => ({ id: installmentEntryId })) } as unknown as import('../../src/services/billingLedgerService.js').BillingLedgerService;
    await markInstallmentPaidManualRoute(service, managerCaller, { installmentEntryId });
    expect(service.markInstallmentPaidManual).toHaveBeenCalledWith({ installmentEntryId }, managerCaller);
  });
});

describe('markLedgerItemPaidManualRoute — validation', () => {
  it('rejects a missing ledgerItemId', async () => {
    const service = { markLedgerItemPaidManual: vi.fn() } as unknown as import('../../src/services/billingLedgerService.js').BillingLedgerService;
    await expect(markLedgerItemPaidManualRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.markLedgerItemPaidManual).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { markLedgerItemPaidManual: vi.fn(async () => ({ id: ledgerItemId })) } as unknown as import('../../src/services/billingLedgerService.js').BillingLedgerService;
    await markLedgerItemPaidManualRoute(service, managerCaller, { ledgerItemId });
    expect(service.markLedgerItemPaidManual).toHaveBeenCalledWith({ ledgerItemId }, managerCaller);
  });
});

describe('verifyPaymentRoute — validation', () => {
  it('rejects an invalid decision', async () => {
    const service = { verify: vi.fn() } as unknown as import('../../src/services/paymentService.js').PaymentService;
    await expect(verifyPaymentRoute(service, managerCaller, { paymentTransactionId, decision: 'refunded' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.verify).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { verify: vi.fn(async () => ({ id: paymentTransactionId })) } as unknown as import('../../src/services/paymentService.js').PaymentService;
    await verifyPaymentRoute(service, managerCaller, { paymentTransactionId, decision: 'succeeded' });
    expect(service.verify).toHaveBeenCalledWith({ paymentTransactionId, decision: 'succeeded' }, managerCaller);
  });
});

describe('refundPaymentRoute — validation', () => {
  it('rejects a missing paymentTransactionId', async () => {
    const service = { refund: vi.fn() } as unknown as import('../../src/services/paymentService.js').PaymentService;
    await expect(refundPaymentRoute(service, managerCaller, { reason: 'test' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.refund).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { refund: vi.fn(async () => ({ id: paymentTransactionId })) } as unknown as import('../../src/services/paymentService.js').PaymentService;
    await refundPaymentRoute(service, managerCaller, { paymentTransactionId });
    expect(service.refund).toHaveBeenCalledWith({ paymentTransactionId }, managerCaller);
  });
});
