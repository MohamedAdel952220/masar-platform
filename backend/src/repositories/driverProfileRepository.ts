// Mirrors StaffProfileRepository (Epic 1) for identity.driver_profiles —
// no such repository existed before Epic 3 since that table had "schema
// only in Epic 1, first rows in Epic 3" (Epic 1 migration 3 comment).
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { DriverProfileRow } from '../types/database.types.js';

export interface DriverProfile {
  id: string;
  tenantId: string;
  busId: string | null;
  name: string;
  nameAr: string | null;
  phone: string;
  deletedAt: string | null;
}

function driverProfileFromRow(row: DriverProfileRow): DriverProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    busId: row.bus_id,
    name: row.name,
    nameAr: row.name_ar,
    phone: row.phone,
    deletedAt: row.deleted_at,
  };
}

export class DriverProfileRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findById(id: string): Promise<DriverProfile | null> {
    const { data, error } = await this.client
      .schema('identity')
      .from('driver_profiles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? driverProfileFromRow(data as DriverProfileRow) : null;
  }

  async create(input: { id: string; tenantId: string; name: string; nameAr?: string | null; phone: string; nationalId?: string | null; createdBy?: string | null }): Promise<DriverProfile> {
    const { data, error } = await this.client
      .schema('identity')
      .from('driver_profiles')
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        name: input.name,
        name_ar: input.nameAr ?? null,
        phone: input.phone,
        national_id: input.nationalId ?? null,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return driverProfileFromRow(data as DriverProfileRow);
  }

  // Fix for EPIC_3_REVIEW.md H4 — saga compensation for AddBusService: the
  // driver_profiles row must be removed BEFORE the Auth user is deleted
  // (identity.driver_profiles.id references auth.users(id) ON DELETE
  // RESTRICT), or the deleteUser call itself fails.
  async delete(id: string): Promise<void> {
    const { error } = await this.client.schema('identity').from('driver_profiles').delete().eq('id', id);
    if (error) throw error;
  }
}
