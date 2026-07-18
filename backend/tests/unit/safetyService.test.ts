import { describe, it, expect, vi } from 'vitest';
import { SafetyService } from '../../src/services/safetyService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { PickupPass } from '../../src/types/domain.epic3.js';

function makePass(overrides: Partial<PickupPass> = {}): PickupPass {
  return {
    id: 'pass-1',
    tenantId: 'tenant-1',
    childId: 'child-1',
    createdBy: 'guardian-1',
    personName: 'Amira Hassan',
    relation: 'aunt',
    idPhotoObjectId: null,
    qrToken: 'tok-abc',
    status: 'active',
    expiresAt: '2026-07-16T00:00:00Z',
    ...overrides,
  };
}

function buildHarness() {
  const pickupPasses = {
    create: vi.fn(async () => makePass()),
    scan: vi.fn(async () => ({ result: 'valid' as const, scanEventId: 'evt-1', pass: makePass() })),
    confirmHandover: vi.fn(async () => ({ id: 'evt-1', tenantId: 'tenant-1', pickupPassId: 'pass-1', scannedBy: 'reception-1', result: 'valid' as const, handoverConfirmed: true, scannedAt: '2026-07-15T08:00:00Z' })),
    revoke: vi.fn(async () => makePass({ status: 'revoked' })),
  };
  // deno-lint-ignore no-explicit-any
  const service = new SafetyService(pickupPasses as any);
  return { service, pickupPasses };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const receptionCaller: CallerContext = { userId: 'reception-1', tenantId: 'tenant-1', role: 'reception', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };

describe('SafetyService.createPickupPass', () => {
  it('allows a guardian to create a pickup pass', async () => {
    const h = buildHarness();
    await h.service.createPickupPass({ childId: 'child-1', personName: 'Amira Hassan', relation: 'aunt' }, guardianCaller);
    expect(h.pickupPasses.create).toHaveBeenCalled();
  });

  it('rejects a manager creating a pickup pass', async () => {
    const h = buildHarness();
    await expect(h.service.createPickupPass({ childId: 'child-1', personName: 'Amira Hassan', relation: 'aunt' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.pickupPasses.create).not.toHaveBeenCalled();
  });
});

describe('SafetyService.scanPickupPass', () => {
  it('allows reception to scan a pickup pass', async () => {
    const h = buildHarness();
    const result = await h.service.scanPickupPass({ qrToken: 'tok-abc' }, receptionCaller);
    expect(result.result).toBe('valid');
    expect(h.pickupPasses.scan).toHaveBeenCalledWith('tok-abc');
  });

  it('rejects a driver scanning a pickup pass', async () => {
    const h = buildHarness();
    const driverCaller: CallerContext = { userId: 'driver-1', tenantId: 'tenant-1', role: 'driver', platformAdminTier: null };
    await expect(h.service.scanPickupPass({ qrToken: 'tok-abc' }, driverCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.pickupPasses.scan).not.toHaveBeenCalled();
  });
});

describe('SafetyService.confirmHandover', () => {
  it('allows reception to confirm a handover', async () => {
    const h = buildHarness();
    await h.service.confirmHandover({ pickupScanEventId: 'evt-1' }, receptionCaller);
    expect(h.pickupPasses.confirmHandover).toHaveBeenCalledWith('evt-1');
  });

  it('rejects a guardian confirming a handover', async () => {
    const h = buildHarness();
    await expect(h.service.confirmHandover({ pickupScanEventId: 'evt-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

// Fix for EPIC_3_REVIEW.md M4.
describe('SafetyService.revokePickupPass', () => {
  it('allows a guardian to revoke their own pickup pass', async () => {
    const h = buildHarness();
    const result = await h.service.revokePickupPass({ pickupPassId: 'pass-1' }, guardianCaller);
    expect(result.status).toBe('revoked');
    expect(h.pickupPasses.revoke).toHaveBeenCalledWith('pass-1');
  });

  it('rejects a manager revoking a pickup pass (§12: guardian CRUD, manager R-only)', async () => {
    const h = buildHarness();
    await expect(h.service.revokePickupPass({ pickupPassId: 'pass-1' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.pickupPasses.revoke).not.toHaveBeenCalled();
  });

  it('rejects reception revoking a pickup pass', async () => {
    const h = buildHarness();
    await expect(h.service.revokePickupPass({ pickupPassId: 'pass-1' }, receptionCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
