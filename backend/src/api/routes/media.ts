// API handlers for camera registry / classroom linkage / service-account
// management — mirrors the corresponding direct-CRUD paths and Edge
// Functions (§14.2, §16 API Groups: Camera Registry, Stream Token, Service
// Account Management). camera-stream-token has no handler here — it is
// Edge-Function-only (calls the external media relay), matching
// PaymentService's own precedent for initiate-payment (Epic 6).
import {
  createCameraSchema,
  updateCameraSchema,
  updateCameraConnectionSchema,
  deleteCameraSchema,
  linkCameraClassroomSchema,
  unlinkCameraClassroomSchema,
  issueServiceAccountKeySchema,
  revokeServiceAccountKeySchema,
} from '../../validation/media.schema.js';
import { AppError } from '../../lib/errors.js';
import type { CameraService } from '../../services/cameraService.js';
import type { ServiceAccountService, IssuedServiceAccountKey } from '../../services/serviceAccountService.js';
import type { CallerContext } from '../../types/domain.js';
import type { ServiceAccount } from '../../types/domain.js';
import type { Camera, ManagerCamera, CameraConnection, CameraClassroomLink } from '../../types/domain.epic7.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function listCamerasForManagerRoute(service: CameraService, caller: CallerContext): Promise<ManagerCamera[]> {
  return service.listForManager(caller);
}

export async function listCamerasForGuardianRoute(service: CameraService, caller: CallerContext): Promise<Camera[]> {
  return service.listForGuardian(caller);
}

export async function createCameraRoute(service: CameraService, caller: CallerContext, rawBody: unknown): Promise<ManagerCamera> {
  const parsed = createCameraSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.create(parsed.data, caller);
}

export async function updateCameraRoute(service: CameraService, caller: CallerContext, rawBody: unknown): Promise<Camera> {
  const parsed = updateCameraSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.update(parsed.data, caller);
}

// Fix for EPIC_7_REVIEW.md C1: separate route for the two connection
// fields, which now live on media.camera_connections.
export async function updateCameraConnectionRoute(service: CameraService, caller: CallerContext, rawBody: unknown): Promise<CameraConnection> {
  const parsed = updateCameraConnectionSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.updateConnection(parsed.data, caller);
}

export async function deleteCameraRoute(service: CameraService, caller: CallerContext, rawBody: unknown): Promise<Camera> {
  const parsed = deleteCameraSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.remove(parsed.data, caller);
}

export async function linkCameraClassroomRoute(service: CameraService, caller: CallerContext, rawBody: unknown): Promise<CameraClassroomLink> {
  const parsed = linkCameraClassroomSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.linkClassroom(parsed.data, caller);
}

export async function unlinkCameraClassroomRoute(service: CameraService, caller: CallerContext, rawBody: unknown): Promise<{ ok: true }> {
  const parsed = unlinkCameraClassroomSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  await service.unlinkClassroom(parsed.data, caller);
  return { ok: true };
}

export async function listServiceAccountsRoute(service: ServiceAccountService, caller: CallerContext): Promise<ServiceAccount[]> {
  return service.listForTenant(caller);
}

export async function issueServiceAccountKeyRoute(service: ServiceAccountService, caller: CallerContext, rawBody: unknown): Promise<IssuedServiceAccountKey> {
  const parsed = issueServiceAccountKeySchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.issueKey(parsed.data, caller);
}

export async function revokeServiceAccountKeyRoute(service: ServiceAccountService, caller: CallerContext, rawBody: unknown): Promise<ServiceAccount> {
  const parsed = revokeServiceAccountKeySchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.revokeKey(parsed.data, caller);
}
