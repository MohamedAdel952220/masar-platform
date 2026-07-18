import { describe, it, expect, vi } from 'vitest';
import { TransportService } from '../../src/services/transportService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { Bus, BusRider, Trip } from '../../src/types/domain.epic3.js';

function makeBusRider(overrides: Partial<BusRider> = {}): BusRider {
  return { id: 'rider-1', busId: 'bus-1', childId: 'child-1', tenantId: 'tenant-1', pickupAddressOverride: null, active: true, ...overrides };
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return { id: 'trip-1', tenantId: 'tenant-1', busId: 'bus-1', leg: 'am', serviceDate: '2026-07-15', status: 'moving', startedAt: '2026-07-15T06:00:00Z', arrivedAt: null, completedAt: null, ...overrides };
}

function buildHarness() {
  const buses = {
    assignRider: vi.fn(async () => makeBusRider()),
    unassignRider: vi.fn(async () => makeBusRider({ active: false })),
    findById: vi.fn(async () => null as Bus | null),
    createWithDriver: vi.fn(async () => ({ id: 'bus-1' }) as Bus),
  };
  const trips = {
    start: vi.fn(async () => ({ trip: makeTrip(), tripStopRiders: [] })),
    recordGpsPing: vi.fn(async () => ({ id: 'ping-1', tripId: 'trip-1', tenantId: 'tenant-1', lat: 30.1, lng: 31.2, heading: null, speedKph: null, recordedAt: '2026-07-15T06:05:00Z' })),
    updateChildStatus: vi.fn(async () => ({ id: 'tcs-1', tripId: 'trip-1', childId: 'child-1', tenantId: 'tenant-1', status: 'picked_up' as const, statusChangedAt: '2026-07-15T06:10:00Z', changedBy: 'driver-1' })),
    complete: vi.fn(async () => makeTrip({ status: 'completed', completedAt: '2026-07-15T07:00:00Z' })),
  };
  // deno-lint-ignore no-explicit-any
  const service = new TransportService(buses as any, trips as any);
  return { service, buses, trips };
}

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const driverCaller: CallerContext = { userId: 'driver-1', tenantId: 'tenant-1', role: 'driver', platformAdminTier: null };
const receptionCaller: CallerContext = { userId: 'reception-1', tenantId: 'tenant-1', role: 'reception', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };

describe('TransportService.assignBusRider / unassignBusRider', () => {
  it('allows a manager to assign a bus rider', async () => {
    const h = buildHarness();
    await h.service.assignBusRider({ busId: 'bus-1', childId: 'child-1' }, managerCaller);
    expect(h.buses.assignRider).toHaveBeenCalledWith({ busId: 'bus-1', childId: 'child-1' });
  });

  it('rejects a driver assigning a bus rider', async () => {
    const h = buildHarness();
    await expect(h.service.assignBusRider({ busId: 'bus-1', childId: 'child-1' }, driverCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.buses.assignRider).not.toHaveBeenCalled();
  });

  it('allows a manager to unassign a bus rider', async () => {
    const h = buildHarness();
    await h.service.unassignBusRider({ busRiderId: 'rider-1' }, managerCaller);
    expect(h.buses.unassignRider).toHaveBeenCalledWith('rider-1');
  });

  it('rejects a guardian unassigning a bus rider', async () => {
    const h = buildHarness();
    await expect(h.service.unassignBusRider({ busRiderId: 'rider-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('TransportService.startTrip / recordGpsPing / completeTrip', () => {
  it('allows a driver to start a trip', async () => {
    const h = buildHarness();
    await h.service.startTrip({ busId: 'bus-1', leg: 'am' }, driverCaller);
    expect(h.trips.start).toHaveBeenCalledWith('bus-1', 'am');
  });

  it('rejects a manager starting a trip', async () => {
    const h = buildHarness();
    await expect(h.service.startTrip({ busId: 'bus-1', leg: 'am' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('allows a driver to record a GPS ping', async () => {
    const h = buildHarness();
    await h.service.recordGpsPing({ tripId: 'trip-1', lat: 30.1, lng: 31.2 }, driverCaller);
    expect(h.trips.recordGpsPing).toHaveBeenCalled();
  });

  it('rejects a guardian recording a GPS ping', async () => {
    const h = buildHarness();
    await expect(h.service.recordGpsPing({ tripId: 'trip-1', lat: 30.1, lng: 31.2 }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('allows a driver to complete a trip', async () => {
    const h = buildHarness();
    await h.service.completeTrip({ tripId: 'trip-1' }, driverCaller);
    expect(h.trips.complete).toHaveBeenCalledWith('trip-1');
  });

  it('rejects reception completing a trip', async () => {
    const h = buildHarness();
    await expect(h.service.completeTrip({ tripId: 'trip-1' }, receptionCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('TransportService.updateChildTripStatus', () => {
  it('allows a driver to update a child trip status', async () => {
    const h = buildHarness();
    await h.service.updateChildTripStatus({ tripId: 'trip-1', childId: 'child-1', status: 'picked_up' }, driverCaller);
    expect(h.trips.updateChildStatus).toHaveBeenCalled();
  });

  it('allows reception to update a child trip status', async () => {
    const h = buildHarness();
    await h.service.updateChildTripStatus({ tripId: 'trip-1', childId: 'child-1', status: 'dropped_off' }, receptionCaller);
    expect(h.trips.updateChildStatus).toHaveBeenCalled();
  });

  it('rejects a manager updating a child trip status directly', async () => {
    const h = buildHarness();
    await expect(h.service.updateChildTripStatus({ tripId: 'trip-1', childId: 'child-1', status: 'picked_up' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
