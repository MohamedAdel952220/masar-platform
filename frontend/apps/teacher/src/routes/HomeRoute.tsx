import { realtime, useAcademicList, useCommsList, useRealtimeSubscription } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard, StatusPill, type ChildStatus } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative, todayIso } from '../lib/format';

/**
 * Teacher home — today at a glance for the teacher's own classroom.
 *
 * Every read is RLS-scoped: `academic.children`, `attendance_records` and
 * `day_path_events` all return only this teacher's classroom, so no
 * client-side scoping is applied on top of policy.
 *
 * Live via `classroom:{id}:day_path` (children moving through the day) and
 * `user:{id}:notifications` (own feed).
 */

/**
 * `academic.children.day_path_status` is the deployed enum `day_path_status`
 * (snake_case: at_home, in_bus, classroom, playing, nap, delivered). The design
 * system's `ChildStatus` uses kebab-case and adds two presentation-only states
 * (`arrived`, `left`) that no column ever produces.
 *
 * Mapping between them is required. Previously this file held a list of
 * `ChildStatus` values and tested the DB value against it, so `at_home` and
 * `in_bus` never matched and those two states silently rendered as a raw badge.
 */
const DAY_PATH_PILL: Record<string, ChildStatus> = {
  at_home: 'at-home',
  in_bus: 'in-bus',
  classroom: 'classroom',
  playing: 'playing',
  nap: 'nap',
  delivered: 'delivered',
};

function toPillStatus(value: string): ChildStatus | null {
  return DAY_PATH_PILL[value] ?? null;
}

function QuickLink({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <Card padding="md" interactive>
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>{label}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span>
        </div>
      </Card>
    </Link>
  );
}

export function HomeRoute() {
  const { locale } = useLocale();
  const { claims, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  /** identity.staff_profiles.id is the auth user id — the notification recipient key. */
  const userId = session?.user.id ?? null;
  const today = todayIso();

  const classrooms = useAcademicList(tenantId, 'classrooms', { orderBy: 'name', ascending: true, limit: 50 });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });
  const records = useAcademicList(tenantId, 'attendance_records', { orderBy: 'date', limit: 300 });
  const notifications = useCommsList(tenantId, 'notifications', { orderBy: 'created_at', limit: 20 });

  const rooms = useMemo(
    () => (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null),
    [classrooms.data],
  );
  const primaryRoom = rooms[0] ?? null;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useRealtimeSubscription(
    primaryRoom ? realtime.classroomDayPath(primaryRoom.id) : null,
    invalidate,
    Boolean(primaryRoom),
  );
  useRealtimeSubscription(userId ? realtime.userNotifications(userId) : null, invalidate, Boolean(userId));

  const roster = useMemo(
    () => (children.data?.items ?? []).filter((c) => c.deleted_at === null),
    [children.data],
  );

  const todayRegister = useMemo(
    () => (records.data?.items ?? []).filter((r) => r.date === today),
    [records.data, today],
  );

  const present = todayRegister.filter((r) => r.present).length;
  const marked = todayRegister.length > 0;
  const unread = (notifications.data?.items ?? []).filter((n) => n.read_at === null).length;

  return (
    <>
      <PageHeader
        title={primaryRoom ? primaryRoom.name : 'Your classroom'}
        subtitle="Today at a glance."
        meta={
          marked ? (
            <Badge tone="success" dot>
              Register marked
            </Badge>
          ) : (
            <Badge tone="amber" dot>
              Register not marked yet
            </Badge>
          )
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <StatCard label="Children" value={roster.length} accent="var(--primary)" />
        <StatCard label="Present today" value={marked ? present : '—'} accent="var(--success-500)" />
        <StatCard label="Unread" value={unread} accent="var(--amber-500)" />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <QuickLink
          to="/attendance"
          label={marked ? 'Update register' : 'Mark the register'}
          hint={marked ? present + ' of ' + todayRegister.length + ' present' : 'Not marked yet today'}
        />
        <QuickLink
          to="/evaluations"
          label="Record an evaluation"
          hint="Understanding, participation, behaviour"
        />
        <QuickLink to="/ai/polish" label="Polish a note" hint="Tidy a quick note before sending" />
      </div>

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
        Where everyone is
      </span>

      <QueryState
        isLoading={children.isLoading}
        error={children.error}
        isEmpty={roster.length === 0}
        emptyTitle="No children yet"
        emptyHint="Children assigned to your classroom appear here."
        onRetry={() => void children.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {roster.slice(0, 12).map((child) => {
            const pill = toPillStatus(child.day_path_status);
            return (
              <Card key={child.id} padding="sm">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>{child.name}</span>
                  {pill ? (
                    <StatusPill status={pill} lang={locale} size="sm" />
                  ) : (
                    <Badge tone="neutral">{child.day_path_status}</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </QueryState>

      {notifications.data && (notifications.data.items[0]?.created_at ?? null) ? (
        <span
          style={{
            display: 'block',
            marginBlockStart: 'var(--space-5)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-subtle)',
          }}
        >
          Last update {formatRelative(notifications.data.items[0]?.created_at, locale)}
        </span>
      ) : null}
    </>
  );
}
