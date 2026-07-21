import { useBillingList, useRpcMutation, type BillingRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, ManagerOnly, QueryState } from '../components/States';
import { formatCurrency, formatDate, formatRelative, shortId } from '../lib/format';
import { canManageBilling } from '../lib/permissions';

/**
 * Billing — invoices, payments and the fee ledger (§12: manager only; a
 * teacher has no billing row in the permission matrix at all, and RLS returns
 * them nothing here).
 *
 * PAYMENT VERIFICATION is the sensitive action. `verify_payment` reconciles a
 * submitted transaction and is NOT optimistic — the RPC branches server-side
 * (it updates the transaction, settles the ledger, and notifies), so the UI
 * waits for the authoritative row. It carries an idempotency key, so a manual
 * retry is safe, and it is never auto-retried.
 *
 * `mark_ledger_item_paid_manual` is deliberately NOT surfaced here: it is one
 * of the seven RPCs that accept no idempotency key
 * (BACKEND_CERTIFICATION.md §7.1), where a double-submit records a duplicate
 * manual payment. Exposing it needs the non-retryable submit treatment and an
 * explicit confirmation flow, which is recorded as a follow-up rather than
 * shipped half-guarded.
 */

type Invoice = BillingRow<'invoices'>;
type Payment = BillingRow<'payment_transactions'>;
/**
 * `verify_payment(p_decision billing.payment_status)` additionally rejects
 * anything other than 'succeeded' or 'failed' server-side:
 *
 *   if p_decision not in ('succeeded', 'failed') then raise ... VALIDATION_FAILED
 *
 * The decisions below are passed as plain literals so TypeScript checks them
 * against the generated enum. They were previously written as
 * `'verified' as PaymentDecision` / `'rejected' as PaymentDecision`; the casts
 * silenced the type error and both values were rejected by Postgres, so Verify
 * and Reject never worked. Do not reintroduce a cast here.
 */

function invoiceTone(status: string): 'success' | 'amber' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'unpaid') return 'amber';
  return 'neutral';
}

/**
 * Tones for `billing.payment_status`, whose deployed values are exactly:
 *   'initiated' | 'pending_verification' | 'succeeded' | 'failed' | 'refunded'
 *
 * This previously tested for 'verified' and 'settled' (success) and 'rejected'
 * (danger) — none of which are members of the enum, so a succeeded payment fell
 * through to the neutral default.
 */
function paymentTone(status: string): 'success' | 'amber' | 'danger' | 'info' | 'neutral' {
  if (status === 'succeeded') return 'success';
  if (status === 'pending_verification') return 'amber';
  if (status === 'failed') return 'danger';
  return 'info';
}

export function BillingRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const mayManage = canManageBilling(claims);
  const [tab, setTab] = useState('payments');

  const invoices = useBillingList(
    tenantId,
    'invoices',
    { orderBy: 'issued_at', limit: 200 },
    tab === 'invoices',
  );
  const payments = useBillingList(
    tenantId,
    'payment_transactions',
    { orderBy: 'initiated_at', limit: 200 },
    tab === 'payments',
  );

  const invoiceRows = useMemo(() => invoices.data?.items ?? [], [invoices.data]);
  const paymentRows = useMemo(() => payments.data?.items ?? [], [payments.data]);

  const verify = useRpcMutation('verify_payment', {
    idempotent: true,
    onSuccess: () => void queryClient.invalidateQueries(),
  });

  const totals = useMemo(() => {
    const unpaid = invoiceRows.filter((i) => i.status === 'unpaid');
    const awaiting = paymentRows.filter((p) => p.status === 'pending_verification');
    return {
      unpaidCount: unpaid.length,
      unpaidValue: unpaid.reduce((sum, i) => sum + Number(i.total), 0),
      awaiting: awaiting.length,
      awaitingValue: awaiting.reduce((sum, p) => sum + Number(p.amount), 0),
    };
  }, [invoiceRows, paymentRows]);

  const invoiceColumns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.invoice_number}
        </span>
      ),
    },
    {
      key: 'child_id',
      header: 'Child',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.child_id)}</code>,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      render: (row) => formatCurrency(Number(row.total), 'EGP', locale),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={invoiceTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'issued_at',
      header: 'Issued',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.issued_at, locale)}</span>
      ),
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'child_id',
      header: 'Child',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.child_id)}</code>,
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {formatCurrency(Number(row.amount), 'EGP', locale)}
        </span>
      ),
    },
    { key: 'method', header: 'Method', render: (row) => <Badge tone="neutral">{row.method}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={paymentTone(row.status)} dot>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'initiated_at',
      header: 'Submitted',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.initiated_at, locale)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Verify',
      render: (row) => {
        if (!mayManage || row.status !== 'pending_verification') {
          return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
        }
        return (
          <span style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
            <Button
              size="sm"
              disabled={verify.isPending}
              onClick={() =>
                verify.mutate({
                  p_payment_transaction_id: row.id,
                  p_decision: 'succeeded',
                })
              }
            >
              Verify
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={verify.isPending}
              onClick={() =>
                verify.mutate({
                  p_payment_transaction_id: row.id,
                  p_decision: 'failed',
                })
              }
            >
              Reject
            </Button>
          </span>
        );
      },
    },
  ];

  if (!mayManage) {
    return (
      <>
        <PageHeader title="Billing" subtitle="Fees, invoices and payment reconciliation." />
        <ManagerOnly>
          Billing is a manager-only area. Your account has no billing permissions, and the database returns no
          billing rows to it.
        </ManagerOnly>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Invoices and parent payments. Verifying a payment reconciles it against the child's ledger."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Awaiting verification" value={totals.awaiting} accent="var(--amber-500)" />
        <StatCard
          label="Awaiting value"
          value={formatCurrency(totals.awaitingValue, 'EGP', locale)}
          accent="var(--amber-500)"
        />
        <StatCard label="Unpaid invoices" value={totals.unpaidCount} accent="var(--danger-500)" />
        <StatCard label="Unpaid value" value={formatCurrency(totals.unpaidValue, 'EGP', locale)} />
      </div>

      {verify.error ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ErrorState error={verify.error} onRetry={() => verify.reset()} />
        </div>
      ) : null}

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'payments', label: 'Payments', count: paymentRows.length },
            { value: 'invoices', label: 'Invoices', count: invoiceRows.length },
          ]}
          value={tab}
          onChange={setTab}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {tab === 'payments' ? (
        <QueryState
          isLoading={payments.isLoading}
          error={payments.error}
          isEmpty={paymentRows.length === 0}
          emptyTitle="No payments"
          emptyHint="Parent payments appear here for reconciliation."
          onRetry={() => void payments.refetch()}
        >
          <DataTable
            columns={paymentColumns}
            rows={paymentRows}
            rowKey={(row) => row.id}
            caption="Payments"
          />
        </QueryState>
      ) : (
        <QueryState
          isLoading={invoices.isLoading}
          error={invoices.error}
          isEmpty={invoiceRows.length === 0}
          emptyTitle="No invoices"
          emptyHint="Generated invoices appear here."
          onRetry={() => void invoices.refetch()}
        >
          <DataTable
            columns={invoiceColumns}
            rows={invoiceRows}
            rowKey={(row) => row.id}
            caption="Invoices"
          />
        </QueryState>
      )}
    </>
  );
}
