import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantProvisioningService } from '../../src/services/tenantProvisioningService.js';
import { AppError } from '../../src/lib/errors.js';
import type { ProvisionTenantInput } from '../../src/validation/tenant.schema.js';
import type { Tenant, StaffProfile, PlanCatalog } from '../../src/types/domain.js';

// ---- fakes -----------------------------------------------------------------

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-1',
    name: 'Sunrise Nursery',
    slug: 'sunrise',
    city: null,
    planId: 'plan-growth',
    status: 'trial',
    contactName: 'Nadia Fouad',
    contactEmail: null,
    contactPhone: '+201002223344',
    trialEndsAt: new Date().toISOString(),
    suspendedAt: null,
    suspendedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildHarness(opts: { staffInsertFails?: boolean } = {}) {
  const advanceStepCalls: Array<{ tenantId: string; step: string; error?: string | null }> = [];
  const auditEvents: unknown[] = [];
  const deleteUserCalls: string[] = [];

  const tenants = {
    findBySlug: vi.fn(async () => null),
    create: vi.fn(async () => makeTenant()),
  };

  const plans = {
    findByCode: vi.fn(async (): Promise<PlanCatalog> => ({ id: 'plan-growth', code: 'growth', monthlyPrice: 7500, setupFee: 12000, maxChildren: 100 })),
  };

  const staff = {
    create: vi.fn(async (): Promise<StaffProfile> => {
      if (opts.staffInsertFails) throw new Error('duplicate key value violates unique constraint');
      return {
        id: 'auth-user-1',
        tenantId: 'tenant-1',
        role: 'manager',
        name: 'Nadia Fouad',
        nameAr: null,
        phone: '+201002223344',
        email: null,
        employmentStatus: 'active',
        deletedAt: null,
      };
    }),
  };

  const provisioning = {
    advanceStep: vi.fn(async (tenantId: string, step: string, error?: string | null) => {
      advanceStepCalls.push({ tenantId, step, error });
    }),
  };

  const phoneRegistry = { register: vi.fn(async () => undefined) };

  const authAdmin = {
    createUser: vi.fn(async () => ({ id: 'auth-user-1' })),
    deleteUser: vi.fn(async (id: string) => {
      deleteUserCalls.push(id);
    }),
    signOutGlobal: vi.fn(async () => undefined),
  };

  const activation = {
    send: vi.fn(async () => ({ delivered: true, channel: 'whatsapp_stub' as const, activationUrl: 'https://app.masar.app/activate/x' })),
  };

  const audit = { record: vi.fn(async (e: unknown) => { auditEvents.push(e); }) };

  // deno-lint-ignore no-explicit-any
  const service = new TenantProvisioningService(tenants as any, plans as any, staff as any, provisioning as any, phoneRegistry as any, authAdmin as any, activation as any, audit as any);

  return { service, tenants, plans, staff, provisioning, phoneRegistry, authAdmin, activation, audit, advanceStepCalls, auditEvents, deleteUserCalls };
}

const validInput: ProvisionTenantInput = {
  name: 'Sunrise Nursery',
  slug: 'sunrise',
  planCode: 'growth',
  contactName: 'Nadia Fouad',
  ownerName: 'Nadia Fouad',
  ownerPhone: '+201002223344',
};

describe('TenantProvisioningService.provision', () => {
  it('happy path: creates tenant, manager auth user + profile, phone registry entry, sends activation, writes audit log, never returns a password', async () => {
    const h = buildHarness();
    const result = await h.service.provision(validInput, 'platform-admin-1');

    expect(result.tenant.slug).toBe('sunrise');
    expect(result.manager.activationSent).toBe(true);
    expect(result.manager).not.toHaveProperty('password');
    expect(JSON.stringify(result)).not.toMatch(/password/i);

    expect(h.authAdmin.createUser).toHaveBeenCalledTimes(1);
    expect(h.staff.create).toHaveBeenCalledTimes(1);
    expect(h.phoneRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+201002223344', accountType: 'staff' }),
    );
    expect(h.activation.send).toHaveBeenCalledTimes(1);
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'provisioned_tenant' }));

    // Provisioning state progresses through every step in order.
    expect(h.advanceStepCalls.map((c) => c.step)).toEqual([
      'created',
      'initial_manager_created',
      'plan_apps_provisioned',
      'welcome_sent',
      'complete',
    ]);
  });

  it('rejects an unknown plan code before touching Auth or the tenant table', async () => {
    const h = buildHarness();
    h.plans.findByCode = vi.fn(async () => null) as unknown as typeof h.plans.findByCode;

    await expect(h.service.provision(validInput, 'platform-admin-1')).rejects.toThrow(AppError);
    expect(h.tenants.create).not.toHaveBeenCalled();
    expect(h.authAdmin.createUser).not.toHaveBeenCalled();
  });

  it('rejects a duplicate slug before creating any Auth identity', async () => {
    const h = buildHarness();
    h.tenants.findBySlug = vi.fn(async () => makeTenant()) as unknown as typeof h.tenants.findBySlug;

    await expect(h.service.provision(validInput, 'platform-admin-1')).rejects.toMatchObject({ code: 'VALIDATION_DUPLICATE_SLUG' });
    expect(h.authAdmin.createUser).not.toHaveBeenCalled();
  });

  it('saga compensation: deletes the just-created Auth user if the staff_profiles insert fails (§25.3)', async () => {
    const h = buildHarness({ staffInsertFails: true });

    await expect(h.service.provision(validInput, 'platform-admin-1')).rejects.toMatchObject({ code: 'EXTERNAL_AUTH_ADMIN_FAILURE' });

    expect(h.authAdmin.createUser).toHaveBeenCalledTimes(1);
    expect(h.deleteUserCalls).toEqual(['auth-user-1']);
    // Must not have advanced past 'created' with a real success state.
    expect(h.advanceStepCalls.some((c) => c.step === 'initial_manager_created')).toBe(false);
    // Must not have proceeded to send an activation link for a rolled-back account.
    expect(h.activation.send).not.toHaveBeenCalled();
  });
});
