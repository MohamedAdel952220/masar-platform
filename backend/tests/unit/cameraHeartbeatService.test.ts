import { describe, it, expect, vi } from 'vitest';
import { CameraHeartbeatService } from '../../src/services/cameraHeartbeatService.js';
import { hashApiKey } from '../../src/lib/serviceAccountKey.js';
import type { Camera } from '../../src/types/domain.epic7.js';

const RAW_KEY = 'sak_test-raw-key-value';

function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    id: 'camera-1',
    tenantId: 'tenant-1',
    name: 'KG1-A Camera',
    zone: 'classroom',
    resolution: '1080p',
    hasAudio: true,
    online: true,
    adminDisabled: false,
    lastHeartbeatAt: '2026-09-05T10:00:00Z',
    addedAt: '2026-09-01',
    deletedAt: null,
    ...overrides,
  };
}

function buildHarness(
  opts: {
    account?: { id: string; tenantId: string | null; scopes: string[]; status: 'active' | 'revoked' } | null;
    linkedCameraIds?: string[];
    camera?: Camera | null;
  } = {},
) {
  const serviceAccounts = {
    findByKeyHash: vi.fn(async () => (opts.account === undefined ? { id: 'sa-1', tenantId: 'tenant-1', scopes: ['camera:heartbeat'], status: 'active' as const } : opts.account)),
    listLinkedCameraIds: vi.fn(async () => (opts.linkedCameraIds === undefined ? ['camera-1'] : opts.linkedCameraIds)),
    touchLastUsed: vi.fn(async () => undefined),
  };
  const cameras = {
    recordHeartbeat: vi.fn(async () => (opts.camera === undefined ? makeCamera() : opts.camera)),
  };
  // deno-lint-ignore no-explicit-any
  const service = new CameraHeartbeatService(serviceAccounts as any, cameras as any);
  return { service, serviceAccounts, cameras };
}

describe('CameraHeartbeatService.recordHeartbeat', () => {
  it('flips the camera online given a valid, active, correctly-scoped, correctly-bound key', async () => {
    const h = buildHarness();
    const result = await h.service.recordHeartbeat(RAW_KEY, 'camera-1');
    expect(result.online).toBe(true);
    expect(h.cameras.recordHeartbeat).toHaveBeenCalledWith('camera-1', 'tenant-1');
    expect(h.serviceAccounts.touchLastUsed).toHaveBeenCalledWith('sa-1');
  });

  it('hashes the raw key before looking it up — never passes the raw key to the repository', async () => {
    const h = buildHarness();
    await h.service.recordHeartbeat(RAW_KEY, 'camera-1');
    expect(h.serviceAccounts.findByKeyHash).toHaveBeenCalledWith(hashApiKey(RAW_KEY));
    expect(h.serviceAccounts.findByKeyHash).not.toHaveBeenCalledWith(RAW_KEY);
  });

  it('rejects an unrecognized key', async () => {
    const h = buildHarness({ account: null });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(h.cameras.recordHeartbeat).not.toHaveBeenCalled();
  });

  it('rejects a revoked key immediately (§19 Acceptance Criteria)', async () => {
    const h = buildHarness({ account: { id: 'sa-1', tenantId: 'tenant-1', scopes: ['camera:heartbeat'], status: 'revoked' } });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(h.cameras.recordHeartbeat).not.toHaveBeenCalled();
  });

  it('rejects a key that is active but missing the camera:heartbeat scope', async () => {
    const h = buildHarness({ account: { id: 'sa-1', tenantId: 'tenant-1', scopes: ['integration:other'], status: 'active' } });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.cameras.recordHeartbeat).not.toHaveBeenCalled();
  });

  // Fix for EPIC_7_REVIEW.md H2: a key that is active and correctly scoped
  // but not bound to the REQUESTED camera must still be rejected — the
  // direct regression test for the camera-impersonation-within-tenant
  // finding.
  it('rejects a key that is active and correctly scoped but not bound to the requested camera', async () => {
    const h = buildHarness({ linkedCameraIds: ['camera-2', 'camera-3'] });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.cameras.recordHeartbeat).not.toHaveBeenCalled();
  });

  it('rejects a key with zero camera bindings at all', async () => {
    const h = buildHarness({ linkedCameraIds: [] });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.cameras.recordHeartbeat).not.toHaveBeenCalled();
  });

  it('accepts a key bound to multiple cameras, for each of its own bound cameras', async () => {
    const h = buildHarness({ linkedCameraIds: ['camera-1', 'camera-2'] });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).resolves.toMatchObject({ online: true });
  });

  it('raises NOT_FOUND when the camera does not belong to the key\'s own tenant', async () => {
    const h = buildHarness({ camera: null });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a touchLastUsed failure does not fail the heartbeat itself', async () => {
    const h = buildHarness();
    h.serviceAccounts.touchLastUsed = vi.fn(async () => {
      throw new Error('network blip');
    });
    await expect(h.service.recordHeartbeat(RAW_KEY, 'camera-1')).resolves.toMatchObject({ online: true });
  });
});
