import { describe, it, expect, vi } from 'vitest';
import { EventService } from '../../src/services/eventService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { ApprovalEvent, EventRsvp, EventTripRegistration } from '../../src/types/domain.epic5.js';

function makeEvent(overrides: Partial<ApprovalEvent> = {}): ApprovalEvent {
  return {
    id: 'event-1',
    tenantId: 'tenant-1',
    sourceRequestId: null,
    type: 'celebration',
    title: 'End of year party',
    description: null,
    classroomId: null,
    eventDate: '2026-08-01',
    eventTime: null,
    place: null,
    price: null,
    capacity: null,
    ...overrides,
  };
}

function makeRsvp(overrides: Partial<EventRsvp> = {}): EventRsvp {
  return {
    id: 'rsvp-1',
    eventId: 'event-1',
    childId: 'child-1',
    tenantId: 'tenant-1',
    attendee: 'both',
    extraGuestName: null,
    extraGuestRelation: null,
    contactPhone: null,
    respondedAt: '2026-07-20T08:00:00Z',
    ...overrides,
  };
}

function makeRegistration(overrides: Partial<EventTripRegistration> = {}): EventTripRegistration {
  return {
    id: 'reg-1',
    eventId: 'event-1',
    childId: 'child-1',
    tenantId: 'tenant-1',
    status: 'open',
    paymentTransactionId: null,
    ...overrides,
  };
}

function buildHarness() {
  const events = {
    listForTenant: vi.fn(async () => [makeEvent()]),
    updateRsvp: vi.fn(async () => makeRsvp()),
    listRsvpsForChild: vi.fn(async () => [makeRsvp()]),
    registerForTrip: vi.fn(async () => makeRegistration()),
    cancelTripRegistration: vi.fn(async () => makeRegistration({ status: 'cancelled' })),
    listTripRegistrationsForChild: vi.fn(async () => [makeRegistration()]),
  };
  // deno-lint-ignore no-explicit-any
  const service = new EventService(events as any);
  return { service, events };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };

describe('EventService.listForTenant', () => {
  it('lists events for the caller\'s tenant', async () => {
    const h = buildHarness();
    await h.service.listForTenant(managerCaller);
    expect(h.events.listForTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('allows a teacher to list events', async () => {
    const h = buildHarness();
    await h.service.listForTenant(teacherCaller);
    expect(h.events.listForTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('allows a guardian to list events', async () => {
    const h = buildHarness();
    await h.service.listForTenant(guardianCaller);
    expect(h.events.listForTenant).toHaveBeenCalledWith('tenant-1');
  });

  // Fix for EPIC_5_REVIEW.md M3: a role with no documented Events access
  // (§12) must get a clean PERM_ROLE_DENIED, not a silent empty list.
  it('rejects a driver listing events (no documented Events access)', async () => {
    const h = buildHarness();
    const driverCaller: CallerContext = { userId: 'driver-1', tenantId: 'tenant-1', role: 'driver', platformAdminTier: null };
    await expect(h.service.listForTenant(driverCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.events.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects reception listing events (no documented Events access)', async () => {
    const h = buildHarness();
    const receptionCaller: CallerContext = { userId: 'reception-1', tenantId: 'tenant-1', role: 'reception', platformAdminTier: null };
    await expect(h.service.listForTenant(receptionCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.events.listForTenant).not.toHaveBeenCalled();
  });
});

describe('EventService.updateRsvp', () => {
  it('allows a guardian to RSVP', async () => {
    const h = buildHarness();
    await h.service.updateRsvp({ eventId: 'event-1', childId: 'child-1', attendee: 'both' }, guardianCaller);
    expect(h.events.updateRsvp).toHaveBeenCalled();
  });

  it('rejects a teacher RSVPing (matrix: CRU is guardian-only)', async () => {
    const h = buildHarness();
    await expect(h.service.updateRsvp({ eventId: 'event-1', childId: 'child-1', attendee: 'both' }, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.events.updateRsvp).not.toHaveBeenCalled();
  });
});

describe('EventService.registerForTrip', () => {
  it('allows a guardian to register their child for a trip', async () => {
    const h = buildHarness();
    await h.service.registerForTrip({ eventId: 'event-1', childId: 'child-1' }, guardianCaller);
    expect(h.events.registerForTrip).toHaveBeenCalledWith('event-1', 'child-1', 'tenant-1');
  });

  it('rejects a manager registering for a trip (guardian-only action)', async () => {
    const h = buildHarness();
    await expect(h.service.registerForTrip({ eventId: 'event-1', childId: 'child-1' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.events.registerForTrip).not.toHaveBeenCalled();
  });
});

describe('EventService.cancelTripRegistration', () => {
  it('allows a guardian to cancel their own registration', async () => {
    const h = buildHarness();
    const result = await h.service.cancelTripRegistration({ registrationId: 'reg-1' }, guardianCaller);
    expect(result.status).toBe('cancelled');
  });

  it('rejects a teacher cancelling a registration', async () => {
    const h = buildHarness();
    await expect(h.service.cancelTripRegistration({ registrationId: 'reg-1' }, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
