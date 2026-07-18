import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { NotificationRow, DeviceTokenRow, NotificationPreferenceRow } from '../types/database.types.epic4.js';
import {
  notificationFromRow,
  deviceTokenFromRow,
  notificationPreferenceFromRow,
  type Notification,
  type DeviceToken,
  type NotificationPreference,
} from '../types/domain.epic4.js';
import type { RegisterDeviceTokenInput, UpdateNotificationPreferencesInput } from '../validation/comms.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class NotificationRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listOwn(): Promise<Notification[]> {
    const { data, error } = await this.client.schema('comms').from('notifications').select('*').order('created_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as NotificationRow[]).map(notificationFromRow);
  }

  // Uses the same RLS-scoped USING(read_at IS NULL)/WITH CHECK(read_at IS
  // NOT NULL) narrow mark-as-read policy (migration 5) as every other
  // "own, mark read" resource in this codebase (messages, announcement_recipients).
  async markRead(notificationId: string): Promise<Notification> {
    const { data, error } = await this.client
      .schema('comms')
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return notificationFromRow(data as NotificationRow);
  }

  async registerDeviceToken(input: RegisterDeviceTokenInput): Promise<DeviceToken> {
    const { data, error } = await this.client.rpc('register_device_token', { p_platform: input.platform, p_token: input.token });
    if (error) throw toAppError(error);
    return deviceTokenFromRow(data as DeviceTokenRow);
  }

  async unregisterDeviceToken(deviceTokenId: string): Promise<void> {
    const { error } = await this.client.schema('comms').from('device_tokens').delete().eq('id', deviceTokenId);
    if (error) throw toAppError(error);
  }

  async updatePreference(input: UpdateNotificationPreferencesInput): Promise<NotificationPreference> {
    const { data, error } = await this.client.rpc('update_notification_preferences', {
      p_category: input.category,
      p_channel: input.channel,
      p_enabled: input.enabled,
    });
    if (error) throw toAppError(error);
    return notificationPreferenceFromRow(data as NotificationPreferenceRow);
  }

  async listOwnPreferences(): Promise<NotificationPreference[]> {
    const { data, error } = await this.client.schema('comms').from('notification_preferences').select('*');
    if (error) throw toAppError(error);
    return (data as NotificationPreferenceRow[]).map(notificationPreferenceFromRow);
  }
}
