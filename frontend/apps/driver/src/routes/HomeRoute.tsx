import { callRpc, useCommsList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { canRunTrip } from '../lib/driver';
import {
  TRIP_LEGS,
  TRIP_LEG_LABEL,
  TRIP_STATUS_LABEL,
  asTripLeg,
  asTripStatus,
  type TripLeg,
} from '../lib/enums';
import { formatRelative } from '../lib/format';
import { useTripContext } from '../lib/tripContext';

/**
 * Driver home — start the run, or resume the one already going.
 *
 * The screen is deliberately dominated by a single action. A driver opening
 * this app is at the depot about to start, or mid-route wanting to get back to
 * the manifest. Everything else is secondary and sits below the fold.
 *
 * `start_trip` is NOT one of the seven non-idempotent RPCs, and does not need
 * to be: it is an atomic `INSERT ... ON CONFLICT (bus_id, leg, service_date) DO
 * NOTHING`, so a double-tap cannot create a second trip — the second call
 * raises `STATE_ALREADY_PROCESSED` instead. That guarantee is the backend's,
 * not this screen's, which is why the button needs no special guarding beyond
 * an in-flight lock.
 *
 * Server-side it also snapshots the bus's current `bus_riders` into
 * `trip_stops` / `trip_stop_riders` / `trip_child_status` in one statement
 * chain. The manifest is therefore a snapshot taken at start, not a live view
 * of the roster — a child added to the bus mid-run does not appear until the
 * next trip. That is the backend's chosen semantics and this app reflects it
 * rather than papering over it.
 */

export function HomeRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tenantId = claims.tenantId ?? '';
  const mayRun = canRunTrip(claims);

  const { bus, activeTrip, todaysTrips, isLoading, error, refetch, gps } = useTripContext();

  const [starting, setStarting] = useState<TripLeg | null>(null);
  const [startError, setStartError] = useState<unknown>(null);

  const notifications = useCommsList(tenantId, 'notifications', { orderBy: 'created_at', limit: 3 });
  const unread = useMemo(
    () => (notifications.data?.items ?? []).filter((n) => n.read_at === null).length,
    [notifications.data],
  );

  /** Legs already run today — `start_trip` rejects a repeat per (bus, leg, day). */
  const legsDone = useMemo(() => {
    const set = new Set<string>();
    for (const trip of todaysTrips) set.add(trip.leg);
    return set;
  }, [todaysTrips]);

  const start = async (leg: TripLeg) => {
    if (!bus || starting !== null) return;
    setStarting(leg);
    setStartError(null);
    try {
      // Returns jsonb { trip, tripStopRiders }. The trip row is re-read from
      // the list query rather than parsed out of the response, so one source of
      // truth for trip state remains the table.
      await callRpc('start_trip', { p_bus_id: bus.id, p_leg: leg });
      await queryClient.invalidateQueries();
      void navigate('/trip');
    } catch (err) {
      setStartError(err);
    } finally {
      setStarting(null);
    }
  };

  const activeStatus = activeTrip ? asTripStatus(activeTrip.status) : null;
  const activeLeg = activeTrip ? asTripLeg(activeTrip.leg) : null;

  return (
    <>
      <PageHeader title={bus ? 'Bus ' + bus.number : 'Driver'} subtitle={bus?.service_area ?? undefined} />

      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={!bus}
        emptyTitle="No bus assigned to you"
        emptyHint="The nursery office assigns buses. Contact them if this looks wrong."
        onRetry={refetch}
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {startError ? <ErrorState error={startError} onRetry={() => setStartError(null)} /> : null}

          {activeTrip ? (
            <Link to="/trip" style={{ textDecoration: 'none' }}>
              <Card padding="lg" accent="var(--status-live)">
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Icon name="bus" size={26} />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'var(--weight-extra)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {activeLeg ? TRIP_LEG_LABEL[activeLeg] : activeTrip.leg} run under way
                    </span>
                    <Badge tone="teal" dot>
                      {activeStatus ? TRIP_STATUS_LABEL[activeStatus] : activeTrip.status}
                    </Badge>
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    Started {formatRelative(activeTrip.started_at, locale)} ·{' '}
                    {gps.tracking ? gps.sent + ' positions sent' : 'location not tracking'}
                  </span>
                  <Button size="lg" style={{ minHeight: 56 }}>
                    Open the trip
                  </Button>
                </div>
              </Card>
            </Link>
          ) : (
            <Card padding="lg">
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-extra)',
                    color: 'var(--text-strong)',
                  }}
                >
                  Start a run
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Starting a run takes today&apos;s rider list for this bus and begins sharing your position
                  with the nursery.
                </span>
                {TRIP_LEGS.map((leg) => {
                  const done = legsDone.has(leg);
                  return (
                    <Button
                      key={leg}
                      size="lg"
                      variant={leg === 'am' ? 'primary' : 'secondary'}
                      disabled={!mayRun || done || starting !== null}
                      onClick={() => void start(leg)}
                      style={{ minHeight: 64 }}
                    >
                      {starting === leg
                        ? 'Starting…'
                        : done
                          ? TRIP_LEG_LABEL[leg] + ' run already done today'
                          : 'Start ' + TRIP_LEG_LABEL[leg].toLowerCase() + ' run'}
                    </Button>
                  );
                })}
              </div>
            </Card>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <Link to="/manifest" style={{ textDecoration: 'none' }}>
              <Card padding="md" style={{ minHeight: 96, height: '100%' }}>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <Icon name="users" size={24} />
                  <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                    Riders
                  </span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                    Board and drop off
                  </span>
                </div>
              </Card>
            </Link>
            <Link to="/gps" style={{ textDecoration: 'none' }}>
              <Card padding="md" style={{ minHeight: 96, height: '100%' }}>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <Icon name="satellite" size={24} />
                  <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                    Location
                  </span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                    {gps.tracking ? 'Sharing' : 'Not sharing'}
                  </span>
                </div>
              </Card>
            </Link>
            <Link to="/notifications" style={{ textDecoration: 'none' }}>
              <Card padding="md" style={{ minHeight: 96, height: '100%' }}>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <Icon name="bell" size={24} />
                  <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                    Updates
                  </span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                    {unread > 0 ? unread + ' unread' : 'Nothing new'}
                  </span>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </QueryState>
    </>
  );
}
