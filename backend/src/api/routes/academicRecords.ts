// API handlers for mark-attendance / submit-evaluation / withdraw-child /
// suspend-child / reactivate-child — mirrors the five corresponding RPCs (§14.2).
import {
  markAttendanceSchema,
  submitEvaluationSchema,
  withdrawChildSchema,
  suspendChildSchema,
  reactivateChildSchema,
} from '../../validation/academic.schema.js';
import { AppError } from '../../lib/errors.js';
import type { AcademicRecordService } from '../../services/academicRecordService.js';
import type { CallerContext } from '../../types/domain.js';
import type { Child, Evaluation, AttendanceSummary } from '../../types/domain.epic2.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function markAttendanceRoute(service: AcademicRecordService, caller: CallerContext, rawBody: unknown): Promise<AttendanceSummary> {
  const parsed = markAttendanceSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.markAttendance(parsed.data, caller);
}

export async function submitEvaluationRoute(service: AcademicRecordService, caller: CallerContext, rawBody: unknown): Promise<Evaluation> {
  const parsed = submitEvaluationSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.submitEvaluation(parsed.data, caller);
}

export async function withdrawChildRoute(service: AcademicRecordService, caller: CallerContext, rawBody: unknown): Promise<Child> {
  const parsed = withdrawChildSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.withdrawChild(parsed.data.childId, caller, parsed.data.reason);
}

export async function suspendChildRoute(service: AcademicRecordService, caller: CallerContext, rawBody: unknown): Promise<Child> {
  const parsed = suspendChildSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.suspendChild(parsed.data.childId, caller, parsed.data.reason);
}

export async function reactivateChildRoute(service: AcademicRecordService, caller: CallerContext, rawBody: unknown): Promise<Child> {
  const parsed = reactivateChildSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.reactivateChild(parsed.data.childId, caller);
}
