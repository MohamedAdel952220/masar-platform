// Epic 8 domain (camelCase) types + row<->domain mappers.
import type {
  AiReportBatchRow,
  AiReportDraftRow,
  AiUsageCounterRow,
  ReportType,
  ReportScope,
  ReportDraftStatus,
  DeliveryChannel,
} from './database.types.epic8.js';

export interface AiReportBatch {
  id: string;
  tenantId: string;
  type: ReportType;
  scope: ReportScope;
  classroomId: string | null;
  topic: string | null;
  createdBy: string;
  createdAt: string;
}

export function aiReportBatchFromRow(row: AiReportBatchRow): AiReportBatch {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    scope: row.scope,
    classroomId: row.classroom_id,
    topic: row.topic,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export interface AiReportDraft {
  id: string;
  batchId: string;
  tenantId: string;
  childId: string;
  body: string;
  metrics: Record<string, unknown>;
  status: ReportDraftStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  deliveryChannels: DeliveryChannel[];
  editedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function aiReportDraftFromRow(row: AiReportDraftRow): AiReportDraft {
  return {
    id: row.id,
    batchId: row.batch_id,
    tenantId: row.tenant_id,
    childId: row.child_id,
    body: row.body,
    metrics: row.metrics,
    status: row.status,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    deliveryChannels: row.delivery_channels,
    editedBy: row.edited_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AiUsageCounter {
  id: string;
  tenantId: string;
  usageDate: string;
  callsUsed: number;
}

export function aiUsageCounterFromRow(row: AiUsageCounterRow): AiUsageCounter {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    usageDate: row.usage_date,
    callsUsed: row.calls_used,
  };
}
