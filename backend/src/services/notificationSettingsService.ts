// NotificationSettingsService — testable core behind register_device_token/
// update_notification_preferences/mark-notification-read (§14.2, §12: every
// role gets CRUD-own on both device tokens and preferences, R/U-own on
// notifications).
import { AppError } from '../lib/errors.js';
import type { NotificationRepository } from '../repositories/notificationRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { Notification, DeviceToken, NotificationPreference } from '../types/domain.epic4.js';
import type { RegisterDeviceTokenInput, UpdateNotificationPreferencesInput, MarkNotificationReadInput } from '../validation/comms.schema.js';

export class NotificationSettingsService {
  constructor(private readonly notifications: NotificationRepository) {}

  async listOwn(caller: CallerContext): Promise<Notification[]> {
    void caller; // RLS scopes the read to the caller's own recipient_id — no extra service-layer check needed.
    return this.notifications.listOwn();
  }

  async markRead(input: MarkNotificationReadInput, caller: CallerContext): Promise<Notification> {
    void caller;
    return this.notifications.markRead(input.notificationId);
  }

  async registerDeviceToken(input: RegisterDeviceTokenInput, caller: CallerContext): Promise<DeviceToken> {
    if (!caller.role) {
      throw new AppError('PERM_ROLE_DENIED', 'Your account role cannot register a device token.', 'لا يمكن لدور حسابك تسجيل رمز الجهاز.');
    }
    return this.notifications.registerDeviceToken(input);
  }

  async updatePreference(input: UpdateNotificationPreferencesInput, caller: CallerContext): Promise<NotificationPreference> {
    if (!caller.role) {
      throw new AppError('PERM_ROLE_DENIED', 'Your account role cannot update notification preferences.', 'لا يمكن لدور حسابك تحديث تفضيلات الإشعارات.');
    }
    return this.notifications.updatePreference(input);
  }
}
