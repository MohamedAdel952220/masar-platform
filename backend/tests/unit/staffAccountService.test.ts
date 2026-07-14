import { describe, it, expect, vi } from 'vitest';
import { StaffAccountService } from '../../src/services/staffAccountService.js';
import type { StaffProfile } from '../../src/types/domain.js';
import type { CallerContext } from '../../src/types/domain.js';

function makeStaff(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: 'staff-1',
    tenantId: 'tenant-1',
    role: 'teacher',
    name: 'Sara Mahmoud',
    nameAr: null,
    phone: '+201009998888',
    email: null,
    employmentStatus: 'active',
    deletedAt: null,
    ...overrides,
  };
}

function buildHarness(staffOverrides: Partial<StaffProfile> = {}) {
  const staffRecord = makeStaff(staffOverrides);
  const staff = {
    findById: vi.fn(async () => staffRecord),
    setEmploymentStatus: vi.fn(async () => staffRecord),
  };
  const authAdmin = { signOutGlobal: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  // deno-lint-ignore no-explicit-any
  const service = new StaffAccountService(staff as any, authAdmin as any, audit as any);
  return { service, staff, authAdmin, audit, staffRecord };
}

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const otherTenantManager: CallerContext = { userId: 'manager-2', tenantId: 'tenant-2', role: 'manager', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const platformAdminCaller: CallerContext = { userId: 'pa-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'support' };

describe('StaffAccountService.suspend', () => {
  it('suspends and synchronously revokes sessions', async () => {
    const h = buildHarness();
    await h.service.suspend('staff-1', managerCaller, 'policy violation');
    expect(h.staff.setEmploymentStatus).toHaveBeenCalledWith('staff-1', 'terminated');
    expect(h.authAdmin.signOutGlobal).toHaveBeenCalledWith('staff-1');
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'suspended_staff_account' }));
  });

  it('rejects a non-manager caller', async () => {
    const h = buildHarness();
    await expect(h.service.suspend('staff-1', teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.staff.setEmploymentStatus).not.toHaveBeenCalled();
  });

  it('rejects a manager from a different tenant (tenant isolation)', async () => {
    const h = buildHarness();
    await expect(h.service.suspend('staff-1', otherTenantManager)).rejects.toMatchObject({ code: 'PERM_TENANT_MISMATCH' });
    expect(h.staff.setEmploymentStatus).not.toHaveBeenCalled();
  });

  it('rejects suspending an already-suspended account', async () => {
    const h = buildHarness({ employmentStatus: 'terminated' });
    await expect(h.service.suspend('staff-1', managerCaller)).rejects.toMatchObject({ code: 'STATE_ACCOUNT_ALREADY_SUSPENDED' });
  });

  it('does not fail the whole request if session revocation itself errors (still audit-logged locally)', async () => {
    const h = buildHarness();
    h.authAdmin.signOutGlobal = vi.fn(async () => { throw new Error('network blip'); });
    await expect(h.service.suspend('staff-1', managerCaller)).resolves.toBeUndefined();
    expect(h.staff.setEmploymentStatus).toHaveBeenCalled();
  });
});

describe('StaffAccountService.reactivate', () => {
  it('reactivates a suspended account', async () => {
    const h = buildHarness({ employmentStatus: 'terminated' });
    await h.service.reactivate('staff-1', managerCaller);
    expect(h.staff.setEmploymentStatus).toHaveBeenCalledWith('staff-1', 'active');
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'reactivated_staff_account' }));
  });

  it('rejects reactivating an account that is not suspended', async () => {
    const h = buildHarness({ employmentStatus: 'active' });
    await expect(h.service.reactivate('staff-1', managerCaller)).rejects.toMatchObject({ code: 'STATE_ACCOUNT_NOT_SUSPENDED' });
  });
});

describe('StaffAccountService.revokeSessions', () => {
  it('allows a manager to revoke sessions for their own tenant', async () => {
    const h = buildHarness();
    await h.service.revokeSessions('staff-1', 'tenant-1', managerCaller);
    expect(h.authAdmin.signOutGlobal).toHaveBeenCalledWith('staff-1');
  });

  it('allows a platform admin to revoke sessions for any tenant', async () => {
    const h = buildHarness();
    await h.service.revokeSessions('staff-1', 'tenant-99', platformAdminCaller);
    expect(h.authAdmin.signOutGlobal).toHaveBeenCalledWith('staff-1');
  });

  it('rejects a manager from a different tenant', async () => {
    const h = buildHarness();
    await expect(h.service.revokeSessions('staff-1', 'tenant-1', otherTenantManager)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.authAdmin.signOutGlobal).not.toHaveBeenCalled();
  });

  it('rejects a teacher entirely (no self-service session revocation of others)', async () => {
    const h = buildHarness();
    await expect(h.service.revokeSessions('staff-1', 'tenant-1', teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
