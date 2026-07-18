// Epic 7 domain (camelCase) types + row<->domain mappers.
//
// Fix for EPIC_7_REVIEW.md C1: media.cameras no longer carries ip_address/
// stream_protocol at all (moved to media.camera_connections) — so the
// `Camera` type below is now, by construction, safe for both guardian and
// manager reads. The previous `GuardianCamera`/`guardianCameraFromRow`
// "restricted projection" type is removed: it existed specifically to keep
// two sensitive fields out of the guardian-facing shape, and now that those
// fields don't exist on this table's row shape at all, a second, narrower
// type would be redundant duplication rather than a real safety boundary.
// `ManagerCamera` (Camera + connection fields) is the new, additive,
// manager-only type that replaces the old plain `Camera`-with-ip-address
// shape.
import type {
  CameraRow,
  ManagerCameraRow,
  CameraConnectionRow,
  CameraClassroomLinkRow,
  CameraServiceAccountLinkRow,
  CameraZone,
  CameraResolution,
} from './database.types.epic7.js';

export interface Camera {
  id: string;
  tenantId: string;
  name: string;
  zone: CameraZone;
  resolution: CameraResolution;
  hasAudio: boolean;
  online: boolean;
  adminDisabled: boolean;
  lastHeartbeatAt: string | null;
  addedAt: string;
  deletedAt: string | null;
}

export function cameraFromRow(row: CameraRow): Camera {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    zone: row.zone,
    resolution: row.resolution,
    hasAudio: row.has_audio,
    online: row.online,
    adminDisabled: row.admin_disabled,
    lastHeartbeatAt: row.last_heartbeat_at,
    addedAt: row.added_at,
    deletedAt: row.deleted_at,
  };
}

// Manager-only — always the result of a media.cameras + media.
// camera_connections join (CameraRepository.listForManager/
// findByIdForManager). Never constructed anywhere on the guardian read path.
export interface ManagerCamera extends Camera {
  ipAddress: string;
  streamProtocol: string;
}

export function managerCameraFromRow(row: ManagerCameraRow): ManagerCamera {
  return {
    ...cameraFromRow(row),
    ipAddress: row.ip_address,
    streamProtocol: row.stream_protocol,
  };
}

export interface CameraConnection {
  cameraId: string;
  tenantId: string;
  ipAddress: string;
  streamProtocol: string;
  createdAt: string;
  updatedAt: string;
}

export function cameraConnectionFromRow(row: CameraConnectionRow): CameraConnection {
  return {
    cameraId: row.camera_id,
    tenantId: row.tenant_id,
    ipAddress: row.ip_address,
    streamProtocol: row.stream_protocol,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CameraClassroomLink {
  cameraId: string;
  classroomId: string;
  tenantId: string;
  createdAt: string;
}

export function cameraClassroomLinkFromRow(row: CameraClassroomLinkRow): CameraClassroomLink {
  return {
    cameraId: row.camera_id,
    classroomId: row.classroom_id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
  };
}

// Fix for EPIC_7_REVIEW.md H2.
export interface CameraServiceAccountLink {
  cameraId: string;
  serviceAccountId: string;
  tenantId: string;
  createdAt: string;
}

export function cameraServiceAccountLinkFromRow(row: CameraServiceAccountLinkRow): CameraServiceAccountLink {
  return {
    cameraId: row.camera_id,
    serviceAccountId: row.service_account_id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
  };
}
