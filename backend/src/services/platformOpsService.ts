// PlatformOpsService — testable core behind platform.activity_log (read),
// platform.audit_log (read), platform.support_tickets (CRUD via RPC),
// platform.service_health_status + jobs.scheduled_job_runs (read), and
// platform.tenant_billing_transactions (issue/refund via RPC). Defense-in-
// depth role checks matching the RLS policies' own (§28 convention) and the
// §12.1 owner/admin-vs-support tier split — RLS/RPC internal checks remain
// the authoritative gate; these checks exist so a role mismatch fails fast
// with a clear PERM_ROLE_DENIED before ever reaching the database.
import { AppError } from '../lib/errors.js';
import type { ActivityLogRepository } from '../repositories/activityLogRepository.js';
import type { AuditLogRepository } from '../repositories/auditLogRepository.js';
import type { SupportTicketRepository } from '../repositories/supportTicketRepository.js';
import type { ServiceHealthRepository } from '../repositories/serviceHealthRepository.js';
import type { TenantBillingRepository } from '../repositories/tenantBillingRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { ActivityLogEntry, AuditLogEntry, SupportTicket, ServiceHealthStatus, ScheduledJobRun, TenantBillingTransaction } from '../types/domain.epic9.js';
import type {
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
  ListSupportTicketsInput,
  IssueTenantBillingTransactionInput,
  RefundTenantBillingTransactionInput,
  ListTenantBillingTransactionsInput,
  ListActivityLogInput,
  ListAuditLogInput,
} from '../validation/platformOps.schema.js';

function requirePlatformAdmin(caller: CallerContext): void {
  if (caller.role !== 'platform_admin') {
    throw new AppError('PERM_ROLE_DENIED', 'Only a Platform Admin can perform this action.', 'فقط مسؤول المنصة يمكنه القيام بهذا الإجراء.');
  }
}

// §12.1's own named boundary — the "canManage" line a support-tier account
// must never cross. Mirrors public.is_platform_admin_manager_tier() (Epic
// 1) at the service layer.
function requirePlatformAdminManagerTier(caller: CallerContext): void {
  requirePlatformAdmin(caller);
  if (caller.platformAdminTier !== 'owner' && caller.platformAdminTier !== 'admin') {
    throw new AppError('PERM_ROLE_DENIED', 'This action requires Owner or Admin tier access.', 'يتطلب هذا الإجراء صلاحية مالك أو مدير.');
  }
}

function requireManager(caller: CallerContext): void {
  if (caller.role !== 'manager') {
    throw new AppError('PERM_ROLE_DENIED', 'Only a manager can perform this action.', 'فقط المدير يمكنه القيام بهذا الإجراء.');
  }
}

// Activity log: Manager or Reception, own tenant only (§12) — RLS narrows
// the actual rows; this is a fast-fail role gate only.
function requireActivityLogReader(caller: CallerContext): void {
  if (caller.role !== 'manager' && caller.role !== 'reception') {
    throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view the activity log.', 'غير مصرح لك بعرض سجل النشاط.');
  }
}

// Audit log: Manager (own tenant actions only) or Platform Admin (any tier,
// all tenants) — §12/§12.1.
function requireAuditLogReader(caller: CallerContext): void {
  if (caller.role !== 'manager' && caller.role !== 'platform_admin') {
    throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view the audit log.', 'غير مصرح لك بعرض سجل التدقيق.');
  }
}

export class PlatformOpsService {
  constructor(
    private readonly activityLog: ActivityLogRepository,
    private readonly auditLog: AuditLogRepository,
    private readonly supportTickets: SupportTicketRepository,
    private readonly serviceHealth: ServiceHealthRepository,
    private readonly tenantBilling: TenantBillingRepository,
  ) {}

  async listActivityLog(input: ListActivityLogInput, caller: CallerContext): Promise<ActivityLogEntry[]> {
    requireActivityLogReader(caller);
    return this.activityLog.listForTenant(input);
  }

  async listAuditLog(input: ListAuditLogInput, caller: CallerContext): Promise<AuditLogEntry[]> {
    requireAuditLogReader(caller);
    return this.auditLog.list(input, input);
  }

  // Manager: own tenant (RLS-scoped). Platform Admin: all tenants (RLS-scoped).
  async listSupportTickets(input: ListSupportTicketsInput, caller: CallerContext): Promise<SupportTicket[]> {
    if (caller.role !== 'manager' && caller.role !== 'platform_admin') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view support tickets.', 'غير مصرح لك بعرض تذاكر الدعم.');
    }
    return this.supportTickets.list(input);
  }

  async createSupportTicket(input: CreateSupportTicketInput, caller: CallerContext): Promise<SupportTicket> {
    requireManager(caller);
    return this.supportTickets.create(input);
  }

  // Any Platform Admin tier — §12.1's own "no divergence" note for this resource.
  async updateSupportTicket(input: UpdateSupportTicketInput, caller: CallerContext): Promise<SupportTicket> {
    requirePlatformAdmin(caller);
    return this.supportTickets.update(input);
  }

  async listServiceHealth(caller: CallerContext): Promise<ServiceHealthStatus[]> {
    requirePlatformAdmin(caller);
    return this.serviceHealth.listServiceHealth();
  }

  async listScheduledJobRuns(caller: CallerContext): Promise<ScheduledJobRun[]> {
    requirePlatformAdmin(caller);
    return this.serviceHealth.listScheduledJobRuns();
  }

  async listTenantBillingTransactions(input: ListTenantBillingTransactionsInput, caller: CallerContext): Promise<TenantBillingTransaction[]> {
    requirePlatformAdmin(caller);
    return this.tenantBilling.list(input);
  }

  // Owner/admin tier only — §12.1.
  async issueTenantBillingTransaction(input: IssueTenantBillingTransactionInput, caller: CallerContext): Promise<TenantBillingTransaction> {
    requirePlatformAdminManagerTier(caller);
    return this.tenantBilling.issue(input);
  }

  async refundTenantBillingTransaction(input: RefundTenantBillingTransactionInput, caller: CallerContext): Promise<TenantBillingTransaction> {
    requirePlatformAdminManagerTier(caller);
    return this.tenantBilling.refund(input);
  }
}
