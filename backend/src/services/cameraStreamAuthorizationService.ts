// cameraStreamAuthorizationService — fix for EPIC_7_REVIEW.md L2. Factors
// the pure authorization DECISION camera-stream-token/index.ts makes
// (classroom ownership + online/admin_disabled gating) out into a small,
// dependency-free, fully unit-testable function, without touching the
// external-relay-calling part of that Edge Function (which stays
// deliberately un-mirrored in Node, matching PaymentService's own
// established precedent of not wrapping initiate-payment — see
// EPIC_7_COMPLETION_REPORT.md §7's own reasoning for camera-stream-token).
//
// This is a decision function, not a repository-backed service: every
// input is already-resolved data (the camera row, the set of classroom IDs
// the camera is linked to, the set of classroom IDs the calling guardian's
// own non-withdrawn children currently belong to, already filtered to
// exclude soft-deleted classrooms — fix for EPIC_7_REVIEW.md M4). It throws
// the same AppError codes camera-stream-token/index.ts itself throws, so a
// test against this function is a direct, real regression test for that
// Edge Function's own logic.
import { AppError } from '../lib/errors.js';

export interface CameraStreamAuthorizationInput {
  camera: { id: string; online: boolean; adminDisabled: boolean } | null;
  cameraClassroomIds: string[];
  guardianClassroomIds: string[];
}

export function authorizeCameraStreamRequest(input: CameraStreamAuthorizationInput): void {
  if (!input.camera) {
    throw new AppError('NOT_FOUND', 'Camera not found.', 'لم يتم العثور على الكاميرا.');
  }

  const isLinkedToOwnChild = input.cameraClassroomIds.some((id) => input.guardianClassroomIds.includes(id));
  if (!isLinkedToOwnChild) {
    throw new AppError('PERM_ROLE_DENIED', 'This is not your child\'s camera.', 'هذه ليست كاميرا طفلك.');
  }

  // Fix for EPIC_7_REVIEW.md H1: both halves of §3.33's compound
  // viewability rule ("online = true AND admin_disabled = false") are
  // checked — previously only admin_disabled was.
  if (!input.camera.online || input.camera.adminDisabled) {
    throw new AppError('VALIDATION_FAILED', 'This camera is currently unavailable.', 'هذه الكاميرا غير متاحة حاليًا.');
  }
}
