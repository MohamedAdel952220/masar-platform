import { describe, it, expect, vi } from 'vitest';
import { BillingLedgerService } from '../../src/services/billingLedgerService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { BillingLedgerItem, InstallmentScheduleEntry } from '../../src/types/domain.epic6.js';

function makeLedgerItem(overrides: Partial<BillingLedgerItem> = {}): BillingLedgerItem {
  return {
    id: 'ledger-1',
    tenantId: 'tenant-1',
    childId: 'child-1',
    feeItemId: 'fee-1',
    periodLabel: '2026-09',
    amountDue: 1500,
    amountPaid: 0,
    status: 'due',
    dueDate: '2026-09-30',
    ...overrides,
  };
}

function makeInstallmentEntry(overrides: Partial<InstallmentScheduleEntry> = {}): InstallmentScheduleEntry {
  return {
    id: 'entry-1',
    planId: 'plan-1',
    tenantId: 'tenant-1',
    sequence: 1,
    label: 'Installment 1',
    amount: 500,
    dueDate: '2026-09-30',
    paid: false,
    paidAt: null,
    status: 'due',
    ...overrides,
  };
}

function buildHarness() {
  const ledger = {
    listForChild: vi.fn(async () => [makeLedgerItem()]),
    listInstallmentEntriesForChild: vi.fn(async () => [makeInstallmentEntry()]),
    markInstallmentPaidManual: vi.fn(async () => makeInstallmentEntry({ paid: true, status: 'paid' })),
    markLedgerItemPaidManual: vi.fn(async () => makeLedgerItem({ status: 'paid', amountPaid: 1500 })),
  };
  // deno-lint-ignore no-explicit-any
  const service = new BillingLedgerService(ledger as any);
  return { service, ledger };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };

describe('BillingLedgerService.listForChild', () => {
  it('allows a guardian to view a ledger', async () => {
    const h = buildHarness();
    await h.service.listForChild('child-1', guardianCaller);
    expect(h.ledger.listForChild).toHaveBeenCalledWith('child-1');
  });

  it('rejects a teacher viewing a ledger', async () => {
    const h = buildHarness();
    await expect(h.service.listForChild('child-1', teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('BillingLedgerService.markInstallmentPaidManual', () => {
  it('allows a manager to mark an installment as manually paid', async () => {
    const h = buildHarness();
    const result = await h.service.markInstallmentPaidManual({ installmentEntryId: 'entry-1' }, managerCaller);
    expect(result.status).toBe('paid');
  });

  it('rejects a guardian marking an installment as manually paid', async () => {
    const h = buildHarness();
    await expect(h.service.markInstallmentPaidManual({ installmentEntryId: 'entry-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.ledger.markInstallmentPaidManual).not.toHaveBeenCalled();
  });
});

// Fix for EPIC_6_REVIEW.md M2: mark_ledger_item_paid_manual is the sole
// audited path to billing_ledger_items.status = 'paid' — mirrors the
// installment-entry tests above exactly.
describe('BillingLedgerService.markLedgerItemPaidManual', () => {
  it('allows a manager to mark a ledger item as manually paid', async () => {
    const h = buildHarness();
    const result = await h.service.markLedgerItemPaidManual({ ledgerItemId: 'ledger-1' }, managerCaller);
    expect(result.status).toBe('paid');
    expect(h.ledger.markLedgerItemPaidManual).toHaveBeenCalledWith({ ledgerItemId: 'ledger-1' });
  });

  it('rejects a guardian marking a ledger item as manually paid', async () => {
    const h = buildHarness();
    await expect(h.service.markLedgerItemPaidManual({ ledgerItemId: 'ledger-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.ledger.markLedgerItemPaidManual).not.toHaveBeenCalled();
  });

  it('rejects a teacher marking a ledger item as manually paid', async () => {
    const h = buildHarness();
    await expect(h.service.markLedgerItemPaidManual({ ledgerItemId: 'ledger-1' }, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
