import { callRpc } from './core';
import type { RpcReturns } from '../types/helpers';

/**
 * Session-scope helper RPCs.
 *
 * These are the same SECURITY DEFINER helpers the RLS policies call. They are
 * read-only and side-effect free, and take no arguments. The frontend normally
 * reads identity from the JWT claims (see @masar/auth) rather than
 * round-tripping; these exist for verification and for the rare case where a
 * server-evaluated answer is wanted (e.g. confirming the session tenant matches
 * the subdomain the app was opened on).
 */

export function currentRole(): Promise<RpcReturns<'current_role'>> {
  return callRpc('current_role');
}

export function currentTenantId(): Promise<RpcReturns<'current_tenant_id'>> {
  return callRpc('current_tenant_id');
}

export function currentPlatformAdminTier(): Promise<RpcReturns<'current_platform_admin_tier'>> {
  return callRpc('current_platform_admin_tier');
}

export function isPlatformAdmin(): Promise<RpcReturns<'is_platform_admin'>> {
  return callRpc('is_platform_admin');
}

export function isPlatformAdminManagerTier(): Promise<RpcReturns<'is_platform_admin_manager_tier'>> {
  return callRpc('is_platform_admin_manager_tier');
}

export function currentAccountIsActive(): Promise<RpcReturns<'current_account_is_active'>> {
  return callRpc('current_account_is_active');
}

export function currentNotificationRecipientType(): Promise<
  RpcReturns<'current_notification_recipient_type'>
> {
  return callRpc('current_notification_recipient_type');
}

export function currentGuardianChildIds(): Promise<RpcReturns<'current_guardian_child_ids'>> {
  return callRpc('current_guardian_child_ids');
}

export function currentGuardianClassroomIds(): Promise<RpcReturns<'current_guardian_classroom_ids'>> {
  return callRpc('current_guardian_classroom_ids');
}

export function currentGuardianActiveBusIds(): Promise<RpcReturns<'current_guardian_active_bus_ids'>> {
  return callRpc('current_guardian_active_bus_ids');
}

export function currentGuardianActiveTripIds(): Promise<RpcReturns<'current_guardian_active_trip_ids'>> {
  return callRpc('current_guardian_active_trip_ids');
}

export function currentDriverBusIds(): Promise<RpcReturns<'current_driver_bus_ids'>> {
  return callRpc('current_driver_bus_ids');
}

export function currentDriverTripIds(): Promise<RpcReturns<'current_driver_trip_ids'>> {
  return callRpc('current_driver_trip_ids');
}

export function currentDriverRiderIds(): Promise<RpcReturns<'current_driver_rider_ids'>> {
  return callRpc('current_driver_rider_ids');
}

export function currentStaffClassroomIds(): Promise<RpcReturns<'current_staff_classroom_ids'>> {
  return callRpc('current_staff_classroom_ids');
}
