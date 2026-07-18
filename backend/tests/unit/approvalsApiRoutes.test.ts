import { describe, it, expect, vi } from 'vitest';
import {
  submitRequestRoute,
  reviewRequestRoute,
  updateRsvpRoute,
  registerForTripRoute,
  cancelTripRegistrationRoute,
} from '../../src/api/routes/approvals.js';
import type { CallerContext } from '../../src/types/domain.js';

const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };

const eventId = '11111111-1111-1111-1111-111111111111';
const childId = '22222222-2222-2222-2222-222222222222';
const requestId = '33333333-3333-3333-3333-333333333333';
const registrationId = '44444444-4444-4444-4444-444444444444';

describe('submitRequestRoute — validation', () => {
  it('rejects a body missing required fields', async () => {
    const service = { submit: vi.fn() } as unknown as import('../../src/services/approvalRequestService.js').ApprovalRequestService;
    await expect(submitRequestRoute(service, teacherCaller, { title: 'Trip' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { submit: vi.fn(async () => ({ id: 'req-1' })) } as unknown as import('../../src/services/approvalRequestService.js').ApprovalRequestService;
    const body = { type: 'exam', title: 'Mid-term', requestDate: '2026-08-01', examKind: 'weekly' };
    await submitRequestRoute(service, teacherCaller, body);
    expect(service.submit).toHaveBeenCalledWith(body, teacherCaller);
  });
});

describe('reviewRequestRoute — validation', () => {
  it('rejects a rejection with no rejectionReason', async () => {
    const service = { review: vi.fn() } as unknown as import('../../src/services/approvalRequestService.js').ApprovalRequestService;
    await expect(reviewRequestRoute(service, managerCaller, { requestId, decision: 'rejected' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.review).not.toHaveBeenCalled();
  });

  it('passes a valid approval through to the service', async () => {
    const service = { review: vi.fn(async () => ({ request: { id: requestId }, event: null })) } as unknown as import('../../src/services/approvalRequestService.js').ApprovalRequestService;
    await reviewRequestRoute(service, managerCaller, { requestId, decision: 'approved' });
    expect(service.review).toHaveBeenCalledWith({ requestId, decision: 'approved' }, managerCaller);
  });
});

describe('updateRsvpRoute — validation', () => {
  it('rejects a non-uuid eventId', async () => {
    const service = { updateRsvp: vi.fn() } as unknown as import('../../src/services/eventService.js').EventService;
    await expect(updateRsvpRoute(service, guardianCaller, { eventId: 'nope', childId, attendee: 'both' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.updateRsvp).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { updateRsvp: vi.fn(async () => ({ id: 'rsvp-1' })) } as unknown as import('../../src/services/eventService.js').EventService;
    const body = { eventId, childId, attendee: 'both' };
    await updateRsvpRoute(service, guardianCaller, body);
    expect(service.updateRsvp).toHaveBeenCalledWith(body, guardianCaller);
  });
});

describe('registerForTripRoute — validation', () => {
  it('passes a valid body through to the service', async () => {
    const service = { registerForTrip: vi.fn(async () => ({ id: 'reg-1' })) } as unknown as import('../../src/services/eventService.js').EventService;
    const body = { eventId, childId };
    await registerForTripRoute(service, guardianCaller, body);
    expect(service.registerForTrip).toHaveBeenCalledWith(body, guardianCaller);
  });
});

describe('cancelTripRegistrationRoute — validation', () => {
  it('rejects a missing registrationId', async () => {
    const service = { cancelTripRegistration: vi.fn() } as unknown as import('../../src/services/eventService.js').EventService;
    await expect(cancelTripRegistrationRoute(service, guardianCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.cancelTripRegistration).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { cancelTripRegistration: vi.fn(async () => ({ id: registrationId, status: 'cancelled' })) } as unknown as import('../../src/services/eventService.js').EventService;
    await cancelTripRegistrationRoute(service, guardianCaller, { registrationId });
    expect(service.cancelTripRegistration).toHaveBeenCalledWith({ registrationId }, guardianCaller);
  });
});
