import { useCommsList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { NOTIFICATION_SEVERITY_TONE, asNotificationSeverity } from '../lib/enums';
import { formatRelative } from '../lib/format';

/**
 * Notifications — `comms.notifications`, RLS-scoped to this recipient.
 *
 * Live via `user:{id}:notifications` (§15) — but this screen does NOT subscribe.
 * `TripProvider` holds that subscription for the whole session and invalidates
 * on arrival, so the list here is already fresh.
 *
 * The api-client registry is reference-counted, so a second subscription would
 * have shared the same socket rather than opening a duplicate channel. It is
 * still removed: "one logical subscription per resource" is worth holding
 * structurally rather than relying on the registry to clean up after a habit.
 *
 * MARKING AS READ IS NOT IMPLEMENTED, deliberately: the deployed RPC catalogue
 * has no `mark_notification_read`, and writing to `comms.notifications`
 * directly would bypass the "all writes go through RPCs" model. Read state is
 * displayed but not mutated; the missing RPC is recorded as a follow-up rather
 * than worked around.
 */

/**
 * Severity tones come from `lib/enums.ts` rather than from literal comparisons
 * written here. `NOTIFICATION_SEVERITY_TONE` is a
 * `Record<NotificationSeverity, …>`, so it is exhaustive by construction: a new
 * member of `comms.notification_severity` breaks the build until a tone is
 * supplied, instead of silently falling through to a default.
 *
 * The sibling portals reached this behaviour by writing three `===` comparisons
 * and getting all three wrong. Not repeating that here is the point of the
 * enums module.
 */
function severityTone(severity: string): 'amber' | 'info' | 'neutral' {
  const value = asNotificationSeverity(severity);
  return value === null ? 'neutral' : NOTIFICATION_SEVERITY_TONE[value];
}

export function NotificationsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';

  const notifications = useCommsList(tenantId, 'notifications', { orderBy: 'created_at', limit: 100 });

  const rows = useMemo(() => notifications.data?.items ?? [], [notifications.data]);
  const unread = useMemo(() => rows.filter((n) => n.read_at === null).length, [rows]);

  return (
    <>
      <PageHeader
        title="Updates"
        subtitle="Messages and alerts for you."
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
        emptyHint="Updates from the office appear here."
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
