import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * AI reports domain (draft lifecycle) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `schedule_report_draft`
 */
export function scheduleReportDraft(
  args: RpcArgs<'schedule_report_draft'>,
): Promise<RpcReturns<'schedule_report_draft'>> {
  return callRpc('schedule_report_draft', args);
}

/**
 * `send_report_draft`
 */
export function sendReportDraft(
  args: RpcArgs<'send_report_draft'>,
): Promise<RpcReturns<'send_report_draft'>> {
  return callRpc('send_report_draft', args);
}

/**
 * `resend_report_draft`
 */
export function resendReportDraft(
  args: RpcArgs<'resend_report_draft'>,
): Promise<RpcReturns<'resend_report_draft'>> {
  return callRpc('resend_report_draft', args);
}

/**
 * `delete_report_draft`
 */
export function deleteReportDraft(
  args: RpcArgs<'delete_report_draft'>,
): Promise<RpcReturns<'delete_report_draft'>> {
  return callRpc('delete_report_draft', args);
}

/**
 * `export_report_draft`
 */
export function exportReportDraft(
  args: RpcArgs<'export_report_draft'>,
): Promise<RpcReturns<'export_report_draft'>> {
  return callRpc('export_report_draft', args);
}
