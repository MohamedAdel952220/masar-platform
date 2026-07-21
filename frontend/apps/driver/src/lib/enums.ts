import type { Database } from '@masar/api-client';

/**
 * EVERY enum literal this app uses, in one place, each annotated with its
 * generated type.
 *
 * ══ WHY THIS FILE EXISTS ══
 *
 * The Parent portal shipped `['in_progress', 'started']` as its live-trip
 * predicate. Neither is a member of `transport.trip_status`, so the comparison
 * silently matched nothing and live tracking never activated. It passed
 * typecheck because a status compared against `readonly string[]` type-checks
 * regardless of content, and it passed review because an unmatched value yields
 * an empty result — indistinguishable from "no trips today".
 *
 * The audit that followed found the same class of defect in three more portals,
 * including two `as` casts that silenced the exact error TypeScript would
 * otherwise have raised on a payment RPC.
 *
 * So in this portal no route file writes a bare enum literal. Every value is
 * declared here with an explicit generated type, which makes a wrong literal a
 * COMPILE ERROR rather than a runtime silence:
 *
 *   const X: TripStatus = 'in_progress';   // ✗ does not compile
 *
 * Rules for this file, and for anyone editing this app:
 *   1. Never write an enum literal outside this file.
 *   2. Never write `as SomeEnum`. A cast here would restore exactly the hazard
 *      this file exists to remove.
 *   3. Exhaustive label maps use `Record<TheEnum, string>`, so adding a value
 *      to the database enum breaks the build until the label is supplied.
 */

// ---------------------------------------------------------------------------
// Types, straight from the generated schema. No hand-written unions.
// ---------------------------------------------------------------------------

export type TripStatus = Database['transport']['Enums']['trip_status'];
export type TripLeg = Database['transport']['Enums']['trip_leg'];
export type ChildTripStatus = Database['transport']['Enums']['trip_child_status_value'];
export type NotificationSeverity = Database['comms']['Enums']['notification_severity'];
export type NotificationChannel = Database['comms']['Enums']['notification_channel'];

// ---------------------------------------------------------------------------
// transport.trip_status — 'scheduled' | 'moving' | 'arrived' | 'completed' | 'cancelled'
// ---------------------------------------------------------------------------

/**
 * Trip states a driver is actively running.
 *
 * `start_trip` inserts the row at `moving` directly (§18), so `scheduled` is a
 * state this app creates but never observes mid-run; `arrived` is set when the
 * bus reaches the nursery but the trip has not been completed yet. Both accept
 * GPS pings — `record_gps_ping` refuses only `completed` and `cancelled`.
 */
export const ACTIVE_TRIP_STATUSES: readonly TripStatus[] = ['moving', 'arrived'];

/** Terminal states. `record_gps_ping` and `complete_trip` both reject these. */
export const TERMINAL_TRIP_STATUSES: readonly TripStatus[] = ['completed', 'cancelled'];

export function isTripActive(status: TripStatus): boolean {
  return ACTIVE_TRIP_STATUSES.includes(status);
}

export function isTripTerminal(status: TripStatus): boolean {
  return TERMINAL_TRIP_STATUSES.includes(status);
}

/** Exhaustive: adding a `trip_status` member breaks the build here first. */
export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  scheduled: 'Not started',
  moving: 'On the road',
  arrived: 'At the nursery',
  completed: 'Finished',
  cancelled: 'Cancelled',
};

export const TRIP_STATUS_TONE: Record<TripStatus, 'teal' | 'info' | 'success' | 'neutral' | 'amber'> = {
  scheduled: 'neutral',
  moving: 'teal',
  arrived: 'info',
  completed: 'success',
  cancelled: 'amber',
};

// ---------------------------------------------------------------------------
// transport.trip_leg — 'am' | 'pm'
// ---------------------------------------------------------------------------

export const TRIP_LEGS: readonly TripLeg[] = ['am', 'pm'];

export const TRIP_LEG_LABEL: Record<TripLeg, string> = {
  am: 'Morning',
  pm: 'Afternoon',
};

/**
 * What the driver is doing to each child on a given leg.
 *
 * Morning: collect children from home and bring them in — boarding.
 * Afternoon: take them home — the bus is dropping off.
 *
 * This drives which control the manifest offers, so it is expressed once rather
 * than re-derived per screen.
 */
export const LEG_PRIMARY_ACTION: Record<TripLeg, ChildTripStatus> = {
  am: 'picked_up',
  pm: 'dropped_off',
};

// ---------------------------------------------------------------------------
// transport.trip_child_status_value — 'pending' | 'picked_up' | 'dropped_off' | 'absent'
// ---------------------------------------------------------------------------

export const CHILD_TRIP_STATUSES: readonly ChildTripStatus[] = [
  'pending',
  'picked_up',
  'dropped_off',
  'absent',
];

export const CHILD_TRIP_STATUS_LABEL: Record<ChildTripStatus, string> = {
  pending: 'Waiting',
  picked_up: 'On board',
  dropped_off: 'Dropped off',
  absent: 'Not travelling',
};

export const CHILD_TRIP_STATUS_TONE: Record<ChildTripStatus, 'neutral' | 'teal' | 'success' | 'amber'> = {
  pending: 'neutral',
  picked_up: 'teal',
  dropped_off: 'success',
  absent: 'amber',
};

/** A child the driver still has something to do about on this leg. */
export function isChildOutstanding(status: ChildTripStatus, leg: TripLeg): boolean {
  if (status === 'absent') return false;
  return status !== LEG_PRIMARY_ACTION[leg];
}

// ---------------------------------------------------------------------------
// comms.notification_severity — 'info' | 'attention' | 'urgent'
// ---------------------------------------------------------------------------

export const NOTIFICATION_SEVERITY_TONE: Record<NotificationSeverity, 'neutral' | 'info' | 'amber'> = {
  info: 'neutral',
  attention: 'info',
  urgent: 'amber',
};

/**
 * Columns arrive typed, but a value can still be widened to `string` in
 * transit (e.g. through a `Json` return). These narrow safely without a cast:
 * an unrecognised value returns null and the caller renders it raw rather than
 * mislabelling it.
 */
export function asTripStatus(value: string): TripStatus | null {
  return Object.prototype.hasOwnProperty.call(TRIP_STATUS_LABEL, value) ? (value as TripStatus) : null;
}

export function asTripLeg(value: string): TripLeg | null {
  return Object.prototype.hasOwnProperty.call(TRIP_LEG_LABEL, value) ? (value as TripLeg) : null;
}

export function asChildTripStatus(value: string): ChildTripStatus | null {
  return Object.prototype.hasOwnProperty.call(CHILD_TRIP_STATUS_LABEL, value)
    ? (value as ChildTripStatus)
    : null;
}

export function asNotificationSeverity(value: string): NotificationSeverity | null {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_SEVERITY_TONE, value)
    ? (value as NotificationSeverity)
    : null;
}
