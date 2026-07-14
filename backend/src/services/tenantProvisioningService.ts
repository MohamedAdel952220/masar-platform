// TenantProvisioningService — the testable business-logic core behind the
// provision-tenant Edge Function (§10.3, §25.3). The Edge Function
// (supabase/functions/provision-tenant/index.ts) is the deployed runtime;
// this service is the same saga expressed as plain, dependency-injected
// TypeScript so it can be unit-tested without Deno or a live Supabase
// project (see tests/unit/tenantProvisioningService.test.ts).
import { AppError } from '../lib/errors.js';
import type { TenantRepository } from '../repositories/tenantRepository.js';
import type { PlanCatalogRepository } from '../repositories/planCatalogRepository.js';
import type { StaffProfileRepository } from '../repositories/staffProfileRepository.js';
import type { TenantProvisioningRepository, TenantPhoneRegistryRepository } from '../repositories/tenantProvisioningRepository.js';
import type { AuthAdminPort } from './authAdminPort.js';
import type { ActivationLinkPort } from './activationLinkPort.js';
import type { AuditLogger } from '../audit/auditLogger.js';
import type { ProvisionTenantInput } from '../validation/tenant.schema.js';
import type { Tenant } from '../types/domain.js';

export interface ProvisionTenantResult {
  tenant: Tenant;
  manager: { id: string; name: string; phone: string; activationSent: boolean };
}

export class TenantProvisioningService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly plans: PlanCatalogRepository,
    private readonly staff: StaffProfileRepository,
    private readonly provisioning: TenantProvisioningRepository,
    private readonly phoneRegistry: TenantPhoneRegistryRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly activation: ActivationLinkPort,
    private readonly audit: AuditLogger,
  ) {}

  async provision(input: ProvisionTenantInput, actorId: string): Promise<ProvisionTenantResult> {
    const plan = await this.plans.findByCode(input.planCode);
    if (!plan) {
      throw new AppError('VALIDATION_FAILED', `Unknown plan code ${input.planCode}`, 'خطة غير معروفة.');
    }

    const existing = await this.tenants.findBySlug(input.slug);
    if (existing) {
      throw new AppError('VALIDATION_DUPLICATE_SLUG', `Subdomain "${input.slug}" is already taken.`, `النطاق الفرعي "${input.slug}" مستخدم بالفعل.`);
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const tenant = await this.tenants.create({
      name: input.name,
      slug: input.slug,
      city: input.city ?? null,
      planId: plan.id,
      contactName: input.contactName,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.ownerPhone,
      trialEndsAt,
    });
    await this.provisioning.advanceStep(tenant.id, 'created');

    // --- saga step: Auth identity first, DB row second, compensate on failure (§25.3)
    const authUser = await this.authAdmin.createUser({
      phone: input.ownerPhone,
      appMetadata: { tenant_id: tenant.id, role: 'manager', app_access: ['dashboard'] },
      userMetadata: { name: input.ownerName },
    });

    try {
      await this.staff.create({
        id: authUser.id,
        tenantId: tenant.id,
        role: 'manager',
        name: input.ownerName,
        phone: input.ownerPhone,
        email: input.contactEmail ?? null,
      });
    } catch (err) {
      await this.authAdmin.deleteUser(authUser.id).catch((compErr) => {
        console.error(`Compensating deleteUser failed for ${authUser.id} — manual cleanup required.`, compErr);
      });
      await this.provisioning.advanceStep(tenant.id, 'created', `staff_profiles insert failed: ${(err as Error).message}`);
      throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the manager profile.', 'فشل إنشاء ملف المدير.');
    }

    await this.phoneRegistry.register({ tenantId: tenant.id, phone: input.ownerPhone, accountType: 'staff', accountId: authUser.id });
    await this.provisioning.advanceStep(tenant.id, 'initial_manager_created');

    await this.provisioning.advanceStep(tenant.id, 'plan_apps_provisioned');

    const activationResult = await this.activation.send({
      phone: input.ownerPhone,
      name: input.ownerName,
      appLabel: 'Nursery Dashboard',
      userId: authUser.id,
    });
    await this.provisioning.advanceStep(tenant.id, 'welcome_sent');

    await this.provisioning.advanceStep(tenant.id, 'complete');
    await this.audit.record({
      tenantId: tenant.id,
      actorType: 'platform_admin',
      actorId: actorId,
      action: 'provisioned_tenant',
      targetType: 'tenant',
      targetId: tenant.id,
    });

    return {
      tenant,
      manager: { id: authUser.id, name: input.ownerName, phone: input.ownerPhone, activationSent: activationResult.delivered },
    };
  }
}
