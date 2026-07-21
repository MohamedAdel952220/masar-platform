import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Approvals domain (requests, events, RSVPs) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `submit_request`
 */
export function submitRequest(args: RpcArgs<'submit_request'>): Promise<RpcReturns<'submit_request'>> {
  return callRpc('submit_request', args);
}

/**
 * `review_request`
 */
export function reviewRequest(args: RpcArgs<'review_request'>): Promise<RpcReturns<'review_request'>> {
  return callRpc('review_request', args);
}

/**
 * `update_rsvp`
 */
export function updateRsvp(args: RpcArgs<'update_rsvp'>): Promise<RpcReturns<'update_rsvp'>> {
  return callRpc('update_rsvp', args);
}

/**
 * `cancel_trip_registration`
 */
export function cancelTripRegistration(
  args: RpcArgs<'cancel_trip_registration'>,
): Promise<RpcReturns<'cancel_trip_registration'>> {
  return callRpc('cancel_trip_registration', args);
}
