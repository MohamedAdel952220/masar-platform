import { describe, it, expect } from 'vitest';
import {
  addBusSchema,
  assignBusRiderSchema,
  startTripSchema,
  recordGpsPingSchema,
  updateChildTripStatusSchema,
  createPickupPassSchema,
  scanPickupPassSchema,
  revokePickupPassSchema,
} from '../../src/validation/transport.schema.js';

const busId = '11111111-1111-1111-1111-111111111111';
const childId = '22222222-2222-2222-2222-222222222222';
const tripId = '33333333-3333-3333-3333-333333333333';

describe('addBusSchema', () => {
  const valid = { number: 'B-12', plate: 'ABC-123', capacity: 20, driver: { name: 'Karim Adel', phone: '+201007778888' } };

  it('accepts a valid payload', () => {
    expect(addBusSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a non-positive capacity', () => {
    expect(addBusSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
  });

  it('rejects a driver phone missing the country code', () => {
    expect(addBusSchema.safeParse({ ...valid, driver: { ...valid.driver, phone: '01007778888' } }).success).toBe(false);
  });

  it('rejects a missing driver name', () => {
    const { name: _drop, ...rest } = valid.driver;
    expect(addBusSchema.safeParse({ ...valid, driver: rest }).success).toBe(false);
  });
});

describe('assignBusRiderSchema', () => {
  it('accepts a valid payload', () => {
    expect(assignBusRiderSchema.safeParse({ busId, childId }).success).toBe(true);
  });

  it('rejects a non-uuid busId', () => {
    expect(assignBusRiderSchema.safeParse({ busId: 'not-a-uuid', childId }).success).toBe(false);
  });
});

describe('startTripSchema', () => {
  it('accepts am/pm legs', () => {
    expect(startTripSchema.safeParse({ busId, leg: 'am' }).success).toBe(true);
    expect(startTripSchema.safeParse({ busId, leg: 'pm' }).success).toBe(true);
  });

  it('rejects an invalid leg', () => {
    expect(startTripSchema.safeParse({ busId, leg: 'noon' }).success).toBe(false);
  });
});

describe('recordGpsPingSchema', () => {
  const valid = { tripId, lat: 30.05, lng: 31.23 };

  it('accepts a valid payload', () => {
    expect(recordGpsPingSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an out-of-range latitude', () => {
    expect(recordGpsPingSchema.safeParse({ ...valid, lat: 91 }).success).toBe(false);
  });

  it('rejects a negative speed', () => {
    expect(recordGpsPingSchema.safeParse({ ...valid, speedKph: -5 }).success).toBe(false);
  });
});

describe('updateChildTripStatusSchema', () => {
  it('accepts every trip child status value', () => {
    for (const status of ['pending', 'picked_up', 'dropped_off', 'absent']) {
      expect(updateChildTripStatusSchema.safeParse({ tripId, childId, status }).success).toBe(true);
    }
  });

  it('rejects an invalid status', () => {
    expect(updateChildTripStatusSchema.safeParse({ tripId, childId, status: 'boarding' }).success).toBe(false);
  });
});

describe('createPickupPassSchema', () => {
  const valid = { childId, personName: 'Amira Hassan', relation: 'aunt' };

  it('accepts a valid payload', () => {
    expect(createPickupPassSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid relation', () => {
    expect(createPickupPassSchema.safeParse({ ...valid, relation: 'neighbor' }).success).toBe(false);
  });

  it('rejects an empty personName', () => {
    expect(createPickupPassSchema.safeParse({ ...valid, personName: '  ' }).success).toBe(false);
  });
});

describe('scanPickupPassSchema', () => {
  it('accepts a non-empty token', () => {
    expect(scanPickupPassSchema.safeParse({ qrToken: 'tok-abc' }).success).toBe(true);
  });

  it('rejects an empty token', () => {
    expect(scanPickupPassSchema.safeParse({ qrToken: '' }).success).toBe(false);
  });
});

// Fix for EPIC_3_REVIEW.md M4.
describe('revokePickupPassSchema', () => {
  it('accepts a valid uuid', () => {
    expect(revokePickupPassSchema.safeParse({ pickupPassId: childId }).success).toBe(true);
  });

  it('rejects a non-uuid pickupPassId', () => {
    expect(revokePickupPassSchema.safeParse({ pickupPassId: 'not-a-uuid' }).success).toBe(false);
  });
});
