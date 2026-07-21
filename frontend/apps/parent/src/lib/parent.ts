import type { Database } from '@masar/api-client';
import type { MasarClaims } from '@masar/auth';

/** The deployed `transport.trip_status` enum, straight from the generated types. */
type TripStatus = Database['transport']['Enums']['trip_status'];

/**
 * Parent App scope helpers (BACKEND_ARCHITECTURE.md §12).
 *
 * IMPORTANT: these are UX affordances only. RLS is the authorization boundary.
 * A guardian's reach is defined server-side by
 * `child_id = ANY(public.current_guardian_child_ids())` on every child-scoped
 * table, and by narrower rules elsewhere. This app applies NO client-side child
 * filtering on top of policy — it reads, and the database returns only this
 * guardian's own children.
 *
 * §12 row for `guardian`, as deployed — note how narrow it is:
 *   Children ............ R (own children only)
 *   Attendance .......... R (own child)
 *   Evaluations/Lessons . R (own child)
 *   Concerns ............ R (own child, NON-ESCALATED only)
 *   Day-path history .... R (own child, current + own history)
 *   AI Reports .......... R (own child, SENT ONLY — drafts are never visible)
 *   Buses/Trips ......... R (own child's bus, LIVE ONLY)
 *   GPS pings ........... R (own child's ACTIVE trip)
 *   Cameras ............. R (own classroom's, stream token only)
 *   Billing/Invoices .... R (own child)
 *   Payments ............ C (own child, initiate), R (own)
 *   Conversations ....... CRU (own)
 *   Notifications ....... R, U (own)
 *
 * Two of these are worth stating plainly because they shape screens here:
 *  - AI reports are visible to a guardian ONLY once sent. A draft a teacher is
 *    still reviewing is invisible to this app by policy, not by filtering.
 *  - Trip and GPS visibility is LIVE-ONLY. Historical route replay is not a
 *    guardian capability; the trip screen reflects that.
 */

export function canOpenParentApp(claims: MasarClaims): boolean {
  return claims.role === 'guardian';
}

/** Initiating a payment for one's own child (§12: "C own child, initiate"). */
export function canInitiatePayment(claims: MasarClaims): boolean {
  return claims.role === 'guardian';
}

/** Messaging the nursery about one's own child. */
export function canMessage(claims: MasarClaims): boolean {
  return claims.role === 'guardian';
}

/**
 * A camera is viewable only when it is online AND not administratively
 * disabled (§17 — these are independent booleans, never one status). The
 * stream token itself is minted by the `camera-stream-token` Edge Function,
 * which performs its own authorization; this predicate only decides whether
 * offering the control makes sense.
 */
export function isCameraViewable(camera: { online: boolean; admin_disabled: boolean }): boolean {
  return camera.online && !camera.admin_disabled;
}

/**
 * Trip states a guardian may meaningfully watch live.
 *
 * These MUST be members of the deployed `transport.trip_status` enum:
 *   'scheduled' | 'moving' | 'arrived' | 'completed' | 'cancelled'
 *
 * A trip is live once it is `moving` (en route) or `arrived` (at the nursery,
 * children being collected). `scheduled` has not begun; `completed` and
 * `cancelled` are closed.
 *
 * The type annotation is load-bearing: a literal outside the enum is now a
 * compile error. Before, this list held 'in_progress'/'started', which match no
 * enum member — so `isTripLive` always returned false and the live trip screen
 * never left its empty state. That failed silently because an unmatched status
 * yields an empty result, which is indistinguishable from "no trips today".
 */
export const LIVE_TRIP_STATUSES: readonly TripStatus[] = ['moving', 'arrived'];

export function isTripLive(status: string): boolean {
  return (LIVE_TRIP_STATUSES as readonly string[]).includes(status);
}
