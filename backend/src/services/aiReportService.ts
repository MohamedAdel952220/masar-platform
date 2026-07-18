// AiReportService — testable core behind reports.ai_report_batches/
// ai_report_drafts read + manager-only edit/lifecycle actions (§12's AI
// Reports row: Guardian R (own child, sent only), Teacher C + R own,
// Manager CRUD (all)). Defense-in-depth role checks matching the RLS
// policies' own (§28 convention) — RLS (migration 4) remains the
// authoritative gate; these checks exist so a role mismatch fails fast with
// a clear PERM_ROLE_DENIED before ever reaching the database.
//
// Drafting itself (ai-draft-report) and note-polishing (ai-polish-note) have
// no service-layer mirror at all — both call an external LLM provider, and
// per the established "no Node mirror for a function whose core purpose is
// calling an external service" precedent (PaymentService/initiate-payment,
// Epic 7's camera-stream-token), they stay Edge-Function-only.
import { AppError } from '../lib/errors.js';
import type { AiReportRepository } from '../repositories/aiReportRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { AiReportBatch, AiReportDraft, AiUsageCounter } from '../types/domain.epic8.js';
import type {
  ListReportDraftsInput,
  UpdateReportDraftInput,
  SendReportDraftInput,
  ScheduleReportDraftInput,
  ResendReportDraftInput,
  DeleteReportDraftInput,
  ExportReportDraftInput,
} from '../validation/reports.schema.js';

function requireTenantScopedReader(caller: CallerContext): void {
  if (!caller.tenantId || !caller.role || !['manager', 'teacher', 'guardian'].includes(caller.role)) {
    throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view reports.', 'غير مصرح لك بعرض التقارير.');
  }
}

function requireManager(caller: CallerContext): string {
  if (caller.role !== 'manager' || !caller.tenantId) {
    throw new AppError('PERM_ROLE_DENIED', 'Only a manager can perform this action.', 'فقط المدير يمكنه القيام بهذا الإجراء.');
  }
  return caller.tenantId;
}

export class AiReportService {
  constructor(private readonly reports: AiReportRepository) {}

  // Manager: every batch in the tenant. Teacher: RLS (migration 4) narrows
  // this to their own drafting requests. Guardian has no batch-level
  // visibility at all (batches are a staff-facing action record) — the RLS
  // policy simply has no guardian clause, so this call returns an empty
  // list rather than erroring for a guardian caller, matching PostgREST's
  // own "no matching policy => zero rows" behavior elsewhere in this
  // codebase.
  async listBatches(caller: CallerContext): Promise<AiReportBatch[]> {
    requireTenantScopedReader(caller);
    return this.reports.listBatches(caller.tenantId!);
  }

  async listDrafts(input: ListReportDraftsInput, caller: CallerContext): Promise<AiReportDraft[]> {
    requireTenantScopedReader(caller);
    return this.reports.listDrafts(caller.tenantId!, input);
  }

  async getUsageToday(caller: CallerContext): Promise<AiUsageCounter | null> {
    const tenantId = requireManager(caller);
    return this.reports.getTodayUsageCounter(tenantId);
  }

  // Fix for EPIC_8_REVIEW.md M3: callerId is threaded through so the
  // repository can stamp edited_by.
  async updateDraft(input: UpdateReportDraftInput, caller: CallerContext): Promise<AiReportDraft> {
    requireManager(caller);
    return this.reports.updateDraft(input, caller.tenantId!, caller.userId);
  }

  // Fix for EPIC_8_REVIEW.md H1: idempotencyKey passthrough on every
  // mutating method below.
  async send(input: SendReportDraftInput, caller: CallerContext): Promise<AiReportDraft> {
    requireManager(caller);
    return this.reports.sendDraft(input.draftId, input.idempotencyKey);
  }

  async schedule(input: ScheduleReportDraftInput, caller: CallerContext): Promise<AiReportDraft> {
    requireManager(caller);
    return this.reports.scheduleDraft(input.draftId, input.scheduledFor, input.idempotencyKey);
  }

  async resend(input: ResendReportDraftInput, caller: CallerContext): Promise<AiReportDraft> {
    requireManager(caller);
    return this.reports.resendDraft(input.draftId, input.idempotencyKey);
  }

  async remove(input: DeleteReportDraftInput, caller: CallerContext): Promise<{ deleted: true; draftId: string }> {
    requireManager(caller);
    return this.reports.deleteDraft(input.draftId, input.idempotencyKey);
  }

  async export(input: ExportReportDraftInput, caller: CallerContext): Promise<{ jobId: string; draftId: string; status: string }> {
    requireManager(caller);
    return this.reports.exportDraft(input.draftId, input.idempotencyKey);
  }
}
