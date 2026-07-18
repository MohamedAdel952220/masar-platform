import { describe, it, expect } from 'vitest';
import {
  createCameraSchema,
  updateCameraSchema,
  updateCameraConnectionSchema,
  deleteCameraSchema,
  linkCameraClassroomSchema,
  unlinkCameraClassroomSchema,
  issueServiceAccountKeySchema,
  revokeServiceAccountKeySchema,
} from '../../src/validation/media.schema.js';

const cameraId = '11111111-1111-1111-1111-111111111111';
const classroomId = '22222222-2222-2222-2222-222222222222';
const serviceAccountId = '33333333-3333-3333-3333-333333333333';

describe('createCameraSchema', () => {
  it('accepts a valid camera', () => {
    expect(
      createCameraSchema.safeParse({
        name: 'KG1-A Camera',
        zone: 'classroom',
        ipAddress: '192.168.1.10',
        streamProtocol: 'rtsp',
        resolution: '1080p',
        hasAudio: true,
      }).success,
    ).toBe(true);
  });

  it('accepts an IPv6 address', () => {
    expect(
      createCameraSchema.safeParse({
        name: 'Entrance Camera',
        zone: 'entrance',
        ipAddress: '2001:db8::1',
        streamProtocol: 'webrtc',
        resolution: '4k',
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid ip address', () => {
    expect(
      createCameraSchema.safeParse({
        name: 'KG1-A Camera',
        zone: 'classroom',
        ipAddress: 'not-an-ip',
        streamProtocol: 'rtsp',
        resolution: '1080p',
      }).success,
    ).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(
      createCameraSchema.safeParse({
        name: '  ',
        zone: 'classroom',
        ipAddress: '192.168.1.10',
        streamProtocol: 'rtsp',
        resolution: '1080p',
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid zone', () => {
    expect(
      createCameraSchema.safeParse({
        name: 'KG1-A Camera',
        zone: 'garden',
        ipAddress: '192.168.1.10',
        streamProtocol: 'rtsp',
        resolution: '1080p',
      }).success,
    ).toBe(false);
  });

  it('defaults hasAudio to false', () => {
    const parsed = createCameraSchema.safeParse({
      name: 'KG1-A Camera',
      zone: 'classroom',
      ipAddress: '192.168.1.10',
      streamProtocol: 'rtsp',
      resolution: '1080p',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.hasAudio).toBe(false);
  });
});

describe('updateCameraSchema', () => {
  it('accepts a single-field update', () => {
    expect(updateCameraSchema.safeParse({ cameraId, adminDisabled: true }).success).toBe(true);
  });

  it('rejects an update with no fields beyond cameraId', () => {
    expect(updateCameraSchema.safeParse({ cameraId }).success).toBe(false);
  });

  it('rejects a non-uuid cameraId', () => {
    expect(updateCameraSchema.safeParse({ cameraId: 'nope', adminDisabled: true }).success).toBe(false);
  });

  // Fix for EPIC_7_REVIEW.md C1: ipAddress/streamProtocol are no longer
  // part of this schema at all (they moved to updateCameraConnectionSchema
  // below) — an unrecognized key is silently stripped by Zod's default
  // non-strict object parsing, so the request still succeeds but the field
  // never reaches CameraRepository.update()'s patch object.
  it('strips an ipAddress field if present, rather than applying it', () => {
    const parsed = updateCameraSchema.safeParse({ cameraId, adminDisabled: true, ipAddress: '10.0.0.1' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty('ipAddress');
  });
});

// Fix for EPIC_7_REVIEW.md C1.
describe('updateCameraConnectionSchema', () => {
  it('accepts an ipAddress-only update', () => {
    expect(updateCameraConnectionSchema.safeParse({ cameraId, ipAddress: '10.0.0.5' }).success).toBe(true);
  });

  it('accepts a streamProtocol-only update', () => {
    expect(updateCameraConnectionSchema.safeParse({ cameraId, streamProtocol: 'webrtc' }).success).toBe(true);
  });

  it('rejects an update with neither field', () => {
    expect(updateCameraConnectionSchema.safeParse({ cameraId }).success).toBe(false);
  });

  it('rejects an invalid ip address', () => {
    expect(updateCameraConnectionSchema.safeParse({ cameraId, ipAddress: 'not-an-ip' }).success).toBe(false);
  });
});

describe('deleteCameraSchema', () => {
  it('accepts a valid payload', () => {
    expect(deleteCameraSchema.safeParse({ cameraId }).success).toBe(true);
  });

  it('rejects a missing cameraId', () => {
    expect(deleteCameraSchema.safeParse({}).success).toBe(false);
  });
});

describe('linkCameraClassroomSchema / unlinkCameraClassroomSchema', () => {
  it('accepts a valid link payload', () => {
    expect(linkCameraClassroomSchema.safeParse({ cameraId, classroomId }).success).toBe(true);
  });

  it('accepts a valid unlink payload', () => {
    expect(unlinkCameraClassroomSchema.safeParse({ cameraId, classroomId }).success).toBe(true);
  });

  it('rejects a missing classroomId', () => {
    expect(linkCameraClassroomSchema.safeParse({ cameraId }).success).toBe(false);
  });
});

describe('issueServiceAccountKeySchema', () => {
  it('accepts a valid camera_agent payload with cameraIds', () => {
    expect(
      issueServiceAccountKeySchema.safeParse({
        name: 'KG1-A Camera Agent',
        purpose: 'camera_agent',
        scopes: ['camera:heartbeat'],
        cameraIds: [cameraId],
      }).success,
    ).toBe(true);
  });

  it('accepts a valid integration_other payload with no cameraIds', () => {
    expect(
      issueServiceAccountKeySchema.safeParse({
        name: 'Some Integration',
        purpose: 'integration_other',
        scopes: ['integration:sync'],
      }).success,
    ).toBe(true);
  });

  it('rejects an empty scopes array', () => {
    expect(issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'camera_agent', scopes: [], cameraIds: [cameraId] }).success).toBe(false);
  });

  it('rejects a malformed scope', () => {
    expect(issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'camera_agent', scopes: ['camera-heartbeat'], cameraIds: [cameraId] }).success).toBe(false);
  });

  it('rejects an invalid purpose', () => {
    expect(issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'weather_station', scopes: ['camera:heartbeat'], cameraIds: [cameraId] }).success).toBe(false);
  });

  // Fix for EPIC_7_REVIEW.md H2.
  it('rejects a camera_agent payload with no cameraIds', () => {
    expect(issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'camera_agent', scopes: ['camera:heartbeat'] }).success).toBe(false);
  });

  it('rejects a camera_agent payload with an empty cameraIds array', () => {
    expect(issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'camera_agent', scopes: ['camera:heartbeat'], cameraIds: [] }).success).toBe(false);
  });

  it('rejects an integration_other payload that carries cameraIds', () => {
    expect(
      issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'integration_other', scopes: ['integration:sync'], cameraIds: [cameraId] }).success,
    ).toBe(false);
  });

  // Fix for EPIC_7_REVIEW.md M3.
  it('rejects a camera_agent payload whose scopes contain no camera:* scope', () => {
    expect(
      issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'camera_agent', scopes: ['integration:sync'], cameraIds: [cameraId] }).success,
    ).toBe(false);
  });

  it('rejects an integration_other payload whose scopes contain a camera:* scope', () => {
    expect(
      issueServiceAccountKeySchema.safeParse({ name: 'Agent', purpose: 'integration_other', scopes: ['camera:heartbeat'] }).success,
    ).toBe(false);
  });
});

describe('revokeServiceAccountKeySchema', () => {
  it('accepts a valid payload', () => {
    expect(revokeServiceAccountKeySchema.safeParse({ serviceAccountId }).success).toBe(true);
  });

  it('rejects a missing serviceAccountId', () => {
    expect(revokeServiceAccountKeySchema.safeParse({}).success).toBe(false);
  });
});
