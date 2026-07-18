import { describe, it, expect, vi } from 'vitest';
import {
  listReportBatchesRoute,
  listReportDraftsRoute,
  getReportUsageTodayRoute,
  updateReportDraftRoute,
  sendReportDraftRoute,
  scheduleReportDraftRoute,
  resendReportDraftRoute,
  deleteReportDraftRoute,
  exportReportDraftRoute,
} from '../../src/api/routes/reports.js';
import type { CallerContext } from '../../src/types/domain.js';

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const draftId = '11111111-1111-1111-1111-111111111111';
const batchId = '22222222-2222-2222-2222-222222222222';

describe('listReportBatchesRoute / listReportDraftsRoute / getReportUsageTodayRoute', () => {
  it('delegates to AiReportService.listBatches', async () => {
    const service = { listBatches: vi.fn(async () => [{ id: batchId }]) } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    const result = await listReportBatchesRoute(service, managerCaller);
    expect(result).toEqual([{ id: batchId }]);
  });

  it('validates the listReportDrafts query and delegates', async () => {
    const service = { listDrafts: vi.fn(async () => [{ id: draftId }]) } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    const result = await listReportDraftsRoute(service, managerCaller, { batchId });
    expect(service.listDrafts).toHaveBeenCalledWith({ batchId }, managerCaller);
    expect(result).toEqual([{ id: draftId }]);
  });

  it('rejects an invalid listReportDrafts query', async () => {
    const service = { listDrafts: vi.fn() } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    await expect(listReportDraftsRoute(service, managerCaller, { batchId: 'nope' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.listDrafts).not.toHaveBeenCalled();
  });

  it('delegates to AiReportService.getUsageToday', async () => {
    const service = { getUsageToday: vi.fn(async () => ({ id: 'usage-1', callsUsed: 5 })) } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    const result = await getReportUsageTodayRoute(service, managerCaller);
    expect(result).toEqual({ id: 'usage-1', callsUsed: 5 });
  });
});

describe('updateReportDraftRoute — validation', () => {
  it('rejects a body with no updatable fields', async () => {
    const service = { updateDraft: vi.fn() } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    await expect(updateReportDraftRoute(service, managerCaller, { draftId })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.updateDraft).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { updateDraft: vi.fn(async () => ({ id: draftId, body: 'Edited.' })) } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    await updateReportDraftRoute(service, managerCaller, { draftId, body: 'Edited.' });
    expect(service.updateDraft).toHaveBeenCalledWith({ draftId, body: 'Edited.' }, managerCaller);
  });
});

describe('sendReportDraftRoute / resendReportDraftRoute / deleteReportDraftRoute / exportReportDraftRoute — validation', () => {
  it('rejects a missing draftId for each', async () => {
    const service = { send: vi.fn(), resend: vi.fn(), remove: vi.fn(), export: vi.fn() } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    await expect(sendReportDraftRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(resendReportDraftRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(deleteReportDraftRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(exportReportDraftRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('passes a valid draftId through to the service for each', async () => {
    const service = {
      send: vi.fn(async () => ({ id: draftId, status: 'sent' })),
      resend: vi.fn(async () => ({ id: draftId, status: 'sent' })),
      remove: vi.fn(async () => ({ deleted: true as const, draftId })),
      export: vi.fn(async () => ({ jobId: 'job-1', draftId, status: 'queued' })),
    } as unknown as import('../../src/services/aiReportService.js').AiReportService;

    await sendReportDraftRoute(service, managerCaller, { draftId });
    expect(service.send).toHaveBeenCalledWith({ draftId }, managerCaller);

    await resendReportDraftRoute(service, managerCaller, { draftId });
    expect(service.resend).toHaveBeenCalledWith({ draftId }, managerCaller);

    // Fix for EPIC_8_REVIEW.md H1: delete_report_draft's response is now
    // returned directly (not discarded to {ok:true}), since it carries the
    // idempotency-replay-visible {deleted, draftId} payload.
    const deleteResult = await deleteReportDraftRoute(service, managerCaller, { draftId });
    expect(service.remove).toHaveBeenCalledWith({ draftId }, managerCaller);
    expect(deleteResult).toEqual({ deleted: true, draftId });

    const exportResult = await exportReportDraftRoute(service, managerCaller, { draftId });
    expect(service.export).toHaveBeenCalledWith({ draftId }, managerCaller);
    expect(exportResult).toEqual({ jobId: 'job-1', draftId, status: 'queued' });
  });

  // Fix for EPIC_8_REVIEW.md H1: idempotencyKey passes through validation.
  it('accepts and passes through an optional idempotencyKey', async () => {
    const idempotencyKey = '99999999-9999-9999-9999-999999999999';
    const service = { send: vi.fn(async () => ({ id: draftId, status: 'sent' })) } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    await sendReportDraftRoute(service, managerCaller, { draftId, idempotencyKey });
    expect(service.send).toHaveBeenCalledWith({ draftId, idempotencyKey }, managerCaller);
  });
});

describe('scheduleReportDraftRoute — validation', () => {
  it('rejects a missing scheduledFor', async () => {
    const service = { schedule: vi.fn() } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    await expect(scheduleReportDraftRoute(service, managerCaller, { draftId })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.schedule).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { schedule: vi.fn(async () => ({ id: draftId, status: 'scheduled' })) } as unknown as import('../../src/services/aiReportService.js').AiReportService;
    await scheduleReportDraftRoute(service, managerCaller, { draftId, scheduledFor: '2026-08-01T09:00:00.000Z' });
    expect(service.schedule).toHaveBeenCalledWith({ draftId, scheduledFor: '2026-08-01T09:00:00.000Z' }, managerCaller);
  });
});
