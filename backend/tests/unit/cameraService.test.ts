import { describe, it, expect, vi } from 'vitest';
import { CameraService } from '../../src/services/cameraService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { Camera, ManagerCamera } from '../../src/types/domain.epic7.js';

function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    id: 'camera-1',
    tenantId: 'tenant-1',
    name: 'KG1-A Camera',
    zone: 'classroom',
    resolution: '1080p',
    hasAudio: true,
    online: false,
    adminDisabled: false,
    lastHeartbeatAt: null,
    addedAt: '2026-09-01',
    deletedAt: null,
    ...overrides,
  };
}

function makeManagerCamera(overrides: Partial<ManagerCamera> = {}): ManagerCamera {
  return { ...makeCamera(), ipAddress: '192.168.1.10', streamProtocol: 'rtsp', ...overrides };
}

function buildHarness() {
  const cameras = {
    listForManager: vi.fn(async () => [makeManagerCamera()]),
    listForGuardian: vi.fn(async () => [makeCamera()]),
    create: vi.fn(async () => makeManagerCamera()),
    update: vi.fn(async () => makeCamera({ adminDisabled: true })),
    updateConnection: vi.fn(async () => ({ cameraId: 'camera-1', tenantId: 'tenant-1', ipAddress: '192.168.1.20', streamProtocol: 'webrtc', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z' })),
    softDelete: vi.fn(async () => makeCamera({ deletedAt: '2026-09-05T00:00:00Z' })),
    linkClassroom: vi.fn(async () => ({ cameraId: 'camera-1', classroomId: 'classroom-1', tenantId: 'tenant-1', createdAt: '2026-09-01T00:00:00Z' })),
    unlinkClassroom: vi.fn(async () => undefined),
  };
  // deno-lint-ignore no-explicit-any
  const service = new CameraService(cameras as any);
  return { service, cameras };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const platformAdminCaller: CallerContext = { userId: 'admin-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'support' };

describe('CameraService.listForManager', () => {
  it('allows a manager to list the camera registry, including connection fields', async () => {
    const h = buildHarness();
    const result = await h.service.listForManager(managerCaller);
    expect(h.cameras.listForManager).toHaveBeenCalledWith('tenant-1');
    expect(result[0]).toMatchObject({ ipAddress: '192.168.1.10', streamProtocol: 'rtsp' });
  });

  it('rejects a guardian listing the manager-facing registry', async () => {
    const h = buildHarness();
    await expect(h.service.listForManager(guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('rejects a teacher (§12: Cameras row has no Teacher access at all)', async () => {
    const h = buildHarness();
    await expect(h.service.listForManager(teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('CameraService.listForGuardian', () => {
  it('allows a guardian to list their linked-classroom cameras', async () => {
    const h = buildHarness();
    const result = await h.service.listForGuardian(guardianCaller);
    expect(h.cameras.listForGuardian).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  // Fix for EPIC_7_REVIEW.md C1: the Camera type has no ipAddress/
  // streamProtocol fields at all anymore (they moved to media.
  // camera_connections, a manager-only table) — this is now a structural
  // guarantee, not just a column-selection convention.
  it('never includes ipAddress/streamProtocol in the guardian-facing result shape', async () => {
    const h = buildHarness();
    const result = await h.service.listForGuardian(guardianCaller);
    expect(JSON.stringify(result)).not.toMatch(/ipAddress|streamProtocol|192\.168/);
  });

  it('rejects a manager calling the guardian-facing list', async () => {
    const h = buildHarness();
    await expect(h.service.listForGuardian(managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  it('rejects platform_admin (§12/§13.6: Cameras is not in the platform_admin bypass list)', async () => {
    const h = buildHarness();
    await expect(h.service.listForGuardian(platformAdminCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('CameraService.create', () => {
  it('allows a manager to add a camera', async () => {
    const h = buildHarness();
    await h.service.create(
      { name: 'KG1-A Camera', zone: 'classroom', ipAddress: '192.168.1.10', streamProtocol: 'rtsp', resolution: '1080p', hasAudio: true },
      managerCaller,
    );
    expect(h.cameras.create).toHaveBeenCalled();
  });

  it('rejects a guardian adding a camera', async () => {
    const h = buildHarness();
    await expect(
      h.service.create({ name: 'KG1-A Camera', zone: 'classroom', ipAddress: '192.168.1.10', streamProtocol: 'rtsp', resolution: '1080p', hasAudio: true }, guardianCaller),
    ).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.cameras.create).not.toHaveBeenCalled();
  });
});

describe('CameraService.update', () => {
  it('allows a manager to toggle admin_disabled', async () => {
    const h = buildHarness();
    const result = await h.service.update({ cameraId: 'camera-1', adminDisabled: true }, managerCaller);
    expect(result.adminDisabled).toBe(true);
  });

  it('rejects a guardian updating a camera', async () => {
    const h = buildHarness();
    await expect(h.service.update({ cameraId: 'camera-1', adminDisabled: true }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

// Fix for EPIC_7_REVIEW.md C1.
describe('CameraService.updateConnection', () => {
  it('allows a manager to update ip/protocol', async () => {
    const h = buildHarness();
    const result = await h.service.updateConnection({ cameraId: 'camera-1', ipAddress: '192.168.1.20' }, managerCaller);
    expect(result.ipAddress).toBe('192.168.1.20');
    expect(h.cameras.updateConnection).toHaveBeenCalled();
  });

  it('rejects a guardian updating connection details', async () => {
    const h = buildHarness();
    await expect(h.service.updateConnection({ cameraId: 'camera-1', ipAddress: '192.168.1.20' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.cameras.updateConnection).not.toHaveBeenCalled();
  });
});

describe('CameraService.remove', () => {
  it('allows a manager to soft-delete a camera', async () => {
    const h = buildHarness();
    const result = await h.service.remove({ cameraId: 'camera-1' }, managerCaller);
    expect(result.deletedAt).not.toBeNull();
  });

  it('rejects a guardian removing a camera', async () => {
    const h = buildHarness();
    await expect(h.service.remove({ cameraId: 'camera-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});

describe('CameraService.linkClassroom / unlinkClassroom', () => {
  it('allows a manager to link a camera to a classroom', async () => {
    const h = buildHarness();
    await h.service.linkClassroom({ cameraId: 'camera-1', classroomId: 'classroom-1' }, managerCaller);
    expect(h.cameras.linkClassroom).toHaveBeenCalled();
  });

  it('allows a manager to unlink a camera from a classroom', async () => {
    const h = buildHarness();
    await h.service.unlinkClassroom({ cameraId: 'camera-1', classroomId: 'classroom-1' }, managerCaller);
    expect(h.cameras.unlinkClassroom).toHaveBeenCalled();
  });

  it('rejects a guardian linking a camera', async () => {
    const h = buildHarness();
    await expect(h.service.linkClassroom({ cameraId: 'camera-1', classroomId: 'classroom-1' }, guardianCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
