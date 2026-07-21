import { useTransportList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, DayPath, type DayPathStep } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, QueryState } from '../components/States';
import { TRIP_LEG_LABEL, asTripLeg } from '../lib/enums';
import { formatDateTime } from '../lib/format';
import { useDriverChildIndex } from '../lib/useDriverChildren';
import { useTripContext } from '../lib/tripContext';

/**
 * Route status — the stops on this run, in order, with which riders belong to
 * each.
 *
 * `start_trip` builds `trip_stops` from each active rider's home address, one
 * stop per child, ordered by when they were added to the bus. There is **no
 * routing engine in v1** (EPIC_3 known limitations) — the sequence is roster
 * order, not an optimised path. The screen says so, because a driver who
 * assumes this is an optimised route will drive it in the wrong order and lose
 * time blaming the app.
 *
 * `reached_at` is the only per-stop state, and nothing in this app writes it:
 * no `mark_stop_reached` RPC is deployed. The column is displayed where the
 * backend has populated it and is otherwise blank. Inventing a write path — or
 * worse, faking progress from GPS proximity — is exactly the kind of
 * client-side invention the architecture forbids.
 *
 * No map is drawn. A tile provider is not in this phase's dependency set, and a
 * fabricated map on a driver's screen would be worse than an honest list.
 */

export function RouteRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { activeTrip, todaysTrips } = useTripContext();

  const trip = activeTrip ?? todaysTrips[0] ?? null;
  const leg = trip ? asTripLeg(trip.leg) : null;

  const stops = useTransportList(tenantId, 'trip_stops', {
    orderBy: 'sequence',
    ascending: true,
    limit: 200,
  });
  const stopRiders = useTransportList(tenantId, 'trip_stop_riders', { orderBy: 'trip_stop_id', limit: 300 });
  const children = useDriverChildIndex(tenantId);

  const rows = useMemo(() => {
    if (!trip) return [];
    const mine = (stops.data?.items ?? []).filter((s) => s.trip_id === trip.id);
    const ridersByStop = new Map<string, string[]>();
    for (const link of stopRiders.data?.items ?? []) {
      if (link.trip_id !== trip.id) continue;
      const list = ridersByStop.get(link.trip_stop_id) ?? [];
      const child = children.byId.get(link.child_id);
      list.push(child ? (locale === 'ar' && child.name_ar ? child.name_ar : child.name) : 'Rider');
      ridersByStop.set(link.trip_stop_id, list);
    }
    return mine.map((stop) => ({ stop, riders: ridersByStop.get(stop.id) ?? [] }));
  }, [stops.data, stopRiders.data, trip, children.byId, locale]);

  const steps = useMemo<DayPathStep[]>(() => {
    const firstPending = rows.findIndex((r) => r.stop.reached_at === null);
    return rows.map((r, i) => ({
      label: r.stop.label ?? 'Stop ' + (r.stop.sequence + 1),
      state: r.stop.reached_at !== null ? 'done' : i === firstPending ? 'live' : 'pending',
      ...(r.stop.reached_at
        ? { time: formatDateTime(r.stop.reached_at, locale).split(', ').pop() ?? '' }
        : {}),
    }));
  }, [rows, locale]);

  if (!trip || !leg) {
    return (
      <>
        <PageHeader title="Route" />
        <EmptyState
          title="No route yet"
          hint="Stops are created when you start a run. Start one from the Home tab."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Route"
        subtitle={TRIP_LEG_LABEL[leg] + ' run · one stop per rider'}
        meta={<Badge tone="neutral">Roster order — not an optimised route</Badge>}
      />

      <QueryState
        isLoading={stops.isLoading || children.isLoading}
        error={stops.error}
        isEmpty={rows.length === 0}
        emptyTitle="No stops on this run"
        emptyHint="Stops come from each rider's home address when the run starts."
        onRetry={() => void stops.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {steps.length > 0 ? (
            <Card padding="lg">
              <DayPath steps={steps} orientation="vertical" />
            </Card>
          ) : null}

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {rows.map(({ stop, riders }) => (
              <Card key={stop.id} padding="md">
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        flex: 'none',
                        borderRadius: 'var(--radius-pill)',
                        background: stop.reached_at ? 'var(--teal-50)' : 'var(--surface-sunken, #f2f2f0)',
                        color: stop.reached_at ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: 'var(--weight-bold)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      {stop.sequence + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {stop.label ?? 'Stop ' + (stop.sequence + 1)}
                    </span>
                    {stop.reached_at ? (
                      <Badge tone="success" dot>
                        Reached
                      </Badge>
                    ) : null}
                  </div>
                  {riders.length > 0 ? (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {riders.join(' · ')}
                    </span>
                  ) : null}
                  {stop.reached_at ? (
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      {formatDateTime(stop.reached_at, locale)}
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </QueryState>
    </>
  );
}
