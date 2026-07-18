// AnnouncementService — testable core behind broadcast_announcement (§14.2,
// §12.1: manager own-tenant, platform_admin owner/admin tier platform-wide).
import { AppError } from '../lib/errors.js';
import type { AnnouncementRepository } from '../repositories/announcementRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { Announcement } from '../types/domain.epic4.js';
import type { BroadcastAnnouncementInput } from '../validation/comms.schema.js';

export class AnnouncementService {
  constructor(private readonly announcements: AnnouncementRepository) {}

  async broadcast(input: BroadcastAnnouncementInput, caller: CallerContext): Promise<Announcement> {
    if (caller.role !== 'manager' && caller.role !== 'platform_admin') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager or platform admin can broadcast an announcement.', 'فقط المدير أو مسؤول المنصة يمكنه بث إعلان.');
    }

    if (caller.role === 'manager' && !input.audience) {
      throw new AppError('VALIDATION_FAILED', 'An audience is required for a tenant-scoped announcement.', 'الجمهور المستهدف مطلوب.');
    }

    // Fix for EPIC_4_REVIEW.md H1 — layer 2 of the 3-layer fix (Zod schema,
    // this service check, and the RPC/DB-constraint pair). Kept here too so
    // a caller invoking AnnouncementService directly (bypassing only the
    // Zod schema, e.g. in a test) still gets a clean, immediate error.
    if (input.audience === 'classroom' && !input.classroomId) {
      throw new AppError('VALIDATION_FAILED', 'A classroom must be selected for a classroom-targeted announcement.', 'يجب اختيار فصل عند استهداف إعلان لفصل معيّن.');
    }

    if (caller.role === 'platform_admin') {
      if (!input.platformAudience) {
        throw new AppError('VALIDATION_FAILED', 'A platform audience is required for a platform-wide announcement.', 'جمهور المنصة المستهدف مطلوب.');
      }
      if (caller.platformAdminTier === 'support') {
        throw new AppError('PERM_ROLE_DENIED', 'Only owner/admin tier can broadcast platform-wide.', 'فقط فئة المالك/المسؤول يمكنها البث على مستوى المنصة.');
      }
    }

    return this.announcements.broadcast(input);
  }
}
