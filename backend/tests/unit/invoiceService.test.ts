import { describe, it, expect, vi } from 'vitest';
import { InvoiceService } from '../../src/services/invoiceService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { Invoice } from '../../src/types/domain.epic6.js';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-1',
    tenantId: 'tenant-1',
    childId: 'child-1',
    invoiceNumber: 'INV-2026-00001',
    issuedAt: '2026-09-01T08:00:00Z',
    total: 1500,
    status: 'unpaid',
    pdfObjectId: null,
    ...overrides,
  };
}

function buildHarness() {
  const invoices = {
    listForChild: vi.fn(async () => [makeInvoice()]),
    listLines: vi.fn(async () => []),
    generate: vi.fn(async () => makeInvoice()),
    void: vi.fn(async () => makeInvoice({ status: 'void' })),
  };
  // deno-lint-ignore no-explicit-any
  const service = new InvoiceService(invoices as any);
  return { service, invoices };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };

describe('InvoiceService.generate', () => {
  it('allows a manager to generate an invoice', async () => {
    const h = buildHarness();
    await h.service.generate({ childId: 'child-1', items: [{ description: 'Tuition', amount: 1500 }] }, managerCaller);
    expect(h.invoices.generate).toHaveBeenCalled();
  });

  it('rejects a guardian generating an invoice', async () => {
    const h = buildHarness();
    await expect(
      h.service.generate({ childId: 'child-1', items: [{ description: 'Tuition', amount: 1500 }] }, guardianCaller),
    ).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.invoices.generate).not.toHaveBeenCalled();
  });
});

describe('InvoiceService.void', () => {
  it('allows a manager to void an invoice', async () => {
    const h = buildHarness();
    const result = await h.service.void('invoice-1', managerCaller);
    expect(result.status).toBe('void');
  });

  it('rejects a guardian voiding an invoice', async () => {
    const h = buildHarness();
    await expect(h.service.void('invoice-1', guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('InvoiceService.listForChild', () => {
  it('allows a guardian to list their child\'s invoices', async () => {
    const h = buildHarness();
    await h.service.listForChild('child-1', guardianCaller);
    expect(h.invoices.listForChild).toHaveBeenCalledWith('child-1');
  });
});
