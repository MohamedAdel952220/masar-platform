import { invokeEdgeFunction, useAcademicList, useReportsList, type ReportsRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatRelative, todayIso } from '../lib/format';
import { canDraftReports } from '../lib/teacher';

/**
 * AI Reports — drafting (`ai-draft-report`) and reading the drafts back.
 *
 * SENDING IS NOT A TEACHER CAPABILITY. §12's AI Reports row gives a teacher
 * `C (own students), R own`; sending belongs to the manager's `CRUD (all)`, and
 * `send_report_draft` enforces that server-side:
 *
 *   if public.current_role() <> 'manager' then raise ... 'PERM_ROLE_DENIED'
 *
 * This screen previously offered a "Send to family" button that failed on every
 * press. The Phase 9 integration audit removed it and moved the human-review
 * gate to the Dashboard, where sending actually happens — see
 * SYSTEM_INTEGRATION_AUDIT_REPORT.md §3 (I1, I2).
 *
 * The teacher's role in §19's human-in-the-loop chain is unchanged in substance:
 * they read every draft about their own children and raise anything wrong. What
 * changed is who presses send.
 *
 * DRAFTING IS A BATCH: `ai-draft-report` fans out per child and can be slow, so
 * it is dispatched and left — completion arrives via the notification channel
 * rather than by holding a request open (frontend architecture §17).
 *
 * QUOTA (§19): today's AI usage is shown before drafting; the cap itself is
 * enforced server-side.
 */

type Draft = ReportsRow<'ai_report_drafts'>;

function draftTone(status: string): 'amber' | 'info' | 'success' | 'neutral' {
  if (status === 'draft') return 'amber';
  if (status === 'scheduled') return 'info';
  if (status === 'sent') return 'success';
  return 'neutral';
}

export function ReportsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const mayDraft = canDraftReports(claims);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<unknown>(null);
  const [dispatched, setDispatched] = useState<number | null>(null);

  const drafts = useReportsList(tenantId, 'ai_report_drafts', { orderBy: 'created_at', limit: 100 });
  const usage = useReportsList(tenantId, 'ai_usage_counters', { orderBy: 'usage_date', limit: 30 });
  const classrooms = useAcademicList(tenantId, 'classrooms', { orderBy: 'name', ascending: true, limit: 50 });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });

  const draftRows = useMemo(() => drafts.data?.items ?? [], [drafts.data]);
  const rooms = useMemo(
    () => (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null),
    [classrooms.data],
  );
  const childNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const child of children.data?.items ?? []) map.set(child.id, child.name);
    return map;
  }, [children.data]);

  const today = todayIso();
  const usedToday = useMemo(() => {
    const row = (usage.data?.items ?? []).find((r) => r.usage_date === today);
    return row?.calls_used ?? 0;
  }, [usage.data, today]);

  const startDraft = async () => {
    const room = rooms[0];
    if (!room || drafting) return;
    setDrafting(true);
    setDraftError(null);
    setDispatched(null);
    try {
      const result = await invokeEdgeFunction('ai-draft-report', {
        scope: 'classroom',
        scopeId: room.id,
        reportType: 'weekly',
      });
      setDispatched(result.queued);
    } catch (err) {
      setDraftError(err);
    } finally {
      setDrafting(false);
      void usage.refetch();
    }
  };

  const pending = draftRows.filter((d) => d.status === 'draft').length;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="AI writes a first draft. Read it and tell your manager if anything is wrong."
        meta={
          <span style={{ display: 'inline-flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge tone="amber">Your manager sends these</Badge>
            <Badge tone={usedToday > 0 ? 'info' : 'neutral'} dot>
              {usedToday} AI {usedToday === 1 ? 'call' : 'calls'} today
            </Badge>
          </span>
        }
      />

      {mayDraft ? (
        <Card padding="lg" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
              Draft this week&apos;s reports
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              This drafts a report for every child in your classroom. It runs in the background — you will be
              notified when the drafts are ready.
            </span>
            <Button size="lg" disabled={drafting || rooms.length === 0} onClick={() => void startDraft()}>
              {drafting ? 'Starting…' : 'Draft reports'}
            </Button>
            {dispatched !== null ? (
              <Card padding="sm" accent="var(--primary)">
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                  Drafting started for {dispatched} {dispatched === 1 ? 'child' : 'children'}. Drafts appear
                  below when ready.
                </span>
              </Card>
            ) : null}
          </div>
        </Card>
      ) : null}

      {draftError ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState error={draftError} onRetry={() => setDraftError(null)} />
        </div>
      ) : null}

      <span
        style={{
          display: 'block',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {pending > 0 ? pending + ' awaiting your review' : 'Drafts'}
      </span>

      <QueryState
        isLoading={drafts.isLoading}
        error={drafts.error}
        isEmpty={draftRows.length === 0}
        emptyTitle="No drafts yet"
        emptyHint="Drafts you generate appear here to read before your manager sends them."
        onRetry={() => void drafts.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {draftRows.map((draft: Draft) => {
            const open = expandedId === draft.id;
            const isSent = draft.status === 'sent';

            return (
              <Card key={draft.id} padding="md">
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
                      {childNames.get(draft.child_id) ?? draft.child_id.slice(0, 8)}
                    </span>
                    <Badge tone={draftTone(draft.status)} dot>
                      {isSent ? 'Sent' : draft.status}
                    </Badge>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : draft.id)}
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
                    {open ? 'Hide draft' : 'Read draft'}
                  </button>

                  {open ? (
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      <p
                        lang={locale}
                        style={{
                          margin: 0,
                          fontSize: 'var(--text-sm)',
                          lineHeight: 1.6,
                          color: 'var(--text-body)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {draft.body}
                      </p>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ flex: 1, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      {formatRelative(draft.sent_at ?? draft.created_at, locale)}
                    </span>
                    {!isSent ? <Badge tone="amber">Awaiting your manager</Badge> : null}
                  </div>

                  {!isSent ? (
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                      Read the draft and raise anything wrong with your manager, who sends it to the family.
                    </span>
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
