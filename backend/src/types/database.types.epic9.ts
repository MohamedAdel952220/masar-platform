// Epic 9 snake_case row types, kept separate from database.types(.epicN).ts
// for the same reason those files are separate: repositories are the only
// place that ever sees a raw DB row shape.

export type ActivityActorType = 'staff' | 'guardian' | 'driver' | 'system';
export type SupportTicketCategory = 'technical' | 'how_to' | 'request' | 'billing';
export type SupportTicketSeverity = 'high' | 'med' | 'low';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved';
export type ServiceStatus = 'up' | 'degraded' | 'down';
export type BillingTransactionKind = 'subscription_charge' | 'setup_fee' | 'refund';
export type BillingTransactionStatus = 'initiated' | 'succeeded' | 'failed' | 'refunded';
export type ScheduledJobRunStatus = 'running' | 'succeeded' | 'failed';

export interface ActivityLogRow {
  id: string;
  tenant_id: string;
  actor_type: ActivityActorType;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface SupportTicketRow {
  id: string;
  tenant_id: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  severity: SupportTicketSeverity;
  status: SupportTicketStatus;
  reported_by: string;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ServiceHealthStatusRow {
  id: string;
  service_code: string;
  status: ServiceStatus;
  uptime_pct: number;
  latency_ms: number;
  checked_at: string;
}

export interface TenantBillingTransactionRow {
  id: string;
  tenant_id: string;
  amount: number;
  currency: string;
  kind: BillingTransactionKind;
  status: BillingTransactionStatus;
  provider_reference: string | null;
  invoice_object_id: string | null;
  initiated_at: string;
  settled_at: string | null;
}

export interface ScheduledJobRunRow {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: ScheduledJobRunStatus;
  rows_affected: number | null;
  error: string | null;
}

// Epic 1 row (frozen) — this Epic is the first to need its own TS-layer
// mapper for the audit_log *viewing* surface (§21: "audit writes actually
// began in Epic 1, this Epic ships the viewing UI").
export type AuditActorType = 'platform_admin' | 'staff' | 'system';

export interface AuditLogRow {
  id: string;
  tenant_id: string | null;
  actor_type: AuditActorType;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  ip_address: string | null;
  occurred_at: string;
}
