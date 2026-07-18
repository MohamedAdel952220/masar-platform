// SafetyService — testable core behind create_pickup_pass, scan_pickup_pass,
// confirm_handover (§14.2, §13.4). Same defense-in-depth convention as
// TransportService/AcademicRecordService.
import { AppError } from '../lib/errors.js';
import type { PickupPassRepository } from '../repositories/pickupPassRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { PickupPass, ScanPickupPassResult, PickupScanEvent } from '../types/domain.epic3.js';
import type { CreatePickupPassInput, ScanPickupPassInput, ConfirmHandoverInput, RevokePickupPassInput } from '../validation/transport.schema.js';

export class SafetyService {
  constructor(private readonly pickupPasses: PickupPassRepository) {}

  async createPickupPass(input: CreatePickupPassInput, caller: CallerContext): Promise<PickupPass> {
    if (caller.role !== 'guardian') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a guardian can create a pickup pass.', 'فقط ولي الأمر يمكنه إنشاء تصريح استلام.');
    }
    return this.pickupPasses.create(input);
  }

  // Fix for EPIC_3_REVIEW.md M4 — guardian-only per §12's permission matrix
  // (Pickup passes: CRUD own child, manager R-only).
  async revokePickupPass(input: RevokePickupPassInput, caller: CallerContext): Promise<PickupPass> {
    if (caller.role !== 'guardian') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a guardian can revoke a pickup pass.', 'فقط ولي الأمر يمكنه إلغاء تصريح الاستلام.');
    }
    return this.pickupPasses.revoke(input.pickupPassId);
  }

  // §13.4: exact qr_token match only — this method never accepts a partial
  // token or performs a listing query.
  async scanPickupPass(input: ScanPickupPassInput, caller: CallerContext): Promise<ScanPickupPassResult> {
    if (caller.role !== 'reception') {
      throw new AppError('PERM_ROLE_DENIED', 'Only reception can scan a pickup pass.', 'فقط موظف الاستقبال يمكنه مسح تصريح الاستلام.');
    }
    return this.pickupPasses.scan(input.qrToken);
  }

  async confirmHandover(input: ConfirmHandoverInput, caller: CallerContext): Promise<PickupScanEvent> {
    if (caller.role !== 'reception') {
      throw new AppError('PERM_ROLE_DENIED', 'Only reception can confirm a handover.', 'فقط موظف الاستقبال يمكنه تأكيد التسليم.');
    }
    return this.pickupPasses.confirmHandover(input.pickupScanEventId);
  }
}
