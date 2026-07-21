import { realtime, useCommsList, useRealtimeSubscription } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative } from '../lib/format';

/**
 * Notifications — `comms.notifications`, RLS-scoped to this recipient.
 *
 * Live via `user:{id}:notifications` (§15). The channel filters on
 * `recipient_id`, which is `auth.users.id` — `MasarClaims` carries no user id,
 * so it comes from the session (Epic 1 keys the identity tables by the auth
 * user id).
 *
 * MARKING AS READ IS NOT IMPLEMENTED, deliberately: the deployed RPC catalogue
 * has no `mark_notification_read`, and writing to `comms.notifications`
 * directly would bypass the "all writes go through RPCs" model. Read state is
 * displayed but not mutated; the missing RPC is recorded as a follow-up rather
 * than worked around.
 */

/**
 * Tones for `comms.notification_severity`, whose deployed values are exactly:
 *   'info' | 'attention' | 'urgent'
 *
 * This previously tested for 'critical', 'high' and 'normal' — none of which
 * are members of the enum, so every notification fell through to neutral and
 * severity was never indicated at all.
 */
function severityTone(severity: string): 'amber' | 'info' | 'neutral' {
  if (severity === 'urgent') return 'amber';
  if (severity === 'attention') return 'info';
  return 'neutral';
}

export function NotificationsRoute() {
  const { locale } = useLocale();
  const { claims, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const userId = session?.user.id ?? '';

  const notifications = useCommsList(tenantId, 'notifications', { orderBy: 'created_at', limit: 100 });

  const invalidate = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);
  useRealtimeSubscription(userId ? realtime.userNotifications(userId) : null, invalidate, Boolean(userId));

  const rows = useMemo(() => notifications.data?.items ?? [], [notifications.data]);
  const unread = useMemo(() => rows.filter((n) => n.read_at === null).length, [rows]);

  return (
    <>
      <PageHeader
        title="Updates"
        subtitle="Everything the nursery has sent you."
        meta={
          unread > 0 ? (
            <Badge tone="info" dot>
              {unread} unread
            </Badge>
          ) : null
        }
      />

      <QueryState
        isLoading={notifications.isLoading}
        error={notifications.error}
        isEmpty={rows.length === 0}
        emptyTitle="Nothing yet"
        emptyHint="Updates about your child appear here."
        onRetry={() => void notifications.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {rows.map((n) => {
            const card = (
              <Card padding="md" accent={n.read_at === null ? 'var(--primary)' : undefined}>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {n.title}
                    </span>
                    <Badge tone={severityTone(n.severity)} dot>
                      {n.category}
                    </Badge>
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{n.body}</span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                    {formatRelative(n.created_at, locale)}
                  </span>
                </div>
              </Card>
            );

            // `deep_link` is a stored path; only in-app relative links are
            // followed, so a stored value can never navigate off-origin.
            const target = n.deep_link && n.deep_link.startsWith('/') ? n.deep_link : null;

            return target ? (
              <Link key={n.id} to={target} style={{ textDecoration: 'none' }}>
                {card}
              </Link>
            ) : (
              <div key={n.id}>{card}</div>
            );
          })}
        </div>
      </QueryState>
    </>
  );
}
