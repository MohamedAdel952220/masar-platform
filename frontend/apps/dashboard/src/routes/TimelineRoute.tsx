import { realtime, useAcademicList, useRealtimeSubscription, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, DayPath, StatusPill } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative } from '../lib/format';

/**
 * Daily Timeline — `academic.day_path_events`, the live day-path per child.
 *
 * This is the one page that uses the design system's signature DayPath
 * component for what it was built for: each child's progression through the
 * day, completed steps solid, the current step live.
 *
 * Live via `classroom:{id}:day_path` — one subscription per selected classroom,
 * the narrowest filter available (§15), torn down when the selection changes.
 */

type DayPathEvent = AcademicRow<'day_path_events'>;

/** The canonical day-path order, matching the StatusPill vocabulary. */
const STEP_ORDER = [
  'at-home',
  'in-bus',
  'arrived',
  'classroom',
  'playing',
  'nap',
  'left',
  'delivered',
] as const;
type Step = (typeof STEP_ORDER)[number];

const STEP_LABEL: Record<Step, string> = {
  'at-home': 'At home',
  'in-bus': 'In bus',
  arrived: 'Arrived',
  classroom: 'Classroom',
  playing: 'Playing',
  nap: 'Nap',
  left: 'Left',
  delivered: 'Delivered',
};

function isStep(value: string): value is Step {
  return (STEP_ORDER as readonly string[]).includes(value);
}

export function TimelineRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const [classroomId, setClassroomId] = useState<string | null>(null);

  const classrooms = useAcademicList(tenantId, 'classrooms', {
    orderBy: 'name',
    ascending: true,
    limit: 200,
  });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'created_at', limit: 500 });
  const events = useAcademicList(tenantId, 'day_path_events', { orderBy: 'occurred_at', limit: 500 });

  const rooms = useMemo(
    () => (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null),
    [classrooms.data],
  );
  const activeRoom = classroomId ?? rooms[0]?.id ?? null;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useRealtimeSubscription(
    activeRoom ? realtime.classroomDayPath(activeRoom) : null,
    invalidate,
    Boolean(activeRoom),
  );

  const roomChildren = useMemo(
    () => (children.data?.items ?? []).filter((c) => c.deleted_at === null && c.classroom_id === activeRoom),
    [children.data, activeRoom],
  );

  /** Latest event per child, from the RLS-scoped event stream. */
  const latestByChild = useMemo(() => {
    const map = new Map<string, DayPathEvent>();
    for (const event of events.data?.items ?? []) {
      const existing = map.get(event.child_id);
      if (!existing || event.occurred_at > existing.occurred_at) map.set(event.child_id, event);
    }
    return map;
  }, [events.data]);

  return (
    <>
      <PageHeader
        title="Daily Timeline"
        subtitle="Each child's progression through the day. Updates arrive live as events are recorded."
        meta={
          <Badge tone="teal" dot>
            Live
          </Badge>
        }
      />

      {rooms.length > 0 ? (
        <div
          style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}
        >
          {rooms.map((room) => {
            const active = room.id === activeRoom;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setClassroomId(room.id)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-subtle)'),
                  background: active ? 'var(--teal-50)' : 'var(--surface-card)',
                  color: active ? 'var(--primary)' : 'var(--text-body)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)',
                  cursor: 'pointer',
                }}
              >
                {room.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <QueryState
        isLoading={children.isLoading || classrooms.isLoading}
        error={children.error ?? classrooms.error}
        isEmpty={roomChildren.length === 0}
        emptyTitle="No children in this classroom"
        emptyHint="Children assigned to the selected classroom appear here."
        onRetry={() => void children.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {roomChildren.map((child) => {
            const latest = latestByChild.get(child.id);
            const currentStatus = latest?.status ?? child.day_path_status;
            const currentIndex = isStep(currentStatus) ? STEP_ORDER.indexOf(currentStatus) : -1;

            const steps = STEP_ORDER.map((step, index) => ({
              label: STEP_LABEL[step],
              state: (index < currentIndex ? 'done' : index === currentIndex ? 'live' : 'pending') as
                | 'done'
                | 'live'
                | 'pending',
            }));

            return (
              <Card key={child.id} padding="lg">
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                      {child.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      {isStep(currentStatus) ? (
                        <StatusPill status={currentStatus} lang={locale} size="sm" />
                      ) : null}
                      {latest ? (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                          {formatRelative(latest.occurred_at, locale)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <DayPath steps={steps} showTime={false} />
                </div>
              </Card>
            );
          })}
        </div>
      </QueryState>
    </>
  );
}
