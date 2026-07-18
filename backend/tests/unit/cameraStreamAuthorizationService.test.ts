import { describe, it, expect } from 'vitest';
import { authorizeCameraStreamRequest } from '../../src/services/cameraStreamAuthorizationService.js';

// Fix for EPIC_7_REVIEW.md L2: direct, automated regression coverage for
// the authorization decision camera-stream-token/index.ts makes — factored
// out into this pure function specifically so H1 (missing online check)
// and M4 (missing classroom-deleted_at exclusion, exercised via the
// guardianClassroomIds input already having been filtered) can never
// silently regress again.

describe('authorizeCameraStreamRequest', () => {
  it('allows a request for an online, non-disabled camera linked to the guardian\'s own classroom', () => {
    expect(() =>
      authorizeCameraStreamRequest({
        camera: { id: 'camera-1', online: true, adminDisabled: false },
        cameraClassroomIds: ['classroom-1'],
        guardianClassroomIds: ['classroom-1'],
      }),
    ).not.toThrow();
  });

  it('raises NOT_FOUND when the camera does not exist for this tenant', () => {
    expect(() =>
      authorizeCameraStreamRequest({ camera: null, cameraClassroomIds: [], guardianClassroomIds: ['classroom-1'] }),
    ).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('raises PERM_ROLE_DENIED when the camera is not linked to any of the guardian\'s own classrooms', () => {
    expect(() =>
      authorizeCameraStreamRequest({
        camera: { id: 'camera-1', online: true, adminDisabled: false },
        cameraClassroomIds: ['classroom-2'],
        guardianClassroomIds: ['classroom-1'],
      }),
    ).toThrowError(expect.objectContaining({ code: 'PERM_ROLE_DENIED' }));
  });

  // Fix for EPIC_7_REVIEW.md H1 — the direct regression test.
  it('raises VALIDATION_FAILED when the camera is offline, even if admin_disabled is false', () => {
    expect(() =>
      authorizeCameraStreamRequest({
        camera: { id: 'camera-1', online: false, adminDisabled: false },
        cameraClassroomIds: ['classroom-1'],
        guardianClassroomIds: ['classroom-1'],
      }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });

  it('raises VALIDATION_FAILED when the camera is admin_disabled, even if online', () => {
    expect(() =>
      authorizeCameraStreamRequest({
        camera: { id: 'camera-1', online: true, adminDisabled: true },
        cameraClassroomIds: ['classroom-1'],
        guardianClassroomIds: ['classroom-1'],
      }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });

  // Fix for EPIC_7_REVIEW.md M4 — this function trusts its caller to have
  // already excluded soft-deleted classrooms from guardianClassroomIds; this
  // test documents that contract by showing a classroom absent from the
  // (already-filtered) guardian set is correctly denied.
  it('denies access when the camera\'s only linked classroom has been excluded from guardianClassroomIds (e.g. because it was soft-deleted upstream)', () => {
    expect(() =>
      authorizeCameraStreamRequest({
        camera: { id: 'camera-1', online: true, adminDisabled: false },
        cameraClassroomIds: ['classroom-1'],
        guardianClassroomIds: [],
      }),
    ).toThrowError(expect.objectContaining({ code: 'PERM_ROLE_DENIED' }));
  });
});
