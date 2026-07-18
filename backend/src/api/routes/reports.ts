// API handlers for AI report batches/drafts (§14.2, §16 API Group: AI
// Reports). ai-polish-note and ai-draft-report have no handler here — both
// are Edge-Function-only (call the external LLM provider), matching
// media.ts's own precedent for camera-stream-token.
import {
  listReportDraftsSchema,
  updateReportDraftSchema,
  sendReportDraftSchema,
  scheduleReportDraftSchema,
  resendReportDraftSchema,
  deleteReportDraftSchema,
  exportReportDraftSchema,
} from '../../validation/reports.schema.js';
import { AppError } from '../../lib/errors.js';
import type { AiReportService } from '../../services/aiReportService.js';
import type { CallerContext } from '../../types/domain.js';
import type { AiReportBatch, AiReportDraft, AiUsageCounter } from '../../types/domain.epic8.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function listReportBatchesRoute(service: AiReportService, caller: CallerContext): Promise<AiReportBatch[]> {
  return service.listBatches(caller);
}

export async function listReportDraftsRoute(service: AiReportService, caller: CallerContext, rawQuery: unknown): Promise<AiReportDraft[]> {
  const parsed = listReportDraftsSchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listDrafts(parsed.data, caller);
}

export async function getReportUsageTodayRoute(service: AiReportService, caller: CallerContext): Promise<AiUsageCounter | null> {
  return service.getUsageToday(caller);
}

export async function updateReportDraftRoute(service: AiReportService, caller: CallerContext, rawBody: unknown): Promise<AiReportDraft> {
  const parsed = updateReportDraftSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.updateDraft(parsed.data, caller);
}

export async function sendReportDraftRoute(service: AiReportService, caller: CallerContext, rawBody: unknown): Promise<AiReportDraft> {
  const parsed = sendReportDraftSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.send(parsed.data, caller);
}

export async function scheduleReportDraftRoute(service: AiReportService, caller: CallerContext, rawBody: unknown): Promise<AiReportDraft> {
  const parsed = scheduleReportDraftSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.schedule(parsed.data, caller);
}

export async function resendReportDraftRoute(service: AiReportService, caller: CallerContext, rawBody: unknown): Promise<AiReportDraft> {
  const parsed = resendReportDraftSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.resend(parsed.data, caller);
}

// Fix for EPIC_8_REVIEW.md H1: delete_report_draft now returns
// {deleted, draftId} (not void), so this route returns that result
// directly instead of discarding it — a replayed idempotent retry now
// surfaces the same body both times.
export async function deleteReportDraftRoute(service: AiReportService, caller: CallerContext, rawBody: unknown): Promise<{ deleted: true; draftId: string }> {
  const parsed = deleteReportDraftSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.remove(parsed.data, caller);
}

export async function exportReportDraftRoute(
  service: AiReportService,
  caller: CallerContext,
  rawBody: unknown,
): Promise<{ jobId: string; draftId: string; status: string }> {
  const parsed = exportReportDraftSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.export(parsed.data, caller);
}
