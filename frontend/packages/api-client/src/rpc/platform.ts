import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Platform operations (support tickets, tenant billing) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `create_support_ticket`
 */
export function createSupportTicket(
  args: RpcArgs<'create_support_ticket'>,
): Promise<RpcReturns<'create_support_ticket'>> {
  return callRpc('create_support_ticket', args);
}

/**
 * `update_support_ticket`
 */
export function updateSupportTicket(
  args: RpcArgs<'update_support_ticket'>,
): Promise<RpcReturns<'update_support_ticket'>> {
  return callRpc('update_support_ticket', args);
}

/**
 * `issue_tenant_billing_transaction`
 */
export function issueTenantBillingTransaction(
  args: RpcArgs<'issue_tenant_billing_transaction'>,
): Promise<RpcReturns<'issue_tenant_billing_transaction'>> {
  return callRpc('issue_tenant_billing_transaction', args);
}

/**
 * `refund_tenant_billing_transaction`
 */
export function refundTenantBillingTransaction(
  args: RpcArgs<'refund_tenant_billing_transaction'>,
): Promise<RpcReturns<'refund_tenant_billing_transaction'>> {
  return callRpc('refund_tenant_billing_transaction', args);
}
