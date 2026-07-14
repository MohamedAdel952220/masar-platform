import { describe, it, expect } from 'vitest';
import { provisionTenantSchema } from '../../src/validation/tenant.schema.js';
import { suspendStaffSchema, revokeSessionsSchema } from '../../src/validation/staff.schema.js';
import { phoneSchema, slugSchema } from '../../src/validation/common.js';

describe('phoneSchema', () => {
  it('accepts a valid E.164 number', () => {
    expect(phoneSchema.safeParse('+201001234567').success).toBe(true);
  });
  it('rejects a local-format number missing +country code', () => {
    expect(phoneSchema.safeParse('01001234567').success).toBe(false);
  });
  it('rejects a number with letters', () => {
    expect(phoneSchema.safeParse('+2010abc4567').success).toBe(false);
  });
});

describe('slugSchema', () => {
  it('accepts a lowercase DNS-safe slug', () => {
    expect(slugSchema.safeParse('sunrise-nursery').success).toBe(true);
  });
  it('rejects uppercase', () => {
    expect(slugSchema.safeParse('SunriseNursery').success).toBe(false);
  });
  it('rejects a slug starting with a hyphen', () => {
    expect(slugSchema.safeParse('-sunrise').success).toBe(false);
  });
  it('rejects a too-short slug', () => {
    expect(slugSchema.safeParse('ab').success).toBe(false);
  });
});

describe('provisionTenantSchema', () => {
  const valid = {
    name: 'Sunrise Nursery',
    slug: 'sunrise',
    planCode: 'growth',
    contactName: 'Nadia Fouad',
    ownerName: 'Nadia Fouad',
    ownerPhone: '+201002223344',
  };

  it('accepts a complete valid payload', () => {
    const result = provisionTenantSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid plan code', () => {
    const result = provisionTenantSchema.safeParse({ ...valid, planCode: 'enterprise' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing owner phone', () => {
    const { ownerPhone: _drop, ...rest } = valid;
    const result = provisionTenantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects an empty tenant name', () => {
    const result = provisionTenantSchema.safeParse({ ...valid, name: '   ' });
    expect(result.success).toBe(false);
  });
});

describe('suspendStaffSchema', () => {
  it('requires a UUID staffId', () => {
    expect(suspendStaffSchema.safeParse({ staffId: 'not-a-uuid' }).success).toBe(false);
    expect(suspendStaffSchema.safeParse({ staffId: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
  });
});

describe('revokeSessionsSchema', () => {
  it('requires a UUID userId', () => {
    expect(revokeSessionsSchema.safeParse({ userId: '22222222-2222-2222-2222-222222222222' }).success).toBe(true);
    expect(revokeSessionsSchema.safeParse({}).success).toBe(false);
  });
});
