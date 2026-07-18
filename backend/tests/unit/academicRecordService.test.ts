import { describe, it, expect, vi } from 'vitest';
import { AcademicRecordService } from '../../src/services/academicRecordService.js';
import type { Child } from '../../src/types/domain.epic2.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { MarkAttendanceInput, SubmitEvaluationInput } from '../../src/validation/academic.schema.js';

function makeChild(overrides: Partial<Child> = {}): Child {
  return {
    id: 'child-1',
    tenantId: 'tenant-1',
    name: 'Yousef Adel',
    nameAr: null,
    dob: '2020-05-14',
    gender: 'male',
    classroomId: 'classroom-1',
    package: 'full_day',
    membershipStatus: 'active',
    dayPathStatus: 'at_home',
    deletedAt: null,
    ...overrides,
  };
}

function buildHarness(childOverrides: Partial<Child> = {}) {
  const childRecord = makeChild(childOverrides);
  const children = {
    findById: vi.fn(async () => childRecord),
    withdraw: vi.fn(async () => childRecord),
    suspend: vi.fn(async () => childRecord),
    reactivate: vi.fn(async () => childRecord),
  };
  const attendance = { mark: vi.fn(async () => ({ classroomId: 'classroom-1', date: '2026-07-15', presentCount: 1, absentCount: 0, total: 1 })) };
  const evaluations = { submit: vi.fn(async () => ({ id: 'eval-1', tenantId: 'tenant-1', childId: 'child-1', lessonId: 'lesson-1', understanding: 4, participation: 5, behavior: 3, homework: 'done' as const, note: null })) };
  // deno-lint-ignore no-explicit-any
  const service = new AcademicRecordService(children as any, attendance as any, evaluations as any);
  return { service, children, attendance, evaluations, childRecord };
}

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const otherTenantManager: CallerContext = { userId: 'manager-2', tenantId: 'tenant-2', role: 'manager', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };

const attendanceInput: MarkAttendanceInput = { classroomId: 'classroom-1', date: '2026-07-15', records: [{ childId: 'child-1', present: true }] };
const evaluationInput: SubmitEvaluationInput = { childId: 'child-1', lessonId: 'lesson-1', understanding: 4, participation: 5, behavior: 3, homework: 'done' };

describe('AcademicRecordService.markAttendance', () => {
  it('allows a teacher to mark attendance', async () => {
    const h = buildHarness();
    await h.service.markAttendance(attendanceInput, teacherCaller);
    expect(h.attendance.mark).toHaveBeenCalledWith(attendanceInput);
  });

  it('allows a manager to mark attendance (override)', async () => {
    const h = buildHarness();
    await h.service.markAttendance(attendanceInput, managerCaller);
    expect(h.attendance.mark).toHaveBeenCalled();
  });

  it('rejects a guardian', async () => {
    const h = buildHarness();
    await expect(h.service.markAttendance(attendanceInput, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.attendance.mark).not.toHaveBeenCalled();
  });
});

describe('AcademicRecordService.submitEvaluation', () => {
  it('allows a teacher to submit an evaluation', async () => {
    const h = buildHarness();
    await h.service.submitEvaluation(evaluationInput, teacherCaller);
    expect(h.evaluations.submit).toHaveBeenCalledWith(evaluationInput);
  });

  it('rejects a manager (matrix: evaluations are teacher CRU, manager R-only)', async () => {
    const h = buildHarness();
    await expect(h.service.submitEvaluation(evaluationInput, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('AcademicRecordService.withdrawChild', () => {
  it('allows a manager to withdraw a child in their own tenant', async () => {
    const h = buildHarness();
    await h.service.withdrawChild('child-1', managerCaller, 'Relocated');
    expect(h.children.withdraw).toHaveBeenCalledWith('child-1', 'Relocated');
  });

  it('rejects a non-manager', async () => {
    const h = buildHarness();
    await expect(h.service.withdrawChild('child-1', teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('rejects a manager from a different tenant', async () => {
    const h = buildHarness();
    await expect(h.service.withdrawChild('child-1', otherTenantManager)).rejects.toMatchObject({ code: 'PERM_TENANT_MISMATCH' });
    expect(h.children.withdraw).not.toHaveBeenCalled();
  });

  it('rejects a child that does not exist', async () => {
    const h = buildHarness();
    h.children.findById = vi.fn(async () => null) as unknown as typeof h.children.findById;
    await expect(h.service.withdrawChild('child-404', managerCaller)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('AcademicRecordService.suspendChild / reactivateChild', () => {
  it('suspends an active child', async () => {
    const h = buildHarness({ membershipStatus: 'active' });
    await h.service.suspendChild('child-1', managerCaller);
    expect(h.children.suspend).toHaveBeenCalledWith('child-1', undefined);
  });

  it('rejects suspending an already-suspended child', async () => {
    const h = buildHarness({ membershipStatus: 'suspended' });
    await expect(h.service.suspendChild('child-1', managerCaller)).rejects.toMatchObject({ code: 'STATE_ALREADY_PROCESSED' });
  });

  it('reactivates a suspended child', async () => {
    const h = buildHarness({ membershipStatus: 'suspended' });
    await h.service.reactivateChild('child-1', managerCaller);
    expect(h.children.reactivate).toHaveBeenCalledWith('child-1');
  });

  it('rejects reactivating a child that is not suspended', async () => {
    const h = buildHarness({ membershipStatus: 'active' });
    await expect(h.service.reactivateChild('child-1', managerCaller)).rejects.toMatchObject({ code: 'STATE_ALREADY_PROCESSED' });
  });
});
