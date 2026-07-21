import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Tenant + account provisioning — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `advance_tenant_provisioning`
 *
 * NON-IDEMPOTENT (BACKEND_CERTIFICATION.md §7.1): this RPC accepts no
 * idempotency key. Never auto-retry it; callers must disable the submit
 * control on dispatch and require explicit confirmation before a re-attempt.
 */
export function advanceTenantProvisioning(
  args: RpcArgs<'advance_tenant_provisioning'>,
): Promise<RpcReturns<'advance_tenant_provisioning'>> {
  return callRpc('advance_tenant_provisioning', args);
}

/**
 * `enroll_child_with_guardian`
 */
export function enrollChildWithGuardian(
  args: RpcArgs<'enroll_child_with_guardian'>,
): Promise<RpcReturns<'enroll_child_with_guardian'>> {
  return callRpc('enroll_child_with_guardian', args);
}

/**
 * `link_child_guardian`
 */
export function linkChildGuardian(
  args: RpcArgs<'link_child_guardian'>,
): Promise<RpcReturns<'link_child_guardian'>> {
  return callRpc('link_child_guardian', args);
}
