// ApprovalRequestService — testable core behind submit_request/review_request
// (§14.2). Defense-in-depth role checks matching the RPC's own (§28
// convention, same as ChatService/TransportService/SafetyService).
import { AppError } from '../lib/errors.js';
import type { ApprovalRequestRepository } from '../repositories/approvalRequestRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { ApprovalRequest, ReviewRequestResult } from '../types/domain.epic5.js';
import type { SubmitRequestInput, ReviewRequestInput } from '../validation/approvals.schema.js';

export class ApprovalRequestService {
  constructor(private readonly requests: ApprovalRequestRepository) {}

  async submit(input: SubmitRequestInput, caller: CallerContext): Promise<ApprovalRequest> {
    if (caller.role !== 'teacher') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a teacher can submit a request.', 'فقط المعلّم يمكنه تقديم طلب.');
    }

    // Fix-forward application of EPIC_4_REVIEW.md H1's lesson — layer 2 of
    // the 3-layer fix (Zod schema, this service check, the RPC/DB-constraint
    // pair). Kept here too so a caller invoking the service directly
    // (bypassing only the Zod schema, e.g. in a test) still gets a clean,
    // immediate error rather than a raw constraint violation.
    if (input.type === 'exam' && !input.examKind) {
      throw new AppError('VALIDATION_FAILED', 'An exam kind is required for an exam request.', 'نوع الامتحان مطلوب لطلب الامتحان.');
    }

    return this.requests.submit(input);
  }

  async review(input: ReviewRequestInput, caller: CallerContext): Promise<ReviewRequestResult> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can review a request.', 'فقط المدير يمكنه مراجعة الطلب.');
    }

    if (input.decision === 'rejected' && !input.rejectionReason) {
      throw new AppError('VALIDATION_FAILED', 'A rejection reason is required.', 'سبب الرفض مطلوب.');
    }

    return this.requests.review(input);
  }

  async listOwn(caller: CallerContext): Promise<ApprovalRequest[]> {
    if (caller.role !== 'teacher') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a teacher can list their own requests.', 'فقط المعلّم يمكنه عرض طلباته.');
    }
    return this.requests.listForTeacher(caller.userId);
  }

  async listPending(caller: CallerContext): Promise<ApprovalRequest[]> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can list pending requests.', 'فقط المدير يمكنه عرض الطلبات المعلّقة.');
    }
    return this.requests.listPendingForTenant(caller.tenantId);
  }
}
