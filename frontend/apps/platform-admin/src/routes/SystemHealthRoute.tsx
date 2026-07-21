import { useJobsList, type JobsRow } from '@masar/api-client';
import { Badge, Card, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatNumber, formatRelative, shortId } from '../lib/format';

/**
 * System Health — job observability (§27).
 *
 * Two surfaces, both in the `jobs` schema:
 *   scheduled_job_runs   — run history for every registered scheduled job
 *   background_job_queue  — the event-driven retry queue
 *
 * §27: "a run that ends failed triggers the background-job-repeatedly-failing
 * notification — this is what Platform Admin's system health view partially
 * surfaces." Read-only for every tier.
 */

type RunRow = JobsRow<'scheduled_job_runs'>;
type QueueRow = JobsRow<'background_job_queue'>;

function runTone(status: string): 'success' | 'amber' | 'danger' | 'neutral' {
  if (status === 'succeeded') return 'success';
  if (status === 'running') return 'amber';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

function queueTone(status: string): 'success' | 'amber' | 'danger' | 'neutral' {
  if (status === 'succeeded') return 'success';
  if (status === 'processing') return 'amber';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export function SystemHealthRoute() {
  const { locale } = useLocale();
  const [tab, setTab] = useState('runs');

  const runs = useJobsList('scheduled_job_runs', { orderBy: 'started_at', limit: 50 });
  const queue = useJobsList('background_job_queue', { orderBy: 'created_at', limit: 50 });

  const runRows = runs.data?.items ?? [];
  const queueRows = queue.data?.items ?? [];
  const failedRuns = runRows.filter((r) => r.status === 'failed').length;
  const failedJobs = queueRows.filter((r) => r.status === 'failed').length;

  const runColumns: Column<RunRow>[] = [
    {
      key: 'job_name',
      header: 'Job',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.job_name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={runTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'rows_affected',
      header: 'Rows',
      numeric: true,
      render: (row) => formatNumber(row.rows_affected, locale),
    },
    {
      key: 'started_at',
      header: 'Started',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.started_at, locale)}</span>
      ),
    },
    {
      key: 'error',
      header: 'Error',
      render: (row) =>
        row.error ? (
          <span style={{ color: 'var(--danger-700)', fontSize: 'var(--text-xs)' }}>{row.error}</span>
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>—</span>
        ),
    },
  ];

  const queueColumns: Column<QueueRow>[] = [
    {
      key: 'job_type',
      header: 'Job type',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.job_type}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={queueTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      numeric: true,
      render: (row) => formatNumber(row.attempts, locale) + ' / ' + formatNumber(row.max_attempts, locale),
    },
    {
      key: 'next_attempt_at',
      header: 'Next attempt',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.next_attempt_at, locale)}</span>
      ),
    },
    {
      key: 'id',
      header: 'ID',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.id)}</code>,
    },
  ];

  return (
    <>
      <PageHeader
        title="System Health"
        subtitle="Scheduled-job run history and the background job queue. A failed run is what the failing-job alert is raised from (§27)."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Recent runs" value={runRows.length} />
        <StatCard label="Failed runs" value={failedRuns} accent="var(--danger-500)" />
        <StatCard label="Queued jobs" value={queueRows.length} />
        <StatCard label="Failed jobs" value={failedJobs} accent="var(--danger-500)" />
      </div>

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'runs', label: 'Scheduled runs', count: runRows.length },
            { value: 'queue', label: 'Background queue', count: queueRows.length },
          ]}
          value={tab}
          onChange={setTab}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {tab === 'runs' ? (
        <QueryState
          isLoading={runs.isLoading}
          error={runs.error}
          isEmpty={runRows.length === 0}
          emptyTitle="No scheduled job runs recorded"
          emptyHint="No job has executed yet. Scheduled jobs require the pg_cron extension, which is not currently enabled on this project."
          onRetry={() => void runs.refetch()}
        >
          <DataTable
            columns={runColumns}
            rows={runRows}
            rowKey={(row) => row.id}
            caption="Most recent runs"
          />
        </QueryState>
      ) : (
        <QueryState
          isLoading={queue.isLoading}
          error={queue.error}
          isEmpty={queueRows.length === 0}
          emptyTitle="Background queue is empty"
          emptyHint="No event-triggered jobs are pending."
          onRetry={() => void queue.refetch()}
        >
          <DataTable columns={queueColumns} rows={queueRows} rowKey={(row) => row.id} caption="Queued work" />
        </QueryState>
      )}
    </>
  );
}
