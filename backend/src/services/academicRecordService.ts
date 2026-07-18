// AcademicRecordService — testable core behind the mark_attendance,
// submit_evaluation, withdraw_child, suspend_child, reactivate_child RPCs
// (§14.2). These RPCs already enforce role/tenant checks at the database
// layer (migration 7) — this service duplicates the same checks at the API
// layer for clean, testable error messages before ever reaching Postgres,
// matching the defense-in-depth convention already used by
// TenantProvisioningService/StaffAccountService (§28).
import { AppError } from '../lib/errors.js';
import type { ChildRepository } from '../repositories/childRepository.js';
import type { AttendanceRepository } from '../repositories/attendanceRepository.js';
import type { EvaluationRepository } from '../repositories/evaluationRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { Child, Evaluation, AttendanceSummary } from '../types/domain.epic2.js';
import type { MarkAttendanceInput, SubmitEvaluationInput } from '../validation/academic.schema.js';

export class AcademicRecordService {
  constructor(
    private readonly children: ChildRepository,
    private readonly attendance: AttendanceRepository,
    private readonly evaluations: EvaluationRepository,
  ) {}

  async markAttendance(input: MarkAttendanceInput, caller: CallerContext): Promise<AttendanceSummary> {
    if (caller.role !== 'teacher' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a teacher or manager can mark attendance.', 'فقط المعلّم أو المدير يمكنه تسجيل الحضور.');
    }
    return this.attendance.mark(input);
  }

  async submitEvaluation(input: SubmitEvaluationInput, caller: CallerContext): Promise<Evaluation> {
    if (caller.role !== 'teacher') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a teacher can submit an evaluation.', 'فقط المعلّم يمكنه تقديم تقييم.');
    }
    return this.evaluations.submit(input);
  }

  async withdrawChild(childId: string, caller: CallerContext, reason?: string): Promise<Child> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can withdraw a child.', 'فقط المدير يمكنه سحب طفل.');
    }
    const child = await this.children.findById(childId);
    if (!child) throw new AppError('NOT_FOUND', 'Child not found.', 'لم يتم العثور على الطفل.');
    if (child.tenantId !== caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'This child does not belong to your tenant.', 'هذا الطفل لا ينتمي إلى مؤسستك.');
    }
    return this.children.withdraw(childId, reason);
  }

  async suspendChild(childId: string, caller: CallerContext, reason?: string): Promise<Child> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', "Only a manager can suspend a child's membership.", 'فقط المدير يمكنه تعليق عضوية طفل.');
    }
    const child = await this.children.findById(childId);
    if (!child) throw new AppError('NOT_FOUND', 'Child not found.', 'لم يتم العثور على الطفل.');
    if (child.tenantId !== caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'This child does not belong to your tenant.', 'هذا الطفل لا ينتمي إلى مؤسستك.');
    }
    if (child.membershipStatus === 'suspended') {
      throw new AppError('STATE_ALREADY_PROCESSED', "This child's membership is already suspended.", 'عضوية هذا الطفل معلّقة بالفعل.');
    }
    return this.children.suspend(childId, reason);
  }

  async reactivateChild(childId: string, caller: CallerContext): Promise<Child> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', "Only a manager can reactivate a child's membership.", 'فقط المدير يمكنه إعادة تفعيل عضوية طفل.');
    }
    const child = await this.children.findById(childId);
    if (!child) throw new AppError('NOT_FOUND', 'Child not found.', 'لم يتم العثور على الطفل.');
    if (child.tenantId !== caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'This child does not belong to your tenant.', 'هذا الطفل لا ينتمي إلى مؤسستك.');
    }
    if (child.membershipStatus !== 'suspended') {
      throw new AppError('STATE_ALREADY_PROCESSED', "This child's membership is not currently suspended.", 'عضوية هذا الطفل غير معلّقة حاليًا.');
    }
    return this.children.reactivate(childId);
  }
}
