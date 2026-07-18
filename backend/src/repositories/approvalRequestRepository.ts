import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { RequestRow, ReviewRequestResultRow } from '../types/database.types.epic5.js';
import { approvalRequestFromRow, reviewRequestResultFromRow, type ApprovalRequest, type ReviewRequestResult } from '../types/domain.epic5.js';
import type { SubmitRequestInput, ReviewRequestInput } from '../validation/approvals.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class ApprovalRequestRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Wraps public.submit_request (§14.2, migration 5) — idempotency-key
  // supported (resubmitting the same request twice must not create two
  // pending rows for the manager to review).
  async submit(input: SubmitRequestInput): Promise<ApprovalRequest> {
    const { data, error } = await this.client.rpc('submit_request', {
      p_type: input.type,
      p_title: input.title,
      p_request_date: input.requestDate,
      p_request_time: input.requestTime ?? null,
      p_classroom_id: input.classroomId ?? null,
      p_subject_id: input.subjectId ?? null,
      p_exam_kind: input.examKind ?? null,
      p_note: input.note ?? null,
      p_place: input.place ?? null,
      p_price: input.price ?? null,
      p_attachment_object_id: input.attachmentObjectId ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return approvalRequestFromRow(data as RequestRow);
  }

  // Wraps public.review_request (§14.2, migration 5) — idempotency-key
  // supported (a network retry after a successful approval must not create
  // a second event).
  async review(input: ReviewRequestInput): Promise<ReviewRequestResult> {
    const { data, error } = await this.client.rpc('review_request', {
      p_request_id: input.requestId,
      p_decision: input.decision,
      p_rejection_reason: input.rejectionReason ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return reviewRequestResultFromRow(data as ReviewRequestResultRow);
  }

  async listForTeacher(submittedBy: string): Promise<ApprovalRequest[]> {
    const { data, error } = await this.client
      .schema('approvals')
      .from('requests')
      .select('*')
      .eq('submitted_by', submittedBy)
      .order('created_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as RequestRow[]).map(approvalRequestFromRow);
  }

  async listPendingForTenant(tenantId: string): Promise<ApprovalRequest[]> {
    const { data, error } = await this.client
      .schema('approvals')
      .from('requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as RequestRow[]).map(approvalRequestFromRow);
  }
}
