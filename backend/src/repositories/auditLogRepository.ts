// AuditLogRepository — platform.audit_log (§3.51, §23). Epic 1's own table
// and RLS (audit_log_select_platform_admin/audit_log_select_manager_own_
// tenant) — frozen, unmodified. This Epic is the first to need the TS-layer
// read wrapper (§21: "audit writes actually began in Epic 1, this Epic
// ships the viewing UI"). Read-only, matching audit_log's own immutability
// (§23: "no UPDATE/DELETE grants to any role including manager").
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { AuditLogRow } from '../types/database.types.epic9.js';
import { auditLogEntryFromRow, type AuditLogEntry } from '../types/domain.epic9.js';
import { toAppError } from '../lib/rpcError.js';

const DEFAULT_PAGE_SIZE = 100;

export class AuditLogRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // RLS scopes this automatically: a manager sees only their own tenant's
  // actions, a Platform Admin (any tier, §12.1: "R (all)") sees every
  // tenant's. tenantId is an optional additional client-side filter (e.g.
  // a Platform Admin narrowing to one tenant for ticket context), never a
  // widening one — RLS remains the authoritative scope.
  async list(filters: { tenantId?: string } = {}, opts: { limit?: number; offset?: number } = {}): Promise<AuditLogEntry[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    let query = this.client
      .schema('platform')
      .from('audit_log')
      .select('*')
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as AuditLogRow[]).map(auditLogEntryFromRow);
  }
}
