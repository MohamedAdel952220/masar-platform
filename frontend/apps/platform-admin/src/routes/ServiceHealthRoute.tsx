import {
  queryKeys,
  realtime,
  usePlatformList,
  useRealtimeSubscription,
  type PlatformRow,
} from '@masar/api-client';
import { Badge, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatNumber, formatRelative } from '../lib/format';

/**
 * Service Health — `platform.service_health_status` (§3.53).
 *
 * Live via the `platform:service_health` channel: the health-check job updates
 * rows, and this page invalidates its query so the table reflects the change
 * without a manual refresh. Read-only for every tier (§12.1: "Service health —
 * R for owner/admin and support alike").
 */

type Row = PlatformRow<'service_health_status'>;

function statusTone(status: string): 'success' | 'amber' | 'danger' | 'neutral' {
  if (status === 'up') return 'success';
  if (status === 'degraded') return 'amber';
  if (status === 'down') return 'danger';
  return 'neutral';
}

export function ServiceHealthRoute() {
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const query = usePlatformList('service_health_status', {
    orderBy: 'service_code',
    ascending: true,
    limit: 50,
  });

  // Realtime: the health-check job writes here; refresh on any change.
  const onChange = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.platform.all() });
  }, [queryClient]);
  useRealtimeSubscription(realtime.platformServiceHealth(), onChange);

  const rows = query.data?.items ?? [];
  const up = rows.filter((r) => r.status === 'up').length;
  const degraded = rows.filter((r) => r.status === 'degraded').length;
  const down = rows.filter((r) => r.status === 'down').length;

  const columns: Column<Row>[] = [
    {
      key: 'service_code',
      header: 'Service',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.service_code}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={statusTone(row.status)} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'uptime_pct',
      header: 'Uptime',
      numeric: true,
      render: (row) => (row.uptime_pct === null ? '—' : formatNumber(Number(row.uptime_pct), locale) + '%'),
    },
    {
      key: 'latency_ms',
      header: 'Latency',
      numeric: true,
      render: (row) => (row.latency_ms === null ? '—' : formatNumber(row.latency_ms, locale) + ' ms'),
    },
    {
      key: 'checked_at',
      header: 'Last checked',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.checked_at, locale)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Service Health"
        subtitle="Reachability of Masar's own infrastructure, written by the service-health check job. Updates arrive live."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Services up" value={up} accent="var(--success-500)" />
        <StatCard label="Degraded" value={degraded} accent="var(--amber-500)" />
        <StatCard label="Down" value={down} accent="var(--danger-500)" />
      </div>

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyTitle="No service health records"
        emptyHint="The service-health check job has not written any rows yet."
        onRetry={() => void query.refetch()}
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Tracked services" />
      </QueryState>
    </>
  );
}
