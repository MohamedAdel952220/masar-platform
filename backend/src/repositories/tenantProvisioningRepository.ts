import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { ProvisioningStep, PhoneAccountType } from '../types/database.types.js';

export class TenantProvisioningRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async advanceStep(tenantId: string, step: ProvisioningStep, error?: string | null): Promise<void> {
    const { error: rpcError } = await this.client.rpc('advance_tenant_provisioning', {
      p_tenant_id: tenantId,
      p_step: step,
      p_error: error ?? null,
    });
    if (rpcError) throw rpcError;
  }
}

export class TenantPhoneRegistryRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async register(input: { tenantId: string; phone: string; accountType: PhoneAccountType; accountId: string }): Promise<void> {
    const { error } = await this.client.schema('tenancy').from('tenant_phone_registry').insert({
      tenant_id: input.tenantId,
      phone: input.phone,
      account_type: input.accountType,
      account_id: input.accountId,
    });
    if (error) throw error;
  }

  async isPhoneTaken(tenantId: string, phone: string): Promise<boolean> {
    const { data, error } = await this.client
      .schema('tenancy')
      .from('tenant_phone_registry')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
}
