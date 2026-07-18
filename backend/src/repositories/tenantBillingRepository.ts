// TenantBillingRepository — platform.tenant_billing_transactions (§3.53.1).
// No direct RLS write path exists for anyone (migration 3) — every write
// routes through migration 4's issue_tenant_billing_transaction/
// refund_tenant_billing_transaction RPCs (owner/admin tier only, enforced
// inside the RPC bodies via public.is_platform_admin_manager_tier()).
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { TenantBillingTransactionRow } from '../types/database.types.epic9.js';
import { tenantBillingTransactionFromRow, type TenantBillingTransaction } from '../types/domain.epic9.js';
import type { IssueTenantBillingTransactionInput, RefundTenantBillingTransactionInput } from '../validation/platformOps.schema.js';
import { toAppError } from '../lib/rpcError.js';

const DEFAULT_PAGE_SIZE = 200;

export class TenantBillingRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async list(filters: { tenantId?: string } = {}, opts: { limit?: number; offset?: number } = {}): Promise<TenantBillingTransaction[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    let query = this.client
      .schema('platform')
      .from('tenant_billing_transactions')
      .select('*')
      .order('initiated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as TenantBillingTransactionRow[]).map(tenantBillingTransactionFromRow);
  }

  async issue(input: IssueTenantBillingTransactionInput): Promise<TenantBillingTransaction> {
    const { data, error } = await this.client.rpc('issue_tenant_billing_transaction', {
      p_tenant_id: input.tenantId,
      p_amount: input.amount,
      p_kind: input.kind,
      p_currency: input.currency ?? 'EGP',
      p_provider_reference: input.providerReference ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return tenantBillingTransactionFromRow(data as TenantBillingTransactionRow);
  }

  async refund(input: RefundTenantBillingTransactionInput): Promise<TenantBillingTransaction> {
    const { data, error } = await this.client.rpc('refund_tenant_billing_transaction', {
      p_original_transaction_id: input.originalTransactionId,
      p_reason: input.reason ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return tenantBillingTransactionFromRow(data as TenantBillingTransactionRow);
  }
}
