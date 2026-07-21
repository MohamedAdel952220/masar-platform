// Epic 10 snake_case row types for the analytics read surfaces (§29
// materialized views, exposed via access-controlled views in already-exposed
// schemas). Repositories are the only place that sees these raw row shapes.
//
// These map the EXPOSED views (academic.v_child_attendance_summary,
// platform.v_tenant_billing_summary, platform.v_tenant_health_summary), never
// the underlying analytics.* materialized views — those carry no client grant
// and live in an unexposed schema (migration 1's fail-closed security model).

export interface ChildAttendanceSummaryRow {
  child_id: string;
  // Grained per classroom (EPIC_10_REVIEW.md M1) so a teacher sees only their
  // own classrooms' rows, never a cross-classroom aggregate.
  classroom_id: string;
  tenant_id: string;
  total_days: number;
  present_days: number;
  attendance_pct: number;
  computed_at: string;
}

export interface TenantBillingSummaryRow {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  succeeded_charge_count: number;
  gross_succeeded_amount: number;
  refunded_amount: number;
  net_succeeded_amount: number;
  failed_charge_count: number;
  last_transaction_at: string | null;
  computed_at: string;
}

export interface TenantHealthSummaryRow {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  active_children: number;
  active_staff: number;
  cameras_total: number;
  cameras_viewable: number;
  open_support_tickets: number;
  computed_at: string;
}
