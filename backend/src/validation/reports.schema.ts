import { z } from 'zod';
import { uuidSchema } from './common.js';

export const reportTypeSchema = z.enum(['monthly_progress', 'subject_report', 'behavior_social', 'attendance_summary']);
export const reportScopeSchema = z.enum(['classroom', 'children']);
export const deliveryChannelSchema = z.enum(['app', 'whatsapp', 'email']);

export const listReportDraftsSchema = z.object({
  batchId: uuidSchema.optional(),
  childId: uuidSchema.optional(),
});
export type ListReportDraftsInput = z.infer<typeof listReportDraftsSchema>;

// Manager-only direct RLS UPDATE (ai_report_drafts_update_manager, migration
// 4) — the pre-send/schedule editing path. Only reachable while
// status IN ('draft', 'ready'); the RLS policy itself is the authoritative
// enforcement of that, this schema only validates shape.
export const updateReportDraftSchema = z
  .object({
    draftId: uuidSchema,
    body: z.string().trim().min(1, 'body is required').max(20000).optional(),
    deliveryChannels: z.array(deliveryChannelSchema).min(1).optional(),
    status: z.enum(['draft', 'ready']).optional(),
  })
  .refine((v) => v.body !== undefined || v.deliveryChannels !== undefined || v.status !== undefined, {
    message: 'At least one field must be provided to update',
    path: ['draftId'],
  });
export type UpdateReportDraftInput = z.infer<typeof updateReportDraftSchema>;

// Fix for EPIC_8_REVIEW.md H1: every mutating schema below now accepts an
// optional idempotencyKey, matching the established Epic 6 convention
// (billing.schema.ts's verifyPaymentSchema/refundPaymentSchema) — passed
// through the repository as p_idempotency_key (migration 5, this fix pass).
export const sendReportDraftSchema = z.object({
  draftId: uuidSchema,
  idempotencyKey: uuidSchema.optional(),
});
export type SendReportDraftInput = z.infer<typeof sendReportDraftSchema>;

export const scheduleReportDraftSchema = z.object({
  draftId: uuidSchema,
  scheduledFor: z.string().datetime({ message: 'scheduledFor must be an ISO 8601 timestamp' }),
  idempotencyKey: uuidSchema.optional(),
});
export type ScheduleReportDraftInput = z.infer<typeof scheduleReportDraftSchema>;

export const resendReportDraftSchema = z.object({
  draftId: uuidSchema,
  idempotencyKey: uuidSchema.optional(),
});
export type ResendReportDraftInput = z.infer<typeof resendReportDraftSchema>;

export const deleteReportDraftSchema = z.object({
  draftId: uuidSchema,
  idempotencyKey: uuidSchema.optional(),
});
export type DeleteReportDraftInput = z.infer<typeof deleteReportDraftSchema>;

export const exportReportDraftSchema = z.object({
  draftId: uuidSchema,
  idempotencyKey: uuidSchema.optional(),
});
export type ExportReportDraftInput = z.infer<typeof exportReportDraftSchema>;
