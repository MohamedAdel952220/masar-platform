import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { PlanCatalogRow, PlanCode, AppCode } from '../types/database.types.js';
import { planCatalogFromRow, type PlanCatalog } from '../types/domain.js';

export class PlanCatalogRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findByCode(code: PlanCode): Promise<PlanCatalog | null> {
    const { data, error } = await this.client.schema('tenancy').from('plan_catalog').select('*').eq('code', code).maybeSingle();
    if (error) throw error;
    return data ? planCatalogFromRow(data as PlanCatalogRow) : null;
  }

  async listApps(planId: string): Promise<AppCode[]> {
    const { data, error } = await this.client.schema('tenancy').from('plan_catalog_apps').select('app_code').eq('plan_id', planId);
    if (error) throw error;
    return (data as { app_code: AppCode }[]).map((r) => r.app_code);
  }
}
