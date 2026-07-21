import { useReportsList, useRpcMutation, type ReportsRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, ManagerOnly, QueryState } from '../components/States';
import { formatNumber, formatRelative, shortId } from '../lib/format';
import { canSendReports } from '../lib/permissions';

/**
 * AI Reports — `reports.ai_report_drafts` and the usage cap (§19).
 *
 * HUMAN-IN-THE-LOOP IS ENFORCED HERE, not merely documented (§19): a draft's
 * Send button stays disabled until the manager has OPENED that specific draft
 * and ticked "I have read this draft and it is accurate". The acknowledgement
 * is per-draft, so reviewing one report never unlocks another.
 *
 * The Phase 9 integration audit found this gate implemented in the Teacher App
 * — on a Send button that could never work, because `send_report_draft` is
 * manager-only server-side. The gate belonged where the send actually happens.
 * See SYSTEM_INTEGRATION_AUDIT_REPORT.md §3 (I1, I2).
 *
 * Sending goes through `send_report_draft`, which carries an idempotency key
 * (a manual retry is safe) and is never auto-retried. It is NOT optimistic:
 * the RPC transitions state and triggers delivery server-side, so the UI waits
 * for the authoritative row.
 *
 * Drafting itself (`ai-draft-report`) is a long-running batch Edge Function
 * whose completion arrives by notification (§17 of the frontend architecture);
 * it is not dispatched from this list surface.
 */

type Draft = ReportsRow<'ai_report_drafts'>;
type UsageCounter = ReportsRow<'ai_usage_counters'>;

function draftTone(status: string): 'neutral' | 'amber' | 'success' | 'info' {
  if (status === 'sent') return 'success';
  if (status === 'scheduled') return 'info';
  if (status === 'draft') return 'amber';
  return 'neutral';
}

export function ReportsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const maySend = canSendReports(claims);
  const [tab, setTab] = useState('drafts');
  /** Draft currently opened for review. §19 requires a person to read it. */
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  /** Per-draft acknowledgement. Resets when a different draft is opened. */
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});

  const drafts = useReportsList(tenantId, 'ai_report_drafts', { orderBy: 'created_at', limit: 200 });
  const usage = useReportsList(tenantId, 'ai_usage_counters', {
    orderBy: 'tenant_id',
    ascending: true,
    limit: 50,
  });

  const draftRows = useMemo(() => drafts.data?.items ?? [], [drafts.data]);
  const usageRows = usage.data?.items ?? [];

  const reviewingDraft = useMemo(
    () => draftRows.find((d) => d.id === reviewingId) ?? null,
    [draftRows, reviewingId],
  );

  const send = useRpcMutation('send_report_draft', {
    idempotent: true,
    onSuccess: () => {
      setReviewingId(null);
      void queryClient.invalidateQueries();
    },
  });

  const counts = useMemo(
    () => ({
      draft: draftRows.filter((d) => d.status === 'draft').length,
      scheduled: draftRows.filter((d) => d.status === 'scheduled').length,
      sent: draftRows.filter((d) => d.status === 'sent').length,
    }),
    [draftRows],
  );

  const draftColumns: Column<Draft>[] = [
    {
      key: 'child_id',
      header: 'Child',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.child_id)}</code>,
    },
    {
      key: 'body',
      header: 'Draft',
      render: (row) => (
        <span
          style={{
            color: 'var(--text-body)',
            display: 'inline-block',
            maxWidth: '46ch',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.body}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'State',
      render: (row) => (
        <Badge tone={draftTone(row.status)} dot>
          {row.status === 'sent' ? 'Sent to guardian' : row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Drafted',
      render: (row) => (
        <span style={{ color: 'var(--text-subtle)' }}>{formatRelative(row.created_at, locale)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => {
        if (!maySend || row.status === 'sent') return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
        // §19 human-in-the-loop: the draft must be opened and acknowledged
        // before it can be sent. See the note at the top of this file.
        if (reviewingId !== row.id) {
          return (
            <Button size="sm" variant="secondary" onClick={() => setReviewingId(row.id)}>
              Read draft
            </Button>
          );
        }
        return (
          <Button
            size="sm"
            disabled={send.isPending || acknowledged[row.id] !== true}
            onClick={() => send.mutate({ p_draft_id: row.id })}
          >
            {send.isPending ? 'Sending…' : 'Send to family'}
          </Button>
        );
      },
    },
  ];

  const usageColumns: Column<UsageCounter>[] = [
    {
      key: 'usage_date',
      header: 'Date',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.usage_date}
        </span>
      ),
    },
    {
      key: 'calls_used',
      header: 'AI calls used',
      numeric: true,
      render: (row) => formatNumber(row.calls_used, locale),
    },
  ];

  return (
    <>
      <PageHeader
        title="AI Reports"
        subtitle="AI writes a draft; a person sends it. Nothing reaches a guardian without an explicit send."
        meta={<Badge tone="amber">Drafts are never auto-sent</Badge>}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Awaiting review" value={counts.draft} accent="var(--amber-500)" />
        <StatCard label="Scheduled" value={counts.scheduled} accent="var(--info-500)" />
        <StatCard label="Sent" value={counts.sent} accent="var(--success-500)" />
      </div>

      {!maySend ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>Sending a report to a guardian is a manager action.</ManagerOnly>
        </div>
      ) : null}

      {send.error ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ErrorState error={send.error} onRetry={() => send.reset()} />
        </div>
      ) : null}

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'drafts', label: 'Drafts', count: draftRows.length },
            { value: 'usage', label: 'AI usage', count: usageRows.length },
          ]}
          value={tab}
          onChange={setTab}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {tab === 'drafts' ? (
        <QueryState
          isLoading={drafts.isLoading}
          error={drafts.error}
          isEmpty={draftRows.length === 0}
          emptyTitle="No report drafts"
          emptyHint="Drafts generated from the Teacher App appear here for review."
          onRetry={() => void drafts.refetch()}
        >
          {reviewingDraft ? (
            <Card padding="lg" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ flex: 1, fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                    Draft for {shortId(reviewingDraft.child_id)}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => setReviewingId(null)}>
                    Close
                  </Button>
                </div>
                <p
                  lang={locale}
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.7,
                    color: 'var(--text-body)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {reviewingDraft.body}
                </p>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    minHeight: 44,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acknowledged[reviewingDraft.id] === true}
                    onChange={(e) =>
                      setAcknowledged((prev) => ({ ...prev, [reviewingDraft.id]: e.target.checked }))
                    }
                    style={{ width: 20, height: 20 }}
                  />
                  I have read this draft and it is accurate
                </label>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                  Nothing written by AI reaches a family until a person confirms it (§19).
                </span>
              </div>
            </Card>
          ) : null}

          <DataTable
            columns={draftColumns}
            rows={draftRows}
            rowKey={(row) => row.id}
            caption="Report drafts"
          />
        </QueryState>
      ) : (
        <QueryState
          isLoading={usage.isLoading}
          error={usage.error}
          isEmpty={usageRows.length === 0}
          emptyTitle="No AI usage recorded"
          emptyHint="Usage against your plan's AI cap appears here."
          onRetry={() => void usage.refetch()}
        >
          <DataTable
            columns={usageColumns}
            rows={usageRows}
            rowKey={(row) => String(row.id)}
            caption="AI usage"
          />
        </QueryState>
      )}
    </>
  );
}
