import {
  realtime,
  useAcademicList,
  useApprovalsList,
  useIdentityList,
  useMediaList,
  useRealtimeSubscription,
} from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative } from '../lib/format';
import { isManager, roleLabel } from '../lib/permissions';

/**
 * Dashboard home — the nursery's operational picture at a glance.
 *
 * Every figure comes from an RLS-scoped read, so a teacher opening this page
 * automatically sees only their own classroom's children and records; no
 * client-side filtering is applied on top of policy.
 *
 * Live via `tenant:{id}:activity` and `tenant:{id}:approvals`.
 */

function SectionLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-link)',
        textDecoration: 'none',
      }}
    >
      {children} →
    </Link>
  );
}

export function HomeRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useRealtimeSubscription(
    tenantId ? realtime.tenantActivity(tenantId) : null,
    invalidateAll,
    Boolean(tenantId),
  );
  useRealtimeSubscription(
    tenantId ? realtime.tenantApprovals(tenantId) : null,
    invalidateAll,
    Boolean(tenantId),
  );

  const children = useAcademicList(tenantId, 'children', { orderBy: 'created_at', limit: 500 });
  const classrooms = useAcademicList(tenantId, 'classrooms', {
    orderBy: 'name',
    ascending: true,
    limit: 100,
  });
  const staff = useIdentityList(tenantId, 'staff_profiles', { orderBy: 'created_at', limit: 200 });
  const requests = useApprovalsList(tenantId, 'requests', { orderBy: 'created_at', limit: 200 });
  const cameras = useMediaList(tenantId, 'cameras', { orderBy: 'name', ascending: true, limit: 100 });

  const childRows = (children.data?.items ?? []).filter((c) => c.deleted_at === null);
  const classroomRows = (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null);
  const staffRows = (staff.data?.items ?? []).filter((s) => s.deleted_at === null);
  const requestRows = requests.data?.items ?? [];
  const cameraRows = (cameras.data?.items ?? []).filter((c) => c.deleted_at === null);

  const pendingApprovals = requestRows.filter((r) => r.status === 'pending').length;
  const overdueChildren = childRows.filter((c) => c.membership_status === 'overdue').length;
  const camerasOffline = cameraRows.filter((c) => !c.online && !c.admin_disabled).length;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          'Signed in as ' +
          roleLabel(claims.role) +
          '. Figures reflect what your account is permitted to see.'
        }
        meta={
          !isManager(claims) ? (
            <Badge tone="amber">Classroom-scoped view — some areas are manager-only</Badge>
          ) : null
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-7)',
        }}
      >
        <StatCard label="Children" value={childRows.length} accent="var(--primary)" />
        <StatCard label="Classrooms" value={classroomRows.length} />
        <StatCard label="Staff" value={staffRows.length} />
        <StatCard label="Pending approvals" value={pendingApprovals} accent="var(--amber-500)" />
        <StatCard label="Cameras offline" value={camerasOffline} accent="var(--danger-500)" />
        {isManager(claims) ? (
          <StatCard label="Overdue accounts" value={overdueChildren} accent="var(--danger-500)" />
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>Approvals</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {pendingApprovals === 0
                ? 'Nothing awaiting review.'
                : pendingApprovals + ' request(s) awaiting review.'}
            </span>
            <SectionLink to="/approvals">Review approvals</SectionLink>
          </div>
        </Card>

        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>Today</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Follow each child through the day as events arrive.
            </span>
            <SectionLink to="/timeline">Open daily timeline</SectionLink>
          </div>
        </Card>

        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>Cameras</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {cameraRows.length === 0
                ? 'No cameras registered.'
                : camerasOffline === 0
                  ? 'All cameras reporting online.'
                  : camerasOffline + ' camera(s) offline.'}
            </span>
            <SectionLink to="/cameras">View cameras</SectionLink>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 'var(--space-7)' }}>
        <RecentActivity tenantId={tenantId} locale={locale} />
      </div>
    </>
  );
}

function RecentActivity({ tenantId, locale }: { tenantId: string; locale: 'en' | 'ar' }) {
  // activity_log lives in the platform schema but carries tenant_id, so RLS
  // scopes it to the caller's own nursery (§12: manager "R own tenant").
  const activity = useAcademicList(tenantId, 'day_path_events', { orderBy: 'occurred_at', limit: 12 });
  const rows = activity.data?.items ?? [];

  return (
    <Card padding="lg">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>Recent activity</span>
        <QueryState
          isLoading={activity.isLoading}
          error={activity.error}
          isEmpty={rows.length === 0}
          emptyTitle="No activity yet today"
          emptyHint="Day-path events appear here as children move through the day."
          onRetry={() => void activity.refetch()}
        >
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 'var(--space-3)' }}>
            {rows.map((row) => (
              <li
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <Badge tone="teal">{row.status}</Badge>
                <span style={{ color: 'var(--text-muted)' }}>via {row.source}</span>
                <span style={{ marginInlineStart: 'auto', color: 'var(--text-subtle)' }}>
                  {formatRelative(row.occurred_at, locale)}
                </span>
              </li>
            ))}
          </ul>
        </QueryState>
      </div>
    </Card>
  );
}
