import { describe, it, expect, vi } from 'vitest';
import { FeeItemService } from '../../src/services/feeItemService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { FeeItem } from '../../src/types/domain.epic6.js';

function makeFeeItem(overrides: Partial<FeeItem> = {}): FeeItem {
  return {
    id: 'fee-1',
    tenantId: 'tenant-1',
    name: 'Tuition',
    nameAr: null,
    icon: null,
    cycle: 'monthly',
    scope: 'all',
    required: true,
    price: 1500,
    active: true,
    ...overrides,
  };
}

function buildHarness() {
  const feeItems = {
    listForTenant: vi.fn(async () => [makeFeeItem()]),
    create: vi.fn(async () => makeFeeItem()),
  };
  // deno-lint-ignore no-explicit-any
  const service = new FeeItemService(feeItems as any);
  return { service, feeItems };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };

describe('FeeItemService.listForTenant', () => {
  it('allows a guardian to list fee items', async () => {
    const h = buildHarness();
    await h.service.listForTenant(guardianCaller);
    expect(h.feeItems.listForTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('allows a manager to list fee items', async () => {
    const h = buildHarness();
    await h.service.listForTenant(managerCaller);
    expect(h.feeItems.listForTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects a teacher listing fee items (matrix: R is guardian-only besides manager)', async () => {
    const h = buildHarness();
    await expect(h.service.listForTenant(teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.feeItems.listForTenant).not.toHaveBeenCalled();
  });
});

describe('FeeItemService.create', () => {
  it('allows a manager to create a fee item', async () => {
    const h = buildHarness();
    await h.service.create({ name: 'Tuition', cycle: 'monthly', scope: 'all', required: true, price: 1500 }, managerCaller);
    expect(h.feeItems.create).toHaveBeenCalled();
  });

  it('rejects a guardian creating a fee item', async () => {
    const h = buildHarness();
    await expect(
      h.service.create({ name: 'Tuition', cycle: 'monthly', scope: 'all', required: true, price: 1500 }, guardianCaller),
    ).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.feeItems.create).not.toHaveBeenCalled();
  });
});
