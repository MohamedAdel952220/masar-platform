import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const announcementAudienceSchema = z.enum(['all', 'parents', 'classroom', 'teachers', 'drivers']);
export const platformAnnouncementAudienceSchema = z.enum(['all_schools', 'plan_tier', 'overdue_accounts', 'trial_accounts']);
export const announcementPrioritySchema = z.enum(['normal', 'important', 'urgent']);
export const announcementChannelSchema = z.enum(['push', 'whatsapp', 'sms', 'email', 'in_app']);
export const devicePlatformSchema = z.enum(['ios', 'android', 'web']);
export const notificationChannelSchema = z.enum(['push', 'whatsapp', 'sms', 'email', 'in_app']);

export const sendMessageSchema = z
  .object({
    body: nonEmptyString('body').max(4000),
    conversationId: uuidSchema.optional(),
    childId: uuidSchema.optional(),
    idempotencyKey: uuidSchema.optional(),
  })
  .refine((v) => Boolean(v.conversationId) || Boolean(v.childId), {
    message: 'Either conversationId or childId is required',
  });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const escalateConversationSchema = z.object({
  conversationId: uuidSchema,
  reason: z.string().trim().max(1000).optional(),
});
export type EscalateConversationInput = z.infer<typeof escalateConversationSchema>;

export const broadcastAnnouncementSchema = z
  .object({
    title: nonEmptyString('title').max(200),
    body: nonEmptyString('body').max(4000),
    audience: announcementAudienceSchema.optional(),
    platformAudience: platformAnnouncementAudienceSchema.optional(),
    classroomId: uuidSchema.optional(),
    priority: announcementPrioritySchema.default('normal'),
    channels: z.array(announcementChannelSchema).min(1).default(['in_app']),
    platformPlanCode: z.string().trim().max(50).optional(),
    idempotencyKey: uuidSchema.optional(),
  })
  .refine((v) => Boolean(v.audience) !== Boolean(v.platformAudience), {
    message: 'Exactly one of audience or platformAudience is required',
  })
  // Fix for EPIC_4_REVIEW.md H1: previously nothing tied classroomId's
  // presence to audience==='classroom' at this layer — a caller could omit
  // it and the announcement would silently reach zero recipients (the
  // fan-out join never matches a null classroom_id). Layer 1 of a 3-layer
  // fix (this schema, broadcast_announcement's own RPC-level check, and the
  // new announcements_classroom_audience_requires_classroom DB constraint).
  .refine((v) => v.audience !== 'classroom' || Boolean(v.classroomId), {
    message: 'classroomId is required when audience is "classroom"',
  });
export type BroadcastAnnouncementInput = z.infer<typeof broadcastAnnouncementSchema>;

export const registerDeviceTokenSchema = z.object({
  platform: devicePlatformSchema,
  token: nonEmptyString('token').max(4096),
});
export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

export const updateNotificationPreferencesSchema = z.object({
  category: nonEmptyString('category').max(100),
  channel: notificationChannelSchema,
  enabled: z.boolean(),
});
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

export const markNotificationReadSchema = z.object({
  notificationId: uuidSchema,
});
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;
