import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Transport domain (buses, trips, GPS) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `assign_bus_rider`
 */
export function assignBusRider(args: RpcArgs<'assign_bus_rider'>): Promise<RpcReturns<'assign_bus_rider'>> {
  return callRpc('assign_bus_rider', args);
}

/**
 * `unassign_bus_rider`
 */
export function unassignBusRider(
  args: RpcArgs<'unassign_bus_rider'>,
): Promise<RpcReturns<'unassign_bus_rider'>> {
  return callRpc('unassign_bus_rider', args);
}

/**
 * `start_trip`
 */
export function startTrip(args: RpcArgs<'start_trip'>): Promise<RpcReturns<'start_trip'>> {
  return callRpc('start_trip', args);
}

/**
 * `complete_trip`
 */
export function completeTrip(args: RpcArgs<'complete_trip'>): Promise<RpcReturns<'complete_trip'>> {
  return callRpc('complete_trip', args);
}

/**
 * `record_gps_ping`
 */
export function recordGpsPing(args: RpcArgs<'record_gps_ping'>): Promise<RpcReturns<'record_gps_ping'>> {
  return callRpc('record_gps_ping', args);
}

/**
 * `update_child_trip_status`
 *
 * NON-IDEMPOTENT (BACKEND_CERTIFICATION.md §7.1): this RPC accepts no
 * idempotency key. Never auto-retry it; callers must disable the submit
 * control on dispatch and require explicit confirmation before a re-attempt.
 */
export function updateChildTripStatus(
  args: RpcArgs<'update_child_trip_status'>,
): Promise<RpcReturns<'update_child_trip_status'>> {
  return callRpc('update_child_trip_status', args);
}
