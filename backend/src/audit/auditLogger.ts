// Node-side audit logger — thin wrapper around the write_audit_log RPC
// (§23). This is the ONLY function in the Node codebase that is allowed to
// write to platform.audit_log; repositories/services must go through it
// rather than inserting directly, mirroring the DB-level rule that there is
// no INSERT policy on the table itself.
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { AuditActorType } from '../types/database.types.js';

export interface AuditEvent {
  tenantId: string | null;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  ipAddress?: string | null;
}

export class AuditLogger {
  constructor(private readonly client: AnySupabaseClient) {}

  async record(event: AuditEvent): Promise<void> {
    const { error } = await this.client.rpc('write_audit_log', {
      p_tenant_id: event.tenantId,
      p_actor_type: event.actorType,
      p_actor_id: event.actorId,
      p_action: event.action,
      p_target_type: event.targetType,
      p_target_id: event.targetId ?? null,
      p_ip_address: event.ipAddress ?? null,
    });
    if (error) {
      // Audit-write failure must never silently disappear, but per §23 it
      // also must never be allowed to corrupt the audit trail with a partial
      // write — surface loudly so an operator investigates.
      throw new Error(`AuditLogger.record failed: ${error.message}`);
    }
  }
}
