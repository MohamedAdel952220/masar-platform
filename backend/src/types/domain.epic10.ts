// Epic 10 domain (camelCase) types + row<->domain mappers for the analytics
// read surfaces (§29). numeric columns are normalized to number via Number(),
// matching the Epic 9 tenantBillingTransactionFromRow precedent.
import type {
  ChildAttendanceSummaryRow,
  TenantBillingSummaryRow,
  TenantHealthSummaryRow,
} from './database.types.epic10.js';

export interface ChildAttendanceSummary {
  childId: string;
  // Per-classroom grain (EPIC_10_REVIEW.md M1): attendance is aggregated
  // within a classroom, never across classrooms a caller cannot see.
  classroomId: string;
  tenantId: string;
  totalDays: number;
  presentDays: number;
  attendancePct: number;
  computedAt: string;
}

export function childAttendanceSummaryFromRow(row: ChildAttendanceSummaryRow): ChildAttendanceSummary {
  return {
    childId: row.child_id,
    classroomId: row.classroom_id,
    tenantId: row.tenant_id,
    totalDays: Number(row.total_days),
    presentDays: Number(row.present_days),
    attendancePct: Number(row.attendance_pct),
    computedAt: row.computed_at,
  };
}

export interface TenantBillingSummary {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  succeededChargeCount: number;
  grossSucceededAmount: number;
  refundedAmount: number;
  netSucceededAmount: number;
  failedChargeCount: number;
  lastTransactionAt: string | null;
  computedAt: string;
}

export function tenantBillingSummaryFromRow(row: TenantBillingSummaryRow): TenantBillingSummary {
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantStatus: row.tenant_status,
    succeededChargeCount: Number(row.succeeded_charge_count),
    grossSucceededAmount: Number(row.gross_succeeded_amount),
    refundedAmount: Number(row.refunded_amount),
    netSucceededAmount: Number(row.net_succeeded_amount),
    failedChargeCount: Number(row.failed_charge_count),
    lastTransactionAt: row.last_transaction_at,
    computedAt: row.computed_at,
  };
}

export interface TenantHealthSummary {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  activeChildren: number;
  activeStaff: number;
  camerasTotal: number;
  camerasViewable: number;
  openSupportTickets: number;
  computedAt: string;
}

export function tenantHealthSummaryFromRow(row: TenantHealthSummaryRow): TenantHealthSummary {
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantStatus: row.tenant_status,
    activeChildren: Number(row.active_children),
    activeStaff: Number(row.active_staff),
    camerasTotal: Number(row.cameras_total),
    camerasViewable: Number(row.cameras_viewable),
    openSupportTickets: Number(row.open_support_tickets),
    computedAt: row.computed_at,
  };
}
