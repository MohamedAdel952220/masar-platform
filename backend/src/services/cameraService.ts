// CameraService — testable core behind media.cameras/camera_connections/
// camera_classroom_links CRUD (§14.2 "no bespoke API for straightforward
// CRUD" — except camera creation itself, which now routes through the
// public.create_camera RPC for two-table atomicity, fix for
// EPIC_7_REVIEW.md C1). Defense-in-depth role checks matching the RLS
// policies' own (§28 convention, §12's Cameras row: Guardian R
// own-classroom-only, Manager CRUD, everyone else denied).
import { AppError } from '../lib/errors.js';
import type { CameraRepository } from '../repositories/cameraRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { Camera, ManagerCamera, CameraConnection, CameraClassroomLink } from '../types/domain.epic7.js';
import type {
  CreateCameraInput,
  UpdateCameraInput,
  UpdateCameraConnectionInput,
  DeleteCameraInput,
  LinkCameraClassroomInput,
  UnlinkCameraClassroomInput,
} from '../validation/media.schema.js';

export class CameraService {
  constructor(private readonly cameras: CameraRepository) {}

  async listForManager(caller: CallerContext): Promise<ManagerCamera[]> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can view the camera registry.', 'فقط المدير يمكنه عرض سجل الكاميرات.');
    }
    return this.cameras.listForManager(caller.tenantId);
  }

  // §17's "Access rule": a guardian only ever resolves cameras via their
  // own children's linked classroom(s) — enforced by RLS on the underlying
  // query (cameras_select_guardian, migration 3), re-stated here as the
  // service-layer role gate every sibling service in this codebase applies.
  // The returned Camera type structurally has no ipAddress/streamProtocol
  // fields (fix for EPIC_7_REVIEW.md C1 — those columns don't exist on
  // media.cameras at all anymore).
  async listForGuardian(caller: CallerContext): Promise<Camera[]> {
    if (caller.role !== 'guardian') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view cameras.', 'غير مصرح لك بعرض الكاميرات.');
    }
    return this.cameras.listForGuardian();
  }

  async create(input: CreateCameraInput, caller: CallerContext): Promise<ManagerCamera> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can add a camera.', 'فقط المدير يمكنه إضافة كاميرا.');
    }
    return this.cameras.create(input, caller.tenantId);
  }

  async update(input: UpdateCameraInput, caller: CallerContext): Promise<Camera> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can update a camera.', 'فقط المدير يمكنه تعديل كاميرا.');
    }
    return this.cameras.update(input, caller.tenantId);
  }

  // Fix for EPIC_7_REVIEW.md C1: manager-only update of ip_address/
  // stream_protocol, now a separate method operating on media.
  // camera_connections.
  async updateConnection(input: UpdateCameraConnectionInput, caller: CallerContext): Promise<CameraConnection> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can update a camera\'s connection details.', 'فقط المدير يمكنه تعديل بيانات اتصال الكاميرا.');
    }
    return this.cameras.updateConnection(input, caller.tenantId);
  }

  async remove(input: DeleteCameraInput, caller: CallerContext): Promise<Camera> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can remove a camera.', 'فقط المدير يمكنه إزالة كاميرا.');
    }
    return this.cameras.softDelete(input.cameraId, caller.tenantId);
  }

  async linkClassroom(input: LinkCameraClassroomInput, caller: CallerContext): Promise<CameraClassroomLink> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can link a camera to a classroom.', 'فقط المدير يمكنه ربط كاميرا بفصل.');
    }
    return this.cameras.linkClassroom(input, caller.tenantId);
  }

  async unlinkClassroom(input: UnlinkCameraClassroomInput, caller: CallerContext): Promise<void> {
    if (caller.role !== 'manager' || !caller.tenantId) {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can unlink a camera from a classroom.', 'فقط المدير يمكنه إلغاء ربط كاميرا من فصل.');
    }
    return this.cameras.unlinkClassroom(input, caller.tenantId);
  }
}
