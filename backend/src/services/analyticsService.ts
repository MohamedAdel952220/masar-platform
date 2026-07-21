// AnalyticsService — testable core behind the Epic 10 analytics read
// surfaces (§29). Defense-in-depth role checks that mirror the underlying
// access control (§28 convention): the exposed views' own RLS/is_platform_
// admin() gate remains the authoritative boundary; these checks fail fast
// with PERM_ROLE_DENIED before a request that could never return rows anyway
// reaches the database.
import { AppError } from '../lib/errors.js';
import type { AnalyticsRepository } from '../repositories/analyticsRepository.js';
import type { CallerContext } from '../types/domain.js';
import type {
  ChildAttendanceSummary,
  TenantBillingSummary,
  TenantHealthSummary,
} from '../types/domain.epic10.js';
import type {
  ListChildAttendanceSummaryInput,
  ListTenantSummaryInput,
} from '../validation/analytics.schema.js';

// Attendance analytics: guardian (own child), teacher (own classroom),
// manager (own tenant) — the §12 Permission Matrix "Attendance" R holders.
// academic.v_child_attendance_summary's SECURITY INVOKER definition narrows
// the actual rows per caller; this is a fast-fail role gate only.
function requireAttendanceReader(caller: CallerContext): void {
  if (caller.role !== 'guardian' && caller.role !== 'teacher' && caller.role !== 'manager') {
    throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view attendance analytics.', 'غير مصرح لك بعرض تحليلات الحضور.');
  }
}

// Tenant billing/health summaries are cross-tenant platform surfaces (§2.1,
// §13.6) — Platform Admin only (any tier; both are read-only observability).
function requirePlatformAdmin(caller: CallerContext): void {
  if (caller.role !== 'platform_admin') {
    throw new AppError('PERM_ROLE_DENIED', 'Only a Platform Admin can perform this action.', 'فقط مسؤول المنصة يمكنه القيام بهذا الإجراء.');
  }
}

export class AnalyticsService {
  constructor(private readonly analytics: AnalyticsRepository) {}

  async listChildAttendanceSummary(input: ListChildAttendanceSummaryInput, caller: CallerContext): Promise<ChildAttendanceSummary[]> {
    requireAttendanceReader(caller);
    return this.analytics.listChildAttendanceSummary(input);
  }

  async listTenantBillingSummary(input: ListTenantSummaryInput, caller: CallerContext): Promise<TenantBillingSummary[]> {
    requirePlatformAdmin(caller);
    return this.analytics.listTenantBillingSummary(input);
  }

  async listTenantHealthSummary(input: ListTenantSummaryInput, caller: CallerContext): Promise<TenantHealthSummary[]> {
    requirePlatformAdmin(caller);
    return this.analytics.listTenantHealthSummary(input);
  }
}
