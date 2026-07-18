import { describe, it, expect, vi } from 'vitest';
import { AiReportService } from '../../src/services/aiReportService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { AiReportBatch, AiReportDraft, AiUsageCounter } from '../../src/types/domain.epic8.js';

function makeBatch(overrides: Partial<AiReportBatch> = {}): AiReportBatch {
  return {
    id: 'batch-1',
    tenantId: 'tenant-1',
    type: 'monthly_progress',
    scope: 'classroom',
    classroomId: 'classroom-1',
    topic: null,
    createdBy: 'teacher-1',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function makeDraft(overrides: Partial<AiReportDraft> = {}): AiReportDraft {
  return {
    id: 'draft-1',
    batchId: 'batch-1',
    tenantId: 'tenant-1',
    childId: 'child-1',
    body: 'Progressing well.',
    metrics: {},
    status: 'draft',
    scheduledFor: null,
    sentAt: null,
    deliveryChannels: [],
    editedBy: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function makeUsageCounter(overrides: Partial<AiUsageCounter> = {}): AiUsageCounter {
  return { id: 'usage-1', tenantId: 'tenant-1', usageDate: '2026-07-16', callsUsed: 3, ...overrides };
}

function buildHarness() {
  const reports = {
    listBatches: vi.fn(async () => [makeBatch()]),
    listDrafts: vi.fn(async () => [makeDraft()]),
    findDraftById: vi.fn(async () => makeDraft()),
    updateDraft: vi.fn(async () => makeDraft({ body: 'Edited by manager.' })),
    sendDraft: vi.fn(async () => makeDraft({ status: 'sent', sentAt: '2026-07-16T10:00:00Z' })),
    scheduleDraft: vi.fn(async () => makeDraft({ status: 'scheduled', scheduledFor: '2026-08-01T09:00:00Z' })),
    resendDraft: vi.fn(async () => makeDraft({ status: 'sent', sentAt: '2026-07-16T10:00:00Z' })),
    deleteDraft: vi.fn(async () => ({ deleted: true as const, draftId: 'draft-1' })),
    exportDraft: vi.fn(async () => ({ jobId: 'job-1', draftId: 'draft-1', status: 'queued' })),
    getTodayUsageCounter: vi.fn(async () => makeUsageCounter()),
  };
  // deno-lint-ignore no-explicit-any
  const service = new AiReportService(reports as any);
  return { service, reports };
}

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const receptionCaller: CallerContext = { userId: 'reception-1', tenantId: 'tenant-1', role: 'reception', platformAdminTier: null };
const platformAdminCaller: CallerContext = { userId: 'admin-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'support' };

describe('AiReportService.listBatches / listDrafts', () => {
  it('allows manager/teacher/guardian to read (RLS narrows the actual rows)', async () => {
    const h = buildHarness();
    await expect(h.service.listBatches(managerCaller)).resolves.toHaveLength(1);
    await expect(h.service.listBatches(teacherCaller)).resolves.toHaveLength(1);
    await expect(h.service.listDrafts({}, guardianCaller)).resolves.toHaveLength(1);
  });

  it('rejects reception (§12: AI Reports row has no Reception access at all)', async () => {
    const h = buildHarness();
    await expect(h.service.listBatches(receptionCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('rejects platform_admin (§12/§13.6: reports schema is not in the platform_admin bypass list)', async () => {
    const h = buildHarness();
    await expect(h.service.listDrafts({}, platformAdminCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('passes filters through to the repository', async () => {
    const h = buildHarness();
    await h.service.listDrafts({ batchId: 'batch-1' }, managerCaller);
    expect(h.reports.listDrafts).toHaveBeenCalledWith('tenant-1', { batchId: 'batch-1' });
  });
});

describe('AiReportService.getUsageToday', () => {
  it('allows a manager to read today\'s usage counter', async () => {
    const h = buildHarness();
    const result = await h.service.getUsageToday(managerCaller);
    expect(result?.callsUsed).toBe(3);
  });

  it('rejects a teacher reading the usage counter', async () => {
    const h = buildHarness();
    await expect(h.service.getUsageToday(teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('AiReportService.updateDraft', () => {
  it('allows a manager to edit a draft/ready report', async () => {
    const h = buildHarness();
    const result = await h.service.updateDraft({ draftId: 'draft-1', body: 'Edited by manager.' }, managerCaller);
    expect(result.body).toBe('Edited by manager.');
  });

  // Fix for EPIC_8_REVIEW.md M3: edited_by tracking.
  it("threads the calling manager's own id through to the repository for edited_by stamping", async () => {
    const h = buildHarness();
    await h.service.updateDraft({ draftId: 'draft-1', body: 'Edited by manager.' }, managerCaller);
    expect(h.reports.updateDraft).toHaveBeenCalledWith({ draftId: 'draft-1', body: 'Edited by manager.' }, 'tenant-1', 'manager-1');
  });

  // §12: Teacher has "R own" only, no U — editing a drafted report before
  // send is manager-only (migration 4's own narrowed UPDATE policy).
  it('rejects a teacher editing a draft', async () => {
    const h = buildHarness();
    await expect(h.service.updateDraft({ draftId: 'draft-1', body: 'x' }, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.reports.updateDraft).not.toHaveBeenCalled();
  });
});

describe('AiReportService.send / schedule / resend / remove / export', () => {
  it('allows a manager to send a draft', async () => {
    const h = buildHarness();
    const result = await h.service.send({ draftId: 'draft-1' }, managerCaller);
    expect(result.status).toBe('sent');
  });

  it('rejects a teacher sending a draft (§19 human-in-the-loop invariant)', async () => {
    const h = buildHarness();
    await expect(h.service.send({ draftId: 'draft-1' }, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.reports.sendDraft).not.toHaveBeenCalled();
  });

  it('allows a manager to schedule a draft', async () => {
    const h = buildHarness();
    const result = await h.service.schedule({ draftId: 'draft-1', scheduledFor: '2026-08-01T09:00:00Z' }, managerCaller);
    expect(result.status).toBe('scheduled');
  });

  it('rejects a guardian scheduling a draft', async () => {
    const h = buildHarness();
    await expect(h.service.schedule({ draftId: 'draft-1', scheduledFor: '2026-08-01T09:00:00Z' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('allows a manager to resend a sent draft', async () => {
    const h = buildHarness();
    await h.service.resend({ draftId: 'draft-1' }, managerCaller);
    expect(h.reports.resendDraft).toHaveBeenCalledWith('draft-1', undefined);
  });

  it('allows a manager to delete a draft', async () => {
    const h = buildHarness();
    await h.service.remove({ draftId: 'draft-1' }, managerCaller);
    expect(h.reports.deleteDraft).toHaveBeenCalledWith('draft-1', undefined);
  });

  // Fix for EPIC_8_REVIEW.md H1.
  it('passes an idempotencyKey through to the repository when supplied', async () => {
    const h = buildHarness();
    const idempotencyKey = '99999999-9999-9999-9999-999999999999';
    await h.service.send({ draftId: 'draft-1', idempotencyKey }, managerCaller);
    expect(h.reports.sendDraft).toHaveBeenCalledWith('draft-1', idempotencyKey);
  });

  it('rejects a teacher deleting a draft', async () => {
    const h = buildHarness();
    await expect(h.service.remove({ draftId: 'draft-1' }, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.reports.deleteDraft).not.toHaveBeenCalled();
  });

  it('allows a manager to export a draft', async () => {
    const h = buildHarness();
    const result = await h.service.export({ draftId: 'draft-1' }, managerCaller);
    expect(result).toEqual({ jobId: 'job-1', draftId: 'draft-1', status: 'queued' });
  });

  it('rejects a guardian exporting a draft', async () => {
    const h = buildHarness();
    await expect(h.service.export({ draftId: 'draft-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.reports.exportDraft).not.toHaveBeenCalled();
  });
});
