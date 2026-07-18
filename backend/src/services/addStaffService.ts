// AddStaffService — testable core behind the add-staff Edge Function
// (§10.3, §14.2). Direct extension of Epic 1's provisioning pattern, reusing
// Epic 1's StaffProfileRepository, TenantPhoneRegistryRepository,
// AuthAdminPort, ActivationLinkPort, and AuditLogger UNMODIFIED.
import { AppError } from '../lib/errors.js';
import type { StaffProfileRepository } from '../repositories/staffProfileRepository.js';
import type { TenantPhoneRegistryRepository } from '../repositories/tenantProvisioningRepository.js';
import type { AuthAdminPort } from './authAdminPort.js';
import type { ActivationLinkPort } from './activationLinkPort.js';
import type { AuditLogger } from '../audit/auditLogger.js';
import type { AddStaffInput } from '../validation/staff.schema.js';
import type { StaffProfile } from '../types/domain.js';

export interface AddStaffResult {
  staff: { id: string; role: StaffProfile['role']; name: string; phone: string; activationSent: boolean };
}

export class AddStaffService {
  constructor(
    private readonly staff: StaffProfileRepository,
    private readonly phoneRegistry: TenantPhoneRegistryRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly activation: ActivationLinkPort,
    private readonly audit: AuditLogger,
  ) {}

  async add(input: AddStaffInput, actorId: string): Promise<AddStaffResult> {
    if (input.role === 'manager') {
      // manager accounts are only ever created by provision-tenant (Epic 1,
      // exactly one per tenant) — add-staff is scoped to teacher|reception,
      // matching BACKEND_EXECUTION_PLAN.md Epic 2's add-staff contract.
      throw new AppError('VALIDATION_FAILED', 'add-staff cannot create a manager account.', 'لا يمكن إنشاء حساب مدير عبر إضافة موظف.');
    }

    const isTaken = await this.phoneRegistry.isPhoneTaken(input.tenantId, input.phone);
    if (isTaken) {
      throw new AppError('VALIDATION_DUPLICATE_PHONE', 'This phone number is already registered in your tenant.', 'رقم الهاتف هذا مسجّل بالفعل في مؤسستك.');
    }

    const appAccess = input.role === 'teacher' ? ['teacher'] : ['reception'];
    const authUser = await this.authAdmin.createUser({
      phone: input.phone,
      appMetadata: { tenant_id: input.tenantId, role: input.role, app_access: appAccess },
      userMetadata: { name: input.name },
    });

    let created: StaffProfile;
    try {
      created = await this.staff.create({
        id: authUser.id,
        tenantId: input.tenantId,
        role: input.role,
        name: input.name,
        nameAr: input.nameAr ?? null,
        phone: input.phone,
        email: input.email ?? null,
      });
    } catch (err) {
      await this.authAdmin.deleteUser(authUser.id).catch((compErr) => {
        console.error(`Compensating deleteUser failed for ${authUser.id} — manual cleanup required.`, compErr);
      });
      throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the staff profile.', 'فشل إنشاء ملف الموظف.');
    }

    await this.phoneRegistry.register({ tenantId: input.tenantId, phone: input.phone, accountType: 'staff', accountId: authUser.id });

    const activationResult = await this.activation.send({
      phone: input.phone,
      name: input.name,
      appLabel: input.role === 'teacher' ? 'Teacher App' : 'Reception App',
      userId: authUser.id,
    });

    await this.audit.record({
      tenantId: input.tenantId,
      actorType: 'staff',
      actorId,
      action: 'added_staff',
      targetType: 'staff_profiles',
      targetId: created.id,
    });

    return { staff: { id: created.id, role: created.role, name: created.name, phone: created.phone, activationSent: activationResult.delivered } };
  }
}
