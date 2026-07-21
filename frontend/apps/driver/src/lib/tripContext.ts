import { type TransportRow } from '@masar/api-client';
import { createContext, useContext } from 'react';
import type { GpsState } from './useGpsTracker';

/**
 * Shared trip context — the context object and its hook.
 *
 * ══ WHY THE TRIP LIVES ABOVE THE ROUTER ══
 *
 * GPS tracking is bound to TRIP ACTIVITY, not to screen mount. A driver who
 * opens the manifest to mark a child aboard, or checks the route list, must not
 * silently stop transmitting position — parents are watching that bus move.
 * Mounting the tracker inside a route would tie the fleet's live location to
 * whichever tab happened to be open, which is indefensible.
 *
 * So the provider sits above the router: one tracker, one trip subscription,
 * one notification subscription, for the whole session.
 *
 * This also satisfies "one logical subscription per resource, no duplicate
 * channels" structurally rather than by convention — screens read from this
 * context and cannot open a second channel even by accident.
 *
 * The provider lives in `TripProvider.tsx`. Keeping the hook and the component
 * in separate files is what lets Fast Refresh work on the provider.
 */

export type Trip = TransportRow<'trips'>;
export type Bus = TransportRow<'buses'>;

export interface TripContextValue {
  /** Buses RLS returned for this driver. Never filtered client-side. */
  buses: Bus[];
  /** The driver's bus. RLS returns only their own, so this is the first row. */
  bus: Bus | null;
  /** Today's trips for this driver's bus, as returned by the backend. */
  todaysTrips: Trip[];
  /** The one trip currently under way, if any. */
  activeTrip: Trip | null;
  /** Live GPS state for the active trip. Idle when there is none. */
  gps: GpsState;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export const TripContext = createContext<TripContextValue | null>(null);

export function useTripContext(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used within a TripProvider');
  return ctx;
}
