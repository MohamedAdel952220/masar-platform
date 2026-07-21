/**
 * Transport vocabulary, as actually deployed.
 *
 * `transport.trips.status` is the enum `trip_status`:
 *   'scheduled' | 'moving' | 'arrived' | 'completed' | 'cancelled'
 *
 * A trip a reception desk can act on is one that is under way today — `moving`
 * (en route) or `arrived` (at the nursery, children being collected). A
 * `scheduled` trip has not started, and `completed`/`cancelled` ones are closed.
 *
 * These constants exist rather than inline string literals because the enum is
 * easy to guess wrong, and guessing wrong fails silently: a status that matches
 * nothing simply yields an empty list, which looks identical to "no trips
 * today" and therefore never surfaces as an error.
 */

export const ACTIVE_TRIP_STATUSES = ['moving', 'arrived'] as const;

export function isTripActive(status: string): boolean {
  return (ACTIVE_TRIP_STATUSES as readonly string[]).includes(status);
}

/** `trip_child_status_value` — per-child state within one trip. */
export const CHILD_TRIP_STATUSES = ['pending', 'picked_up', 'dropped_off', 'absent'] as const;
export type ChildTripStatus = (typeof CHILD_TRIP_STATUSES)[number];

export const CHILD_TRIP_LABEL: Record<ChildTripStatus, string> = {
  pending: 'Not yet on the bus',
  picked_up: 'On the bus',
  dropped_off: 'Dropped off',
  absent: 'Absent',
};

/** `trip_leg` — morning run in, afternoon run home. */
export function legLabel(leg: string): string {
  if (leg === 'am') return 'Morning';
  if (leg === 'pm') return 'Afternoon';
  return leg;
}
