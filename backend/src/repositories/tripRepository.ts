import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { TripRow, TripChildStatusRow, GpsPingRow } from '../types/database.types.epic3.js';
import {
  tripFromRow,
  tripChildStatusFromRow,
  gpsPingFromRow,
  type StartTripResult,
  type TripChildStatusRecord,
  type GpsPing,
  type Trip,
} from '../types/domain.epic3.js';
import { toAppError } from '../lib/rpcError.js';

interface StartTripRpcResult {
  trip: TripRow;
  tripStopRiders: Array<{ tripStopId: string; busRiderId: string; childId: string; sequence: number }>;
}

export class TripRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Wraps public.start_trip (§14.2, migration 6) — snapshots the bus's
  // current active riders into trip_stops/trip_stop_riders/trip_child_status
  // in one transaction.
  async start(busId: string, leg: 'am' | 'pm'): Promise<StartTripResult> {
    const { data, error } = await this.client.rpc('start_trip', { p_bus_id: busId, p_leg: leg });
    if (error) throw toAppError(error);
    const result = data as StartTripRpcResult;
    return { trip: tripFromRow(result.trip), tripStopRiders: result.tripStopRiders };
  }

  // No idempotency-key plumbing — see migration 6's file header for why
  // this specific RPC is a documented exception to the mandatory-
  // idempotency convention (append-only, retry-safe by construction).
  async recordGpsPing(input: { tripId: string; lat: number; lng: number; heading?: number | null; speedKph?: number | null }): Promise<GpsPing> {
    const { data, error } = await this.client.rpc('record_gps_ping', {
      p_trip_id: input.tripId,
      p_lat: input.lat,
      p_lng: input.lng,
      p_heading: input.heading ?? null,
      p_speed_kph: input.speedKph ?? null,
    });
    if (error) throw toAppError(error);
    return gpsPingFromRow(data as GpsPingRow);
  }

  async updateChildStatus(input: { tripId: string; childId: string; status: 'pending' | 'picked_up' | 'dropped_off' | 'absent' }): Promise<TripChildStatusRecord> {
    const { data, error } = await this.client.rpc('update_child_trip_status', {
      p_trip_id: input.tripId,
      p_child_id: input.childId,
      p_status: input.status,
    });
    if (error) throw toAppError(error);
    return tripChildStatusFromRow(data as TripChildStatusRow);
  }

  async complete(tripId: string): Promise<Trip> {
    const { data, error } = await this.client.rpc('complete_trip', { p_trip_id: tripId });
    if (error) throw toAppError(error);
    return tripFromRow(data as TripRow);
  }
}
