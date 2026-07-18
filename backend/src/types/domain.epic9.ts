// Epic 9 domain (camelCase) types + row<->domain mappers.
import type {
  ActivityLogRow,
  SupportTicketRow,
  ServiceHealthStatusRow,
  TenantBillingTransactionRow,
  ScheduledJobRunRow,
  AuditLogRow,
  ActivityActorType,
  SupportTicketCategory,
  SupportTicketSeverity,
  SupportTicketStatus,
  ServiceStatus,
  BillingTransactionKind,
  BillingTransactionStatus,
  ScheduledJobRunStatus,
  AuditActorType,
} from './database.types.epic9.js';

export interface ActivityLogEntry {
  id: string;
  tenantId: string;
  actorType: ActivityActorType;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export function activityLogEntryFromRow(row: ActivityLogRow): ActivityLogEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata,
    occurredAt: row.occurred_at,
  };
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  severity: SupportTicketSeverity;
  status: SupportTicketStatus;
  reportedBy: string;
  assignedTo: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export function supportTicketFromRow(row: SupportTicketRow): SupportTicket {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subject: row.subject,
    body: row.body,
    category: row.category,
    severity: row.severity,
    status: row.status,
    reportedBy: row.reported_by,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export interface ServiceHealthStatus {
  id: string;
  serviceCode: string;
  status: ServiceStatus;
  uptimePct: number;
  latencyMs: number;
  checkedAt: string;
}

export function serviceHealthStatusFromRow(row: ServiceHealthStatusRow): ServiceHealthStatus {
  return {
    id: row.id,
    serviceCode: row.service_code,
    status: row.status,
    uptimePct: Number(row.uptime_pct),
    latencyMs: row.latency_ms,
    checkedAt: row.checked_at,
  };
}

export interface TenantBillingTransaction {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  kind: BillingTransactionKind;
  status: BillingTransactionStatus;
  providerReference: string | null;
  invoiceObjectId: string | null;
  initiatedAt: string;
  settledAt: string | null;
}

export function tenantBillingTransactionFromRow(row: TenantBillingTransactionRow): TenantBillingTransaction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    amount: Number(row.amount),
    currency: row.currency,
    kind: row.kind,
    status: row.status,
    providerReference: row.provider_reference,
    invoiceObjectId: row.invoice_object_id,
    initiatedAt: row.initiated_at,
    settledAt: row.settled_at,
  };
}

export interface ScheduledJobRun {
  id: string;
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  status: ScheduledJobRunStatus;
  rowsAffected: number | null;
  error: string | null;
}

export function scheduledJobRunFromRow(row: ScheduledJobRunRow): ScheduledJobRun {
  return {
    id: row.id,
    jobName: row.job_name,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    rowsAffected: row.rows_affected,
    error: row.error,
  };
}

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  occurredAt: string;
}

export function auditLogEntryFromRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    ipAddress: row.ip_address,
    occurredAt: row.occurred_at,
  };
}
