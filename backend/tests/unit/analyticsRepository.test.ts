import { describe, it, expect, vi } from 'vitest';
import { AnalyticsRepository } from '../../src/repositories/analyticsRepository.js';
import type { AnySupabaseClient } from '../../src/lib/supabaseClient.js';

const childId = '11111111-1111-1111-1111-111111111111';
const classroomId = '22222222-2222-2222-2222-222222222222';
const tenantId = '33333333-3333-3333-3333-333333333333';

// Chainable query-builder double. Deliberately does NOT implement `range()` —
// if the repository ever regressed to offset pagination the call would throw,
// which is itself the L1 regression guard.
function buildClient(rows: unknown[]) {
  const calls = {
    schema: [] as string[],
    from: [] as string[],
    order: [] as unknown[][],
    limit: [] as number[],
    eq: [] as unknown[][],
    gt: [] as unknown[][],
    or: [] as string[],
  };
  const q: Record<string, unknown> = {};
  q.select = vi.fn(() => q);
  q.order = vi.fn((...a: unknown[]) => { calls.order.push(a); return q; });
  q.limit = vi.fn((n: number) => { calls.limit.push(n); return q; });
  q.eq = vi.fn((...a: unknown[]) => { calls.eq.push(a); return q; });
  q.gt = vi.fn((...a: unknown[]) => { calls.gt.push(a); return q; });
  q.or = vi.fn((s: string) => { calls.or.push(s); return q; });
  q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows, error: null });

  const from = vi.fn((t: string) => { calls.from.push(t); return q; });
  const schema = vi.fn((s: string) => { calls.schema.push(s); return { from }; });
  return { client: { schema } as unknown as AnySupabaseClient, calls };
}

describe('AnalyticsRepository.listChildAttendanceSummary', () => {
  it('reads the exposed academic view (never the analytics MV) and maps the classroom grain', async () => {
    const { client, calls } = buildClient([
      { child_id: childId, classroom_id: classroomId, tenant_id: tenantId, total_days: 4, present_days: 3, attendance_pct: 75, computed_at: '2026-07-31T00:00:00Z' },
    ]);
    const repo = new AnalyticsRepository(client);
    const result = await repo.listChildAttendanceSummary({});

    expect(calls.schema).toEqual(['academic']);
    expect(calls.from).toEqual(['v_child_attendance_summary']);
    expect(result[0]).toEqual({
      childId, classroomId, tenantId, totalDays: 4, presentDays: 3, attendancePct: 75, computedAt: '2026-07-31T00:00:00Z',
    });
  });

  it('uses keyset ordering + limit, not offset pagination (L1)', async () => {
    const { client, calls } = buildClient([]);
    await new AnalyticsRepository(client).listChildAttendanceSummary({});
    expect(calls.order).toEqual([
      ['child_id', { ascending: true }],
      ['classroom_id', { ascending: true }],
    ]);
    expect(calls.limit).toEqual([200]);
  });

  it('applies a composite keyset cursor over (child_id, classroom_id)', async () => {
    const { client, calls } = buildClient([]);
    await new AnalyticsRepository(client).listChildAttendanceSummary({ cursor: { childId, classroomId } });
    expect(calls.or).toEqual([
      `child_id.gt.${childId},and(child_id.eq.${childId},classroom_id.gt.${classroomId})`,
    ]);
  });

  it('applies childId and classroomId filters', async () => {
    const { client, calls } = buildClient([]);
    await new AnalyticsRepository(client).listChildAttendanceSummary({ childId, classroomId });
    expect(calls.eq).toEqual([['child_id', childId], ['classroom_id', classroomId]]);
  });

  it('honours an explicit limit', async () => {
    const { client, calls } = buildClient([]);
    await new AnalyticsRepository(client).listChildAttendanceSummary({ limit: 25 });
    expect(calls.limit).toEqual([25]);
  });
});

describe('AnalyticsRepository tenant summaries', () => {
  it('reads the exposed platform billing view with keyset ordering and cursor', async () => {
    const { client, calls } = buildClient([]);
    await new AnalyticsRepository(client).listTenantBillingSummary({ cursor: tenantId });
    expect(calls.schema).toEqual(['platform']);
    expect(calls.from).toEqual(['v_tenant_billing_summary']);
    expect(calls.order).toEqual([['tenant_id', { ascending: true }]]);
    expect(calls.gt).toEqual([['tenant_id', tenantId]]);
  });

  it('reads the exposed platform health view and filters by tenantId', async () => {
    const { client, calls } = buildClient([]);
    await new AnalyticsRepository(client).listTenantHealthSummary({ tenantId });
    expect(calls.from).toEqual(['v_tenant_health_summary']);
    expect(calls.eq).toEqual([['tenant_id', tenantId]]);
  });

  it('maps billing summary numerics to numbers', async () => {
    const { client } = buildClient([
      { tenant_id: tenantId, tenant_name: 'T', tenant_status: 'active', succeeded_charge_count: '2', gross_succeeded_amount: '150.50', refunded_amount: '50.25', net_succeeded_amount: '100.25', failed_charge_count: '1', last_transaction_at: null, computed_at: '2026-07-31T00:00:00Z' },
    ]);
    const rows = await new AnalyticsRepository(client).listTenantBillingSummary({});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.grossSucceededAmount).toBe(150.5);
    expect(rows[0]?.netSucceededAmount).toBe(100.25);
    expect(rows[0]?.succeededChargeCount).toBe(2);
    expect(rows[0]?.lastTransactionAt).toBeNull();
  });
});
