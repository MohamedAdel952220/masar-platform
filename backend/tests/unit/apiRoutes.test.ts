import { describe, it, expect, vi } from 'vitest';
import { provisionTenantRoute } from '../../src/api/routes/provisionTenant.js';
import type { CallerContext } from '../../src/types/domain.js';

const validBody = {
  name: 'Sunrise Nursery',
  slug: 'sunrise',
  planCode: 'growth',
  contactName: 'Nadia Fouad',
  ownerName: 'Nadia Fouad',
  ownerPhone: '+201002223344',
};

function fakeService(result: unknown = { ok: true }) {
  return { provision: vi.fn(async () => result) } as unknown as import('../../src/services/tenantProvisioningService.js').TenantProvisioningService;
}

describe('provisionTenantRoute — §12.1 permission gating', () => {
  it('allows owner tier', async () => {
    const caller: CallerContext = { userId: 'pa-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'owner' };
    const service = fakeService();
    await expect(provisionTenantRoute(service, caller, validBody)).resolves.toBeDefined();
  });

  it('allows admin tier', async () => {
    const caller: CallerContext = { userId: 'pa-2', tenantId: null, role: 'platform_admin', platformAdminTier: 'admin' };
    const service = fakeService();
    await expect(provisionTenantRoute(service, caller, validBody)).resolves.toBeDefined();
  });

  it('rejects support tier — this is the exact regression the Product Validation review caught in the frontend (C8)', async () => {
    const caller: CallerContext = { userId: 'pa-3', tenantId: null, role: 'platform_admin', platformAdminTier: 'support' };
    const service = fakeService();
    await expect(provisionTenantRoute(service, caller, validBody)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(service.provision).not.toHaveBeenCalled();
  });

  it('rejects a non-platform-admin caller entirely', async () => {
    const caller: CallerContext = { userId: 'mgr-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
    const service = fakeService();
    await expect(provisionTenantRoute(service, caller, validBody)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('rejects an invalid body even for an owner-tier caller', async () => {
    const caller: CallerContext = { userId: 'pa-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'owner' };
    const service = fakeService();
    await expect(provisionTenantRoute(service, caller, { ...validBody, ownerPhone: 'not-a-phone' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});
