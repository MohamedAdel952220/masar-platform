import { describe, it, expect, vi } from 'vitest';
import { ApprovalRequestService } from '../../src/services/approvalRequestService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { ApprovalRequest, ReviewRequestResult } from '../../src/types/domain.epic5.js';

function makeRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'req-1',
    tenantId: 'tenant-1',
    submittedBy: 'teacher-1',
    type: 'exam',
    examKind: 'weekly',
    title: 'Mid-term',
    classroomId: null,
    subjectId: null,
    requestDate: '2026-08-01',
    requestTime: null,
    note: null,
    place: null,
    price: null,
    attachmentObjectId: null,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

function buildHarness() {
  const requests = {
    submit: vi.fn(async () => makeRequest()),
    review: vi.fn(async (): Promise<ReviewRequestResult> => ({ request: makeRequest({ status: 'approved' }), event: null })),
    listForTeacher: vi.fn(async () => [makeRequest()]),
    listPendingForTenant: vi.fn(async () => [makeRequest()]),
  };
  // deno-lint-ignore no-explicit-any
  const service = new ApprovalRequestService(requests as any);
  return { service, requests };
}

const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };

const examInput = { type: 'exam' as const, title: 'Mid-term', requestDate: '2026-08-01', examKind: 'weekly' as const };

describe('ApprovalRequestService.submit', () => {
  it('allows a teacher to submit a request', async () => {
    const h = buildHarness();
    await h.service.submit(examInput, teacherCaller);
    expect(h.requests.submit).toHaveBeenCalledWith(examInput);
  });

  it('rejects a manager submitting a request', async () => {
    const h = buildHarness();
    await expect(h.service.submit(examInput, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.requests.submit).not.toHaveBeenCalled();
  });

  it('rejects an exam request with no examKind before ever calling the repository', async () => {
    const h = buildHarness();
    const { examKind, ...rest } = examInput;
    await expect(h.service.submit(rest as typeof examInput, teacherCaller)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(h.requests.submit).not.toHaveBeenCalled();
  });
});

describe('ApprovalRequestService.review', () => {
  it('allows a manager to approve a request', async () => {
    const h = buildHarness();
    const result = await h.service.review({ requestId: 'req-1', decision: 'approved' }, managerCaller);
    expect(result.request.status).toBe('approved');
  });

  it('rejects a teacher reviewing a request', async () => {
    const h = buildHarness();
    await expect(h.service.review({ requestId: 'req-1', decision: 'approved' }, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('rejects a rejection with no rejectionReason before ever calling the repository', async () => {
    const h = buildHarness();
    await expect(h.service.review({ requestId: 'req-1', decision: 'rejected' }, managerCaller)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(h.requests.review).not.toHaveBeenCalled();
  });
});

describe('ApprovalRequestService.listOwn / listPending', () => {
  it('allows a teacher to list their own requests', async () => {
    const h = buildHarness();
    await h.service.listOwn(teacherCaller);
    expect(h.requests.listForTeacher).toHaveBeenCalledWith('teacher-1');
  });

  it('rejects a guardian listing their own requests (not a teacher action)', async () => {
    const h = buildHarness();
    await expect(h.service.listOwn(guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('allows a manager to list pending requests for their tenant', async () => {
    const h = buildHarness();
    await h.service.listPending(managerCaller);
    expect(h.requests.listPendingForTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects a teacher listing pending requests (manager-only)', async () => {
    const h = buildHarness();
    await expect(h.service.listPending(teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
