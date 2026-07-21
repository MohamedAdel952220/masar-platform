import { useRpcMutation, useTransportList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState } from '../components/States';
import { canRunTrip } from '../lib/driver';
import {
  CHILD_TRIP_STATUS_LABEL,
  LEG_PRIMARY_ACTION,
  TRIP_LEG_LABEL,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TONE,
  asChildTripStatus,
  asTripLeg,
  asTripStatus,
} from '../lib/enums';
import { formatDateTime, formatRelative } from '../lib/format';
import { useTripContext } from '../lib/tripContext';

/**
 * Active trip — the run in progress, and the control that ends it.
 *
 * `complete_trip` sets `status = 'completed'`, stamps `arrived_at`/`completed_at`
 * and refuses a trip that is already terminal (`STATE_ALREADY_PROCESSED`). Like
 * `start_trip` it is idempotent by construction — the `UPDATE ... WHERE status
 * NOT IN ('completed','cancelled')` cannot double-complete — so it is not on
 * the seven-RPC list and needs no special guarding.
 *
 * ══ COMPLETING WITH RIDERS OUTSTANDING ══
 *
 * The button does not *block* on outstanding riders, but it does not stay quiet
 * about them either. A driver who ends the afternoon run with three children
 * still marked "on board" has almost certainly forgotten to mark them dropped
 * off — or, far worse, has actually left them on the bus. The count is shown
 * prominently and the button label changes, but the decision stays with the
 * person who can see the vehicle. Hard-blocking would strand a driver whose
 * only way out is to falsify a record.
 *
 * Completing stops GPS: the tracker is bound to `activeTrip`, which this
 * mutation clears. `record_gps_ping` would reject pings on a completed trip
 * anyway, so the two agree.
 */

export function TripRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const mayRun = canRunTrip(claims);

  const { activeTrip, bus, gps, todaysTrips } = useTripContext();
  const [confirming, setConfirming] = useState(false);

  const childStatus = useTransportList(tenantId, 'trip_child_status', {
    orderBy: 'status_changed_at',
    limit: 200,
  });

  const leg = activeTrip ? asTripLeg(activeTrip.leg) : null;

  /** Riders on this trip who still need the leg's primary action. */
  const outstanding = useMemo(() => {
    if (!activeTrip || !leg) return 0;
    const target = LEG_PRIMARY_ACTION[leg];
    let count = 0;
    for (const row of childStatus.data?.items ?? []) {
      if (row.trip_id !== activeTrip.id) continue;
      const status = asChildTripStatus(row.status);
      if (!status || status === 'absent') continue;
      if (status !== target) count += 1;
    }
    return count;
  }, [childStatus.data, activeTrip, leg]);

  const onBoard = useMemo(() => {
    if (!activeTrip) return 0;
    let count = 0;
    for (const row of childStatus.data?.items ?? []) {
      if (row.trip_id !== activeTrip.id) continue;
      if (asChildTripStatus(row.status) === 'picked_up') count += 1;
    }
    return count;
  }, [childStatus.data, activeTrip]);

  const complete = useRpcMutation('complete_trip', {
    onSuccess: () => {
      setConfirming(false);
      void queryClient.invalidateQueries();
    },
  });

  if (!activeTrip) {
    const finished = todaysTrips.filter((t) => {
      const s = asTripStatus(t.status);
      return s === 'completed';
    });
    return (
      <>
        <PageHeader title="Trip" subtitle="No run is under way." />
        <EmptyState
          title="Nothing running right now"
          hint="Start a run from the Home tab. Your position is only shared while a run is active."
        />
        {finished.length > 0 ? (
          <div style={{ display: 'grid', gap: 'var(--space-2)', marginBlockStart: 'var(--space-5)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Finished today
            </span>
            {finished.map((trip) => {
              const tripLeg = asTripLeg(trip.leg);
              return (
                <Card key={trip.id} padding="md">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      style={{ flex: 1, fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}
                    >
                      {tripLeg ? TRIP_LEG_LABEL[tripLeg] : trip.leg} run
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      {formatRelative(trip.completed_at, locale)}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </>
    );
  }

  const status = asTripStatus(activeTrip.status);

  return (
    <>
      <PageHeader
        title={(leg ? TRIP_LEG_LABEL[leg] : activeTrip.leg) + ' run'}
        subtitle={bus ? 'Bus ' + bus.number : undefined}
        meta={
          <Badge tone={status ? TRIP_STATUS_TONE[status] : 'neutral'} dot>
            {status ? TRIP_STATUS_LABEL[status] : activeTrip.status}
          </Badge>
        }
      />

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <StatCard label="On board" value={onBoard} />
          <StatCard label="Still to do" value={outstanding} />
          <StatCard label="Positions sent" value={gps.sent} />
        </div>

        <Card padding="md">
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Started {formatDateTime(activeTrip.started_at, locale)}
            </span>
            <Link
              to="/manifest"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                color: 'var(--text-link)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                textDecoration: 'none',
              }}
            >
              Open the rider list →
            </Link>
          </div>
        </Card>

        {complete.error ? <ErrorState error={complete.error} onRetry={() => complete.reset()} /> : null}

        {outstanding > 0 ? (
          <Card padding="md" accent="var(--status-live)">
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                {outstanding} {outstanding === 1 ? 'rider is' : 'riders are'} still marked{' '}
                {leg
                  ? CHILD_TRIP_STATUS_LABEL[
                      LEG_PRIMARY_ACTION[leg] === 'picked_up' ? 'pending' : 'picked_up'
                    ].toLowerCase()
                  : 'unfinished'}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                Check the bus before you finish. You can still finish the run — this is a reminder, not a
                block.
              </span>
            </div>
          </Card>
        ) : null}

        {confirming ? (
          <Card padding="lg" accent="var(--primary)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                Finish this run?
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Your position stops being shared and the run is closed.
              </span>
              <Button
                size="lg"
                disabled={complete.isPending}
                onClick={() => complete.mutate({ p_trip_id: activeTrip.id })}
                style={{ minHeight: 56 }}
              >
                {complete.isPending ? 'Finishing…' : 'Yes, finish the run'}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                disabled={complete.isPending}
                onClick={() => setConfirming(false)}
                style={{ minHeight: 56 }}
              >
                Keep going
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            disabled={!mayRun}
            onClick={() => setConfirming(true)}
            style={{ minHeight: 64 }}
          >
            {outstanding > 0 ? 'Finish run (' + outstanding + ' outstanding)' : 'Finish run'}
          </Button>
        )}
      </div>
    </>
  );
}
