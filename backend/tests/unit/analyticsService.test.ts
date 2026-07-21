import { describe, it, expect, vi } from 'vitest';
import { AnalyticsService } from '../../src/services/analyticsService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type {
  ChildAttendanceSummary,
  TenantBillingSummary,
  TenantHealthSummary,
} from '../../src/types/domain.epic10.js';

function caller(role: CallerContext['role'], tier: CallerContext['platformAdminTier'] = null): CallerContext {
  return { userId: 'u1', tenantId: role === 'platform_admin' ? null : 'tenant-1', role, platformAdminTier: tier };
}

function buildHarness() {
  const analytics = {
    listChildAttendanceSummary: vi.fn(async () => [{ childId: 'c1', classroomId: 'room-1', tenantId: 'tenant-1', totalDays: 10, presentDays: 9, attendancePct: 90, computedAt: '2026-07-31T00:00:00Z' } as ChildAttendanceSummary]),
    listTenantBillingSummary: vi.fn(async () => [{ tenantId: 'tenant-1' } as TenantBillingSummary]),
    listTenantHealthSummary: vi.fn(async () => [{ tenantId: 'tenant-1' } as TenantHealthSummary]),
  };
  const service = new AnalyticsService(analytics as unknown as import('../../src/repositories/analyticsRepository.js').AnalyticsRepository);
  return { service, analytics };
}

describe('AnalyticsService.listChildAttendanceSummary', () => {
  it.each(['guardian', 'teacher', 'manager'] as const)('allows %s and delegates', async (role) => {
    const { service, analytics } = buildHarness();
    const result = await service.listChildAttendanceSummary({}, caller(role));
    expect(analytics.listChildAttendanceSummary).toHaveBeenCalledWith({});
    expect(result).toHaveLength(1);
  });

  it.each(['reception', 'driver', 'platform_admin'] as const)('denies %s with PERM_ROLE_DENIED', async (role) => {
    const { service, analytics } = buildHarness();
    await expect(service.listChildAttendanceSummary({}, caller(role, role === 'platform_admin' ? 'owner' : null))).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(analytics.listChildAttendanceSummary).not.toHaveBeenCalled();
  });

  it('passes a childId filter through', async () => {
    const { service, analytics } = buildHarness();
    await service.listChildAttendanceSummary({ childId: 'child-9' }, caller('manager'));
    expect(analytics.listChildAttendanceSummary).toHaveBeenCalledWith({ childId: 'child-9' });
  });
});

describe('AnalyticsService.listTenantBillingSummary / listTenantHealthSummary', () => {
  it('allows platform_admin (any tier) and delegates', async () => {
    const { service, analytics } = buildHarness();
    await service.listTenantBillingSummary({}, caller('platform_admin', 'support'));
    await service.listTenantHealthSummary({}, caller('platform_admin', 'owner'));
    expect(analytics.listTenantBillingSummary).toHaveBeenCalledWith({});
    expect(analytics.listTenantHealthSummary).toHaveBeenCalledWith({});
  });

  it.each(['guardian', 'teacher', 'manager', 'reception', 'driver'] as const)('denies %s on billing summary', async (role) => {
    const { service, analytics } = buildHarness();
    await expect(service.listTenantBillingSummary({}, caller(role))).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(analytics.listTenantBillingSummary).not.toHaveBeenCalled();
  });

  it('denies manager on health summary', async () => {
    const { service, analytics } = buildHarness();
    await expect(service.listTenantHealthSummary({}, caller('manager'))).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(analytics.listTenantHealthSummary).not.toHaveBeenCalled();
  });
});
