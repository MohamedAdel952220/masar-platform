import { describe, it, expect, vi } from 'vitest';
import {
  listChildAttendanceSummaryRoute,
  listTenantBillingSummaryRoute,
  listTenantHealthSummaryRoute,
} from '../../src/api/routes/analytics.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { AnalyticsService } from '../../src/services/analyticsService.js';

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const adminCaller: CallerContext = { userId: 'admin-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'owner' };
const uuid = '11111111-1111-1111-1111-111111111111';

describe('listChildAttendanceSummaryRoute', () => {
  it('validates and delegates', async () => {
    const service = { listChildAttendanceSummary: vi.fn(async () => [{ childId: 'c1' }]) } as unknown as AnalyticsService;
    const result = await listChildAttendanceSummaryRoute(service, managerCaller, { childId: uuid });
    expect(service.listChildAttendanceSummary).toHaveBeenCalledWith({ childId: uuid }, managerCaller);
    expect(result).toEqual([{ childId: 'c1' }]);
  });

  it('defaults an undefined query to {}', async () => {
    const service = { listChildAttendanceSummary: vi.fn(async () => []) } as unknown as AnalyticsService;
    await listChildAttendanceSummaryRoute(service, managerCaller, undefined);
    expect(service.listChildAttendanceSummary).toHaveBeenCalledWith({}, managerCaller);
  });

  it('rejects an invalid childId', async () => {
    const service = { listChildAttendanceSummary: vi.fn() } as unknown as AnalyticsService;
    await expect(listChildAttendanceSummaryRoute(service, managerCaller, { childId: 'bad' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.listChildAttendanceSummary).not.toHaveBeenCalled();
  });
});

describe('listTenantBillingSummaryRoute / listTenantHealthSummaryRoute', () => {
  it('delegates billing summary', async () => {
    const service = { listTenantBillingSummary: vi.fn(async () => [{ tenantId: 't1' }]) } as unknown as AnalyticsService;
    await listTenantBillingSummaryRoute(service, adminCaller, {});
    expect(service.listTenantBillingSummary).toHaveBeenCalledWith({}, adminCaller);
  });

  it('delegates health summary', async () => {
    const service = { listTenantHealthSummary: vi.fn(async () => [{ tenantId: 't1' }]) } as unknown as AnalyticsService;
    await listTenantHealthSummaryRoute(service, adminCaller, { tenantId: uuid });
    expect(service.listTenantHealthSummary).toHaveBeenCalledWith({ tenantId: uuid }, adminCaller);
  });

  it('rejects an invalid tenantId on health summary', async () => {
    const service = { listTenantHealthSummary: vi.fn() } as unknown as AnalyticsService;
    await expect(listTenantHealthSummaryRoute(service, adminCaller, { tenantId: 'bad' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.listTenantHealthSummary).not.toHaveBeenCalled();
  });
});
