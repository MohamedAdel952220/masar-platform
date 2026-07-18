// CameraHeartbeatService — testable core behind the camera-heartbeat Edge
// Function (§10.7, §13.7, §17). No human caller: authorization is entirely
// an API-key/scope/camera-binding check against identity.service_accounts
// and media.camera_service_account_links, never RLS/CallerContext (§13.7 —
// "RLS is not the authorization mechanism for this path"). Mirrors the
// "same saga expressed as plain TypeScript" pattern used for
// TenantProvisioningService/StaffAccountService, so this machine-identity
// auth path — explicitly flagged as "the least battle-tested pattern in
// the plan" (BACKEND_EXECUTION_PLAN.md Epic 7 §25) — gets the same
// unit-test coverage as every human-facing authorization path in this
// codebase.
//
// Sync note (fix for EPIC_7_REVIEW.md M1): this authorization sequence
// (hash lookup -> status check -> scope check -> camera-binding check) is
// independently mirrored in
// supabase/functions/camera-heartbeat/index.ts for the deployed Deno
// runtime. If you change the sequence here, change it there too — nothing
// enforces the two stay in sync beyond this comment pair and code review
// discipline.
import { AppError } from '../lib/errors.js';
import type { ServiceAccountRepository } from '../repositories/serviceAccountRepository.js';
import type { CameraRepository } from '../repositories/cameraRepository.js';
import type { Camera } from '../types/domain.epic7.js';
import { hashApiKey } from '../lib/serviceAccountKey.js';

const REQUIRED_SCOPE = 'camera:heartbeat';

export class CameraHeartbeatService {
  constructor(
    private readonly serviceAccounts: ServiceAccountRepository,
    private readonly cameras: CameraRepository,
  ) {}

  async recordHeartbeat(rawApiKey: string, cameraId: string): Promise<Camera> {
    const keyHash = hashApiKey(rawApiKey);
    const account = await this.serviceAccounts.findByKeyHash(keyHash);

    // §19 Acceptance Criteria: "A revoked service-account key immediately
    // stops being accepted" — findByKeyHash only ever matches on the hash;
    // this status check is what actually enforces "active", so a revoked
    // key's row is found but rejected here, every time, with no
    // caching/TTL to create a window where a just-revoked key still works.
    if (!account || account.status !== 'active' || !account.tenantId) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'This service-account key is invalid or has been revoked.', 'مفتاح حساب الخدمة هذا غير صالح أو تم إلغاؤه.');
    }
    if (!account.scopes.includes(REQUIRED_SCOPE)) {
      throw new AppError('PERM_ROLE_DENIED', 'This service account is not authorized for camera heartbeats.', 'حساب الخدمة هذا غير مصرح له بإرسال نبضات الكاميرا.');
    }

    // Fix for EPIC_7_REVIEW.md H2: this key must be explicitly bound to the
    // requested camera via media.camera_service_account_links. A service
    // account with zero links can never pass this check — closing the "any
    // active key heartbeats any camera in the tenant" impersonation gap.
    const linkedCameraIds = await this.serviceAccounts.listLinkedCameraIds(account.id);
    if (!linkedCameraIds.includes(cameraId)) {
      throw new AppError('PERM_ROLE_DENIED', 'This service account is not authorized for this camera.', 'حساب الخدمة هذا غير مصرح له بهذه الكاميرا.');
    }

    const camera = await this.cameras.recordHeartbeat(cameraId, account.tenantId);
    if (!camera) {
      throw new AppError('NOT_FOUND', 'Camera not found for this service account.', 'لم يتم العثور على الكاميرا لحساب الخدمة هذا.');
    }

    // Best-effort, non-blocking (mirrors _shared/idempotency.ts's own
    // "secondary bookkeeping write is non-fatal" convention) — a failure
    // here must never fail the heartbeat itself.
    this.serviceAccounts.touchLastUsed(account.id).catch((err) => {
      console.error(`ServiceAccountRepository.touchLastUsed failed for ${account.id}:`, err);
    });

    return camera;
  }
}
