import { describe, it, expect } from 'vitest';
import {
  childFieldsSchema,
  enrollChildSchema,
  markAttendanceSchema,
  submitEvaluationSchema,
  withdrawChildSchema,
  suspendChildSchema,
  reactivateChildSchema,
} from '../../src/validation/academic.schema.js';

const validChild = {
  name: 'Yousef Adel',
  dob: '2020-05-14',
  gender: 'male',
  package: 'full_day',
};

const validGuardian = {
  name: 'Mona Adel',
  phone: '+201002223344',
  relation: 'mother',
};

describe('childFieldsSchema', () => {
  it('accepts a minimal valid child payload', () => {
    expect(childFieldsSchema.safeParse(validChild).success).toBe(true);
  });

  it('rejects a missing dob', () => {
    const { dob: _drop, ...rest } = validChild;
    expect(childFieldsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an invalid gender', () => {
    expect(childFieldsSchema.safeParse({ ...validChild, gender: 'other' }).success).toBe(false);
  });

  it('rejects an invalid package', () => {
    expect(childFieldsSchema.safeParse({ ...validChild, package: 'weekly' }).success).toBe(false);
  });

  it('accepts optional address/contact fields when provided', () => {
    const result = childFieldsSchema.safeParse({
      ...validChild,
      addressLine: '12 Tahrir St.',
      addressLat: 30.05,
      addressLng: 31.23,
      fatherPhone: '+201009998888',
    });
    expect(result.success).toBe(true);
  });
});

describe('enrollChildSchema', () => {
  const valid = { classroomId: '11111111-1111-1111-1111-111111111111', child: validChild, guardian: validGuardian };

  it('accepts a complete valid payload', () => {
    expect(enrollChildSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a non-uuid classroomId', () => {
    expect(enrollChildSchema.safeParse({ ...valid, classroomId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects an invalid guardian relation', () => {
    expect(enrollChildSchema.safeParse({ ...valid, guardian: { ...validGuardian, relation: 'uncle' } }).success).toBe(false);
  });

  it('rejects a guardian phone missing the country code', () => {
    expect(enrollChildSchema.safeParse({ ...valid, guardian: { ...validGuardian, phone: '01002223344' } }).success).toBe(false);
  });
});

describe('markAttendanceSchema', () => {
  const valid = {
    classroomId: '11111111-1111-1111-1111-111111111111',
    date: '2026-07-15',
    records: [{ childId: '22222222-2222-2222-2222-222222222222', present: true }],
  };

  it('accepts a valid payload', () => {
    expect(markAttendanceSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty records array', () => {
    expect(markAttendanceSchema.safeParse({ ...valid, records: [] }).success).toBe(false);
  });

  it('rejects a record with a non-boolean present value', () => {
    expect(markAttendanceSchema.safeParse({ ...valid, records: [{ childId: valid.records[0]!.childId, present: 'yes' }] }).success).toBe(false);
  });
});

describe('submitEvaluationSchema', () => {
  const valid = {
    childId: '11111111-1111-1111-1111-111111111111',
    lessonId: '22222222-2222-2222-2222-222222222222',
    understanding: 4,
    participation: 5,
    behavior: 3,
    homework: 'done',
  };

  it('accepts a valid payload', () => {
    expect(submitEvaluationSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a rating below 1', () => {
    expect(submitEvaluationSchema.safeParse({ ...valid, understanding: 0 }).success).toBe(false);
  });

  it('rejects a rating above 5', () => {
    expect(submitEvaluationSchema.safeParse({ ...valid, behavior: 6 }).success).toBe(false);
  });

  it('rejects an invalid homework status', () => {
    expect(submitEvaluationSchema.safeParse({ ...valid, homework: 'excused' }).success).toBe(false);
  });
});

describe('withdrawChildSchema / suspendChildSchema / reactivateChildSchema', () => {
  const childId = '11111111-1111-1111-1111-111111111111';

  it('requires a UUID childId', () => {
    expect(withdrawChildSchema.safeParse({ childId }).success).toBe(true);
    expect(suspendChildSchema.safeParse({ childId }).success).toBe(true);
    expect(reactivateChildSchema.safeParse({ childId }).success).toBe(true);
    expect(reactivateChildSchema.safeParse({ childId: 'not-a-uuid' }).success).toBe(false);
  });

  it('accepts an optional reason on withdraw/suspend', () => {
    expect(withdrawChildSchema.safeParse({ childId, reason: 'Relocated' }).success).toBe(true);
    expect(suspendChildSchema.safeParse({ childId, reason: 'Non-payment' }).success).toBe(true);
  });
});
