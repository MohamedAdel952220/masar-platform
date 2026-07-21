import { useBillingList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatCurrency, formatDate } from '../lib/format';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Fees — invoices, outstanding items, and payment history.
 *
 * ALL THREE ARE READ-ONLY HERE. Paying happens on `/pay`, which goes through
 * the `initiate-payment` Edge Function; nothing on this screen writes.
 *
 * Payment status shown here is whatever the SERVER says. A transaction sits at
 * `initiated` or `pending_verification` until the PSP webhook or a staff
 * verification moves it — the app never advances it locally, however confident
 * the browser is that a payment went through. See PayRoute for why.
 */

function invoiceTone(status: string): 'success' | 'amber' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'unpaid') return 'amber';
  return 'neutral';
}

function paymentTone(status: string): 'success' | 'amber' | 'info' | 'neutral' {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'amber';
  if (status === 'pending_verification' || status === 'initiated') return 'info';
  return 'neutral';
}

function paymentLabel(status: string): string {
  if (status === 'initiated') return 'Awaiting confirmation';
  if (status === 'pending_verification') return 'Being verified';
  if (status === 'succeeded') return 'Paid';
  if (status === 'failed') return 'Failed';
  if (status === 'refunded') return 'Refunded';
  return status;
}

export function BillingRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { selected } = useSelectedChild();

  const invoices = useBillingList(tenantId, 'invoices', { orderBy: 'issued_at', limit: 50 });
  const ledger = useBillingList(tenantId, 'billing_ledger_items', { orderBy: 'due_date', limit: 100 });
  const payments = useBillingList(tenantId, 'payment_transactions', { orderBy: 'initiated_at', limit: 50 });

  const myInvoices = useMemo(
    () => (selected ? (invoices.data?.items ?? []).filter((i) => i.child_id === selected.id) : []),
    [invoices.data, selected],
  );
  const myLedger = useMemo(
    () => (selected ? (ledger.data?.items ?? []).filter((l) => l.child_id === selected.id) : []),
    [ledger.data, selected],
  );
  const myPayments = useMemo(
    () => (selected ? (payments.data?.items ?? []).filter((p) => p.child_id === selected.id) : []),
    [payments.data, selected],
  );

  const outstanding = useMemo(
    () => myLedger.reduce((sum, l) => sum + (Number(l.amount_due) - Number(l.amount_paid)), 0),
    [myLedger],
  );

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle={selected ? 'Invoices and payments for ' + selected.name + '.' : undefined}
        actions={
          outstanding > 0 ? (
            <Link
              to="/pay"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 var(--space-5)',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--primary)',
                color: 'var(--on-primary, #fff)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-bold)',
                textDecoration: 'none',
              }}
            >
              Pay
            </Link>
          ) : null
        }
      />

      <QueryState
        isLoading={invoices.isLoading}
        error={invoices.error}
        isEmpty={!selected}
        emptyTitle="No child selected"
        onRetry={() => void invoices.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <StatCard label="Outstanding" value={formatCurrency(outstanding, 'EGP', locale)} />
            <StatCard label="Invoices" value={myInvoices.length} />
          </div>

          <section style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Due
            </span>
            {myLedger.length === 0 ? (
              <Card padding="md">
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Nothing outstanding.
                </span>
              </Card>
            ) : (
              myLedger.map((item) => {
                const remaining = Number(item.amount_due) - Number(item.amount_paid);
                return (
                  <Card key={item.id} padding="md">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                          {item.period_label}
                        </span>
                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                          Due {formatDate(item.due_date, locale)}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
                        <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                          {formatCurrency(remaining, 'EGP', locale)}
                        </span>
                        <Badge tone={remaining <= 0 ? 'success' : 'amber'} dot>
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </section>

          <section style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Invoices
            </span>
            {myInvoices.length === 0 ? (
              <Card padding="md">
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  No invoices issued yet.
                </span>
              </Card>
            ) : (
              myInvoices.map((inv) => (
                <Card key={inv.id} padding="md">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                        {inv.invoice_number}
                      </span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                        Issued {formatDate(inv.issued_at, locale)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
                      <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                        {formatCurrency(Number(inv.total), 'EGP', locale)}
                      </span>
                      <Badge tone={invoiceTone(inv.status)} dot>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </section>

          <section style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Payment history
            </span>
            {myPayments.length === 0 ? (
              <Card padding="md">
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  No payments yet.
                </span>
              </Card>
            ) : (
              myPayments.map((p) => (
                <Card key={p.id} padding="md">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                        {formatCurrency(Number(p.amount), 'EGP', locale)}
                      </span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                        {p.method} · {formatDate(p.initiated_at, locale)}
                      </span>
                    </div>
                    <Badge tone={paymentTone(p.status)} dot>
                      {paymentLabel(p.status)}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </section>
        </div>
      </QueryState>
    </>
  );
}
