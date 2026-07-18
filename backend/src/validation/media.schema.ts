import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const cameraZoneSchema = z.enum(['classroom', 'outdoor', 'rest', 'entrance', 'common']);
export const cameraResolutionSchema = z.enum(['720p', '1080p', '4k']);
export const serviceAccountPurposeSchema = z.enum(['camera_agent', 'integration_other']);

// Matches media.camera_connections.stream_protocol's CHECK (btrim(stream_protocol) <> '').
const streamProtocolSchema = nonEmptyString('streamProtocol').max(50);
const scopeSchema = z.string().regex(/^[a-z][a-z_]*:[a-z][a-z_]*$/, 'scope must be in "resource:action" format, e.g. camera:heartbeat');

export const createCameraSchema = z.object({
  name: nonEmptyString('name').max(200),
  zone: cameraZoneSchema,
  ipAddress: z.string().ip({ message: 'ipAddress must be a valid IPv4 or IPv6 address' }),
  streamProtocol: streamProtocolSchema,
  resolution: cameraResolutionSchema,
  hasAudio: z.boolean().default(false),
});
export type CreateCameraInput = z.infer<typeof createCameraSchema>;

// Fix for EPIC_7_REVIEW.md C1: ipAddress/streamProtocol removed — those two
// fields now live on media.camera_connections (updateCameraConnectionSchema
// below), never on media.cameras.
export const updateCameraSchema = z
  .object({
    cameraId: uuidSchema,
    name: nonEmptyString('name').max(200).optional(),
    zone: cameraZoneSchema.optional(),
    resolution: cameraResolutionSchema.optional(),
    hasAudio: z.boolean().optional(),
    adminDisabled: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.zone !== undefined || v.resolution !== undefined || v.hasAudio !== undefined || v.adminDisabled !== undefined, {
    message: 'At least one field must be provided to update',
    path: ['cameraId'],
  });
export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;

// Fix for EPIC_7_REVIEW.md C1: manager-only update of the two connection
// fields, operating on media.camera_connections directly.
export const updateCameraConnectionSchema = z
  .object({
    cameraId: uuidSchema,
    ipAddress: z.string().ip({ message: 'ipAddress must be a valid IPv4 or IPv6 address' }).optional(),
    streamProtocol: streamProtocolSchema.optional(),
  })
  .refine((v) => v.ipAddress !== undefined || v.streamProtocol !== undefined, {
    message: 'At least one of ipAddress or streamProtocol must be provided',
    path: ['cameraId'],
  });
export type UpdateCameraConnectionInput = z.infer<typeof updateCameraConnectionSchema>;

export const deleteCameraSchema = z.object({
  cameraId: uuidSchema,
});
export type DeleteCameraInput = z.infer<typeof deleteCameraSchema>;

export const linkCameraClassroomSchema = z.object({
  cameraId: uuidSchema,
  classroomId: uuidSchema,
});
export type LinkCameraClassroomInput = z.infer<typeof linkCameraClassroomSchema>;

export const unlinkCameraClassroomSchema = z.object({
  cameraId: uuidSchema,
  classroomId: uuidSchema,
});
export type UnlinkCameraClassroomInput = z.infer<typeof unlinkCameraClassroomSchema>;

// Fix for EPIC_7_REVIEW.md M3/H2: purpose is cross-validated against
// scopes (a camera_agent key must carry only camera:* scopes; an
// integration_other key must carry none), and a camera_agent key now
// requires at least one bound cameraId — closing the impersonation gap
// where any active camera:heartbeat-scoped key could heartbeat any camera
// in its tenant regardless of which device it was actually issued for.
export const issueServiceAccountKeySchema = z
  .object({
    name: nonEmptyString('name').max(200),
    purpose: serviceAccountPurposeSchema,
    scopes: z.array(scopeSchema).min(1, 'At least one scope is required'),
    cameraIds: z.array(uuidSchema).optional(),
  })
  .refine((v) => v.purpose !== 'camera_agent' || v.scopes.some((s) => s.startsWith('camera:')), {
    message: 'a camera_agent key must carry at least one camera:* scope',
    path: ['scopes'],
  })
  .refine((v) => v.purpose !== 'integration_other' || !v.scopes.some((s) => s.startsWith('camera:')), {
    message: 'an integration_other key may not carry a camera:* scope',
    path: ['scopes'],
  })
  .refine((v) => v.purpose !== 'camera_agent' || (v.cameraIds !== undefined && v.cameraIds.length > 0), {
    message: 'cameraIds must be a non-empty array for a camera_agent key',
    path: ['cameraIds'],
  })
  .refine((v) => v.purpose === 'camera_agent' || v.cameraIds === undefined || v.cameraIds.length === 0, {
    message: 'cameraIds is only accepted for a camera_agent key',
    path: ['cameraIds'],
  });
export type IssueServiceAccountKeyInput = z.infer<typeof issueServiceAccountKeySchema>;

export const revokeServiceAccountKeySchema = z.object({
  serviceAccountId: uuidSchema,
});
export type RevokeServiceAccountKeyInput = z.infer<typeof revokeServiceAccountKeySchema>;
