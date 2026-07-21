import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Academic domain (children, attendance, evaluations) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `mark_attendance`
 */
export function markAttendance(args: RpcArgs<'mark_attendance'>): Promise<RpcReturns<'mark_attendance'>> {
  return callRpc('mark_attendance', args);
}

/**
 * `submit_evaluation`
 */
export function submitEvaluation(
  args: RpcArgs<'submit_evaluation'>,
): Promise<RpcReturns<'submit_evaluation'>> {
  return callRpc('submit_evaluation', args);
}

/**
 * `suspend_child`
 */
export function suspendChild(args: RpcArgs<'suspend_child'>): Promise<RpcReturns<'suspend_child'>> {
  return callRpc('suspend_child', args);
}

/**
 * `reactivate_child`
 */
export function reactivateChild(args: RpcArgs<'reactivate_child'>): Promise<RpcReturns<'reactivate_child'>> {
  return callRpc('reactivate_child', args);
}

/**
 * `withdraw_child`
 *
 * NON-IDEMPOTENT (BACKEND_CERTIFICATION.md §7.1): this RPC accepts no
 * idempotency key. Never auto-retry it; callers must disable the submit
 * control on dispatch and require explicit confirmation before a re-attempt.
 */
export function withdrawChild(args: RpcArgs<'withdraw_child'>): Promise<RpcReturns<'withdraw_child'>> {
  return callRpc('withdraw_child', args);
}
