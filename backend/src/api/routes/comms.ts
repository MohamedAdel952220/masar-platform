// API handlers for send-message / escalate-conversation / broadcast-
// announcement / register-device-token / update-notification-preferences /
// mark-notification-read — mirrors the corresponding RPCs (§14.2).
import {
  sendMessageSchema,
  escalateConversationSchema,
  broadcastAnnouncementSchema,
  registerDeviceTokenSchema,
  updateNotificationPreferencesSchema,
  markNotificationReadSchema,
} from '../../validation/comms.schema.js';
import { AppError } from '../../lib/errors.js';
import type { ChatService } from '../../services/chatService.js';
import type { AnnouncementService } from '../../services/announcementService.js';
import type { NotificationSettingsService } from '../../services/notificationSettingsService.js';
import type { CallerContext } from '../../types/domain.js';
import type { Message, Conversation, Announcement, Notification, DeviceToken, NotificationPreference } from '../../types/domain.epic4.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function sendMessageRoute(service: ChatService, caller: CallerContext, rawBody: unknown): Promise<Message> {
  const parsed = sendMessageSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.sendMessage(parsed.data, caller);
}

export async function escalateConversationRoute(service: ChatService, caller: CallerContext, rawBody: unknown): Promise<Conversation> {
  const parsed = escalateConversationSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.escalateConversation(parsed.data, caller);
}

export async function broadcastAnnouncementRoute(service: AnnouncementService, caller: CallerContext, rawBody: unknown): Promise<Announcement> {
  const parsed = broadcastAnnouncementSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.broadcast(parsed.data, caller);
}

export async function registerDeviceTokenRoute(service: NotificationSettingsService, caller: CallerContext, rawBody: unknown): Promise<DeviceToken> {
  const parsed = registerDeviceTokenSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.registerDeviceToken(parsed.data, caller);
}

export async function updateNotificationPreferencesRoute(service: NotificationSettingsService, caller: CallerContext, rawBody: unknown): Promise<NotificationPreference> {
  const parsed = updateNotificationPreferencesSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.updatePreference(parsed.data, caller);
}

export async function markNotificationReadRoute(service: NotificationSettingsService, caller: CallerContext, rawBody: unknown): Promise<Notification> {
  const parsed = markNotificationReadSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.markRead(parsed.data, caller);
}
