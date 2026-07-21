import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Media domain (cameras) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `create_camera`
 */
export function createCamera(args: RpcArgs<'create_camera'>): Promise<RpcReturns<'create_camera'>> {
  return callRpc('create_camera', args);
}
