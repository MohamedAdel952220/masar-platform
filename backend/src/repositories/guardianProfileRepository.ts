import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { GuardianProfileRow } from '../types/database.types.js';
import { guardianProfileFromRow, type GuardianProfile } from '../types/domain.epic2.js';

export class GuardianProfileRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findById(id: string): Promise<GuardianProfile | null> {
    const { data, error } = await this.client
      .schema('identity')
      .from('guardian_profiles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? guardianProfileFromRow(data as GuardianProfileRow) : null;
  }

  async create(input: { id: string; tenantId: string; name: string; phone: string; email?: string | null; createdBy?: string | null }): Promise<GuardianProfile> {
    const { data, error } = await this.client
      .schema('identity')
      .from('guardian_profiles')
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return guardianProfileFromRow(data as GuardianProfileRow);
  }
}
