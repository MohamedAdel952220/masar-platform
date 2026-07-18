import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { PickupPassRow, PickupScanEventRow } from '../types/database.types.epic3.js';
import { pickupPassFromRow, pickupScanEventFromRow, type PickupPass, type PickupScanEvent, type ScanPickupPassResult } from '../types/domain.epic3.js';
import { toAppError } from '../lib/rpcError.js';

interface ScanPickupPassRpcResult {
  result: 'valid' | 'invalid_expired' | 'invalid_unknown' | 'invalid_revoked';
  scanEventId: string;
  pass: PickupPassRow | null;
}

export class PickupPassRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Wraps public.create_pickup_pass (§14.2, §13.4, migration 6).
  async create(input: {
    childId: string;
    personName: string;
    relation: string;
    idPhotoObjectId?: string | null;
    expiresAt?: string | null;
  }): Promise<PickupPass> {
    const { data, error } = await this.client.rpc('create_pickup_pass', {
      p_child_id: input.childId,
      p_person_name: input.personName,
      p_relation: input.relation,
      p_id_photo_object_id: input.idPhotoObjectId ?? null,
      p_expires_at: input.expiresAt ?? null,
    });
    if (error) throw toAppError(error);
    return pickupPassFromRow(data as PickupPassRow);
  }

  // §13.4 — exact qr_token match only, never a listing/browsing query.
  async scan(qrToken: string): Promise<ScanPickupPassResult> {
    const { data, error } = await this.client.rpc('scan_pickup_pass', { p_qr_token: qrToken });
    if (error) throw toAppError(error);
    const result = data as ScanPickupPassRpcResult;
    return {
      result: result.result,
      scanEventId: result.scanEventId,
      pass: result.pass ? pickupPassFromRow(result.pass) : null,
    };
  }

  async confirmHandover(pickupScanEventId: string): Promise<PickupScanEvent> {
    const { data, error } = await this.client.rpc('confirm_handover', { p_pickup_scan_event_id: pickupScanEventId });
    if (error) throw toAppError(error);
    return pickupScanEventFromRow(data as PickupScanEventRow);
  }

  // Fix for EPIC_3_REVIEW.md M4 — wraps the new public.revoke_pickup_pass
  // RPC (migration 6), the only legitimate write path to status='revoked'.
  async revoke(pickupPassId: string): Promise<PickupPass> {
    const { data, error } = await this.client.rpc('revoke_pickup_pass', { p_pickup_pass_id: pickupPassId });
    if (error) throw toAppError(error);
    return pickupPassFromRow(data as PickupPassRow);
  }
}
