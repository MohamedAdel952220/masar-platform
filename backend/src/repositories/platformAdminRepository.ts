import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { PlatformAdminRow } from '../types/database.types.js';
import { platformAdminFromRow, type PlatformAdmin } from '../types/domain.js';

export class PlatformAdminRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findById(id: string): Promise<PlatformAdmin | null> {
    const { data, error } = await this.client
      .schema('identity')
      .from('platform_admins')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? platformAdminFromRow(data as PlatformAdminRow) : null;
  }
}
