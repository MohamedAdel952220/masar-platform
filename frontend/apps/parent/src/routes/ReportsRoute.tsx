import { useReportsList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatDate } from '../lib/format';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Reports — the AI-drafted reports a teacher has REVIEWED AND SENT.
 *
 * SENT ONLY. §12 gives a guardian read on `reports.ai_report_drafts` for their
 * own child **restricted to sent rows**. A draft a teacher is still working on
 * is invisible here by policy, not by filtering: the row never reaches the
 * client, so there is nothing to hide client-side.
 *
 * The `status === 'sent'` guard below is therefore NOT the access control — it
 * is defence in depth (§28). If policy ever loosened by accident, this screen
 * would still not show a parent an unreviewed draft. Nothing written by AI
 * reaches a family without a person having read it first (§19), and that
 * promise is only worth making if it holds on both sides.
 *
 * These are presented as reports from the nursery, because that is what they
 * are — a teacher signed off on the text. The drafting mechanism is the
 * nursery's business, not a caveat to hang on every report a parent reads.
 */

export function ReportsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { selected } = useSelectedChild();
  const [openId, setOpenId] = useState<string | null>(null);

  const drafts = useReportsList(tenantId, 'ai_report_drafts', {
    orderBy: 'sent_at',
    limit: 50,
  });

  const sent = useMemo(() => {
    if (!selected) return [];
    return (drafts.data?.items ?? []).filter(
      (d) => d.child_id === selected.id && d.status === 'sent' && d.sent_at !== null,
    );
  }, [drafts.data, selected]);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={
          selected
            ? 'Reports the nursery has sent about ' + (selected.name.split(' ')[0] ?? selected.name) + '.'
            : undefined
        }
      />

      <QueryState
        isLoading={drafts.isLoading}
        error={drafts.error}
        isEmpty={sent.length === 0}
        emptyTitle="No reports yet"
        emptyHint="Reports appear here once a teacher has reviewed and sent them."
        onRetry={() => void drafts.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {sent.map((report) => {
            const open = openId === report.id;
            return (
              <Card key={report.id} padding="md">
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {formatDate(report.sent_at, locale)}
                    </span>
                    <Badge tone="success" dot>
                      Sent
                    </Badge>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : report.id)}
                    aria-expanded={open}
                    style={{
                      minHeight: 44,
                      textAlign: 'start',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: 'var(--text-link)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--weight-semibold)',
                      cursor: 'pointer',
                    }}
                  >
                    {open ? 'Hide report' : 'Read report'}
                  </button>

                  {open ? (
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
                      {report.body}
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </QueryState>
    </>
  );
}
