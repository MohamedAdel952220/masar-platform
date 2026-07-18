import { describe, it, expect, vi } from 'vitest';
import { PlatformOpsService } from '../../src/services/platformOpsService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { ActivityLogEntry, AuditLogEntry, SupportTicket, ServiceHealthStatus, ScheduledJobRun, TenantBillingTransaction } from '../../src/types/domain.epic9.js';

function makeTicket(overrides: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    subject: 'Camera offline',
    body: 'The entrance camera has been offline since this morning.',
    category: 'technical',
    severity: 'high',
    status: 'open',
    reportedBy: 'manager-1',
    assignedTo: null,
    createdAt: '2026-07-29T00:00:00Z',
    resolvedAt: null,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<TenantBillingTransaction> = {}): TenantBillingTransaction {
  return {
    id: 'txn-1',
    tenantId: 'tenant-1',
    amount: 7500,
    currency: 'EGP',
    kind: 'subscription_charge',
    status: 'succeeded',
    providerReference: null,
    invoiceObjectId: null,
    initiatedAt: '2026-07-29T00:00:00Z',
    settledAt: '2026-07-29T00:00:00Z',
    ...overrides,
  };
}

function buildHarness() {
  const activityLog = { listForTenant: vi.fn(async () => [{ id: 'a1' } as ActivityLogEntry]) };
  const auditLog = { list: vi.fn(async () => [{ id: 'al1' } as AuditLogEntry]) };
  const supportTickets = {
    list: vi.fn(async () => [makeTicket()]),
    create: vi.fn(async () => makeTicket()),
    update: vi.fn(async () => makeTicket({ status: 'in_progress' })),
  };
  const serviceHealth = {
    listServiceHealth: vi.fn(async () => [{ id: 'sh1' } as ServiceHealthStatus]),
    listScheduledJobRuns: vi.fn(async () => [{ id: 'run1' } as ScheduledJobRun]),
  };
  const tenantBilling = {
    list: vi.fn(async () => [makeTransaction()]),
    issue: vi.fn(async () => makeTransaction()),
    refund: vi.fn(async () => makeTransaction({ kind: 'refund' })),
  };
  // deno-lint-ignore no-explicit-any
  const service = new PlatformOpsService(activityLog as any, auditLog as any, supportTickets as any, serviceHealth as any, tenantBilling as any);
  return { service, activityLog, auditLog, supportTickets, serviceHealth, tenantBilling };
}

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const receptionCaller: CallerContext = { userId: 'reception-1', tenantId: 'tenant-1', role: 'reception', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const ownerCaller: CallerContext = { userId: 'admin-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'owner' };
const adminCaller: CallerContext = { userId: 'admin-2', tenantId: null, role: 'platform_admin', platformAdminTier: 'admin' };
const supportCaller: CallerContext = { userId: 'admin-3', tenantId: null, role: 'platform_admin', platformAdminTier: 'support' };

describe('PlatformOpsService.listActivityLog', () => {
  it('allows manager and reception (own tenant, RLS-scoped)', async () => {
    const h = buildHarness();
    await expect(h.service.listActivityLog({}, managerCaller)).resolves.toHaveLength(1);
    await expect(h.service.listActivityLog({}, receptionCaller)).resolves.toHaveLength(1);
  });

  it('rejects teacher/guardian (§12: Activity log has no Teacher/Guardian access)', async () => {
    const h = buildHarness();
    await expect(h.service.listActivityLog({}, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    await expect(h.service.listActivityLog({}, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('rejects platform_admin (§12: Platform Admin column is "–" for Activity log — audit_log is its own feed)', async () => {
    const h = buildHarness();
    await expect(h.service.listActivityLog({}, ownerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('PlatformOpsService.listAuditLog', () => {
  it('allows manager and any Platform Admin tier', async () => {
    const h = buildHarness();
    await expect(h.service.listAuditLog({}, managerCaller)).resolves.toHaveLength(1);
    await expect(h.service.listAuditLog({}, supportCaller)).resolves.toHaveLength(1);
  });

  it('rejects reception/teacher/guardian', async () => {
    const h = buildHarness();
    await expect(h.service.listAuditLog({}, receptionCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('PlatformOpsService.listSupportTickets / createSupportTicket', () => {
  it('allows manager and platform_admin to list', async () => {
    const h = buildHarness();
    await expect(h.service.listSupportTickets({}, managerCaller)).resolves.toHaveLength(1);
    await expect(h.service.listSupportTickets({}, supportCaller)).resolves.toHaveLength(1);
  });

  it('rejects teacher listing tickets', async () => {
    const h = buildHarness();
    await expect(h.service.listSupportTickets({}, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('allows a manager to create a ticket', async () => {
    const h = buildHarness();
    await h.service.createSupportTicket({ subject: 'x', body: 'y', category: 'technical', severity: 'low' }, managerCaller);
    expect(h.supportTickets.create).toHaveBeenCalled();
  });

  it('rejects a reception creating a ticket (§12: only Manager has C on this resource)', async () => {
    const h = buildHarness();
    await expect(
      h.service.createSupportTicket({ subject: 'x', body: 'y', category: 'technical', severity: 'low' }, receptionCaller),
    ).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.supportTickets.create).not.toHaveBeenCalled();
  });
});

describe('PlatformOpsService.updateSupportTicket', () => {
  it('allows every Platform Admin tier — §12.1: no owner/admin-vs-support divergence for this resource', async () => {
    const h = buildHarness();
    await h.service.updateSupportTicket({ ticketId: 'ticket-1', status: 'in_progress' }, ownerCaller);
    await h.service.updateSupportTicket({ ticketId: 'ticket-1', status: 'in_progress' }, adminCaller);
    await h.service.updateSupportTicket({ ticketId: 'ticket-1', status: 'in_progress' }, supportCaller);
    expect(h.supportTickets.update).toHaveBeenCalledTimes(3);
  });

  it('rejects a manager updating a ticket directly (no U in §12 for Manager on this resource)', async () => {
    const h = buildHarness();
    await expect(h.service.updateSupportTicket({ ticketId: 'ticket-1', status: 'resolved' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.supportTickets.update).not.toHaveBeenCalled();
  });
});

describe('PlatformOpsService.listServiceHealth / listScheduledJobRuns', () => {
  it('allows any Platform Admin tier — §12.1: "Service health | R | R"', async () => {
    const h = buildHarness();
    await expect(h.service.listServiceHealth(supportCaller)).resolves.toHaveLength(1);
    await expect(h.service.listScheduledJobRuns(ownerCaller)).resolves.toHaveLength(1);
  });

  it('rejects a manager (§12: Service health has no Manager access — see note)', async () => {
    const h = buildHarness();
    await expect(h.service.listServiceHealth(managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('PlatformOpsService.listTenantBillingTransactions', () => {
  it('allows every Platform Admin tier to read', async () => {
    const h = buildHarness();
    await expect(h.service.listTenantBillingTransactions({}, supportCaller)).resolves.toHaveLength(1);
  });

  it('rejects a manager (Masar-internal ledger, not tenant-visible)', async () => {
    const h = buildHarness();
    await expect(h.service.listTenantBillingTransactions({}, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('PlatformOpsService.issueTenantBillingTransaction / refundTenantBillingTransaction', () => {
  it('allows owner and admin tiers', async () => {
    const h = buildHarness();
    await h.service.issueTenantBillingTransaction({ tenantId: 'tenant-1', amount: 100, kind: 'setup_fee' }, ownerCaller);
    await h.service.issueTenantBillingTransaction({ tenantId: 'tenant-1', amount: 100, kind: 'setup_fee' }, adminCaller);
    expect(h.tenantBilling.issue).toHaveBeenCalledTimes(2);
  });

  it('rejects support tier — §12.1: "Tenant billing transactions | CRUD [owner/admin] | R only [support]"', async () => {
    const h = buildHarness();
    await expect(
      h.service.issueTenantBillingTransaction({ tenantId: 'tenant-1', amount: 100, kind: 'setup_fee' }, supportCaller),
    ).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.tenantBilling.issue).not.toHaveBeenCalled();
  });

  it('rejects support tier from refunding', async () => {
    const h = buildHarness();
    await expect(h.service.refundTenantBillingTransaction({ originalTransactionId: 'txn-1' }, supportCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.tenantBilling.refund).not.toHaveBeenCalled();
  });

  it('allows owner tier to refund', async () => {
    const h = buildHarness();
    const result = await h.service.refundTenantBillingTransaction({ originalTransactionId: 'txn-1' }, ownerCaller);
    expect(result.kind).toBe('refund');
  });
});
