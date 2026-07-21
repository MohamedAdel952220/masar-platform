import { useTransportList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { useDriverChildIndex } from '../lib/useDriverChildren';
import { useTripContext } from '../lib/tripContext';

/**
 * Assigned bus — the vehicle and its standing roster.
 *
 * ══ ONE BUS, BECAUSE RLS SAYS SO ══
 *
 * `transport.buses` is queried without any driver filter. RLS narrows it to
 * `current_driver_bus_ids()`, so a driver sees their own vehicle and no other.
 * If this app ever displayed a second bus, that would be a policy defect to fix
 * in the database — not something to paper over with a client-side `.filter()`,
 * which would hide the bug while leaving the data on the wire.
 *
 * The roster below is `bus_riders`, the STANDING assignment. It is not the same
 * as a trip manifest: `start_trip` snapshots this list into `trip_stop_riders`
 * at the moment a run begins, and the run works from that snapshot. A child
 * added here mid-run does not join the run already under way. Both views exist
 * because both questions get asked — "who rides my bus" and "who is on this
 * trip" — and conflating them is how a child gets missed.
 *
 * Child records come from the gated `children_driver_safe()` function: name and
 * address, nothing medical, nothing financial, no parent contact details.
 */

export function BusRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { bus, isLoading, error, refetch } = useTripContext();

  const riders = useTransportList(tenantId, 'bus_riders', { orderBy: 'created_at', limit: 200 });
  const children = useDriverChildIndex(tenantId);

  const roster = useMemo(() => {
    if (!bus) return [];
    return (riders.data?.items ?? [])
      .filter((r) => r.bus_id === bus.id && r.active)
      .map((r) => ({ rider: r, child: children.byId.get(r.child_id) ?? null }));
  }, [riders.data, bus, children.byId]);

  return (
    <>
      <PageHeader title="My bus" subtitle="Your vehicle and the children assigned to it." />

      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={!bus}
        emptyTitle="No bus assigned to you"
        emptyHint="The nursery office assigns buses. Contact them if this looks wrong."
        onRetry={refetch}
      >
        {bus ? (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <Card padding="lg">
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <span
                  style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--weight-extra)',
                    color: 'var(--text-strong)',
                  }}
                >
                  Bus {bus.number}
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Badge tone="neutral">{bus.plate}</Badge>
                  {bus.service_area ? <Badge tone="info">{bus.service_area}</Badge> : null}
                </div>
              </div>
            </Card>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              <StatCard label="Riders assigned" value={roster.length} />
              <StatCard label="Seats" value={bus.capacity} />
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-bold)',
                    letterSpacing: 'var(--tracking-caps)',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  Standing roster
                </span>
                <Badge tone="neutral">Not this run</Badge>
              </div>

              <QueryState
                isLoading={riders.isLoading || children.isLoading}
                error={riders.error ?? children.error}
                isEmpty={roster.length === 0}
                emptyTitle="No children assigned to this bus"
                emptyHint="The office manages which children ride which bus."
                onRetry={() => void riders.refetch()}
              >
                {roster.map(({ rider, child }) => (
                  <Card key={rider.id} padding="md">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <Avatar name={child?.name ?? '?'} size={40} />
                      <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                          {child ? (locale === 'ar' && child.name_ar ? child.name_ar : child.name) : 'Rider'}
                        </span>
                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                          {rider.pickup_address_override ?? child?.address_line ?? 'No address on file'}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </QueryState>
            </div>
          </div>
        ) : null}
      </QueryState>
    </>
  );
}
