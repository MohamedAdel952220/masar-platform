import { describe, it, expect, vi } from 'vitest';
import {
  listActivityLogRoute,
  listAuditLogRoute,
  listSupportTicketsRoute,
  createSupportTicketRoute,
  updateSupportTicketRoute,
  listServiceHealthRoute,
  listScheduledJobRunsRoute,
  listTenantBillingTransactionsRoute,
  issueTenantBillingTransactionRoute,
  refundTenantBillingTransactionRoute,
} from '../../src/api/routes/platformOps.js';
import type { CallerContext } from '../../src/types/domain.js';

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const ownerCaller: CallerContext = { userId: 'admin-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'owner' };

const ticketId = '11111111-1111-1111-1111-111111111111';
const tenantId = '22222222-2222-2222-2222-222222222222';
const transactionId = '44444444-4444-4444-4444-444444444444';

describe('listActivityLogRoute / listAuditLogRoute', () => {
  it('validates and delegates', async () => {
    const service = { listActivityLog: vi.fn(async () => [{ id: 'a1' }]) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    const result = await listActivityLogRoute(service, managerCaller, { limit: 50 });
    expect(service.listActivityLog).toHaveBeenCalledWith({ limit: 50 }, managerCaller);
    expect(result).toEqual([{ id: 'a1' }]);
  });

  it('rejects an invalid query', async () => {
    const service = { listActivityLog: vi.fn() } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await expect(listActivityLogRoute(service, managerCaller, { limit: -1 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.listActivityLog).not.toHaveBeenCalled();
  });

  it('delegates listAuditLogRoute with an empty default query', async () => {
    const service = { listAuditLog: vi.fn(async () => [{ id: 'al1' }]) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    const result = await listAuditLogRoute(service, ownerCaller, undefined);
    expect(service.listAuditLog).toHaveBeenCalledWith({}, ownerCaller);
    expect(result).toEqual([{ id: 'al1' }]);
  });
});

describe('listSupportTicketsRoute / createSupportTicketRoute', () => {
  it('delegates a valid list query', async () => {
    const service = { listSupportTickets: vi.fn(async () => [{ id: ticketId }]) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await listSupportTicketsRoute(service, managerCaller, { status: 'open' });
    expect(service.listSupportTickets).toHaveBeenCalledWith({ status: 'open' }, managerCaller);
  });

  it('rejects create with missing fields', async () => {
    const service = { createSupportTicket: vi.fn() } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await expect(createSupportTicketRoute(service, managerCaller, { subject: 'x' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.createSupportTicket).not.toHaveBeenCalled();
  });

  it('passes a valid create body through to the service', async () => {
    const body = { subject: 'Camera offline', body: 'Details here', category: 'technical' as const, severity: 'high' as const };
    const service = { createSupportTicket: vi.fn(async () => ({ id: ticketId })) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await createSupportTicketRoute(service, managerCaller, body);
    expect(service.createSupportTicket).toHaveBeenCalledWith(body, managerCaller);
  });
});

describe('updateSupportTicketRoute', () => {
  it('rejects a body with neither status nor assignedTo', async () => {
    const service = { updateSupportTicket: vi.fn() } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await expect(updateSupportTicketRoute(service, ownerCaller, { ticketId })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.updateSupportTicket).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { updateSupportTicket: vi.fn(async () => ({ id: ticketId, status: 'resolved' })) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await updateSupportTicketRoute(service, ownerCaller, { ticketId, status: 'resolved' });
    expect(service.updateSupportTicket).toHaveBeenCalledWith({ ticketId, status: 'resolved' }, ownerCaller);
  });
});

describe('listServiceHealthRoute / listScheduledJobRunsRoute', () => {
  it('delegates with no query parsing needed', async () => {
    const service = {
      listServiceHealth: vi.fn(async () => [{ id: 'sh1' }]),
      listScheduledJobRuns: vi.fn(async () => [{ id: 'run1' }]),
    } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await listServiceHealthRoute(service, ownerCaller);
    await listScheduledJobRunsRoute(service, ownerCaller);
    expect(service.listServiceHealth).toHaveBeenCalledWith(ownerCaller);
    expect(service.listScheduledJobRuns).toHaveBeenCalledWith(ownerCaller);
  });
});

describe('listTenantBillingTransactionsRoute / issueTenantBillingTransactionRoute / refundTenantBillingTransactionRoute', () => {
  it('delegates a valid list query', async () => {
    const service = { listTenantBillingTransactions: vi.fn(async () => [{ id: transactionId }]) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await listTenantBillingTransactionsRoute(service, ownerCaller, { tenantId });
    expect(service.listTenantBillingTransactions).toHaveBeenCalledWith({ tenantId }, ownerCaller);
  });

  it('rejects an issue request with a non-positive amount', async () => {
    const service = { issueTenantBillingTransaction: vi.fn() } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await expect(
      issueTenantBillingTransactionRoute(service, ownerCaller, { tenantId, amount: 0, kind: 'setup_fee' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.issueTenantBillingTransaction).not.toHaveBeenCalled();
  });

  it('passes a valid issue body through to the service', async () => {
    const body = { tenantId, amount: 7500, kind: 'subscription_charge' as const };
    const service = { issueTenantBillingTransaction: vi.fn(async () => ({ id: transactionId })) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await issueTenantBillingTransactionRoute(service, ownerCaller, body);
    expect(service.issueTenantBillingTransaction).toHaveBeenCalledWith(body, ownerCaller);
  });

  it('rejects a refund request with a missing originalTransactionId', async () => {
    const service = { refundTenantBillingTransaction: vi.fn() } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await expect(refundTenantBillingTransactionRoute(service, ownerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.refundTenantBillingTransaction).not.toHaveBeenCalled();
  });

  it('passes a valid refund body through to the service', async () => {
    const service = { refundTenantBillingTransaction: vi.fn(async () => ({ id: transactionId, kind: 'refund' })) } as unknown as import('../../src/services/platformOpsService.js').PlatformOpsService;
    await refundTenantBillingTransactionRoute(service, ownerCaller, { originalTransactionId: transactionId });
    expect(service.refundTenantBillingTransaction).toHaveBeenCalledWith({ originalTransactionId: transactionId }, ownerCaller);
  });
});
