import { useTransportList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card } from '@masar/design-system';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { RiderCard } from '../components/RiderCard';
import { EmptyState, ErrorState, QueryState } from '../components/States';
import {
  CHILD_TRIP_STATUS_LABEL,
  LEG_PRIMARY_ACTION,
  TRIP_LEG_LABEL,
  asChildTripStatus,
  asTripLeg,
  type ChildTripStatus,
} from '../lib/enums';
import { useChildStatusUpdate } from '../lib/useChildStatus';
import { useDriverChildIndex } from '../lib/useDriverChildren';
import { useTripContext } from '../lib/tripContext';

/**
 * Rider manifest — boarding, drop-off and per-child status in one screen.
 *
 * ══ THE MANIFEST IS WHAT THE BACKEND RETURNS ══
 *
 * Rows come from `transport.trip_child_status` filtered to the active trip.
 * That filter is a JOIN KEY, not a security control: RLS already limits these
 * rows to trips on buses this driver drives (`current_driver_bus_ids()`), and
 * the child records come from the gated `children_driver_safe()` function.
 *
 * No client-side tenant filter, no client-side driver filter, no "is this my
 * bus" check. Re-implementing any of those here would duplicate the
 * authorization boundary somewhere it can drift out of agreement with the
 * policy — and a client-side filter that *disagrees* with RLS is worse than no
 * filter, because it looks like security while enforcing nothing.
 *
 * ══ BOARDING vs DROP-OFF ══
 *
 * These are the same screen. Which action the cards offer is derived from the
 * trip's leg — morning boards, afternoon drops off — via `LEG_PRIMARY_ACTION`
 * in `lib/enums.ts`. Two separate routes would mean a driver could open the
 * wrong one and mark a child "picked up" on the way home.
 *
 * ══ OUTSTANDING FIRST ══
 *
 * Riders needing action sort above those already handled. On a bus at a stop
 * the useful question is "who is still to do", and making the driver scroll
 * past twenty completed rows to find them is how children get missed.
 */

export function ManifestRoute() {
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { activeTrip, todaysTrips } = useTripContext();

  const [showDone, setShowDone] = useState(false);

  /**
   * When no trip is running, show the most recent trip's manifest read-only.
   * A driver who has just finished still needs to check what was recorded.
   */
  const trip = activeTrip ?? todaysTrips[0] ?? null;
  const readOnly = activeTrip === null;
  const leg = trip ? asTripLeg(trip.leg) : null;

  const childStatus = useTransportList(tenantId, 'trip_child_status', {
    orderBy: 'status_changed_at',
    limit: 200,
  });
  const children = useDriverChildIndex(tenantId);
  const updater = useChildStatusUpdate();

  const riders = useMemo(() => {
    if (!trip) return [];
    const rows = (childStatus.data?.items ?? []).filter((r) => r.trip_id === trip.id);
    return rows.map((row) => ({
      row,
      status: asChildTripStatus(row.status),
      child: children.byId.get(row.child_id) ?? null,
    }));
  }, [childStatus.data, trip, children.byId]);

  const { outstanding, done } = useMemo(() => {
    if (!leg) return { outstanding: [], done: [] };
    const target = LEG_PRIMARY_ACTION[leg];
    const a: typeof riders = [];
    const b: typeof riders = [];
    for (const r of riders) {
      if (r.status === null || r.status === 'absent' || r.status === target) b.push(r);
      else a.push(r);
    }
    return { outstanding: a, done: b };
  }, [riders, leg]);

  const handleUpdate = (childId: string, next: ChildTripStatus) => {
    if (!trip) return;
    updater.update(trip.id, childId, next);
  };

  if (!trip || !leg) {
    return (
      <>
        <PageHeader title="Riders" />
        <EmptyState
          title="No rider list yet"
          hint="The rider list is created when you start a run. Start one from the Home tab."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Riders"
        subtitle={
          readOnly
            ? TRIP_LEG_LABEL[leg] + ' run — finished, view only'
            : leg === 'am'
              ? 'Tap a child as they board.'
              : 'Tap a child as they get off.'
        }
        meta={
          <span style={{ display: 'inline-flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge tone={outstanding.length > 0 ? 'amber' : 'success'} dot>
              {outstanding.length > 0 ? outstanding.length + ' to do' : 'All done'}
            </Badge>
            <Badge tone="neutral">
              {riders.length} {riders.length === 1 ? 'rider' : 'riders'}
            </Badge>
          </span>
        }
      />

      {updater.error ? (
        <div style={{ marginBlockEnd: 'var(--space-4)' }}>
          <ErrorState error={updater.error} />
          <Card padding="md" accent="var(--status-live)" style={{ marginBlockStart: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                That change did not save, and it may still have reached the office. Refresh before trying
                again so you are acting on what the system actually recorded.
              </span>
              <Button size="lg" variant="secondary" onClick={updater.reset} style={{ minHeight: 56 }}>
                Refresh and unlock
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <QueryState
        isLoading={childStatus.isLoading || children.isLoading}
        error={childStatus.error ?? children.error}
        isEmpty={riders.length === 0}
        emptyTitle="No riders on this run"
        emptyHint="The rider list is a snapshot taken when the run started."
        onRetry={() => void childStatus.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {outstanding.map(({ row, status, child }) => (
            <RiderCard
              key={row.id}
              child={child}
              childId={row.child_id}
              status={status ?? 'pending'}
              leg={leg}
              disabled={readOnly}
              locked={updater.lockedChildIds.has(row.child_id)}
              failed={updater.failedChildIds.has(row.child_id)}
              onUpdate={handleUpdate}
            />
          ))}

          {done.length > 0 ? (
            <>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setShowDone((v) => !v)}
                style={{ minHeight: 56 }}
              >
                {showDone ? 'Hide' : 'Show'} {done.length} already handled
              </Button>
              {showDone
                ? done.map(({ row, status, child }) => (
                    <RiderCard
                      key={row.id}
                      child={child}
                      childId={row.child_id}
                      status={status ?? 'pending'}
                      leg={leg}
                      disabled={readOnly}
                      locked={updater.lockedChildIds.has(row.child_id)}
                      failed={updater.failedChildIds.has(row.child_id)}
                      onUpdate={handleUpdate}
                    />
                  ))
                : null}
            </>
          ) : null}

          {riders.some((r) => r.status === null) ? (
            <Card padding="sm">
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                Some riders have a status this app does not recognise and are shown as{' '}
                {CHILD_TRIP_STATUS_LABEL.pending.toLowerCase()}. Report this to the office.
              </span>
            </Card>
          ) : null}
        </div>
      </QueryState>
    </>
  );
}
