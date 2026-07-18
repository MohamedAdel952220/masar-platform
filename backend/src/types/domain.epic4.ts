// Epic 4 domain (camelCase) types + row<->domain mappers.
import type {
  ConversationRow,
  MessageRow,
  AnnouncementRow,
  NotificationRow,
  DeviceTokenRow,
  NotificationPreferenceRow,
  ConversationStatus,
  MessageSenderType,
  AnnouncementAudience,
  PlatformAnnouncementAudience,
  AnnouncementPriority,
  AnnouncementChannel,
  NotificationRecipientType,
  NotificationSeverity,
  NotificationChannel,
  DevicePlatform,
} from './database.types.epic4.js';

export interface Conversation {
  id: string;
  tenantId: string;
  guardianId: string;
  childId: string;
  subjectId: string | null;
  staffId: string;
  status: ConversationStatus;
  escalatedAt: string | null;
  escalationReason: string | null;
}

export function conversationFromRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    guardianId: row.guardian_id,
    childId: row.child_id,
    subjectId: row.subject_id,
    staffId: row.staff_id,
    status: row.status,
    escalatedAt: row.escalated_at,
    escalationReason: row.escalation_reason,
  };
}

export interface Message {
  id: string;
  conversationId: string;
  tenantId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  body: string;
  sentAt: string;
  readAt: string | null;
}

export function messageFromRow(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tenantId: row.tenant_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    body: row.body,
    sentAt: row.sent_at,
    readAt: row.read_at,
  };
}

export interface Announcement {
  id: string;
  tenantId: string | null;
  createdBy: string;
  audience: AnnouncementAudience | null;
  platformAudience: PlatformAnnouncementAudience | null;
  classroomId: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  channels: AnnouncementChannel[];
  scheduledFor: string | null;
  sentAt: string | null;
}

export function announcementFromRow(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    audience: row.audience,
    platformAudience: row.platform_audience,
    classroomId: row.classroom_id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    channels: row.channels,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
  };
}

export interface Notification {
  id: string;
  tenantId: string | null;
  recipientType: NotificationRecipientType;
  recipientId: string;
  category: string;
  title: string;
  body: string;
  deepLink: string | null;
  severity: NotificationSeverity;
  readAt: string | null;
  createdAt: string;
}

export function notificationFromRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    category: row.category,
    title: row.title,
    body: row.body,
    deepLink: row.deep_link,
    severity: row.severity,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export interface DeviceToken {
  id: string;
  recipientType: NotificationRecipientType;
  recipientId: string;
  platform: DevicePlatform;
  token: string;
}

export function deviceTokenFromRow(row: DeviceTokenRow): DeviceToken {
  return {
    id: row.id,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    platform: row.platform,
    token: row.token,
  };
}

export interface NotificationPreference {
  id: string;
  recipientType: NotificationRecipientType;
  recipientId: string;
  category: string;
  channel: NotificationChannel;
  enabled: boolean;
}

export function notificationPreferenceFromRow(row: NotificationPreferenceRow): NotificationPreference {
  return {
    id: row.id,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    category: row.category,
    channel: row.channel,
    enabled: row.enabled,
  };
}
