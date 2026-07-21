import { realtime, useCommsList, useRealtimeSubscription, useSafetyList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, Icon, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative, todayIso } from '../lib/format';

/**
 * Reception home — the shift at a glance, with the scan action never more than
 * one tap away.
 *
 * The layout is deliberately front-loaded with the primary action rather than
 * with metrics: a desk operator opening this app almost always has a person
 * standing in front of them. The counts below the button are for the quiet
 * moments between pickups.
 *
 * Realtime: `user:{id}:notifications` (§15). Reception has no live channel of
 * its own in the §15 matrix — scan events are written by this device, so the
 * local mutation's invalidation is the fresher signal, and subscribing to a
 * channel to hear about one's own writes would be pointless traffic.
 */

interface Shortcut {
  to: string;
  icon: string;
  label: string;
  hint: string;
}

const SHORTCUTS: Shortcut[] = [
  { to: '/visitors', icon: 'users', label: "Today's visitors", hint: 'Everyone seen at the desk' },
  { to: '/pickup', icon: 'baby', label: 'Child pickup', hint: 'Who is still waiting' },
  { to: '/log', icon: 'list', label: 'Daily log', hint: 'Activity across the nursery' },
  { to: '/notifications', icon: 'bell', label: 'Updates', hint: 'Messages for you' },
];

export function HomeRoute() {
  const { locale } = useLocale();
  const { claims, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  // `MasarClaims` carries no user id; identity tables are keyed by
  // `auth.users.id` (Epic 1), which is exactly `session.user.id`.
  const userId = session?.user.id ?? '';
  const today = todayIso();

  const events = useSafetyList(tenantId, 'pickup_scan_events', { orderBy: 'scanned_at', limit: 100 });
  const notifications = useCommsList(tenantId, 'notifications', { orderBy: 'created_at', limit: 5 });

  const invalidate = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);
  useRealtimeSubscription(userId ? realtime.userNotifications(userId) : null, invalidate, Boolean(userId));

  const todays = useMemo(
    () => (events.data?.items ?? []).filter((e) => e.scanned_at.slice(0, 10) === today),
    [events.data, today],
  );

  const stats = useMemo(() => {
    let handedOver = 0;
    let pending = 0;
    for (const e of todays) {
      if (e.handover_confirmed) handedOver += 1;
      else if (e.result === 'valid') pending += 1;
    }
    return { handedOver, pending, scans: todays.length };
  }, [todays]);

  const unread = useMemo(
    () => (notifications.data?.items ?? []).filter((n) => n.read_at === null),
    [notifications.data],
  );

  return (
    <>
      <PageHeader title="Reception" subtitle="Scan a family's code to begin a handover." />

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Link to="/scan" style={{ textDecoration: 'none' }}>
          <Card padding="lg" accent="var(--primary)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--primary)',
                  color: 'var(--on-primary, #fff)',
                  flex: 'none',
                }}
              >
                <Icon name="scan-line" size={26} />
              </span>
              <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-extra)',
                    color: 'var(--text-strong)',
                  }}
                >
                  Scan a pickup pass
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Validate the code, check ID, confirm the handover.
                </span>
              </div>
            </div>
          </Card>
        </Link>

        <QueryState
          isLoading={events.isLoading}
          error={events.error}
          isEmpty={false}
          emptyTitle="No activity"
          onRetry={() => void events.refetch()}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <StatCard label="Handed over today" value={stats.handedOver} />
            <StatCard label="Awaiting handover" value={stats.pending} />
            <StatCard label="Scans today" value={stats.scans} />
          </div>
        </QueryState>

        {stats.pending > 0 ? (
          <Card padding="md" accent="var(--status-live)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                {stats.pending} {stats.pending === 1 ? 'scan was' : 'scans were'} validated but not completed
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                A valid pass was scanned but no handover was confirmed. Check whether the child actually left
                with that person.
              </span>
              <Link to="/visitors" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" size="sm">
                  Review today
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
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
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{s.hint}</span>
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
            <Card padding="md">
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Nothing new.</span>
            </Card>
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
    </>
  );
}
