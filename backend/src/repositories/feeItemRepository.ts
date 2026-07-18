import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { FeeItemRow } from '../types/database.types.epic6.js';
import { feeItemFromRow, type FeeItem } from '../types/domain.epic6.js';
import type { CreateFeeItemInput } from '../validation/billing.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class FeeItemRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listForTenant(tenantId: string): Promise<FeeItem[]> {
    const { data, error } = await this.client
      .schema('billing')
      .from('fee_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (error) throw toAppError(error);
    return (data as FeeItemRow[]).map(feeItemFromRow);
  }

  // Direct table insert under RLS (fee_items_insert_manager, migration 4) —
  // no RPC needed, matches §14.1's "no bespoke API surface for
  // straightforward CRUD" default.
  async create(input: CreateFeeItemInput, tenantId: string): Promise<FeeItem> {
    const { data, error } = await this.client
      .schema('billing')
      .from('fee_items')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        name_ar: input.nameAr ?? null,
        icon: input.icon ?? null,
        cycle: input.cycle,
        scope: input.scope,
        required: input.required,
        price: input.price,
      })
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return feeItemFromRow(data as FeeItemRow);
  }
}
