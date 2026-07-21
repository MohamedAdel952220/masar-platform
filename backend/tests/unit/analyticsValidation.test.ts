import { describe, it, expect } from 'vitest';
import {
  listChildAttendanceSummarySchema,
  listTenantSummarySchema,
} from '../../src/validation/analytics.schema.js';

const uuid = '11111111-1111-1111-1111-111111111111';
const uuid2 = '22222222-2222-2222-2222-222222222222';

describe('listChildAttendanceSummarySchema', () => {
  it('accepts an empty object (no filter)', () => {
    expect(listChildAttendanceSummarySchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid childId', () => {
    expect(listChildAttendanceSummarySchema.safeParse({ childId: uuid }).success).toBe(true);
  });

  it('accepts a valid classroomId filter (M1 per-classroom grain)', () => {
    expect(listChildAttendanceSummarySchema.safeParse({ classroomId: uuid }).success).toBe(true);
  });

  it('rejects a non-uuid childId', () => {
    expect(listChildAttendanceSummarySchema.safeParse({ childId: 'nope' }).success).toBe(false);
  });

  it('rejects a non-uuid classroomId', () => {
    expect(listChildAttendanceSummarySchema.safeParse({ classroomId: 'nope' }).success).toBe(false);
  });

  // L1: cursor-based pagination
  it('accepts a valid composite cursor', () => {
    expect(
      listChildAttendanceSummarySchema.safeParse({ cursor: { childId: uuid, classroomId: uuid2 } }).success,
    ).toBe(true);
  });

  it('rejects a partial cursor (missing classroomId)', () => {
    expect(listChildAttendanceSummarySchema.safeParse({ cursor: { childId: uuid } }).success).toBe(false);
  });

  it('rejects a non-uuid cursor component', () => {
    expect(
      listChildAttendanceSummarySchema.safeParse({ cursor: { childId: 'bad', classroomId: uuid2 } }).success,
    ).toBe(false);
  });

  it('accepts a valid limit and rejects out-of-range limits', () => {
    expect(listChildAttendanceSummarySchema.safeParse({ limit: 50 }).success).toBe(true);
    expect(listChildAttendanceSummarySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(listChildAttendanceSummarySchema.safeParse({ limit: -1 }).success).toBe(false);
    expect(listChildAttendanceSummarySchema.safeParse({ limit: 5000 }).success).toBe(false);
  });
});

describe('listTenantSummarySchema', () => {
  it('accepts an empty object', () => {
    expect(listTenantSummarySchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid tenantId', () => {
    expect(listTenantSummarySchema.safeParse({ tenantId: uuid }).success).toBe(true);
  });

  it('rejects a non-uuid tenantId', () => {
    expect(listTenantSummarySchema.safeParse({ tenantId: 'nope' }).success).toBe(false);
  });

  it('accepts a valid uuid cursor and rejects a malformed one', () => {
    expect(listTenantSummarySchema.safeParse({ cursor: uuid }).success).toBe(true);
    expect(listTenantSummarySchema.safeParse({ cursor: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects an out-of-range limit', () => {
    expect(listTenantSummarySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(listTenantSummarySchema.safeParse({ limit: 501 }).success).toBe(false);
  });
});
