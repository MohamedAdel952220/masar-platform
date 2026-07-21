import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Safety domain (pickup passes, handover) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `create_pickup_pass`
 */
export function createPickupPass(
  args: RpcArgs<'create_pickup_pass'>,
): Promise<RpcReturns<'create_pickup_pass'>> {
  return callRpc('create_pickup_pass', args);
}

/**
 * `revoke_pickup_pass`
 */
export function revokePickupPass(
  args: RpcArgs<'revoke_pickup_pass'>,
): Promise<RpcReturns<'revoke_pickup_pass'>> {
  return callRpc('revoke_pickup_pass', args);
}

/**
 * `scan_pickup_pass`
 */
export function scanPickupPass(args: RpcArgs<'scan_pickup_pass'>): Promise<RpcReturns<'scan_pickup_pass'>> {
  return callRpc('scan_pickup_pass', args);
}

/**
 * `confirm_handover`
 *
 * NON-IDEMPOTENT (BACKEND_CERTIFICATION.md §7.1): this RPC accepts no
 * idempotency key. Never auto-retry it; callers must disable the submit
 * control on dispatch and require explicit confirmation before a re-attempt.
 */
export function confirmHandover(args: RpcArgs<'confirm_handover'>): Promise<RpcReturns<'confirm_handover'>> {
  return callRpc('confirm_handover', args);
}
