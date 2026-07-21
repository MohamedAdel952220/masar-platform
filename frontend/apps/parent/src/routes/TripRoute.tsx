import {
  realtime,
  useRealtimeSubscription,
  useTransportList,
  type ChangePayload,
  type TransportRow,
} from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, QueryState } from '../components/States';
import { formatDateTime, formatRelative, todayIso } from '../lib/format';
import { isTripLive } from '../lib/parent';
import { useSelectedChild } from '../lib/selectedChild';
import { useThrottledState } from '../lib/useThrottledState';

/**
 * Live trip tracking.
 *
 * TWO CONSTRAINTS SHAPE THIS SCREEN, and both are visible in the code:
 *
 * 1. **LIVE ONLY.** §12 grants a guardian read on trips for their own child's
 *    bus and on GPS pings for the ACTIVE trip only. Route replay is not a
 *    guardian capability. So when no trip is running, this screen does not
 *    degrade into a history view — it says the bus is not running and stops.
 *    The restriction is enforced by RLS; the UI simply agrees with it rather
 *    than implying data is being withheld.
 *
 * 2. **GPS RENDERS AT MOST ONCE PER SECOND** (§15). Pings arrive far faster
 *    than that. `useThrottledState` coalesces them: the newest position wins,
 *    superseded ones are dropped. See that file for why leading-edge-then-
 *    trailing is the right shape for a position.
 *
 * No map is drawn. The tile provider is not part of this phase's dependency
 * set, and a fabricated map would be worse than an honest coordinate readout —
 * so the screen shows position, speed and freshness, and the map is recorded
 * as a follow-up rather than faked.
 */

type Ping = TransportRow<'gps_pings'>;

export function TripRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const { selected } = useSelectedChild();
  const today = todayIso();

  const trips = useTransportList(tenantId, 'trips', { orderBy: 'service_date', limit: 20 });
  const childStatus = useTransportList(tenantId, 'trip_child_status', {
    orderBy: 'status_changed_at',
    limit: 50,
  });
  const buses = useTransportList(tenantId, 'buses', { orderBy: 'number', ascending: true, limit: 50 });

  const tripRows = useMemo(() => trips.data?.items ?? [], [trips.data]);

  /**
   * The live trip, if any. RLS has already narrowed `trips` to buses this
   * guardian's child rides, so "the live one among what I can see" is the
   * correct selection — no client-side child filtering is applied.
   */
  const liveTrip = useMemo(
    () => tripRows.find((t) => t.service_date === today && isTripLive(t.status)) ?? null,
    [tripRows, today],
  );

  const bus = useMemo(
    () => (liveTrip ? ((buses.data?.items ?? []).find((b) => b.id === liveTrip.bus_id) ?? null) : null),
    [buses.data, liveTrip],
  );

  const myStatus = useMemo(() => {
    if (!liveTrip || !selected) return null;
    return (
      (childStatus.data?.items ?? []).find((s) => s.trip_id === liveTrip.id && s.child_id === selected.id) ??
      null
    );
  }, [childStatus.data, liveTrip, selected]);

  // GPS: subscribed only while a trip is live, and rendered at most 1/second.
  const [position, pushPosition] = useThrottledState<Ping | null>(null, 1000);

  const onPing = useCallback(
    (payload: ChangePayload<Ping>) => {
      if (payload.new) pushPosition(payload.new);
    },
    [pushPosition],
  );
  const onStatus = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);

  useRealtimeSubscription<Ping>(
    liveTrip ? realtime.tripPosition(liveTrip.id) : null,
    onPing,
    Boolean(liveTrip),
  );
  useRealtimeSubscription(liveTrip ? realtime.tripStatus(liveTrip.id) : null, onStatus, Boolean(liveTrip));

  return (
    <>
      <PageHeader
        title="Bus"
        subtitle="Live only while the bus is running."
        meta={
          liveTrip ? (
            <Badge tone="teal" dot>
              Trip in progress
            </Badge>
          ) : (
            <Badge tone="neutral">Not running</Badge>
          )
        }
      />

      <QueryState
        isLoading={trips.isLoading}
        error={trips.error}
        isEmpty={false}
        emptyTitle="No trips"
        onRetry={() => void trips.refetch()}
      >
        {!liveTrip ? (
          <EmptyState
            title="The bus is not running right now"
            hint="Live location appears here while a trip is in progress. The nursery does not share past routes."
          />
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <Card padding="lg">
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Icon name="bus" size={22} />
                  <span
                    style={{
                      flex: 1,
                      fontWeight: 'var(--weight-bold)',
                      color: 'var(--text-strong)',
                    }}
                  >
                    {bus ? 'Bus ' + bus.number : 'Bus'}
                  </span>
                  <Badge tone="info">{liveTrip.leg}</Badge>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Started {formatRelative(liveTrip.started_at, locale)}
                </span>
                {myStatus ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Badge tone="teal" dot>
                      {selected?.name.split(' ')[0] ?? 'Your child'}: {myStatus.status}
                    </Badge>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      {formatRelative(myStatus.status_changed_at, locale)}
                    </span>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card padding="lg">
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-bold)',
                    letterSpacing: 'var(--tracking-caps)',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  Live position
                </span>
                {position ? (
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-body)',
                      }}
                    >
                      {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      {position.speed_kph === null
                        ? 'Speed unknown'
                        : Math.round(position.speed_kph) + ' km/h'}
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      Updated {formatDateTime(position.recorded_at, locale)}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    Waiting for the bus to report its position…
                  </span>
                )}
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                  Position updates at most once a second to preserve battery.
                </span>
              </div>
            </Card>
          </div>
        )}
      </QueryState>
    </>
  );
}
