import { useAcademicList, useCommsList, useRealtimeSubscription, realtime } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, Icon, StatusPill } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, QueryState } from '../components/States';
import { formatRelative } from '../lib/format';
import { dayPathLabel, toChildStatus } from '../lib/dayPath';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Parent home — "where is my child right now, and is there anything I need to
 * do?" Everything else in this app is one tap from here.
 *
 * The day-state is realtime (§15 `classroom:{id}:day_path`) because a parent
 * watching the screen at pickup time should not have to pull to refresh.
 * Notifications are realtime for the same reason.
 */

interface Shortcut {
  to: string;
  icon: string;
  label: string;
  hint: string;
}

const SHORTCUTS: Shortcut[] = [
  { to: '/day', icon: 'route', label: "Today's timeline", hint: 'Every step of the day' },
  { to: '/trip', icon: 'bus', label: 'Bus', hint: 'Live during the trip' },
  { to: '/attendance', icon: 'calendar-check', label: 'Attendance', hint: 'Days present' },
  { to: '/progress', icon: 'sparkles', label: 'Progress', hint: 'Lessons and evaluations' },
  { to: '/reports', icon: 'file-text', label: 'Reports', hint: 'Sent by the nursery' },
  { to: '/billing', icon: 'receipt', label: 'Fees', hint: 'Invoices and payments' },
];

export function HomeRoute() {
  const { locale } = useLocale();
  const { claims, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  // `MasarClaims` carries no user id. The identity tables are keyed by
  // `auth.users.id` (Epic 1), which is exactly `session.user.id`.
  const userId = session?.user.id ?? '';

  const { selected, isLoading, error, refetch } = useSelectedChild();

  const events = useAcademicList(tenantId, 'day_path_events', {
    orderBy: 'occurred_at',
    limit: 20,
  });
  const notifications = useCommsList(tenantId, 'notifications', { orderBy: 'created_at', limit: 5 });

  const onChange = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);

  useRealtimeSubscription(
    selected ? realtime.classroomDayPath(selected.classroom_id) : null,
    onChange,
    Boolean(selected),
  );
  useRealtimeSubscription(userId ? realtime.userNotifications(userId) : null, onChange, Boolean(userId));

  const eventRows = useMemo(() => events.data?.items ?? [], [events.data]);
  const latest = useMemo(
    () => (selected ? eventRows.find((e) => e.child_id === selected.id) : undefined),
    [eventRows, selected],
  );
  const unread = useMemo(
    () => (notifications.data?.items ?? []).filter((n) => n.read_at === null),
    [notifications.data],
  );

  return (
    <>
      <PageHeader
        title={selected ? (selected.name.split(' ')[0] ?? selected.name) : 'Home'}
        subtitle={selected ? 'Today at a glance.' : undefined}
      />

      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={!selected}
        emptyTitle="No children linked to your account"
        emptyHint="If this is unexpected, please contact the nursery — they manage which children are linked to you."
        onRetry={refetch}
      >
        {selected ? (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <Card padding="lg">
              <div style={{ display: 'grid', gap: 'var(--space-3)', justifyItems: 'start' }}>
                <StatusPill
                  status={toChildStatus(selected.day_path_status)}
                  lang={locale === 'ar' ? 'ar' : 'en'}
                />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  {latest
                    ? dayPathLabel(latest.status) + ' — ' + formatRelative(latest.occurred_at, locale)
                    : 'No movement recorded yet today.'}
                </span>
                <Link
                  to="/day"
                  style={{
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: 'var(--text-link)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    textDecoration: 'none',
                  }}
                >
                  See the full day →
                </Link>
              </div>
            </Card>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {SHORTCUTS.map((s) => (
                <Link key={s.to} to={s.to} style={{ textDecoration: 'none' }}>
                  <Card padding="md" style={{ minHeight: 96, height: '100%' }}>
                    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                      <Icon name={s.icon} size={22} />
                      <span
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--weight-bold)',
                          color: 'var(--text-strong)',
                        }}
                      >
                        {s.label}
                      </span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                        {s.hint}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
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
                  Latest
                </span>
                {unread.length > 0 ? (
                  <Badge tone="info" dot>
                    {unread.length} unread
                  </Badge>
                ) : null}
              </div>

              {(notifications.data?.items ?? []).length === 0 ? (
                <EmptyState title="Nothing new" hint="Updates from the nursery appear here." />
              ) : (
                (notifications.data?.items ?? []).map((n) => (
                  <Card key={n.id} padding="md" accent={n.read_at === null ? 'var(--primary)' : undefined}>
                    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{n.body}</span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                        {formatRelative(n.created_at, locale)}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : null}
      </QueryState>
    </>
  );
}
