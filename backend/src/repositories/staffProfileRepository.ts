import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { StaffProfileRow, EmploymentStatus } from '../types/database.types.js';
import { staffProfileFromRow, type StaffProfile } from '../types/domain.js';

export class StaffProfileRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findById(id: string): Promise<StaffProfile | null> {
    const { data, error } = await this.client
      .schema('identity')
      .from('staff_profiles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? staffProfileFromRow(data as StaffProfileRow) : null;
  }

  async listByTenant(tenantId: string): Promise<StaffProfile[]> {
    const { data, error } = await this.client
      .schema('identity')
      .from('staff_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as StaffProfileRow[]).map(staffProfileFromRow);
  }

  async create(input: {
    id: string;
    tenantId: string;
    role: 'manager' | 'teacher' | 'reception';
    name: string;
    nameAr?: string | null;
    phone: string;
    email?: string | null;
  }): Promise<StaffProfile> {
    const { data, error } = await this.client
      .schema('identity')
      .from('staff_profiles')
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        role: input.role,
        name: input.name,
        name_ar: input.nameAr ?? null,
        phone: input.phone,
        email: input.email ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return staffProfileFromRow(data as StaffProfileRow);
  }

  async setEmploymentStatus(id: string, status: EmploymentStatus): Promise<StaffProfile> {
    const { data, error } = await this.client
      .schema('identity')
      .from('staff_profiles')
      .update({ employment_status: status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return staffProfileFromRow(data as StaffProfileRow);
  }
}
