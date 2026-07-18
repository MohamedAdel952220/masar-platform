// ActivityLogRepository — platform.activity_log (§3.50, §24). Read-only:
// the sole write path is platform.write_activity_log (migration 4), called
// only from within this Epic's own new RPCs — no repository method exists
// to insert directly (matches "no direct RLS write path alongside a
// correctness-critical RPC" convention; there is in fact no RLS INSERT
// policy on this table at all, migration 3).
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { ActivityLogRow } from '../types/database.types.epic9.js';
import { activityLogEntryFromRow, type ActivityLogEntry } from '../types/domain.epic9.js';
import { toAppError } from '../lib/rpcError.js';

const DEFAULT_PAGE_SIZE = 100;

export class ActivityLogRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // RLS (activity_log_select_manager/activity_log_select_reception,
  // migration 3) scopes this to the caller's own tenant automatically —
  // matches every other Epic's own "reads are RLS-scoped, no explicit
  // tenantId filter needed beyond what RLS already enforces" convention.
  async listForTenant(opts: { limit?: number; offset?: number } = {}): Promise<ActivityLogEntry[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    const { data, error } = await this.client
      .schema('platform')
      .from('activity_log')
      .select('*')
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw toAppError(error);
    return (data as ActivityLogRow[]).map(activityLogEntryFromRow);
  }
}
