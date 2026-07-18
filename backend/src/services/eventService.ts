// EventService — testable core behind update_rsvp/cancel_trip_registration
// (§14.2) plus the direct-CRUD event/registration reads. Defense-in-depth
// role checks matching the RPC's own (§28 convention). Ownership (does this
// child belong to this guardian) is left to RLS + the DB trigger backstop
// (migration 2/4) — re-deriving it here would just replicate the identical
// RLS-filtered result without adding a real guarantee, per
// EPIC_3_REVIEW.md M10's own resolution for TransportService/SafetyService.
import { AppError } from '../lib/errors.js';
import type { EventRepository } from '../repositories/eventRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { ApprovalEvent, EventRsvp, EventTripRegistration } from '../types/domain.epic5.js';
import type { UpdateRsvpInput, RegisterForTripInput, CancelTripRegistrationInput } from '../validation/approvals.schema.js';

export class EventService {
  constructor(private readonly events: EventRepository) {}

  // Fix for EPIC_5_REVIEW.md M3: every sibling method here (and in
  // ApprovalRequestService) explicitly checks caller.role before
  // delegating; this method previously did not, letting a role with no
  // documented Events access at all (driver, reception — §12's permission
  // matrix) call it without a clean PERM_ROLE_DENIED. RLS already returns
  // an empty array for those roles (no SELECT policy grants them
  // visibility), so this was not a data leak, but it was inconsistent with
  // this file's own convention and produced a confusing silent-empty-list
  // UX instead of a clear rejection.
  async listForTenant(caller: CallerContext): Promise<ApprovalEvent[]> {
    if (caller.role !== 'guardian' && caller.role !== 'teacher' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view events.', 'غير مصرح لك بعرض الفعاليات.');
    }
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'A tenant context is required.', 'يلزم سياق مؤسسة.');
    }
    return this.events.listForTenant(caller.tenantId);
  }

  async updateRsvp(input: UpdateRsvpInput, caller: CallerContext): Promise<EventRsvp> {
    if (caller.role !== 'guardian') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a guardian can RSVP.', 'فقط ولي الأمر يمكنه تأكيد الحضور.');
    }
    return this.events.updateRsvp(input);
  }

  async registerForTrip(input: RegisterForTripInput, caller: CallerContext): Promise<EventTripRegistration> {
    if (caller.role !== 'guardian' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a guardian can register for a trip.', 'فقط ولي الأمر يمكنه التسجيل في الرحلة.');
    }
    return this.events.registerForTrip(input.eventId, input.childId, caller.tenantId);
  }

  async cancelTripRegistration(input: CancelTripRegistrationInput, caller: CallerContext): Promise<EventTripRegistration> {
    if (caller.role !== 'guardian') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a guardian can cancel a trip registration.', 'فقط ولي الأمر يمكنه إلغاء تسجيل الرحلة.');
    }
    return this.events.cancelTripRegistration(input.registrationId);
  }
}
