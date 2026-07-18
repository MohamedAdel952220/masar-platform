// ChildEnrollmentService — the testable business-logic core behind the
// enroll-child Edge Function (§10.3, §25.3). Same saga shape as Epic 1's
// TenantProvisioningService, extended with the sibling-guardian-reuse path
// (EPIC_2_ARCHITECTURE_REVIEW.md §13): check tenant_phone_registry FIRST,
// never insert-then-catch.
//
// Fix for EPIC_2_REVIEW.md C3: the child insert and the guardian-link insert
// are now a SINGLE call to ChildRepository.enrollWithGuardian (wrapping the
// new public.enroll_child_with_guardian RPC, migration 7), which performs
// both writes in one transaction. Previously these were two separate calls
// (enroll() then linkGuardian()); a failure of the second left an orphaned
// child with no compensation, and — because the idempotency wrapper around
// the whole saga only stores a replay snapshot on success — a client retry
// after that failure re-ran the saga and created a duplicate child (children
// have no natural uniqueness key). Folding both writes into one RPC call
// means they now succeed or fail together: no orphan, no duplicate-on-retry.
import { AppError } from '../lib/errors.js';
import type { GuardianProfileRepository } from '../repositories/guardianProfileRepository.js';
import type { TenantPhoneRegistryLookupRepository } from '../repositories/tenantPhoneRegistryLookupRepository.js';
import type { TenantPhoneRegistryRepository } from '../repositories/tenantProvisioningRepository.js';
import type { ChildRepository } from '../repositories/childRepository.js';
import type { AuthAdminPort } from './authAdminPort.js';
import type { ActivationLinkPort } from './activationLinkPort.js';
import type { AuditLogger } from '../audit/auditLogger.js';
import type { EnrollChildInput } from '../validation/academic.schema.js';
import type { Child, GuardianProfile } from '../types/domain.epic2.js';

export interface EnrollChildResult {
  child: Child;
  guardian: { id: string; name: string; phone: string; isNew: boolean; activationSent: boolean };
}

export class ChildEnrollmentService {
  constructor(
    private readonly guardians: GuardianProfileRepository,
    private readonly phoneLookup: TenantPhoneRegistryLookupRepository,
    private readonly phoneRegistry: TenantPhoneRegistryRepository,
    private readonly children: ChildRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly activation: ActivationLinkPort,
    private readonly audit: AuditLogger,
  ) {}

  async enroll(input: EnrollChildInput, tenantId: string, actorId: string): Promise<EnrollChildResult> {
    const existing = await this.phoneLookup.findByTenantAndPhone(tenantId, input.guardian.phone);

    let guardian: { id: string; name: string; phone: string };
    let guardianIsNew = false;

    if (existing) {
      if (existing.accountType !== 'guardian') {
        throw new AppError(
          'VALIDATION_DUPLICATE_PHONE',
          'This phone number is already registered to a non-guardian account in your tenant.',
          'رقم الهاتف هذا مسجّل بالفعل لحساب من نوع آخر في مؤسستك.',
        );
      }
      guardian = { id: existing.accountId, name: input.guardian.name, phone: input.guardian.phone };
    } else {
      const authUser = await this.authAdmin.createUser({
        phone: input.guardian.phone,
        appMetadata: { tenant_id: tenantId, role: 'guardian', app_access: ['parent'] },
        userMetadata: { name: input.guardian.name },
      });

      let created: GuardianProfile;
      try {
        created = await this.guardians.create({
          id: authUser.id,
          tenantId,
          name: input.guardian.name,
          phone: input.guardian.phone,
          email: input.guardian.email ?? null,
          createdBy: actorId,
        });
      } catch (err) {
        await this.authAdmin.deleteUser(authUser.id).catch((compErr) => {
          console.error(`Compensating deleteUser failed for ${authUser.id} — manual cleanup required.`, compErr);
        });
        throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the guardian profile.', 'فشل إنشاء ملف ولي الأمر.');
      }

      await this.phoneRegistry.register({ tenantId, phone: input.guardian.phone, accountType: 'guardian', accountId: authUser.id });

      guardian = { id: created.id, name: created.name, phone: created.phone };
      guardianIsNew = true;
    }

    // Intentionally NOT compensated if this fails — a newly-created guardian
    // account with no child yet is a valid state, and a retried call finds
    // it again via phoneLookup instead of duplicating it (see
    // enroll-child/index.ts's header comment for the full reasoning). The
    // child-insert-and-link step itself is now atomic (EPIC_2_REVIEW.md C3):
    // either both the child row and the guardian link exist, or neither does.
    const child = await this.children.enrollWithGuardian({
      tenantId,
      classroomId: input.classroomId,
      child: input.child,
      createdBy: actorId,
      guardianId: guardian.id,
      relation: input.guardian.relation,
      isPrimaryContact: true,
    });

    let activationSent = false;
    if (guardianIsNew) {
      const result = await this.activation.send({ phone: guardian.phone, name: guardian.name, appLabel: 'Parent App', userId: guardian.id });
      activationSent = result.delivered;
    }

    await this.audit.record({
      tenantId,
      actorType: 'staff',
      actorId,
      action: 'enrolled_child',
      targetType: 'children',
      targetId: child.id,
    });

    return { child, guardian: { ...guardian, isNew: guardianIsNew, activationSent } };
  }
}
