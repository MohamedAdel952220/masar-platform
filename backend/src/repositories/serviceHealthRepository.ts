// ServiceHealthRepository — platform.service_health_status (§3.53) +
// jobs.scheduled_job_runs (§3.53.2), both read-only from the TS layer.
// Writes happen exclusively via migration 5's scheduled-job SQL functions
// (service_role only) — never via a client-facing RPC or direct RLS write.
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { ServiceHealthStatusRow, ScheduledJobRunRow } from '../types/database.types.epic9.js';
import { serviceHealthStatusFromRow, scheduledJobRunFromRow, type ServiceHealthStatus, type ScheduledJobRun } from '../types/domain.epic9.js';
import { toAppError } from '../lib/rpcError.js';

const DEFAULT_PAGE_SIZE = 100;

export class ServiceHealthRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listServiceHealth(): Promise<ServiceHealthStatus[]> {
    const { data, error } = await this.client.schema('platform').from('service_health_status').select('*').order('service_code', { ascending: true });
    if (error) throw toAppError(error);
    return (data as ServiceHealthStatusRow[]).map(serviceHealthStatusFromRow);
  }

  async listScheduledJobRuns(filters: { jobName?: string } = {}, opts: { limit?: number; offset?: number } = {}): Promise<ScheduledJobRun[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    let query = this.client
      .schema('jobs')
      .from('scheduled_job_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (filters.jobName) query = query.eq('job_name', filters.jobName);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as ScheduledJobRunRow[]).map(scheduledJobRunFromRow);
  }
}
