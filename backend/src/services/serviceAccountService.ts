// ServiceAccountService — testable core behind issue-service-account-key /
// revoke-service-account-key (§10.7, §14.2). Mirrors StaffAccountService's
// own shape (manager-only role check, synchronous side effect, audit log)
// for the identical class of "manager manages a machine/human credential"
// action.
import { AppError } from '../lib/errors.js';
import type { ServiceAccountRepository } from '../repositories/serviceAccountRepository.js';
import type { AuditLogger } from '../audit/auditLogger.js';
import type { CallerContext } from '../types/domain.js';
import type { ServiceAccount } from '../types/domain.js';
import { generateApiKey, hashApiKey } from '../lib/serviceAccountKey.js';
import type { IssueServiceAccountKeyInput, RevokeServiceAccountKeyInput } from '../validation/media.schema.js';

export interface IssuedServiceAccountKey {
  serviceAccount: ServiceAccount;
  apiKey: string;
}

export class ServiceAccountService {
  constructor(
    private readonly serviceAccounts: ServiceAccountRepository,
    private readonly audit: AuditLogger,
  ) {}

  async listForTenant(caller: CallerContext): Promise<ServiceAccount[]> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can view service accounts.', 'فقط المدير يمكنه عرض حسابات الخدمة.');
    }
    return this.serviceAccounts.listForTenant(caller.tenantId);
  }

  // The raw key is generated and returned exactly once, here, and never
  // again (§10.7) — no repository method, including this service's own
  // listForTenant, ever exposes it after this call returns.
  //
  // Fix for EPIC_7_REVIEW.md H2: input.cameraIds (validated non-empty for
  // purpose=camera_agent by issueServiceAccountKeySchema's own refine) is
  // passed straight through to the repository, which binds the new account
  // to each named camera.
  async issueKey(input: IssueServiceAccountKeyInput, caller: CallerContext): Promise<IssuedServiceAccountKey> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can issue a service-account key.', 'فقط المدير يمكنه إصدار مفتاح حساب خدمة.');
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const serviceAccount = await this.serviceAccounts.create({
      tenantId: caller.tenantId,
      name: input.name,
      purpose: input.purpose,
      scopes: input.scopes,
      apiKeyHash,
      issuedBy: caller.userId,
      cameraIds: input.cameraIds,
    });

    await this.audit.record({
      tenantId: caller.tenantId,
      actorType: 'staff',
      actorId: caller.userId,
      action: 'issued_service_account_key',
      targetType: 'service_accounts',
      targetId: serviceAccount.id,
    });

    return { serviceAccount, apiKey };
  }

  async revokeKey(input: RevokeServiceAccountKeyInput, caller: CallerContext): Promise<ServiceAccount> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can revoke a service-account key.', 'فقط المدير يمكنه إلغاء مفتاح حساب خدمة.');
    }

    const existing = await this.serviceAccounts.findById(input.serviceAccountId, caller.tenantId);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Service account not found for this tenant.', 'لم يتم العثور على حساب الخدمة لهذه المؤسسة.');
    }

    const revoked = await this.serviceAccounts.revoke(input.serviceAccountId, caller.tenantId);
    if (!revoked) {
      throw new AppError('STATE_ALREADY_PROCESSED', 'This service-account key has already been revoked.', 'تم إلغاء مفتاح حساب الخدمة هذا بالفعل.');
    }

    await this.audit.record({
      tenantId: caller.tenantId,
      actorType: 'staff',
      actorId: caller.userId,
      action: 'revoked_service_account_key',
      targetType: 'service_accounts',
      targetId: revoked.id,
    });

    return revoked;
  }
}
