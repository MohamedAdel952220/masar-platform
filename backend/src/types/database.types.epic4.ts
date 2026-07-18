// Epic 4 snake_case row types, kept separate from database.types(.epicN).ts
// for the same reason those files are separate: repositories are the only
// place that ever sees a raw DB row shape.

export type ConversationStatus = 'open' | 'escalated' | 'closed';
export type MessageSenderType = 'guardian' | 'staff' | 'system';
export type AnnouncementAudience = 'all' | 'parents' | 'classroom' | 'teachers' | 'drivers';
export type PlatformAnnouncementAudience = 'all_schools' | 'plan_tier' | 'overdue_accounts' | 'trial_accounts';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';
export type AnnouncementChannel = 'push' | 'whatsapp' | 'sms' | 'email' | 'in_app';
export type AnnouncementRecipientType = 'guardian' | 'staff' | 'driver' | 'tenant';
export type NotificationRecipientType = 'guardian' | 'staff' | 'driver' | 'platform_admin';
export type NotificationSeverity = 'info' | 'attention' | 'urgent';
export type NotificationChannel = 'push' | 'whatsapp' | 'sms' | 'email' | 'in_app';
export type NotificationDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped_by_preference';
export type DevicePlatform = 'ios' | 'android' | 'web';

export interface ConversationRow {
  id: string;
  tenant_id: string;
  guardian_id: string;
  child_id: string;
  subject_id: string | null;
  staff_id: string;
  status: ConversationStatus;
  escalated_at: string | null;
  escalation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  tenant_id: string;
  sender_type: MessageSenderType;
  sender_id: string | null;
  body: string;
  sent_at: string;
  read_at: string | null;
}

export interface AnnouncementRow {
  id: string;
  tenant_id: string | null;
  created_by: string;
  audience: AnnouncementAudience | null;
  platform_audience: PlatformAnnouncementAudience | null;
  classroom_id: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  channels: AnnouncementChannel[];
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  tenant_id: string | null;
  recipient_type: NotificationRecipientType;
  recipient_id: string;
  category: string;
  title: string;
  body: string;
  deep_link: string | null;
  severity: NotificationSeverity;
  read_at: string | null;
  created_at: string;
}

export interface DeviceTokenRow {
  id: string;
  tenant_id: string | null;
  recipient_type: NotificationRecipientType;
  recipient_id: string;
  platform: DevicePlatform;
  token: string;
  last_seen_at: string;
  created_at: string;
}

export interface NotificationPreferenceRow {
  id: string;
  tenant_id: string | null;
  recipient_type: NotificationRecipientType;
  recipient_id: string;
  category: string;
  channel: NotificationChannel;
  enabled: boolean;
}
