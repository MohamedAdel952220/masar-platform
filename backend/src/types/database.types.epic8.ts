// Epic 8 snake_case row types, kept separate from database.types(.epicN).ts
// for the same reason those files are separate: repositories are the only
// place that ever sees a raw DB row shape.

export type ReportType = 'monthly_progress' | 'subject_report' | 'behavior_social' | 'attendance_summary';
export type ReportScope = 'classroom' | 'children';
export type ReportDraftStatus = 'draft' | 'ready' | 'scheduled' | 'sent';
export type DeliveryChannel = 'app' | 'whatsapp' | 'email';

export interface AiReportBatchRow {
  id: string;
  tenant_id: string;
  type: ReportType;
  scope: ReportScope;
  classroom_id: string | null;
  topic: string | null;
  created_by: string;
  created_at: string;
}

export interface AiReportDraftRow {
  id: string;
  batch_id: string;
  tenant_id: string;
  child_id: string;
  body: string;
  metrics: Record<string, unknown>;
  status: ReportDraftStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  delivery_channels: DeliveryChannel[];
  edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiUsageCounterRow {
  id: string;
  tenant_id: string;
  usage_date: string;
  calls_used: number;
}
