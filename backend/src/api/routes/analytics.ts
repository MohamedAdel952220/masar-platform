// API handlers for Epic 10 analytics read surfaces (§29). No new API group is
// introduced beyond the read endpoints these back (Epic 10 §16 "No new API
// groups"): attendance analytics folds into the existing Academic read
// surface; the tenant summaries fold into the existing Platform read surface.
import {
  listChildAttendanceSummarySchema,
  listTenantSummarySchema,
} from '../../validation/analytics.schema.js';
import { AppError } from '../../lib/errors.js';
import type { AnalyticsService } from '../../services/analyticsService.js';
import type { CallerContext } from '../../types/domain.js';
import type {
  ChildAttendanceSummary,
  TenantBillingSummary,
  TenantHealthSummary,
} from '../../types/domain.epic10.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function listChildAttendanceSummaryRoute(
  service: AnalyticsService,
  caller: CallerContext,
  rawQuery: unknown,
): Promise<ChildAttendanceSummary[]> {
  const parsed = listChildAttendanceSummarySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listChildAttendanceSummary(parsed.data, caller);
}

export async function listTenantBillingSummaryRoute(
  service: AnalyticsService,
  caller: CallerContext,
  rawQuery: unknown,
): Promise<TenantBillingSummary[]> {
  const parsed = listTenantSummarySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listTenantBillingSummary(parsed.data, caller);
}

export async function listTenantHealthSummaryRoute(
  service: AnalyticsService,
  caller: CallerContext,
  rawQuery: unknown,
): Promise<TenantHealthSummary[]> {
  const parsed = listTenantSummarySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listTenantHealthSummary(parsed.data, caller);
}
