// Framework-agnostic API handler — validates input, checks the caller's
// permission tier, and delegates to TenantProvisioningService. Deployed
// today as the provision-tenant Edge Function; this module is the same
// contract expressed so it's independently unit-testable and reusable if
// the platform ever adds a non-Edge-Function API surface (§14).
import { provisionTenantSchema } from '../../validation/tenant.schema.js';
import { AppError } from '../../lib/errors.js';
import type { TenantProvisioningService, ProvisionTenantResult } from '../../services/tenantProvisioningService.js';
import type { CallerContext } from '../../types/domain.js';

export async function provisionTenantRoute(
  service: TenantProvisioningService,
  caller: CallerContext,
  rawBody: unknown,
): Promise<ProvisionTenantResult> {
  if (caller.role !== 'platform_admin' || (caller.platformAdminTier !== 'owner' && caller.platformAdminTier !== 'admin')) {
    throw new AppError('PERM_ROLE_DENIED', 'This action requires Owner or Admin access.', 'يتطلب هذا الإجراء صلاحية مالك أو مسؤول.');
  }

  const parsed = provisionTenantSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', parsed.error.issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
  }

  return service.provision(parsed.data, caller.userId);
}
