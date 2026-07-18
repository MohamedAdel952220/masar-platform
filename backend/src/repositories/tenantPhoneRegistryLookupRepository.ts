// Read-side companion to Epic 1's TenantPhoneRegistryRepository
// (repositories/tenantProvisioningRepository.ts, reused unmodified for its
// existing `register`/`isPhoneTaken` methods). That class doesn't expose
// account_type, which enroll-child's sibling-guardian-reuse path needs
// (EPIC_2_ARCHITECTURE_REVIEW.md §13) — added here as a separate class
// rather than editing the Epic 1 file.
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { PhoneAccountType } from '../types/database.types.js';

export interface PhoneRegistryEntry {
  accountId: string;
  accountType: PhoneAccountType;
}

export class TenantPhoneRegistryLookupRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findByTenantAndPhone(tenantId: string, phone: string): Promise<PhoneRegistryEntry | null> {
    const { data, error } = await this.client
      .schema('tenancy')
      .from('tenant_phone_registry')
      .select('account_id, account_type')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;
    return data ? { accountId: data.account_id as string, accountType: data.account_type as PhoneAccountType } : null;
  }
}
