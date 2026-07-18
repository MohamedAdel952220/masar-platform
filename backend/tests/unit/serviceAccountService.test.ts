import { describe, it, expect, vi } from 'vitest';
import { ServiceAccountService } from '../../src/services/serviceAccountService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { ServiceAccount } from '../../src/types/domain.js';

function makeServiceAccount(overrides: Partial<ServiceAccount> = {}): ServiceAccount {
  return {
    id: 'sa-1',
    tenantId: 'tenant-1',
    name: 'KG1-A Camera Agent',
    purpose: 'camera_agent',
    scopes: ['camera:heartbeat'],
    status: 'active',
    issuedBy: 'manager-1',
    issuedAt: '2026-09-01T00:00:00Z',
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

function buildHarness() {
  const serviceAccounts = {
    listForTenant: vi.fn(async () => [makeServiceAccount()]),
    findById: vi.fn(async (): Promise<ServiceAccount | null> => makeServiceAccount()),
    create: vi.fn(async () => makeServiceAccount()),
    revoke: vi.fn(async (): Promise<ServiceAccount | null> => makeServiceAccount({ status: 'revoked', revokedAt: '2026-09-05T00:00:00Z' })),
  };
  const audit = { record: vi.fn(async () => undefined) };
  // deno-lint-ignore no-explicit-any
  const service = new ServiceAccountService(serviceAccounts as any, audit as any);
  return { service, serviceAccounts, audit };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };

describe('ServiceAccountService.listForTenant', () => {
  it('allows a manager to list service accounts', async () => {
    const h = buildHarness();
    await h.service.listForTenant(managerCaller);
    expect(h.serviceAccounts.listForTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects a guardian listing service accounts', async () => {
    const h = buildHarness();
    await expect(h.service.listForTenant(guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('ServiceAccountService.issueKey', () => {
  const input = { name: 'KG1-A Camera Agent', purpose: 'camera_agent' as const, scopes: ['camera:heartbeat'] };

  it('allows a manager to issue a key and returns the raw key exactly once', async () => {
    const h = buildHarness();
    const result = await h.service.issueKey(input, managerCaller);
    expect(result.apiKey).toMatch(/^sak_/);
    expect(h.serviceAccounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', name: input.name, purpose: 'camera_agent', scopes: ['camera:heartbeat'], issuedBy: 'manager-1' }),
    );
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'issued_service_account_key' }));
  });

  it('never passes the raw key to the repository — only its hash, which differs from the returned raw key', async () => {
    const h = buildHarness();
    const result = await h.service.issueKey(input, managerCaller);
    expect(h.serviceAccounts.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ apiKey: expect.anything() }),
    );
    expect(h.serviceAccounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyHash: expect.stringMatching(/^[0-9a-f]{64}$/) }),
    );
    expect(h.serviceAccounts.create).not.toHaveBeenCalledWith(expect.objectContaining({ apiKeyHash: result.apiKey }));
  });

  it('rejects a guardian issuing a key', async () => {
    const h = buildHarness();
    await expect(h.service.issueKey(input, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.serviceAccounts.create).not.toHaveBeenCalled();
  });

  // Fix for EPIC_7_REVIEW.md H2: cameraIds is threaded straight through to
  // the repository, which is responsible for creating the
  // camera_service_account_links rows.
  it('passes cameraIds through to the repository for a camera_agent key', async () => {
    const h = buildHarness();
    const inputWithCameras = { ...input, cameraIds: ['camera-1', 'camera-2'] };
    await h.service.issueKey(inputWithCameras, managerCaller);
    expect(h.serviceAccounts.create).toHaveBeenCalledWith(expect.objectContaining({ cameraIds: ['camera-1', 'camera-2'] }));
  });
});

describe('ServiceAccountService.revokeKey', () => {
  it('allows a manager to revoke a key', async () => {
    const h = buildHarness();
    const result = await h.service.revokeKey({ serviceAccountId: 'sa-1' }, managerCaller);
    expect(result.status).toBe('revoked');
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'revoked_service_account_key' }));
  });

  it('rejects a guardian revoking a key', async () => {
    const h = buildHarness();
    await expect(h.service.revokeKey({ serviceAccountId: 'sa-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('raises NOT_FOUND for an unknown service account', async () => {
    const h = buildHarness();
    h.serviceAccounts.findById = vi.fn(async () => null);
    await expect(h.service.revokeKey({ serviceAccountId: 'sa-missing' }, managerCaller)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('raises STATE_ALREADY_PROCESSED for a key already revoked', async () => {
    const h = buildHarness();
    h.serviceAccounts.revoke = vi.fn(async () => null);
    await expect(h.service.revokeKey({ serviceAccountId: 'sa-1' }, managerCaller)).rejects.toMatchObject({ code: 'STATE_ALREADY_PROCESSED' });
  });
});
