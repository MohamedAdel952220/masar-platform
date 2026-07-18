import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { AnnouncementRow } from '../types/database.types.epic4.js';
import { announcementFromRow, type Announcement } from '../types/domain.epic4.js';
import type { BroadcastAnnouncementInput } from '../validation/comms.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class AnnouncementRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Wraps public.broadcast_announcement (§14.2, migration 6) — idempotency-
  // key supported (broadcasting twice would double-notify an entire audience).
  async broadcast(input: BroadcastAnnouncementInput): Promise<Announcement> {
    const { data, error } = await this.client.rpc('broadcast_announcement', {
      p_title: input.title,
      p_body: input.body,
      p_audience: input.audience ?? null,
      p_platform_audience: input.platformAudience ?? null,
      p_classroom_id: input.classroomId ?? null,
      p_priority: input.priority,
      p_channels: input.channels,
      p_platform_plan_code: input.platformPlanCode ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return announcementFromRow(data as AnnouncementRow);
  }

  async listForTenant(tenantId: string): Promise<Announcement[]> {
    const { data, error } = await this.client
      .schema('comms')
      .from('announcements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as AnnouncementRow[]).map(announcementFromRow);
  }
}
