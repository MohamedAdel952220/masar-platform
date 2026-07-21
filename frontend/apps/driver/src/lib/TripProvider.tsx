import { realtime, useRealtimeSubscription, useTransportList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, type ReactNode } from 'react';
import { asTripStatus, isTripActive } from './enums';
import { todayIso } from './format';
import { TripContext, type TripContextValue } from './tripContext';
import { useGpsTracker } from './useGpsTracker';

/**
 * Mounts the trip context, the GPS tracker and the two realtime subscriptions
 * for the whole session. See `tripContext.ts` for why this sits above the
 * router rather than inside a screen.
 */
export function TripProvider({ children }: { children: ReactNode }) {
  const { claims, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  // `MasarClaims` carries no user id; identity tables are keyed by
  // `auth.users.id` (Epic 1), which is exactly `session.user.id`.
  const userId = session?.user.id ?? '';
  const today = todayIso();

  // RLS returns only this driver's own bus and its trips. No client-side
  // filtering by bus or driver is applied on top — that would duplicate the
  // authorization boundary in a place that can drift from it.
  const buses = useTransportList(tenantId, 'buses', { orderBy: 'number', ascending: true, limit: 10 });
  const trips = useTransportList(tenantId, 'trips', { orderBy: 'service_date', limit: 50 });

  const busRows = useMemo(() => (buses.data?.items ?? []).filter((b) => b.deleted_at === null), [buses.data]);

  const todaysTrips = useMemo(
    () => (trips.data?.items ?? []).filter((t) => t.service_date === today),
    [trips.data, today],
  );

  /**
   * The trip under way. `asTripStatus` narrows the column safely rather than
   * comparing against a hand-written literal — see `lib/enums.ts`.
   */
  const activeTrip = useMemo(() => {
    for (const trip of todaysTrips) {
      const status = asTripStatus(trip.status);
      if (status && isTripActive(status)) return trip;
    }
    return null;
  }, [todaysTrips]);

  const invalidate = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);

  // One subscription per resource. The api-client registry is reference-counted
  // and keyed by channel name, so even if a screen subscribed to the same
  // channel it would share this socket rather than open a second one.
  useRealtimeSubscription(
    activeTrip ? realtime.tripStatus(activeTrip.id) : null,
    invalidate,
    Boolean(activeTrip),
  );
  useRealtimeSubscription(userId ? realtime.userNotifications(userId) : null, invalidate, Boolean(userId));

  // GPS runs for as long as a trip is active, regardless of which screen is open.
  const gps = useGpsTracker(activeTrip?.id ?? null, activeTrip !== null);

  const value = useMemo<TripContextValue>(
    () => ({
      buses: busRows,
      bus: busRows[0] ?? null,
      todaysTrips,
      activeTrip,
      gps,
      isLoading: buses.isLoading || trips.isLoading,
      error: buses.error ?? trips.error,
      refetch: () => {
        void buses.refetch();
        void trips.refetch();
      },
    }),
    [busRows, todaysTrips, activeTrip, gps, buses, trips],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
