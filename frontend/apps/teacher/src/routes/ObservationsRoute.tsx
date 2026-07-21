import { realtime, useAcademicList, useRealtimeSubscription, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative, todayIso } from '../lib/format';

/**
 * Daily observations — what happened in the room today.
 *
 * Two RLS-scoped streams, both classroom-bound for a teacher:
 *   `academic.day_path_events` — each child's movement through the day
 *   `academic.concerns`        — raised concerns (§12: teacher "C, R own")
 *
 * LIVE via `classroom:{id}:day_path`, the narrowest filter available.
 *
 * Raising a concern is a teacher capability (§12 "C"), but the deployed RPC
 * catalogue contains no `raise_concern` function — concerns are created through
 * flows this app does not own yet. Rather than write directly to the table and
 * bypass the "RPC for writes" model the architecture settled on, this screen
 * reads; creation is recorded as a follow-up.
 */

type DayEvent = AcademicRow<'day_path_events'>;
type Concern = AcademicRow<'concerns'>;

function priorityTone(priority: string): 'info' | 'amber' | 'danger' | 'neutral' {
  if (priority === 'urgent') return 'danger';
  if (priority === 'attention') return 'amber';
  if (priority === 'info') return 'info';
  return 'neutral';
}

export function ObservationsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const today = todayIso();

  const classrooms = useAcademicList(tenantId, 'classrooms', { orderBy: 'name', ascending: true, limit: 50 });
  const events = useAcademicList(tenantId, 'day_path_events', { orderBy: 'occurred_at', limit: 200 });
  const concerns = useAcademicList(tenantId, 'concerns', { orderBy: 'created_at', limit: 60 });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });

  const room = useMemo(
    () => (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null)[0] ?? null,
    [classrooms.data],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);
  useRealtimeSubscription(room ? realtime.classroomDayPath(room.id) : null, invalidate, Boolean(room));

  const childNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const child of children.data?.items ?? []) map.set(child.id, child.name);
    return map;
  }, [children.data]);

  const todayEvents = useMemo(
    () => (events.data?.items ?? []).filter((e) => (e.occurred_at ?? '').slice(0, 10) === today),
    [events.data, today],
  );
  const concernRows = useMemo(() => concerns.data?.items ?? [], [concerns.data]);
  const openConcerns = useMemo(() => concernRows.filter((c) => c.status !== 'resolved'), [concernRows]);

  return (
    <>
      <PageHeader
        title="Observations"
        subtitle="Today in your classroom."
        meta={
          <Badge tone="teal" dot>
            Live
          </Badge>
        }
      />

      {openConcerns.length > 0 ? (
        <div style={{ display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: 'var(--tracking-caps)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Open concerns
          </span>
          {openConcerns.map((concern: Concern) => (
            <Card key={concern.id} padding="md" accent="var(--amber-500)">
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span
                    style={{ flex: 1, fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}
                  >
                    {childNames.get(concern.child_id) ?? concern.child_id.slice(0, 8)}
                  </span>
                  <Badge tone={priorityTone(concern.priority)} dot>
                    {concern.priority}
                  </Badge>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                  {concern.message}
                </span>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                  {formatRelative(concern.created_at, locale)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <span
        style={{
          display: 'block',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Today
      </span>

      <QueryState
        isLoading={events.isLoading}
        error={events.error}
        isEmpty={todayEvents.length === 0}
        emptyTitle="Nothing recorded yet today"
        emptyHint="Events appear here as children move through the day."
        onRetry={() => void events.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {todayEvents.map((event: DayEvent) => (
            <Card key={event.id} padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>
                  {childNames.get(event.child_id) ?? event.child_id.slice(0, 8)}
                </span>
                <Badge tone="teal">{event.status}</Badge>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                  {formatRelative(event.occurred_at, locale)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </>
  );
}
