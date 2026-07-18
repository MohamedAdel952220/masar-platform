import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { CameraRow, ManagerCameraRow, CameraConnectionRow, CameraClassroomLinkRow } from '../types/database.types.epic7.js';
import {
  cameraFromRow,
  managerCameraFromRow,
  cameraConnectionFromRow,
  cameraClassroomLinkFromRow,
  type Camera,
  type ManagerCamera,
  type CameraConnection,
  type CameraClassroomLink,
} from '../types/domain.epic7.js';
import type { CreateCameraInput, UpdateCameraInput, UpdateCameraConnectionInput, LinkCameraClassroomInput, UnlinkCameraClassroomInput } from '../validation/media.schema.js';
import { toAppError } from '../lib/rpcError.js';

// Fix for EPIC_7_REVIEW.md L4: a sane default page size so a very large
// tenant's camera list can never return an unbounded number of rows —
// PostgREST's own project-wide `max_rows = 1000` (supabase/config.toml) was
// the only cap before this fix. 500 comfortably covers any realistic
// per-tenant camera fleet while still being a real, enforced limit.
const DEFAULT_PAGE_SIZE = 500;

// Manager-facing select: joins media.camera_connections (fix for
// EPIC_7_REVIEW.md C1 — ip_address/stream_protocol no longer live on
// media.cameras itself, so a manager-facing read must explicitly join to
// see them). Guardian-facing reads never use this join at all.
const MANAGER_SELECT = '*, camera_connections!inner(ip_address, stream_protocol)';

type ManagerJoinRow = CameraRow & { camera_connections: { ip_address: string; stream_protocol: string } | { ip_address: string; stream_protocol: string }[] };

function flattenManagerRow(row: ManagerJoinRow): ManagerCameraRow {
  const connection = Array.isArray(row.camera_connections) ? row.camera_connections[0] : row.camera_connections;
  if (!connection) {
    throw new Error(`media.cameras row ${row.id} has no joined camera_connections row — this should be impossible under the 1:1 FK/inner-join contract.`);
  }
  const { camera_connections: _omit, ...camera } = row;
  return { ...camera, ip_address: connection.ip_address, stream_protocol: connection.stream_protocol };
}

export class CameraRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Manager-facing: full row, joined with its connection details — the
  // Dashboard's own camera-configuration screen legitimately needs both.
  async listForManager(tenantId: string, opts: { limit?: number; offset?: number } = {}): Promise<ManagerCamera[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    const { data, error } = await this.client
      .schema('media')
      .from('cameras')
      .select(MANAGER_SELECT)
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw toAppError(error);
    return (data as unknown as ManagerJoinRow[]).map((row) => managerCameraFromRow(flattenManagerRow(row)));
  }

  async findByIdForManager(id: string, tenantId: string): Promise<ManagerCamera | null> {
    const { data, error } = await this.client
      .schema('media')
      .from('cameras')
      .select(MANAGER_SELECT)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? managerCameraFromRow(flattenManagerRow(data as unknown as ManagerJoinRow)) : null;
  }

  // Guardian-facing: scoped to the caller's own children's linked
  // classroom(s) (RLS — cameras_select_guardian, migration 3 — is the
  // authoritative row-level gate here). No connection join at all — since
  // the fix for EPIC_7_REVIEW.md C1, ip_address/stream_protocol don't even
  // exist on this table, so there is no column list to defend here beyond
  // what the base row already is.
  async listForGuardian(opts: { limit?: number; offset?: number } = {}): Promise<Camera[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    const { data, error } = await this.client
      .schema('media')
      .from('cameras')
      .select('*')
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw toAppError(error);
    return (data as CameraRow[]).map(cameraFromRow);
  }

  // Fix for EPIC_7_REVIEW.md C1: creation is now a two-table write
  // (media.cameras + media.camera_connections) that must be atomic — routed
  // through public.create_camera (migration 6) rather than a bare
  // .insert(), since two separate client-side .insert() calls cannot be
  // wrapped in one transaction. The RPC is SECURITY INVOKER (runs as the
  // calling manager), so it adds no privilege beyond what
  // cameras_insert_manager/camera_connections_insert_manager (migration 3)
  // already grant — only atomicity.
  async create(input: CreateCameraInput, _tenantId: string): Promise<ManagerCamera> {
    const { data, error } = await this.client.rpc('create_camera', {
      p_name: input.name,
      p_zone: input.zone,
      p_ip_address: input.ipAddress,
      p_stream_protocol: input.streamProtocol,
      p_resolution: input.resolution,
      p_has_audio: input.hasAudio,
    });
    if (error) throw toAppError(error);
    const camera = cameraFromRow(data as CameraRow);
    // The RPC returns only the media.cameras row; the connection fields are
    // exactly what the caller just supplied, so no second round-trip is
    // needed to construct the manager-facing shape.
    return { ...camera, ipAddress: input.ipAddress, streamProtocol: input.streamProtocol };
  }

  // Direct table update under RLS (cameras_update_manager, migration 3) —
  // covers every field including the admin_disabled toggle (§12) in one
  // atomic UPDATE. Never touches ip_address/stream_protocol (those live on
  // media.camera_connections — see updateConnection below).
  //
  // Fix for EPIC_7_REVIEW.md L6: excludes already-soft-deleted rows — a
  // manager can no longer edit a camera that has already been removed.
  async update(input: UpdateCameraInput, tenantId: string): Promise<Camera> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.zone !== undefined) patch.zone = input.zone;
    if (input.resolution !== undefined) patch.resolution = input.resolution;
    if (input.hasAudio !== undefined) patch.has_audio = input.hasAudio;
    if (input.adminDisabled !== undefined) patch.admin_disabled = input.adminDisabled;

    const { data, error } = await this.client
      .schema('media')
      .from('cameras')
      .update(patch)
      .eq('id', input.cameraId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return cameraFromRow(data as CameraRow);
  }

  // Fix for EPIC_7_REVIEW.md C1: manager-only update of the two connection
  // fields, a plain single-table RLS UPDATE (camera_connections_update_
  // manager, migration 3) — no RPC needed since, unlike creation, this
  // never touches more than one table.
  async updateConnection(input: UpdateCameraConnectionInput, tenantId: string): Promise<CameraConnection> {
    const patch: Record<string, unknown> = {};
    if (input.ipAddress !== undefined) patch.ip_address = input.ipAddress;
    if (input.streamProtocol !== undefined) patch.stream_protocol = input.streamProtocol;

    const { data, error } = await this.client
      .schema('media')
      .from('camera_connections')
      .update(patch)
      .eq('camera_id', input.cameraId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return cameraConnectionFromRow(data as CameraConnectionRow);
  }

  // Soft-delete (§8) via the same RLS UPDATE policy — "Manager has no D
  // (hard delete)... only soft-delete, which is functionally a U" (§12).
  //
  // Fix for EPIC_7_REVIEW.md L6: excludes already-soft-deleted rows.
  async softDelete(cameraId: string, tenantId: string): Promise<Camera> {
    const { data, error } = await this.client
      .schema('media')
      .from('cameras')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cameraId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return cameraFromRow(data as CameraRow);
  }

  // Machine-caller path (camera-heartbeat) — scoped by tenantId alone, no
  // manager role check (there is no human caller at all, §13.7); the
  // service-account's own scope/status/camera-binding checks happen one
  // layer up in CameraHeartbeatService before this method is ever called.
  // Never touches admin_disabled (§3.33, §17).
  async recordHeartbeat(cameraId: string, tenantId: string): Promise<Camera | null> {
    const { data, error } = await this.client
      .schema('media')
      .from('cameras')
      .update({ online: true, last_heartbeat_at: new Date().toISOString() })
      .eq('id', cameraId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? cameraFromRow(data as CameraRow) : null;
  }

  async listClassroomLinks(cameraId: string, tenantId: string): Promise<CameraClassroomLink[]> {
    const { data, error } = await this.client
      .schema('media')
      .from('camera_classroom_links')
      .select('*')
      .eq('camera_id', cameraId)
      .eq('tenant_id', tenantId);
    if (error) throw toAppError(error);
    return (data as CameraClassroomLinkRow[]).map(cameraClassroomLinkFromRow);
  }

  async linkClassroom(input: LinkCameraClassroomInput, tenantId: string): Promise<CameraClassroomLink> {
    const { data, error } = await this.client
      .schema('media')
      .from('camera_classroom_links')
      .insert({ camera_id: input.cameraId, classroom_id: input.classroomId, tenant_id: tenantId })
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return cameraClassroomLinkFromRow(data as CameraClassroomLinkRow);
  }

  // Pure link-row hard delete (camera_classroom_links_delete_manager,
  // migration 3) — not a historical/financial record, mirrors
  // academic.child_guardian_links' own established precedent.
  async unlinkClassroom(input: UnlinkCameraClassroomInput, tenantId: string): Promise<void> {
    const { error } = await this.client
      .schema('media')
      .from('camera_classroom_links')
      .delete()
      .eq('camera_id', input.cameraId)
      .eq('classroom_id', input.classroomId)
      .eq('tenant_id', tenantId);
    if (error) throw toAppError(error);
  }
}
