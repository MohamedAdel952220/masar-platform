import { invokeEdgeFunction, useBillingList, type Database } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatCurrency, formatDate } from '../lib/format';
import { canInitiatePayment } from '../lib/parent';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Payments.
 *
 * ══ THE PAYMENT FLOW IS SERVER-AUTHORITATIVE ══
 *
 * This screen can do exactly one thing: ASK the server to start a payment, via
 * the `initiate-payment` Edge Function. It cannot mark anything paid, and it
 * does not try to.
 *
 * What that rules out, explicitly:
 *
 *  - **No optimistic update.** `useOptimisticRpcMutation` is not used here and
 *    could not be — a payment is not on the optimistic-safe list. Showing a
 *    fee as paid before the money has actually moved is the single worst lie
 *    this app could tell.
 *  - **The browser's return is not proof.** A parent comes back from the PSP's
 *    page and the app knows only that they came back — not that payment
 *    succeeded. The redirect can be replayed, abandoned mid-flow, or forged.
 *    So on return the app REFETCHES and displays whatever
 *    `billing.payment_transactions.status` says, which is `initiated` until the
 *    `payment-webhook` function (server-to-server, in `CLIENT_FORBIDDEN`) or a
 *    staff `verify_payment` moves it.
 *  - **`verify_payment` is never called from here.** It is a staff decision
 *    RPC. A guardian confirming their own payment would defeat the point of
 *    having verification at all.
 *
 * `mark_installment_paid_manual` and `mark_ledger_item_paid_manual` are two of
 * the seven non-idempotent RPCs and are staff-only; a guardian has no path to
 * either. The only guardian write in the whole billing domain is "please start
 * a payment", and the server decides everything after that.
 *
 * The pending state below is therefore a FEATURE, not a gap: "we have your
 * payment and are confirming it" is the honest thing to show, and it resolves
 * on its own when the server says so.
 */

type PaymentMethod = Database['billing']['Enums']['payment_method'];

const METHODS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: 'instapay', label: 'InstaPay', hint: 'Instant bank transfer' },
  { value: 'fawry', label: 'Fawry', hint: 'Pay at any Fawry outlet' },
  { value: 'wallet', label: 'Mobile wallet', hint: 'Vodafone Cash and similar' },
  { value: 'bank_transfer', label: 'Bank transfer', hint: 'Verified by the nursery' },
];

export function PayRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const { selected } = useSelectedChild();
  const mayPay = canInitiatePayment(claims);

  const [method, setMethod] = useState<PaymentMethod>('instapay');
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [handedOff, setHandedOff] = useState(false);

  const ledger = useBillingList(tenantId, 'billing_ledger_items', { orderBy: 'due_date', limit: 100 });
  const payments = useBillingList(tenantId, 'payment_transactions', { orderBy: 'initiated_at', limit: 20 });

  const due = useMemo(() => {
    if (!selected) return [];
    return (ledger.data?.items ?? []).filter(
      (l) => l.child_id === selected.id && Number(l.amount_due) - Number(l.amount_paid) > 0,
    );
  }, [ledger.data, selected]);

  const selectedIds = useMemo(() => due.filter((l) => chosen[l.id]).map((l) => l.id), [due, chosen]);

  const total = useMemo(
    () =>
      due
        .filter((l) => chosen[l.id])
        .reduce((sum, l) => sum + (Number(l.amount_due) - Number(l.amount_paid)), 0),
    [due, chosen],
  );

  /** Transactions the server has not yet resolved. */
  const unresolved = useMemo(
    () =>
      (payments.data?.items ?? []).filter(
        (p) =>
          selected &&
          p.child_id === selected.id &&
          (p.status === 'initiated' || p.status === 'pending_verification'),
      ),
    [payments.data, selected],
  );

  const start = async () => {
    if (!selected || selectedIds.length === 0 || starting) return;
    setStarting(true);
    setError(null);
    try {
      const result = await invokeEdgeFunction('initiate-payment', {
        childId: selected.id,
        method,
        ledgerItemIds: selectedIds,
      });

      // The server has created the transaction. Its status is `initiated` and
      // ONLY the server will move it from there.
      setHandedOff(true);
      setChosen({});
      void queryClient.invalidateQueries();

      if (result.redirectUrl) {
        // Hand the parent to the provider. Whatever happens there reaches us
        // through the webhook, never through this tab.
        window.location.assign(result.redirectUrl);
      }
    } catch (err) {
      setError(err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Pay"
        subtitle="Choose what to pay and how."
        meta={<Badge tone="neutral">Payments are confirmed by the nursery&apos;s system, not this app</Badge>}
      />

      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState error={error} onRetry={() => setError(null)} />
        </div>
      ) : null}

      {unresolved.length > 0 ? (
        <Card padding="md" accent="var(--status-live)" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
              {unresolved.length === 1 ? 'A payment is being confirmed' : 'Payments are being confirmed'}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              We have your payment and are waiting for confirmation. This usually takes a few minutes — you do
              not need to pay again. The status updates here on its own.
            </span>
            {unresolved.map((p) => (
              <span key={p.id} style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                {formatCurrency(Number(p.amount), 'EGP', locale)} · {p.method} ·{' '}
                {formatDate(p.initiated_at, locale)}
              </span>
            ))}
            <Button variant="secondary" size="sm" onClick={() => void payments.refetch()}>
              Check again
            </Button>
          </div>
        </Card>
      ) : handedOff ? (
        <Card padding="md" accent="var(--primary)" style={{ marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
            Payment started. It will appear under Fees once the nursery&apos;s system confirms it.
          </span>
        </Card>
      ) : null}

      <QueryState
        isLoading={ledger.isLoading}
        error={ledger.error}
        isEmpty={due.length === 0}
        emptyTitle="Nothing to pay"
        emptyHint="Outstanding fees appear here when the nursery issues them."
        onRetry={() => void ledger.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
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
              What to pay
            </span>
            {due.map((item) => {
              const remaining = Number(item.amount_due) - Number(item.amount_paid);
              return (
                <Card key={item.id} padding="md">
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      minHeight: 44,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={chosen[item.id] === true}
                      onChange={(e) => setChosen((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                      style={{ width: 20, height: 20 }}
                    />
                    <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                        {item.period_label}
                      </span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                        Due {formatDate(item.due_date, locale)}
                      </span>
                    </div>
                    <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                      {formatCurrency(remaining, 'EGP', locale)}
                    </span>
                  </label>
                </Card>
              );
            })}
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
              How to pay
            </span>
            {METHODS.map((m) => (
              <Card key={m.value} padding="md">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    minHeight: 44,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={method === m.value}
                    onChange={() => setMethod(m.value)}
                    style={{ width: 20, height: 20 }}
                  />
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                      {m.label}
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{m.hint}</span>
                  </div>
                </label>
              </Card>
            ))}
          </section>

          <Card padding="lg" style={{ position: 'sticky', insetBlockEnd: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Total</span>
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-extra)',
                    color: 'var(--text-strong)',
                  }}
                >
                  {formatCurrency(total, 'EGP', locale)}
                </span>
              </div>
              <Button
                size="lg"
                disabled={!mayPay || starting || selectedIds.length === 0}
                onClick={() => void start()}
              >
                {starting ? 'Starting…' : 'Continue to payment'}
              </Button>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                You will be taken to the payment provider. Your fees update here once the payment is
                confirmed.
              </span>
            </div>
          </Card>
        </div>
      </QueryState>
    </>
  );
}
