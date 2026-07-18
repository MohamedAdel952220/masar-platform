// AiReportRepository — reports.ai_report_batches/ai_report_drafts/
// ai_usage_counters (§3.19, §3.20, §3.20.1). Reads and the pre-send/schedule
// edit are direct RLS-scoped table access (migration 4); every status
// transition, resend, delete, and export routes through migration 5's RPCs
// — this repository never bypasses that split (§28 convention: repository
// methods mirror the exact RLS/RPC boundary, never widen it).
//
// AiReportDraft creation itself has no repository method at all — batches
// and drafts are created exclusively by the ai-draft-report Edge Function
// (service_role), matching the "no direct RLS INSERT path alongside a
// correctness-critical Edge Function" lesson (EPIC_5_REVIEW.md H2,
// EPIC_6_REVIEW.md H1/H2) restated in migration 4's own header comment.
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { AiReportBatchRow, AiReportDraftRow, AiUsageCounterRow } from '../types/database.types.epic8.js';
import {
  aiReportBatchFromRow,
  aiReportDraftFromRow,
  aiUsageCounterFromRow,
  type AiReportBatch,
  type AiReportDraft,
  type AiUsageCounter,
} from '../types/domain.epic8.js';
import type { UpdateReportDraftInput } from '../validation/reports.schema.js';
import { toAppError } from '../lib/rpcError.js';

const DEFAULT_PAGE_SIZE = 200;

export class AiReportRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listBatches(tenantId: string, opts: { limit?: number; offset?: number } = {}): Promise<AiReportBatch[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    const { data, error } = await this.client
      .schema('reports')
      .from('ai_report_batches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw toAppError(error);
    return (data as AiReportBatchRow[]).map(aiReportBatchFromRow);
  }

  async listDrafts(
    tenantId: string,
    filters: { batchId?: string; childId?: string } = {},
    opts: { limit?: number; offset?: number } = {},
  ): Promise<AiReportDraft[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    let query = this.client
      .schema('reports')
      .from('ai_report_drafts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (filters.batchId) query = query.eq('batch_id', filters.batchId);
    if (filters.childId) query = query.eq('child_id', filters.childId);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as AiReportDraftRow[]).map(aiReportDraftFromRow);
  }

  async findDraftById(draftId: string, tenantId: string): Promise<AiReportDraft | null> {
    const { data, error } = await this.client
      .schema('reports')
      .from('ai_report_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? aiReportDraftFromRow(data as AiReportDraftRow) : null;
  }

  // Manager-only pre-send/schedule edit — a plain RLS UPDATE
  // (ai_report_drafts_update_manager, migration 4), reachable only while
  // status IN ('draft', 'ready'); the RLS policy's own WITH CHECK is the
  // authoritative enforcement, this method adds no elevated privilege.
  // child_id/batch_id are structurally excluded from `patch` (never read
  // from `input`, which has no such fields) and additionally immutable at
  // the trigger level (reports.check_ai_report_draft_immutable_fields,
  // fix for EPIC_8_REVIEW.md M1) for any caller reaching this table
  // directly, bypassing this repository.
  //
  // Fix for EPIC_8_REVIEW.md M3: edited_by is now stamped with the calling
  // manager's own id whenever body/delivery_channels changes — previously
  // this §3.20-named column was never populated by any code path.
  async updateDraft(input: UpdateReportDraftInput, tenantId: string, callerId: string): Promise<AiReportDraft> {
    const patch: Record<string, unknown> = {};
    if (input.body !== undefined) patch.body = input.body;
    if (input.deliveryChannels !== undefined) patch.delivery_channels = input.deliveryChannels;
    if (input.status !== undefined) patch.status = input.status;
    if (input.body !== undefined || input.deliveryChannels !== undefined) patch.edited_by = callerId;

    const { data, error } = await this.client
      .schema('reports')
      .from('ai_report_drafts')
      .update(patch)
      .eq('id', input.draftId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return aiReportDraftFromRow(data as AiReportDraftRow);
  }

  // Fix for EPIC_8_REVIEW.md H1: idempotencyKey passthrough, matching the
  // established Epic 6 pattern (PaymentRepository.verify/refund).
  async sendDraft(draftId: string, idempotencyKey?: string): Promise<AiReportDraft> {
    const { data, error } = await this.client.rpc('send_report_draft', { p_draft_id: draftId, p_idempotency_key: idempotencyKey ?? null });
    if (error) throw toAppError(error);
    return aiReportDraftFromRow(data as AiReportDraftRow);
  }

  async scheduleDraft(draftId: string, scheduledFor: string, idempotencyKey?: string): Promise<AiReportDraft> {
    const { data, error } = await this.client.rpc('schedule_report_draft', {
      p_draft_id: draftId,
      p_scheduled_for: scheduledFor,
      p_idempotency_key: idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return aiReportDraftFromRow(data as AiReportDraftRow);
  }

  async resendDraft(draftId: string, idempotencyKey?: string): Promise<AiReportDraft> {
    const { data, error } = await this.client.rpc('resend_report_draft', { p_draft_id: draftId, p_idempotency_key: idempotencyKey ?? null });
    if (error) throw toAppError(error);
    return aiReportDraftFromRow(data as AiReportDraftRow);
  }

  // Fix for EPIC_8_REVIEW.md H1: delete_report_draft now returns jsonb
  // ({deleted, draftId}) instead of void, so a replayed call has a concrete
  // response to return rather than surfacing NOT_FOUND on a retried delete.
  async deleteDraft(draftId: string, idempotencyKey?: string): Promise<{ deleted: true; draftId: string }> {
    const { data, error } = await this.client.rpc('delete_report_draft', { p_draft_id: draftId, p_idempotency_key: idempotencyKey ?? null });
    if (error) throw toAppError(error);
    return data as { deleted: true; draftId: string };
  }

  async exportDraft(draftId: string, idempotencyKey?: string): Promise<{ jobId: string; draftId: string; status: string }> {
    const { data, error } = await this.client.rpc('export_report_draft', { p_draft_id: draftId, p_idempotency_key: idempotencyKey ?? null });
    if (error) throw toAppError(error);
    const result = data as { jobId: string; draftId: string; status: string };
    return result;
  }

  // Manager read-only visibility into today's usage counter
  // (ai_usage_counters_select_manager, migration 4) — a lazily-created row,
  // so "no row yet today" is a legitimate zero-usage state, not an error.
  async getTodayUsageCounter(tenantId: string): Promise<AiUsageCounter | null> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.client
      .schema('reports')
      .from('ai_usage_counters')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('usage_date', today)
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? aiUsageCounterFromRow(data as AiUsageCounterRow) : null;
  }
}
