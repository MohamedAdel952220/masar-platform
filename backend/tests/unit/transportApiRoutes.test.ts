import { describe, it, expect, vi } from 'vitest';
import { addBusRoute } from '../../src/api/routes/addBus.js';
import { assignBusRiderRoute, startTripRoute, scanPickupPassRoute, revokePickupPassRoute } from '../../src/api/routes/transport.js';
import type { CallerContext } from '../../src/types/domain.js';

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'manager', platformAdminTier: null };
const driverCaller: CallerContext = { userId: 'driver-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'driver', platformAdminTier: null };
const receptionCaller: CallerContext = { userId: 'reception-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'reception', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'guardian', platformAdminTier: null };

describe('addBusRoute — manager-only gating, tenantId taken from caller JWT', () => {
  const validBody = { number: 'B-12', plate: 'ABC-123', capacity: 20, driver: { name: 'Karim Adel', phone: '+201007778888' } };

  it('allows a manager and injects tenantId from the caller context', async () => {
    const service = { add: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/addBusService.js').AddBusService;
    await addBusRoute(service, managerCaller, validBody);
    expect(service.add).toHaveBeenCalledWith(validBody, '11111111-1111-1111-1111-111111111111', 'manager-1');
  });

  it('rejects a driver', async () => {
    const service = { add: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/addBusService.js').AddBusService;
    await expect(addBusRoute(service, driverCaller, validBody)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(service.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid body even for a manager', async () => {
    const service = { add: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/addBusService.js').AddBusService;
    await expect(addBusRoute(service, managerCaller, { ...validBody, capacity: -1 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('assignBusRiderRoute / startTripRoute / scanPickupPassRoute — validation', () => {
  it('rejects an invalid assignBusRider body', async () => {
    const service = { assignBusRider: vi.fn() } as unknown as import('../../src/services/transportService.js').TransportService;
    await expect(assignBusRiderRoute(service, managerCaller, { busId: 'not-a-uuid', childId: 'also-not-a-uuid' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('passes a valid startTrip body through to the service', async () => {
    const service = { startTrip: vi.fn(async () => ({ trip: { id: 'trip-1' }, tripStopRiders: [] })) } as unknown as import('../../src/services/transportService.js').TransportService;
    await startTripRoute(service, driverCaller, { busId: '11111111-1111-1111-1111-111111111111', leg: 'am' });
    expect(service.startTrip).toHaveBeenCalledWith({ busId: '11111111-1111-1111-1111-111111111111', leg: 'am' }, driverCaller);
  });

  it('passes a valid scanPickupPass body through to the service', async () => {
    const service = { scanPickupPass: vi.fn(async () => ({ result: 'valid', scanEventId: 'evt-1', pass: null })) } as unknown as import('../../src/services/safetyService.js').SafetyService;
    await scanPickupPassRoute(service, receptionCaller, { qrToken: 'tok-abc' });
    expect(service.scanPickupPass).toHaveBeenCalledWith({ qrToken: 'tok-abc' }, receptionCaller);
  });
});

// Fix for EPIC_3_REVIEW.md M4.
describe('revokePickupPassRoute', () => {
  it('passes a valid body through to the service for a guardian', async () => {
    const service = { revokePickupPass: vi.fn(async () => ({ id: 'pass-1', status: 'revoked' })) } as unknown as import('../../src/services/safetyService.js').SafetyService;
    await revokePickupPassRoute(service, guardianCaller, { pickupPassId: '11111111-1111-1111-1111-111111111111' });
    expect(service.revokePickupPass).toHaveBeenCalledWith({ pickupPassId: '11111111-1111-1111-1111-111111111111' }, guardianCaller);
  });

  it('rejects an invalid body', async () => {
    const service = { revokePickupPass: vi.fn() } as unknown as import('../../src/services/safetyService.js').SafetyService;
    await expect(revokePickupPassRoute(service, guardianCaller, { pickupPassId: 'not-a-uuid' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
