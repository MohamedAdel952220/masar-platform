// Epic 7 snake_case row types, kept separate from database.types(.epicN).ts
// for the same reason those files are separate: repositories are the only
// place that ever sees a raw DB row shape.

export type CameraZone = 'classroom' | 'outdoor' | 'rest' | 'entrance' | 'common';
export type CameraResolution = '720p' | '1080p' | '4k';

// Fix for EPIC_7_REVIEW.md C1: ip_address/stream_protocol no longer live on
// this row shape at all — they moved to CameraConnectionRow
// (media.camera_connections, migration 2) so this table can safely stay in
// the Realtime publication (§15) without ever broadcasting them. This row
// shape is now identical for both guardian- and manager-facing reads —
// there is no longer a separate "guardian-safe projection" type needed for
// media.cameras itself (see domain.epic7.ts's own header comment).
export interface CameraRow {
  id: string;
  tenant_id: string;
  name: string;
  zone: CameraZone;
  resolution: CameraResolution;
  has_audio: boolean;
  online: boolean;
  admin_disabled: boolean;
  last_heartbeat_at: string | null;
  added_at: string;
  deleted_at: string | null;
}

// Fix for EPIC_7_REVIEW.md C1: manager-only shape, always the result of a
// media.cameras + media.camera_connections join. Never selected by any
// guardian-facing repository method.
export type ManagerCameraRow = CameraRow & {
  ip_address: string;
  stream_protocol: string;
};

// Fix for EPIC_7_REVIEW.md C1: the two raw connection fields, now isolated
// on their own manager-only, non-Realtime-published table.
export interface CameraConnectionRow {
  camera_id: string;
  tenant_id: string;
  ip_address: string;
  stream_protocol: string;
  created_at: string;
  updated_at: string;
}

export interface CameraClassroomLinkRow {
  camera_id: string;
  classroom_id: string;
  tenant_id: string;
  created_at: string;
}

// Fix for EPIC_7_REVIEW.md H2: binds a camera_agent service account to the
// specific camera(s) it may heartbeat for.
export interface CameraServiceAccountLinkRow {
  camera_id: string;
  service_account_id: string;
  tenant_id: string;
  created_at: string;
}
