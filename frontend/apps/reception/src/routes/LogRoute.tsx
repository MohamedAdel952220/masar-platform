import { usePlatformList, type PlatformRow } from '@masar/api-client';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatDateTime, todayIso } from '../lib/format';

/**
 * Daily log — `platform.activity_log`, the tenant-scoped operational feed
 * (§3.52). §12 gives reception `R, C (system-generated)` on it: the desk reads
 * the feed, and its own actions write to it through the RPCs, never directly.
 *
 * NOTHING ON THIS SCREEN WRITES. Every row here was produced server-side by a
 * `write_audit_log`/activity call inside an RPC. `write_audit_log` is on the
 * CLIENT-FORBIDDEN list precisely so a client cannot forge an entry, and this
 * app does not call it.
 *
 * Today is the default view because that is what a shift needs; the toggle
 * widens to everything the feed still holds.
 */

type Entry = PlatformRow<'activity_log'>;

/**
 * Action strings are backend-authored (`pickup_pass_scanned`,
 * `pickup_handover_confirmed`, …). They are rendered readably where recognised
 * and passed through untouched otherwise — inventing a label for an unknown
 * action would misrepresent it, and the raw string is at least honest.
 */
const ACTION_LABEL: Record<string, string> = {
  pickup_pass_scanned: 'Pickup pass scanned',
  pickup_handover_confirmed: 'Handover confirmed',
  pickup_pass_created: 'Pickup pass issued',
  pickup_pass_revoked: 'Pickup pass revoked',
  child_trip_status_updated: 'Bus status updated',
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, ' ');
}

function actorTone(actorType: string): 'teal' | 'info' | 'neutral' {
  if (actorType === 'staff') return 'teal';
  if (actorType === 'system') return 'neutral';
  return 'info';
}

export function LogRoute() {
  const { locale } = useLocale();
  const today = todayIso();

  const [todayOnly, setTodayOnly] = useState(true);

  // usePlatformList takes no tenant argument — the platform schema is scoped by
  // RLS rather than by an explicit filter, and activity_log is tenant-scoped there.
  const log = usePlatformList('activity_log', { orderBy: 'occurred_at', limit: 200 });

  const rows = useMemo(() => {
    const all = log.data?.items ?? [];
    return todayOnly ? all.filter((e) => e.occurred_at.slice(0, 10) === today) : all;
  }, [log.data, todayOnly, today]);

  return (
    <>
      <PageHeader
        title="Daily log"
        subtitle="What has happened across the nursery."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => setTodayOnly(true)}
              aria-pressed={todayOnly}
              style={{
                minHeight: 44,
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid ' + (todayOnly ? 'var(--primary)' : 'var(--border-subtle)'),
                background: todayOnly ? 'var(--teal-50)' : 'var(--surface-card)',
                color: todayOnly ? 'var(--primary)' : 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setTodayOnly(false)}
              aria-pressed={!todayOnly}
              style={{
                minHeight: 44,
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid ' + (!todayOnly ? 'var(--primary)' : 'var(--border-subtle)'),
                background: !todayOnly ? 'var(--teal-50)' : 'var(--surface-card)',
                color: !todayOnly ? 'var(--primary)' : 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
              }}
            >
              All
            </button>
          </div>
        }
      />

      <QueryState
        isLoading={log.isLoading}
        error={log.error}
        isEmpty={rows.length === 0}
        emptyTitle={todayOnly ? 'Nothing logged today yet' : 'The log is empty'}
        emptyHint="Entries are written automatically as staff act in the system."
        onRetry={() => void log.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {rows.map((entry: Entry) => (
            <Card key={entry.id} padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                    {actionLabel(entry.action)}
                  </span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                    {entry.target_type} · {formatDateTime(entry.occurred_at, locale)}
                  </span>
                </div>
                <Badge tone={actorTone(entry.actor_type)} dot>
                  {entry.actor_type}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </>
  );
}
