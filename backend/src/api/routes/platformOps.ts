// API handlers for Platform Operations & Admin Console (§14.2, §16 API
// Groups: Support, Platform Billing, System Health, Audit).
import {
  createSupportTicketSchema,
  updateSupportTicketSchema,
  listSupportTicketsSchema,
  issueTenantBillingTransactionSchema,
  refundTenantBillingTransactionSchema,
  listTenantBillingTransactionsSchema,
  listActivityLogSchema,
  listAuditLogSchema,
} from '../../validation/platformOps.schema.js';
import { AppError } from '../../lib/errors.js';
import type { PlatformOpsService } from '../../services/platformOpsService.js';
import type { CallerContext } from '../../types/domain.js';
import type { ActivityLogEntry, AuditLogEntry, SupportTicket, ServiceHealthStatus, ScheduledJobRun, TenantBillingTransaction } from '../../types/domain.epic9.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function listActivityLogRoute(service: PlatformOpsService, caller: CallerContext, rawQuery: unknown): Promise<ActivityLogEntry[]> {
  const parsed = listActivityLogSchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listActivityLog(parsed.data, caller);
}

export async function listAuditLogRoute(service: PlatformOpsService, caller: CallerContext, rawQuery: unknown): Promise<AuditLogEntry[]> {
  const parsed = listAuditLogSchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listAuditLog(parsed.data, caller);
}

export async function listSupportTicketsRoute(service: PlatformOpsService, caller: CallerContext, rawQuery: unknown): Promise<SupportTicket[]> {
  const parsed = listSupportTicketsSchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listSupportTickets(parsed.data, caller);
}

export async function createSupportTicketRoute(service: PlatformOpsService, caller: CallerContext, rawBody: unknown): Promise<SupportTicket> {
  const parsed = createSupportTicketSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.createSupportTicket(parsed.data, caller);
}

export async function updateSupportTicketRoute(service: PlatformOpsService, caller: CallerContext, rawBody: unknown): Promise<SupportTicket> {
  const parsed = updateSupportTicketSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.updateSupportTicket(parsed.data, caller);
}

export async function listServiceHealthRoute(service: PlatformOpsService, caller: CallerContext): Promise<ServiceHealthStatus[]> {
  return service.listServiceHealth(caller);
}

export async function listScheduledJobRunsRoute(service: PlatformOpsService, caller: CallerContext): Promise<ScheduledJobRun[]> {
  return service.listScheduledJobRuns(caller);
}

export async function listTenantBillingTransactionsRoute(
  service: PlatformOpsService,
  caller: CallerContext,
  rawQuery: unknown,
): Promise<TenantBillingTransaction[]> {
  const parsed = listTenantBillingTransactionsSchema.safeParse(rawQuery ?? {});
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.listTenantBillingTransactions(parsed.data, caller);
}

export async function issueTenantBillingTransactionRoute(
  service: PlatformOpsService,
  caller: CallerContext,
  rawBody: unknown,
): Promise<TenantBillingTransaction> {
  const parsed = issueTenantBillingTransactionSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.issueTenantBillingTransaction(parsed.data, caller);
}

export async function refundTenantBillingTransactionRoute(
  service: PlatformOpsService,
  caller: CallerContext,
  rawBody: unknown,
): Promise<TenantBillingTransaction> {
  const parsed = refundTenantBillingTransactionSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.refundTenantBillingTransaction(parsed.data, caller);
}
