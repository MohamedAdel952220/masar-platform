import { useSafetyList, type SafetyRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatDateTime, todayIso } from '../lib/format';
import type { ScanResult } from '../lib/reception';

/**
 * Today's visitors.
 *
 * ══ WHAT THIS SCREEN IS BUILT FROM, AND WHY ══
 *
 * There is no `visitors` table in the deployed schema. Rather than invent one
 * or fabricate a data source, this screen is built from what actually records a
 * person arriving at this desk: `safety.pickup_scan_events` for today.
 *
 * That is not a workaround — it is the more truthful source. A "visitor" to
 * reception, in this system, is precisely someone who presented a pickup code.
 * Every attempt is recorded, valid or not (§3.32), so this list is also the
 * record of who was turned away, which is exactly what a front desk needs at
 * the end of a shift.
 *
 * What it deliberately CANNOT show: the collector's name. That lives on
 * `pickup_passes`, which this app never lists (§13.4 two-layer control — see
 * `lib/reception.ts`). A name is resolvable at scan time, when the desk is
 * holding the token; it is not resolvable retrospectively by browsing. Losing
 * the name here is the intended cost of not being able to enumerate passes,
 * and it is a cost worth paying.
 */

type ScanEvent = SafetyRow<'pickup_scan_events'>;

function resultTone(result: string): 'success' | 'amber' | 'neutral' {
  if (result === 'valid') return 'success';
  return 'amber';
}

const RESULT_LABEL: Record<ScanResult, string> = {
  valid: 'Valid',
  invalid_expired: 'Expired',
  invalid_revoked: 'Revoked',
  invalid_unknown: 'Not recognised',
};

function resultLabel(result: string): string {
  return RESULT_LABEL[result as ScanResult] ?? result;
}

export function VisitorsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const today = todayIso();

  const events = useSafetyList(tenantId, 'pickup_scan_events', { orderBy: 'scanned_at', limit: 200 });

  const todays = useMemo(
    () => (events.data?.items ?? []).filter((e) => e.scanned_at.slice(0, 10) === today),
    [events.data, today],
  );

  const stats = useMemo(() => {
    let handedOver = 0;
    let refused = 0;
    for (const e of todays) {
      if (e.handover_confirmed) handedOver += 1;
      if (e.result !== 'valid') refused += 1;
    }
    return { total: todays.length, handedOver, refused };
  }, [todays]);

  return (
    <>
      <PageHeader
        title="Today"
        subtitle="Everyone who presented a pickup code at this desk today."
        meta={
          stats.refused > 0 ? (
            <Badge tone="amber" dot>
              {stats.refused} turned away
            </Badge>
          ) : null
        }
      />

      <QueryState
        isLoading={events.isLoading}
        error={events.error}
        isEmpty={false}
        emptyTitle="No scans yet"
        onRetry={() => void events.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <StatCard label="Scans" value={stats.total} />
            <StatCard label="Handed over" value={stats.handedOver} />
            <StatCard label="Turned away" value={stats.refused} />
          </div>

          {todays.length === 0 ? (
            <Card padding="lg">
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                No pickup codes have been scanned today. Scans appear here as they happen.
              </span>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {todays.map((event: ScanEvent) => (
                <Card key={event.id} padding="md">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 'var(--weight-semibold)',
                          color: 'var(--text-strong)',
                        }}
                      >
                        {event.handover_confirmed ? 'Handed over' : resultLabel(event.result)}
                      </span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                        {formatDateTime(event.scanned_at, locale)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <Badge tone={resultTone(event.result)} dot>
                        {resultLabel(event.result)}
                      </Badge>
                      {event.result === 'valid' && !event.handover_confirmed ? (
                        <Badge tone="info">Not completed</Badge>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </QueryState>
    </>
  );
}
