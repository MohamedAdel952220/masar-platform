import { queryKeys, useInfinitePlatformList, useRpcMutation, type PlatformRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState, TierRestricted } from '../components/States';
import { formatCurrency, formatRelative, shortId } from '../lib/format';
import { canManageBilling } from '../lib/tier';

/**
 * Tenant Billing — `platform.tenant_billing_transactions` (tenant pays Masar).
 *
 * TIER SPLIT (§12.1): owner/admin have CRUD; **support is read-only**. The
 * refund control is hidden for support — but that is a UX affordance only:
 * `refund_tenant_billing_transaction` calls `is_platform_admin_manager_tier()`
 * internally and rejects a support-tier caller regardless of what the UI shows.
 * RLS and the RPC are the authorization boundary.
 *
 * Refunds are NOT optimistic. The RPC branches server-side (it locks the
 * original row, guards the status transition, and inserts an independent refund
 * row), so the UI waits for the authoritative response. It is also never
 * auto-retried.
 */

type Txn = PlatformRow<'tenant_billing_transactions'>;

function statusTone(status: string): 'success' | 'amber' | 'danger' | 'info' | 'neutral' {
  if (status === 'succeeded') return 'success';
  if (status === 'initiated') return 'info';
  if (status === 'failed') return 'danger';
  if (status === 'refunded') return 'amber';
  return 'neutral';
}

export function TenantBillingRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const mayManage = canManageBilling(claims);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const query = useInfinitePlatformList('tenant_billing_transactions', {
    orderBy: 'initiated_at',
    limit: 25,
  });

  const refund = useRpcMutation('refund_tenant_billing_transaction', {
    idempotent: true,
    invalidate: [[...queryKeys.platform.all()]],
    onSuccess: () => setConfirmingId(null),
  });

  const rows = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.items), [query.data]);

  const totals = useMemo(() => {
    let gross = 0;
    let refunded = 0;
    let failed = 0;
    for (const row of rows) {
      const amount = Number(row.amount);
      if (row.status === 'succeeded' && row.kind !== 'refund') gross += amount;
      if (row.status === 'succeeded' && row.kind === 'refund') refunded += amount;
      if (row.status === 'failed') failed += 1;
    }
    return { gross, refunded, net: gross - refunded, failed };
  }, [rows]);

  const currency = rows[0]?.currency ?? 'EGP';

  const columns: Column<Txn>[] = [
    {
      key: 'tenant_id',
      header: 'Tenant',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.tenant_id)}</code>,
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (row) => <Badge tone="neutral">{row.kind.replace('_', ' ')}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {formatCurrency(Number(row.amount), row.currency, locale)}
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
      key: 'initiated_at',
      header: 'Initiated',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.initiated_at, locale)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => {
        // Support tier sees no control at all — matching §12.1's read-only rule.
        if (!mayManage) return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
        // Only a succeeded, non-refund transaction can be refunded; the RPC
        // enforces the same rule server-side.
        if (row.status !== 'succeeded' || row.kind === 'refund') {
          return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
        }
        if (confirmingId === row.id) {
          return (
            <span style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
              <Button
                size="sm"
                variant="danger"
                disabled={refund.isPending}
                onClick={() =>
                  refund.mutate({ p_original_transaction_id: row.id, p_reason: 'Platform Admin refund' })
                }
              >
                {refund.isPending ? 'Refunding…' : 'Confirm'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={refund.isPending}
                onClick={() => setConfirmingId(null)}
              >
                Cancel
              </Button>
            </span>
          );
        }
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={refund.isPending}
            onClick={() => setConfirmingId(row.id)}
          >
            Refund
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Tenant Billing"
        subtitle="Transactions between each nursery and Masar. Owner and Admin tiers may issue refunds; Support tier is read-only (§12.1)."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Gross succeeded" value={formatCurrency(totals.gross, currency, locale)} />
        <StatCard
          label="Refunded"
          value={formatCurrency(totals.refunded, currency, locale)}
          accent="var(--amber-500)"
        />
        <StatCard
          label="Net"
          value={formatCurrency(totals.net, currency, locale)}
          accent="var(--success-500)"
        />
        <StatCard label="Failed charges" value={totals.failed} accent="var(--danger-500)" />
      </div>

      {!mayManage ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <TierRestricted>
            Your Support-tier account can review tenant billing but cannot issue refunds or adjustments.
          </TierRestricted>
        </div>
      ) : null}

      {refund.error ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ErrorState error={refund.error} onRetry={() => refund.reset()} />
        </div>
      ) : null}

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyTitle="No tenant billing transactions"
        emptyHint="No charges have been issued to any tenant yet."
        onRetry={() => void query.refetch()}
      >
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            caption="Transactions"
            hasMore={query.hasNextPage}
            onLoadMore={() => void query.fetchNextPage()}
            isLoadingMore={query.isFetchingNextPage}
          />
        </Card>
      </QueryState>
    </>
  );
}
