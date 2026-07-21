// AnalyticsRepository — Epic 10 read-only access to the analytics aggregate
// surfaces (§29). Reads the EXPOSED views only:
//   - academic.v_child_attendance_summary  (definer view; fail-closed
//     tenant/role predicate built from the frozen RLS helper functions —
//     zero rows under a no-tenant/service_role client)
//   - platform.v_tenant_billing_summary     (Platform-Admin-only via the
//     view's own `where public.is_platform_admin()`)
//   - platform.v_tenant_health_summary       (same)
// The underlying analytics.* materialized views are never touched here and
// carry no client grant — they are unreachable by any client path.
//
// Pagination is keyset/cursor-based over each view's unique grain (§14.3
// "cursor-based everywhere ... never offset pagination", EPIC_10_REVIEW.md
// L1). Ordering is by that unique key so a cursor is stable under concurrent
// refreshes; these are bounded per-tenant aggregates, so presentation sorting
// (e.g. by amount) belongs to the client rather than the pagination key.
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type {
  ChildAttendanceSummaryRow,
  TenantBillingSummaryRow,
  TenantHealthSummaryRow,
} from '../types/database.types.epic10.js';
import {
  childAttendanceSummaryFromRow,
  tenantBillingSummaryFromRow,
  tenantHealthSummaryFromRow,
  type ChildAttendanceSummary,
  type TenantBillingSummary,
  type TenantHealthSummary,
} from '../types/domain.epic10.js';
import type {
  ListChildAttendanceSummaryInput,
  ListTenantSummaryInput,
} from '../validation/analytics.schema.js';
import { toAppError } from '../lib/rpcError.js';

const DEFAULT_PAGE_SIZE = 200;

export class AnalyticsRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listChildAttendanceSummary(input: ListChildAttendanceSummaryInput = {}): Promise<ChildAttendanceSummary[]> {
    let query = this.client
      .schema('academic')
      .from('v_child_attendance_summary')
      .select('*')
      .order('child_id', { ascending: true })
      .order('classroom_id', { ascending: true })
      .limit(input.limit ?? DEFAULT_PAGE_SIZE);

    if (input.childId) query = query.eq('child_id', input.childId);
    if (input.classroomId) query = query.eq('classroom_id', input.classroomId);
    // Composite keyset over (child_id, classroom_id). Both cursor components
    // are uuid-validated by the schema, so embedding them here is safe.
    if (input.cursor) {
      query = query.or(
        `child_id.gt.${input.cursor.childId},and(child_id.eq.${input.cursor.childId},classroom_id.gt.${input.cursor.classroomId})`,
      );
    }

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as ChildAttendanceSummaryRow[]).map(childAttendanceSummaryFromRow);
  }

  async listTenantBillingSummary(input: ListTenantSummaryInput = {}): Promise<TenantBillingSummary[]> {
    let query = this.client
      .schema('platform')
      .from('v_tenant_billing_summary')
      .select('*')
      .order('tenant_id', { ascending: true })
      .limit(input.limit ?? DEFAULT_PAGE_SIZE);

    if (input.tenantId) query = query.eq('tenant_id', input.tenantId);
    if (input.cursor) query = query.gt('tenant_id', input.cursor);

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as TenantBillingSummaryRow[]).map(tenantBillingSummaryFromRow);
  }

  async listTenantHealthSummary(input: ListTenantSummaryInput = {}): Promise<TenantHealthSummary[]> {
    let query = this.client
      .schema('platform')
      .from('v_tenant_health_summary')
      .select('*')
      .order('tenant_id', { ascending: true })
      .limit(input.limit ?? DEFAULT_PAGE_SIZE);

    if (input.tenantId) query = query.eq('tenant_id', input.tenantId);
    if (input.cursor) query = query.gt('tenant_id', input.cursor);

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as TenantHealthSummaryRow[]).map(tenantHealthSummaryFromRow);
  }
}
