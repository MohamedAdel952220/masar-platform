import { AppError, invokeEdgeFunction, useReportsList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState } from '../components/States';
import { todayIso } from '../lib/format';

/**
 * AI Polish Note — the `ai-polish-note` Edge Function (§19).
 *
 * INTERACTIVE, NOT BATCH: polishing one note is a short request, so it runs
 * with an explicit pending state rather than the notification-driven pattern
 * the classroom-wide draft uses.
 *
 * QUOTA (§19): `reports.ai_usage_counters` records `calls_used` per day and the
 * cap is enforced SERVER-SIDE by the Edge Function. Today's usage is shown
 * BEFORE the teacher composes, so the limit is learned up front rather than at
 * rejection — but the client never decides the limit. When the cap is hit the
 * backend's own bilingual message is surfaced verbatim.
 *
 * RATE LIMITING: §28 specifies a per-caller limit on `ai_polish_note`, but it
 * is NOT implemented backend-side (BACKEND_CERTIFICATION.md §7.2). The in-flight
 * lock below is a courtesy control to avoid accidental double-taps — it is
 * explicitly NOT a security boundary.
 *
 * The polished text is returned to the teacher to use as they see fit; nothing
 * is sent to a guardian from this screen.
 */

export function AiPolishRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';

  const [raw, setRaw] = useState('');
  const [polished, setPolished] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  const usage = useReportsList(tenantId, 'ai_usage_counters', { orderBy: 'usage_date', limit: 30 });
  const today = todayIso();

  const usedToday = useMemo(() => {
    const row = (usage.data?.items ?? []).find((r) => r.usage_date === today);
    return row?.calls_used ?? 0;
  }, [usage.data, today]);

  const polish = async () => {
    if (busy || raw.trim().length === 0) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await invokeEdgeFunction('ai-polish-note', { rawText: raw.trim() });
      setPolished(result.polishedText);
    } catch (err) {
      setError(err);
      setPolished(null);
    } finally {
      setBusy(false);
      void usage.refetch();
    }
  };

  return (
    <>
      <PageHeader
        title="Polish a note"
        subtitle="Turn a quick note into something ready to share. You stay in control of the wording."
        meta={
          <Badge tone={usedToday > 0 ? 'info' : 'neutral'} dot>
            {usedToday} AI {usedToday === 1 ? 'call' : 'calls'} used today
          </Badge>
        }
      />

      <Card padding="lg" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <label
              htmlFor="raw-note"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-body)',
              }}
            >
              Your note
            </label>
            <textarea
              id="raw-note"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder="e.g. omar did well today, joined circle time, still shy at snack"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-subtle)',
                background: 'var(--surface-card)',
                color: 'var(--text-strong)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                resize: 'vertical',
              }}
            />
          </div>

          <Button
            size="lg"
            fullWidth
            disabled={busy || raw.trim().length === 0}
            onClick={() => void polish()}
          >
            {busy ? 'Polishing…' : 'Polish note'}
          </Button>
        </div>
      </Card>

      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState
            error={error}
            onRetry={
              error instanceof AppError && error.code === 'RATE_LIMITED' ? undefined : () => setError(null)
            }
          />
        </div>
      ) : null}

      {polished ? (
        <Card padding="lg" accent="var(--primary)">
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Badge tone="teal" dot>
                Suggested wording
              </Badge>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                Review before you use it
              </span>
            </div>
            <p
              lang={locale}
              style={{
                margin: 0,
                fontSize: 'var(--text-base)',
                lineHeight: 1.6,
                color: 'var(--text-strong)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {polished}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(polished);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}
