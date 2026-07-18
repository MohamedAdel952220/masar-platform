import { describe, it, expect, vi } from 'vitest';
import { enrollChildRoute } from '../../src/api/routes/enrollChild.js';
import { addStaffRoute } from '../../src/api/routes/addStaff.js';
import { markAttendanceRoute, withdrawChildRoute } from '../../src/api/routes/academicRecords.js';
import type { CallerContext } from '../../src/types/domain.js';

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'manager', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'teacher', platformAdminTier: null };

describe('enrollChildRoute — manager-only gating', () => {
  const validBody = {
    classroomId: '11111111-1111-1111-1111-111111111111',
    child: { name: 'Yousef Adel', dob: '2020-05-14', gender: 'male', package: 'full_day' },
    guardian: { name: 'Mona Adel', phone: '+201002223344', relation: 'mother' },
  };

  it('allows a manager', async () => {
    const service = { enroll: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/childEnrollmentService.js').ChildEnrollmentService;
    await expect(enrollChildRoute(service, managerCaller, validBody)).resolves.toBeDefined();
  });

  it('rejects a teacher', async () => {
    const service = { enroll: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/childEnrollmentService.js').ChildEnrollmentService;
    await expect(enrollChildRoute(service, teacherCaller, validBody)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(service.enroll).not.toHaveBeenCalled();
  });

  it('rejects an invalid body even for a manager', async () => {
    const service = { enroll: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/childEnrollmentService.js').ChildEnrollmentService;
    await expect(enrollChildRoute(service, managerCaller, { ...validBody, guardian: { ...validBody.guardian, phone: 'bad' } })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

describe('addStaffRoute — manager-only gating, tenantId taken from caller JWT', () => {
  const validBody = { role: 'teacher', name: 'Sara Mahmoud', phone: '+201009998888' };

  it('allows a manager and injects tenantId from the caller context', async () => {
    const service = { add: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/addStaffService.js').AddStaffService;
    await addStaffRoute(service, managerCaller, validBody);
    expect(service.add).toHaveBeenCalledWith(expect.objectContaining({ tenantId: '11111111-1111-1111-1111-111111111111' }), 'manager-1');
  });

  it('rejects a teacher', async () => {
    const service = { add: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/addStaffService.js').AddStaffService;
    await expect(addStaffRoute(service, teacherCaller, validBody)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(service.add).not.toHaveBeenCalled();
  });

  it('ignores any client-sent tenantId in favor of the caller\'s own (§13.2)', async () => {
    const service = { add: vi.fn(async () => ({ ok: true })) } as unknown as import('../../src/services/addStaffService.js').AddStaffService;
    await addStaffRoute(service, managerCaller, { ...validBody, tenantId: 'forged-tenant' });
    expect(service.add).toHaveBeenCalledWith(expect.objectContaining({ tenantId: '11111111-1111-1111-1111-111111111111' }), 'manager-1');
  });
});

describe('markAttendanceRoute / withdrawChildRoute — validation', () => {
  it('rejects an invalid markAttendance body', async () => {
    const service = { markAttendance: vi.fn(), submitEvaluation: vi.fn(), withdrawChild: vi.fn(), suspendChild: vi.fn(), reactivateChild: vi.fn() } as unknown as import('../../src/services/academicRecordService.js').AcademicRecordService;
    await expect(markAttendanceRoute(service, teacherCaller, { classroomId: 'not-a-uuid', date: '2026-07-15', records: [] })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('passes a valid withdrawChild body through to the service', async () => {
    const service = { withdrawChild: vi.fn(async () => ({ id: 'child-1' })) } as unknown as import('../../src/services/academicRecordService.js').AcademicRecordService;
    await withdrawChildRoute(service, managerCaller, { childId: '11111111-1111-1111-1111-111111111111', reason: 'Relocated' });
    expect(service.withdrawChild).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', managerCaller, 'Relocated');
  });
});
