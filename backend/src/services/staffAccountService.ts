// StaffAccountService — testable core behind suspend-staff-account,
// reactivate-staff-account, and revoke-sessions (§10.6, §14.2).
import { AppError } from '../lib/errors.js';
import type { StaffProfileRepository } from '../repositories/staffProfileRepository.js';
import type { AuthAdminPort } from './authAdminPort.js';
import type { AuditLogger } from '../audit/auditLogger.js';
import type { CallerContext } from '../types/domain.js';

export class StaffAccountService {
  constructor(
    private readonly staff: StaffProfileRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly audit: AuditLogger,
  ) {}

  async suspend(staffId: string, caller: CallerContext, reason?: string): Promise<void> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can suspend a staff account.', 'فقط المدير يمكنه تعليق حساب موظف.');
    }
    const staffMember = await this.staff.findById(staffId);
    if (!staffMember) throw new AppError('NOT_FOUND', 'Staff member not found.', 'لم يتم العثور على الموظف.');
    if (staffMember.tenantId !== caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'This staff member does not belong to your tenant.', 'هذا الموظف لا ينتمي إلى مؤسستك.');
    }
    if (staffMember.employmentStatus === 'terminated') {
      throw new AppError('STATE_ACCOUNT_ALREADY_SUSPENDED', 'This account is already suspended.', 'هذا الحساب معلّق بالفعل.');
    }

    await this.staff.setEmploymentStatus(staffId, 'terminated');

    // Synchronous — not a follow-up job (§10.6). A failure here is logged but
    // does not block the request: the account is already locked out at the
    // employment_status/RLS layer.
    await this.authAdmin.signOutGlobal(staffId).catch((err) => {
      console.error(`signOutGlobal failed during suspend for ${staffId}:`, err);
    });

    await this.audit.record({
      tenantId: staffMember.tenantId,
      actorType: 'staff',
      actorId: caller.userId,
      action: 'suspended_staff_account',
      targetType: 'staff_profiles',
      targetId: staffId,
    });
  }

  async reactivate(staffId: string, caller: CallerContext): Promise<void> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can reactivate a staff account.', 'فقط المدير يمكنه إعادة تفعيل حساب موظف.');
    }
    const staffMember = await this.staff.findById(staffId);
    if (!staffMember) throw new AppError('NOT_FOUND', 'Staff member not found.', 'لم يتم العثور على الموظف.');
    if (staffMember.tenantId !== caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'This staff member does not belong to your tenant.', 'هذا الموظف لا ينتمي إلى مؤسستك.');
    }
    if (staffMember.employmentStatus !== 'terminated') {
      throw new AppError('STATE_ACCOUNT_NOT_SUSPENDED', 'This account is not currently suspended.', 'هذا الحساب غير معلّق حاليًا.');
    }

    await this.staff.setEmploymentStatus(staffId, 'active');

    await this.audit.record({
      tenantId: staffMember.tenantId,
      actorType: 'staff',
      actorId: caller.userId,
      action: 'reactivated_staff_account',
      targetType: 'staff_profiles',
      targetId: staffId,
    });
  }

  async revokeSessions(targetUserId: string, targetTenantId: string | null, caller: CallerContext): Promise<void> {
    const isPlatformAdmin = caller.role === 'platform_admin';
    const isManagerOwnTenant = caller.role === 'manager' && targetTenantId === caller.tenantId;
    if (!isPlatformAdmin && !isManagerOwnTenant) {
      throw new AppError('PERM_ROLE_DENIED', "You do not have permission to revoke this account's sessions.", 'لا تملك صلاحية إلغاء جلسات هذا الحساب.');
    }

    await this.authAdmin.signOutGlobal(targetUserId);

    await this.audit.record({
      tenantId: targetTenantId,
      actorType: isPlatformAdmin ? 'platform_admin' : 'staff',
      actorId: caller.userId,
      action: 'revoked_sessions',
      targetType: 'account',
      targetId: targetUserId,
    });
  }
}
