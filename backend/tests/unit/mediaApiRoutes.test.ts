import { describe, it, expect, vi } from 'vitest';
import {
  listCamerasForManagerRoute,
  listCamerasForGuardianRoute,
  createCameraRoute,
  updateCameraRoute,
  updateCameraConnectionRoute,
  deleteCameraRoute,
  linkCameraClassroomRoute,
  unlinkCameraClassroomRoute,
  listServiceAccountsRoute,
  issueServiceAccountKeyRoute,
  revokeServiceAccountKeyRoute,
} from '../../src/api/routes/media.js';
import type { CallerContext } from '../../src/types/domain.js';

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };

const cameraId = '11111111-1111-1111-1111-111111111111';
const classroomId = '22222222-2222-2222-2222-222222222222';
const serviceAccountId = '33333333-3333-3333-3333-333333333333';

describe('listCamerasForManagerRoute / listCamerasForGuardianRoute', () => {
  it('delegates to CameraService.listForManager', async () => {
    const service = { listForManager: vi.fn(async () => [{ id: cameraId }]) } as unknown as import('../../src/services/cameraService.js').CameraService;
    const result = await listCamerasForManagerRoute(service, managerCaller);
    expect(result).toEqual([{ id: cameraId }]);
  });

  it('delegates to CameraService.listForGuardian', async () => {
    const service = { listForGuardian: vi.fn(async () => [{ id: cameraId }]) } as unknown as import('../../src/services/cameraService.js').CameraService;
    const result = await listCamerasForGuardianRoute(service, guardianCaller);
    expect(result).toEqual([{ id: cameraId }]);
  });
});

describe('createCameraRoute — validation', () => {
  const validBody = { name: 'KG1-A Camera', zone: 'classroom', ipAddress: '192.168.1.10', streamProtocol: 'rtsp', resolution: '1080p', hasAudio: true };

  it('rejects a body missing required fields', async () => {
    const service = { create: vi.fn() } as unknown as import('../../src/services/cameraService.js').CameraService;
    await expect(createCameraRoute(service, managerCaller, { name: 'KG1-A Camera' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { create: vi.fn(async () => ({ id: cameraId })) } as unknown as import('../../src/services/cameraService.js').CameraService;
    await createCameraRoute(service, managerCaller, validBody);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'KG1-A Camera' }), managerCaller);
  });
});

describe('updateCameraRoute — validation', () => {
  it('rejects an update with no fields', async () => {
    const service = { update: vi.fn() } as unknown as import('../../src/services/cameraService.js').CameraService;
    await expect(updateCameraRoute(service, managerCaller, { cameraId })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.update).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { update: vi.fn(async () => ({ id: cameraId, adminDisabled: true })) } as unknown as import('../../src/services/cameraService.js').CameraService;
    await updateCameraRoute(service, managerCaller, { cameraId, adminDisabled: true });
    expect(service.update).toHaveBeenCalledWith({ cameraId, adminDisabled: true }, managerCaller);
  });
});

// Fix for EPIC_7_REVIEW.md C1.
describe('updateCameraConnectionRoute — validation', () => {
  it('rejects an update with neither field', async () => {
    const service = { updateConnection: vi.fn() } as unknown as import('../../src/services/cameraService.js').CameraService;
    await expect(updateCameraConnectionRoute(service, managerCaller, { cameraId })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.updateConnection).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = {
      updateConnection: vi.fn(async () => ({ cameraId, tenantId: 'tenant-1', ipAddress: '10.0.0.5', streamProtocol: 'rtsp', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z' })),
    } as unknown as import('../../src/services/cameraService.js').CameraService;
    await updateCameraConnectionRoute(service, managerCaller, { cameraId, ipAddress: '10.0.0.5' });
    expect(service.updateConnection).toHaveBeenCalledWith({ cameraId, ipAddress: '10.0.0.5' }, managerCaller);
  });
});

describe('deleteCameraRoute — validation', () => {
  it('rejects a missing cameraId', async () => {
    const service = { remove: vi.fn() } as unknown as import('../../src/services/cameraService.js').CameraService;
    await expect(deleteCameraRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('passes a valid body through to the service', async () => {
    const service = { remove: vi.fn(async () => ({ id: cameraId, deletedAt: '2026-09-05T00:00:00Z' })) } as unknown as import('../../src/services/cameraService.js').CameraService;
    await deleteCameraRoute(service, managerCaller, { cameraId });
    expect(service.remove).toHaveBeenCalledWith({ cameraId }, managerCaller);
  });
});

describe('linkCameraClassroomRoute / unlinkCameraClassroomRoute — validation', () => {
  it('rejects a missing classroomId on link', async () => {
    const service = { linkClassroom: vi.fn() } as unknown as import('../../src/services/cameraService.js').CameraService;
    await expect(linkCameraClassroomRoute(service, managerCaller, { cameraId })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('passes a valid link body through to the service', async () => {
    const service = { linkClassroom: vi.fn(async () => ({ cameraId, classroomId, tenantId: 'tenant-1', createdAt: '2026-09-01T00:00:00Z' })) } as unknown as import('../../src/services/cameraService.js').CameraService;
    await linkCameraClassroomRoute(service, managerCaller, { cameraId, classroomId });
    expect(service.linkClassroom).toHaveBeenCalledWith({ cameraId, classroomId }, managerCaller);
  });

  it('passes a valid unlink body through to the service', async () => {
    const service = { unlinkClassroom: vi.fn(async () => undefined) } as unknown as import('../../src/services/cameraService.js').CameraService;
    const result = await unlinkCameraClassroomRoute(service, managerCaller, { cameraId, classroomId });
    expect(service.unlinkClassroom).toHaveBeenCalledWith({ cameraId, classroomId }, managerCaller);
    expect(result).toEqual({ ok: true });
  });
});

describe('listServiceAccountsRoute', () => {
  it('delegates to ServiceAccountService.listForTenant', async () => {
    const service = { listForTenant: vi.fn(async () => [{ id: serviceAccountId }]) } as unknown as import('../../src/services/serviceAccountService.js').ServiceAccountService;
    const result = await listServiceAccountsRoute(service, managerCaller);
    expect(result).toEqual([{ id: serviceAccountId }]);
  });
});

describe('issueServiceAccountKeyRoute — validation', () => {
  it('rejects an empty scopes array', async () => {
    const service = { issueKey: vi.fn() } as unknown as import('../../src/services/serviceAccountService.js').ServiceAccountService;
    await expect(issueServiceAccountKeyRoute(service, managerCaller, { name: 'Agent', purpose: 'camera_agent', scopes: [], cameraIds: [cameraId] })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.issueKey).not.toHaveBeenCalled();
  });

  // Fix for EPIC_7_REVIEW.md H2.
  it('rejects a camera_agent body with no cameraIds', async () => {
    const service = { issueKey: vi.fn() } as unknown as import('../../src/services/serviceAccountService.js').ServiceAccountService;
    await expect(issueServiceAccountKeyRoute(service, managerCaller, { name: 'Agent', purpose: 'camera_agent', scopes: ['camera:heartbeat'] })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.issueKey).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { issueKey: vi.fn(async () => ({ serviceAccount: { id: serviceAccountId }, apiKey: 'sak_xxx' })) } as unknown as import('../../src/services/serviceAccountService.js').ServiceAccountService;
    const body = { name: 'KG1-A Camera Agent', purpose: 'camera_agent' as const, scopes: ['camera:heartbeat'], cameraIds: [cameraId] };
    await issueServiceAccountKeyRoute(service, managerCaller, body);
    expect(service.issueKey).toHaveBeenCalledWith(body, managerCaller);
  });
});

describe('revokeServiceAccountKeyRoute — validation', () => {
  it('rejects a missing serviceAccountId', async () => {
    const service = { revokeKey: vi.fn() } as unknown as import('../../src/services/serviceAccountService.js').ServiceAccountService;
    await expect(revokeServiceAccountKeyRoute(service, managerCaller, {})).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('passes a valid body through to the service', async () => {
    const service = { revokeKey: vi.fn(async () => ({ id: serviceAccountId, status: 'revoked' })) } as unknown as import('../../src/services/serviceAccountService.js').ServiceAccountService;
    await revokeServiceAccountKeyRoute(service, managerCaller, { serviceAccountId });
    expect(service.revokeKey).toHaveBeenCalledWith({ serviceAccountId }, managerCaller);
  });
});
