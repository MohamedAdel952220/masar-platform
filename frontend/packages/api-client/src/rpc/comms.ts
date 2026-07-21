import { callRpc } from './core';
import type { RpcArgs, RpcReturns } from '../types/helpers';

/**
 * Communications domain (chat, announcements, notifications) — typed RPC wrappers.
 *
 * Each wrapper derives its argument and return types from the generated
 * function catalogue, so a backend signature change becomes a compile error.
 */

/**
 * `send_message`
 */
export function sendMessage(args: RpcArgs<'send_message'>): Promise<RpcReturns<'send_message'>> {
  return callRpc('send_message', args);
}

/**
 * `escalate_conversation`
 *
 * NON-IDEMPOTENT (BACKEND_CERTIFICATION.md §7.1): this RPC accepts no
 * idempotency key. Never auto-retry it; callers must disable the submit
 * control on dispatch and require explicit confirmation before a re-attempt.
 */
export function escalateConversation(
  args: RpcArgs<'escalate_conversation'>,
): Promise<RpcReturns<'escalate_conversation'>> {
  return callRpc('escalate_conversation', args);
}

/**
 * `broadcast_announcement`
 */
export function broadcastAnnouncement(
  args: RpcArgs<'broadcast_announcement'>,
): Promise<RpcReturns<'broadcast_announcement'>> {
  return callRpc('broadcast_announcement', args);
}

/**
 * `register_device_token`
 */
export function registerDeviceToken(
  args: RpcArgs<'register_device_token'>,
): Promise<RpcReturns<'register_device_token'>> {
  return callRpc('register_device_token', args);
}

/**
 * `update_notification_preferences`
 */
export function updateNotificationPreferences(
  args: RpcArgs<'update_notification_preferences'>,
): Promise<RpcReturns<'update_notification_preferences'>> {
  return callRpc('update_notification_preferences', args);
}
