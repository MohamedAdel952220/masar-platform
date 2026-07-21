import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Billing domain (invoices, payments) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `generate_invoice`
 */
export function generateInvoice(args: RpcArgs<'generate_invoice'>): Promise<RpcReturns<'generate_invoice'>> {
  return callRpc('generate_invoice', args);
}

/**
 * `verify_payment`
 */
export function verifyPayment(args: RpcArgs<'verify_payment'>): Promise<RpcReturns<'verify_payment'>> {
  return callRpc('verify_payment', args);
}

/**
 * `refund_payment`
 */
export function refundPayment(args: RpcArgs<'refund_payment'>): Promise<RpcReturns<'refund_payment'>> {
  return callRpc('refund_payment', args);
}

/**
 * `mark_installment_paid_manual`
 *
 * NON-IDEMPOTENT (BACKEND_CERTIFICATION.md §7.1): this RPC accepts no
 * idempotency key. Never auto-retry it; callers must disable the submit
 * control on dispatch and require explicit confirmation before a re-attempt.
 */
export function markInstallmentPaidManual(
  args: RpcArgs<'mark_installment_paid_manual'>,
): Promise<RpcReturns<'mark_installment_paid_manual'>> {
  return callRpc('mark_installment_paid_manual', args);
}

/**
 * `mark_ledger_item_paid_manual`
 *
 * NON-IDEMPOTENT (BACKEND_CERTIFICATION.md §7.1): this RPC accepts no
 * idempotency key. Never auto-retry it; callers must disable the submit
 * control on dispatch and require explicit confirmation before a re-attempt.
 */
export function markLedgerItemPaidManual(
  args: RpcArgs<'mark_ledger_item_paid_manual'>,
): Promise<RpcReturns<'mark_ledger_item_paid_manual'>> {
  return callRpc('mark_ledger_item_paid_manual', args);
}
