import { realtime, useAcademicList, useRealtimeSubscription } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Card, DayPath, type DayPathStep } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { DAY_PATH_SEQUENCE, dayPathLabel } from '../lib/dayPath';
import { formatDateTime, todayIso } from '../lib/format';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Day Path — the child's day as a vertical timeline.
 *
 * Two things are rendered from the same data:
 *  - the signature `DayPath` component, showing the whole day including steps
 *    that have not happened yet, so a parent can see what is still to come;
 *  - the literal event log, which is the authoritative record.
 *
 * §12 gives a guardian read on their own child's day-path history. Only today's
 * events are shown by default — a timeline is a "what is happening now"
 * surface, and older days are noise on a phone.
 *
 * Realtime: `classroom:{id}:day_path` (§15). The filter is by classroom because
 * that is the channel the architecture defines; RLS still limits the rows the
 * subsequent refetch returns to this guardian's own child.
 */

export function DayPathRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const { selected, isLoading: childLoading } = useSelectedChild();

  const events = useAcademicList(tenantId, 'day_path_events', {
    orderBy: 'occurred_at',
    limit: 100,
  });

  const onChange = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);
  useRealtimeSubscription(
    selected ? realtime.classroomDayPath(selected.classroom_id) : null,
    onChange,
    Boolean(selected),
  );

  const today = todayIso();
  const todays = useMemo(() => {
    const rows = events.data?.items ?? [];
    return rows
      .filter((e) => selected && e.child_id === selected.id && e.occurred_at.slice(0, 10) === today)
      .slice()
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  }, [events.data, selected, today]);

  const steps = useMemo<DayPathStep[]>(() => {
    const reachedAt = new Map<string, string>();
    for (const e of todays) if (!reachedAt.has(e.status)) reachedAt.set(e.status, e.occurred_at);
    const current = todays.length > 0 ? todays[todays.length - 1]?.status : undefined;

    return DAY_PATH_SEQUENCE.map((status) => {
      const at = reachedAt.get(status);
      return {
        label: dayPathLabel(status),
        state: status === current ? 'live' : at ? 'done' : 'pending',
        ...(at ? { time: formatDateTime(at, locale).split(', ').pop() ?? '' } : {}),
      };
    });
  }, [todays, locale]);

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={selected ? selected.name + "'s day, step by step." : 'The day, step by step.'}
      />

      <QueryState
        isLoading={childLoading || events.isLoading}
        error={events.error}
        isEmpty={!selected}
        emptyTitle="No child selected"
        onRetry={() => void events.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Card padding="lg">
            <DayPath steps={steps} orientation="vertical" />
          </Card>

          {todays.length === 0 ? (
            <Card padding="lg">
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Nothing recorded yet today. Steps appear here as they happen.
              </span>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-bold)',
                  letterSpacing: 'var(--tracking-caps)',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                Recorded
              </span>
              {todays
                .slice()
                .reverse()
                .map((e) => (
                  <Card key={e.id} padding="sm">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--weight-semibold)',
                          color: 'var(--text-strong)',
                        }}
                      >
                        {dayPathLabel(e.status)}
                      </span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                        {formatDateTime(e.occurred_at, locale)}
                      </span>
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
