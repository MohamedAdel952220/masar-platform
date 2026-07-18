import { describe, it, expect } from 'vitest';
import {
  submitRequestSchema,
  reviewRequestSchema,
  updateRsvpSchema,
  registerForTripSchema,
  cancelTripRegistrationSchema,
} from '../../src/validation/approvals.schema.js';

const classroomId = '11111111-1111-1111-1111-111111111111';
const subjectId = '22222222-2222-2222-2222-222222222222';
const eventId = '33333333-3333-3333-3333-333333333333';
const childId = '44444444-4444-4444-4444-444444444444';
const requestId = '55555555-5555-5555-5555-555555555555';
const registrationId = '66666666-6666-6666-6666-666666666666';

describe('submitRequestSchema', () => {
  const base = { type: 'exam' as const, title: 'Mid-term', requestDate: '2026-08-01', examKind: 'weekly' as const };

  it('accepts a valid exam request', () => {
    expect(submitRequestSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an exam request with no examKind', () => {
    const { examKind, ...rest } = base;
    expect(submitRequestSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a non-trip request carrying place/price', () => {
    expect(submitRequestSchema.safeParse({ ...base, place: 'Zoo', price: 100 }).success).toBe(false);
  });

  it('accepts a trip request with place/price', () => {
    expect(
      submitRequestSchema.safeParse({ type: 'trip', title: 'Zoo trip', requestDate: '2026-08-01', place: 'Zoo', price: 100 }).success,
    ).toBe(true);
  });

  it('accepts a classroom/subject-scoped request', () => {
    expect(submitRequestSchema.safeParse({ ...base, classroomId, subjectId }).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(submitRequestSchema.safeParse({ ...base, title: '  ' }).success).toBe(false);
  });

  // Fix for EPIC_5_REVIEW.md M4: examKind must be rejected for a non-exam
  // type, not just required for an exam type (symmetric with the DB's
  // requests_exam_kind_requires_exam constraint).
  it('rejects examKind being set on a non-exam (trip) request', () => {
    expect(
      submitRequestSchema.safeParse({ type: 'trip', title: 'Zoo trip', requestDate: '2026-08-01', place: 'Zoo', price: 100, examKind: 'weekly' })
        .success,
    ).toBe(false);
  });

  it('rejects examKind being set on a non-exam (event) request', () => {
    expect(
      submitRequestSchema.safeParse({ type: 'event', title: 'Party', requestDate: '2026-08-01', examKind: 'monthly' }).success,
    ).toBe(false);
  });

  // Fix for EPIC_5_REVIEW.md L2: requestTime/requestDate reject
  // semantically invalid values, not just malformed shapes.
  it('rejects an out-of-range requestTime', () => {
    expect(submitRequestSchema.safeParse({ ...base, requestTime: '25:61' }).success).toBe(false);
  });

  it('accepts a valid requestTime', () => {
    expect(submitRequestSchema.safeParse({ ...base, requestTime: '14:30' }).success).toBe(true);
  });

  it('rejects an invalid calendar requestDate', () => {
    expect(submitRequestSchema.safeParse({ ...base, requestDate: '2026-02-30' }).success).toBe(false);
  });

  // Fix for EPIC_5_REVIEW.md L4: price is constrained to 2 decimal places,
  // matching the DB's numeric(10,2) column.
  it('rejects a price with more than 2 decimal places', () => {
    expect(
      submitRequestSchema.safeParse({ type: 'trip', title: 'Zoo trip', requestDate: '2026-08-01', place: 'Zoo', price: 100.999 }).success,
    ).toBe(false);
  });
});

describe('reviewRequestSchema', () => {
  it('accepts an approval with no reason', () => {
    expect(reviewRequestSchema.safeParse({ requestId, decision: 'approved' }).success).toBe(true);
  });

  it('rejects a rejection with no rejectionReason', () => {
    expect(reviewRequestSchema.safeParse({ requestId, decision: 'rejected' }).success).toBe(false);
  });

  it('accepts a rejection with a rejectionReason', () => {
    expect(reviewRequestSchema.safeParse({ requestId, decision: 'rejected', rejectionReason: 'Conflicts with exam schedule' }).success).toBe(true);
  });
});

describe('updateRsvpSchema', () => {
  it('accepts a valid payload', () => {
    expect(updateRsvpSchema.safeParse({ eventId, childId, attendee: 'both' }).success).toBe(true);
  });

  it('rejects an invalid contactPhone', () => {
    expect(updateRsvpSchema.safeParse({ eventId, childId, attendee: 'child', contactPhone: '0100123' }).success).toBe(false);
  });

  it('accepts a valid E.164 contactPhone', () => {
    expect(updateRsvpSchema.safeParse({ eventId, childId, attendee: 'mother', contactPhone: '+201001234567' }).success).toBe(true);
  });
});

describe('registerForTripSchema', () => {
  it('accepts a valid payload', () => {
    expect(registerForTripSchema.safeParse({ eventId, childId }).success).toBe(true);
  });

  it('rejects a non-uuid eventId', () => {
    expect(registerForTripSchema.safeParse({ eventId: 'not-a-uuid', childId }).success).toBe(false);
  });
});

describe('cancelTripRegistrationSchema', () => {
  it('accepts a valid payload', () => {
    expect(cancelTripRegistrationSchema.safeParse({ registrationId }).success).toBe(true);
  });

  it('rejects a missing registrationId', () => {
    expect(cancelTripRegistrationSchema.safeParse({}).success).toBe(false);
  });
});
