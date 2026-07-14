import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { TenantRow, TenantStatus } from '../types/database.types.js';
import { tenantFromRow, type Tenant } from '../types/domain.js';

export class TenantRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findById(id: string): Promise<Tenant | null> {
    const { data, error } = await this.client.schema('tenancy').from('tenants').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? tenantFromRow(data as TenantRow) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.client.schema('tenancy').from('tenants').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data ? tenantFromRow(data as TenantRow) : null;
  }

  async list(params: { status?: TenantStatus; limit?: number; cursor?: string } = {}): Promise<Tenant[]> {
    let query = this.client
      .schema('tenancy')
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50);
    if (params.status) query = query.eq('status', params.status);
    if (params.cursor) query = query.lt('created_at', params.cursor);
    const { data, error } = await query;
    if (error) throw error;
    return (data as TenantRow[]).map(tenantFromRow);
  }

  async create(input: {
    name: string;
    slug: string;
    city: string | null;
    planId: string;
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    trialEndsAt: string;
  }): Promise<Tenant> {
    const { data, error } = await this.client
      .schema('tenancy')
      .from('tenants')
      .insert({
        name: input.name,
        slug: input.slug,
        city: input.city,
        plan_id: input.planId,
        status: 'trial',
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        trial_ends_at: input.trialEndsAt,
      })
      .select('*')
      .single();
    if (error) throw error;
    return tenantFromRow(data as TenantRow);
  }

  async updateStatus(id: string, status: TenantStatus, reason?: string | null): Promise<Tenant> {
    const patch: Record<string, unknown> = { status };
    if (status === 'suspended') {
      patch.suspended_at = new Date().toISOString();
      patch.suspended_reason = reason ?? null;
    }
    const { data, error } = await this.client.schema('tenancy').from('tenants').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return tenantFromRow(data as TenantRow);
  }
}
