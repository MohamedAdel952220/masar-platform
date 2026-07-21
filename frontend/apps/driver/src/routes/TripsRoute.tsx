import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { TRIP_LEG_LABEL, TRIP_STATUS_LABEL, TRIP_STATUS_TONE, asTripLeg, asTripStatus } from '../lib/enums';
import { formatDateTime } from '../lib/format';
import { useTripContext } from '../lib/tripContext';

/**
 * Today's trips.
 *
 * TODAY ONLY, and that is a scope decision rather than a filter convenience:
 * §12 gives a driver `RU (own trip, own bus)`. A driver has no operational need
 * for last month's runs, and a screen that quietly accumulated months of
 * movement history would turn this app into a personal-tracking archive for
 * whoever picks up the phone. The backend returns what RLS permits; this screen
 * narrows to the working day on purpose.
 *
 * The list comes from the shared trip context — no second query, no second
 * subscription.
 */

export function TripsRoute() {
  const { locale } = useLocale();
  const { todaysTrips, isLoading, error, refetch, bus } = useTripContext();

  return (
    <>
      <PageHeader
        title="Today's runs"
        subtitle={bus ? 'Bus ' + bus.number : undefined}
        meta={<Badge tone="neutral">Today only</Badge>}
      />

      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={todaysTrips.length === 0}
        emptyTitle="No runs today"
        emptyHint="Runs appear here once you start one."
        onRetry={refetch}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {todaysTrips.map((trip) => {
            const status = asTripStatus(trip.status);
            const leg = asTripLeg(trip.leg);
            return (
              <Card key={trip.id} padding="md">
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--weight-bold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {leg ? TRIP_LEG_LABEL[leg] : trip.leg} run
                    </span>
                    <Badge tone={status ? TRIP_STATUS_TONE[status] : 'neutral'} dot>
                      {status ? TRIP_STATUS_LABEL[status] : trip.status}
                    </Badge>
                  </div>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                    {trip.started_at ? 'Started ' + formatDateTime(trip.started_at, locale) : 'Not started'}
                    {trip.completed_at ? ' · finished ' + formatDateTime(trip.completed_at, locale) : ''}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </QueryState>
    </>
  );
}
