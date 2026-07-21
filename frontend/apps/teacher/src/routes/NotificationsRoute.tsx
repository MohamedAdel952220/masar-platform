import { realtime, useCommsList, useRealtimeSubscription, type CommsRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative } from '../lib/format';

/**
 * Notifications — the teacher's own feed (§12: "R, U own").
 *
 * LIVE via `user:{id}:notifications`, which covers both INSERT and the UPDATE
 * that marks a notification read.
 *
 * Marking read is a `U own` capability, but the deployed RPC catalogue has no
 * `mark_notification_read` function, and writing `read_at` directly would
 * bypass the "RPC for writes" model. Read state is therefore displayed but not
 * mutated here — recorded as a follow-up rather than worked around.
 */

type Notification = CommsRow<'notifications'>;

function severityTone(severity: string): 'neutral' | 'amber' | 'danger' {
  if (severity === 'urgent') return 'danger';
  if (severity === 'attention') return 'amber';
  return 'neutral';
}

export function NotificationsRoute() {
  const { locale } = useLocale();
  const { claims, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  /** identity.staff_profiles.id is the auth user id — the notification recipient key. */
  const userId = session?.user.id ?? null;

  const query = useCommsList(tenantId, 'notifications', { orderBy: 'created_at', limit: 100 });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);
  useRealtimeSubscription(userId ? realtime.userNotifications(userId) : null, invalidate, Boolean(userId));

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const unread = useMemo(() => rows.filter((n) => n.read_at === null).length, [rows]);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates for you."
        meta={
          unread > 0 ? (
            <Badge tone="amber" dot>
              {unread} unread
            </Badge>
          ) : (
            <Badge tone="teal" dot>
              All caught up
            </Badge>
          )
        }
      />

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyTitle="No notifications"
        emptyHint="Updates about your classroom appear here."
        onRetry={() => void query.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {rows.map((row: Notification) => {
            const isUnread = row.read_at === null;
            return (
              <Card key={row.id} padding="md" accent={isUnread ? 'var(--primary)' : null}>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: isUnread ? 'var(--weight-bold)' : 'var(--weight-semibold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {row.title}
                    </span>
                    <Badge tone={severityTone(row.severity)}>{row.category}</Badge>
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{row.body}</span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                    {formatRelative(row.created_at, locale)}
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
