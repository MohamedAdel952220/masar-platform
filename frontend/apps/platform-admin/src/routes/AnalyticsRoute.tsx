import { usePlatformList, type PlatformRow } from '@masar/api-client';
import { Badge, Card, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { StalenessIndicator } from '../components/StalenessIndicator';
import { formatCurrency, formatNumber, formatRelative } from '../lib/format';

/**
 * Analytics — the two cross-tenant summary views.
 *
 *   platform.v_tenant_billing_summary
 *   platform.v_tenant_health_summary
 *
 * Both are access-controlled views over materialized views in the internal
 * `analytics` schema. The MVs themselves are never queried directly: they are
 * not PostgREST-exposed and carry no client grant. Each view gates on
 * `public.is_platform_admin()` server-side and returns zero rows to anyone
 * else — so this page needs no tier check of its own.
 *
 * The `computed_at` staleness indicator is REQUIRED, not decorative: these are
 * materialized snapshots refreshed by a scheduled job, and `pg_cron` is not
 * enabled on the deployed project, so the figures are not live. Presenting them
 * as current would misrepresent the data.
 */

type BillingSummary = PlatformRow<'v_tenant_billing_summary'>;
type HealthSummary = PlatformRow<'v_tenant_health_summary'>;

function tenantStatusTone(status: string | null): 'success' | 'amber' | 'danger' | 'info' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'trial') return 'info';
  if (status === 'overdue') return 'amber';
  if (status === 'suspended') return 'danger';
  return 'neutral';
}

export function AnalyticsRoute() {
  const { locale } = useLocale();
  const [tab, setTab] = useState('billing');

  const billing = usePlatformList(
    'v_tenant_billing_summary',
    { orderBy: 'tenant_id', ascending: true, limit: 100 },
    tab === 'billing',
  );
  const health = usePlatformList(
    'v_tenant_health_summary',
    { orderBy: 'tenant_id', ascending: true, limit: 100 },
    tab === 'health',
  );

  const billingRows = billing.data?.items ?? [];
  const healthRows = health.data?.items ?? [];

  // Every row of a given view shares one computed_at (one refresh, one snapshot).
  const computedAt = tab === 'billing' ? billingRows[0]?.computed_at : healthRows[0]?.computed_at;

  const billingColumns: Column<BillingSummary>[] = [
    {
      key: 'tenant_name',
      header: 'Tenant',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.tenant_name}
        </span>
      ),
    },
    {
      key: 'tenant_status',
      header: 'Status',
      render: (row) => (
        <Badge tone={tenantStatusTone(row.tenant_status)}>{row.tenant_status ?? 'unknown'}</Badge>
      ),
    },
    {
      key: 'succeeded_charge_count',
      header: 'Charges',
      numeric: true,
      render: (row) => formatNumber(row.succeeded_charge_count, locale),
    },
    {
      key: 'gross_succeeded_amount',
      header: 'Gross',
      numeric: true,
      render: (row) => formatCurrency(Number(row.gross_succeeded_amount), 'EGP', locale),
    },
    {
      key: 'refunded_amount',
      header: 'Refunded',
      numeric: true,
      render: (row) => formatCurrency(Number(row.refunded_amount), 'EGP', locale),
    },
    {
      key: 'net_succeeded_amount',
      header: 'Net',
      numeric: true,
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {formatCurrency(Number(row.net_succeeded_amount), 'EGP', locale)}
        </span>
      ),
    },
    {
      key: 'failed_charge_count',
      header: 'Failed',
      numeric: true,
      render: (row) =>
        (row.failed_charge_count ?? 0) > 0 ? (
          <Badge tone="danger">{formatNumber(row.failed_charge_count, locale)}</Badge>
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>0</span>
        ),
    },
    {
      key: 'last_transaction_at',
      header: 'Last txn',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.last_transaction_at, locale)}</span>
      ),
    },
  ];

  const healthColumns: Column<HealthSummary>[] = [
    {
      key: 'tenant_name',
      header: 'Tenant',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.tenant_name}
        </span>
      ),
    },
    {
      key: 'tenant_status',
      header: 'Status',
      render: (row) => (
        <Badge tone={tenantStatusTone(row.tenant_status)}>{row.tenant_status ?? 'unknown'}</Badge>
      ),
    },
    {
      key: 'active_children',
      header: 'Children',
      numeric: true,
      render: (row) => formatNumber(row.active_children, locale),
    },
    {
      key: 'active_staff',
      header: 'Staff',
      numeric: true,
      render: (row) => formatNumber(row.active_staff, locale),
    },
    {
      key: 'cameras',
      header: 'Cameras viewable',
      numeric: true,
      render: (row) =>
        formatNumber(row.cameras_viewable, locale) + ' / ' + formatNumber(row.cameras_total, locale),
    },
    {
      key: 'open_support_tickets',
      header: 'Open tickets',
      numeric: true,
      render: (row) =>
        (row.open_support_tickets ?? 0) > 0 ? (
          <Badge tone="amber">{formatNumber(row.open_support_tickets, locale)}</Badge>
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>0</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Cross-tenant billing and operational summaries. These are materialized snapshots, not live queries."
        meta={<StalenessIndicator computedAt={computedAt} />}
      />

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'billing', label: 'Billing summary' },
            { value: 'health', label: 'Tenant health' },
          ]}
          value={tab}
          onChange={setTab}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {tab === 'billing' ? (
        <QueryState
          isLoading={billing.isLoading}
          error={billing.error}
          isEmpty={billingRows.length === 0}
          emptyTitle="No billing summary available"
          emptyHint="The snapshot is empty. This view is refreshed by a scheduled job, which is not currently registered on this project."
          onRetry={() => void billing.refetch()}
        >
          <DataTable
            columns={billingColumns}
            rows={billingRows}
            rowKey={(row) => row.tenant_id ?? ''}
            caption="Per-tenant billing snapshot"
          />
        </QueryState>
      ) : (
        <QueryState
          isLoading={health.isLoading}
          error={health.error}
          isEmpty={healthRows.length === 0}
          emptyTitle="No tenant health summary available"
          emptyHint="The snapshot is empty. This view is refreshed by a scheduled job, which is not currently registered on this project."
          onRetry={() => void health.refetch()}
        >
          <DataTable
            columns={healthColumns}
            rows={healthRows}
            rowKey={(row) => row.tenant_id ?? ''}
            caption="Per-tenant operational snapshot"
          />
        </QueryState>
      )}
    </>
  );
}
