import { useInfinitePlatformList, type PlatformRow } from '@masar/api-client';
import { Badge, Card, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatDateTime, shortId } from '../lib/format';

/**
 * Activity & Audit — `platform.activity_log` and `platform.audit_log`.
 *
 * Two deliberately separate records (§23 / §24):
 *   audit_log    — security/compliance, append-only, indefinite retention.
 *                  Platform Admin reads ALL tenants (§12.1: R for every tier).
 *   activity_log — the curated operational feed, prunable (§29).
 *
 * Both are read-only here; no RPC writes to either from this console. Reading
 * the audit trail is itself audited (§23), which is why broad read access
 * across tiers is acceptable.
 */

type AuditRow = PlatformRow<'audit_log'>;
type ActivityRow = PlatformRow<'activity_log'>;

export function ActivityLogRoute() {
  const { locale } = useLocale();
  const [tab, setTab] = useState('audit');

  const audit = useInfinitePlatformList('audit_log', { orderBy: 'occurred_at', limit: 25 }, tab === 'audit');
  const activity = useInfinitePlatformList(
    'activity_log',
    { orderBy: 'occurred_at', limit: 25 },
    tab === 'activity',
  );

  const auditRows = useMemo(() => (audit.data?.pages ?? []).flatMap((p) => p.items), [audit.data]);
  const activityRows = useMemo(() => (activity.data?.pages ?? []).flatMap((p) => p.items), [activity.data]);

  const auditColumns: Column<AuditRow>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.action}
        </span>
      ),
    },
    { key: 'actor_type', header: 'Actor', render: (row) => <Badge tone="neutral">{row.actor_type}</Badge> },
    {
      key: 'target',
      header: 'Target',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>
          {row.target_type}
          {row.target_id ? ' · ' + shortId(row.target_id) : ''}
        </span>
      ),
    },
    {
      key: 'tenant_id',
      header: 'Tenant',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.tenant_id)}</code>,
    },
    {
      key: 'ip_address',
      header: 'IP',
      render: (row) => (
        <code dir="ltr" style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
          {typeof row.ip_address === 'string' ? row.ip_address : '—'}
        </code>
      ),
    },
    {
      key: 'occurred_at',
      header: 'When',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {formatDateTime(row.occurred_at, locale)}
        </span>
      ),
    },
  ];

  const activityColumns: Column<ActivityRow>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.action}
        </span>
      ),
    },
    { key: 'actor_type', header: 'Actor', render: (row) => <Badge tone="neutral">{row.actor_type}</Badge> },
    {
      key: 'target',
      header: 'Target',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>
          {row.target_type}
          {row.target_id ? ' · ' + shortId(row.target_id) : ''}
        </span>
      ),
    },
    {
      key: 'tenant_id',
      header: 'Tenant',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.tenant_id)}</code>,
    },
    {
      key: 'occurred_at',
      header: 'When',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {formatDateTime(row.occurred_at, locale)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Activity & Audit"
        subtitle="The security audit trail (indefinite retention) and the operational activity feed. Read-only — reading the audit trail is itself audited."
      />

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'audit', label: 'Audit log' },
            { value: 'activity', label: 'Activity log' },
          ]}
          value={tab}
          onChange={setTab}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {tab === 'audit' ? (
        <QueryState
          isLoading={audit.isLoading}
          error={audit.error}
          isEmpty={auditRows.length === 0}
          emptyTitle="No audit entries"
          emptyHint="No security-relevant action has been recorded yet."
          onRetry={() => void audit.refetch()}
        >
          <DataTable
            columns={auditColumns}
            rows={auditRows}
            rowKey={(row) => row.id}
            caption="Audit trail — all tenants"
            hasMore={audit.hasNextPage}
            onLoadMore={() => void audit.fetchNextPage()}
            isLoadingMore={audit.isFetchingNextPage}
          />
        </QueryState>
      ) : (
        <QueryState
          isLoading={activity.isLoading}
          error={activity.error}
          isEmpty={activityRows.length === 0}
          emptyTitle="No activity recorded"
          emptyHint="The operational feed is populated by tenant-side actions."
          onRetry={() => void activity.refetch()}
        >
          <DataTable
            columns={activityColumns}
            rows={activityRows}
            rowKey={(row) => row.id}
            caption="Operational activity"
            hasMore={activity.hasNextPage}
            onLoadMore={() => void activity.fetchNextPage()}
            isLoadingMore={activity.isFetchingNextPage}
          />
        </QueryState>
      )}
    </>
  );
}
