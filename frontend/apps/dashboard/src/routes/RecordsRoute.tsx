import { useAcademicList, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatRelative, shortId } from '../lib/format';

/**
 * Academic Records — evaluations, lessons and concerns.
 *
 * §12 scoping, enforced by RLS not by this file:
 *   Evaluations / Lessons — teacher CRU own classroom, manager R
 *   Concerns              — teacher C + R own, manager CRUD
 *
 * A teacher opening this page sees only their own classroom's records because
 * the policies say so; a manager sees the tenant. Writing evaluations is the
 * Teacher App's job (`submit_evaluation`), so this is a read surface.
 */

type Evaluation = AcademicRow<'evaluations'>;
type Concern = AcademicRow<'concerns'>;
type Lesson = AcademicRow<'lessons'>;

function priorityTone(priority: string): 'info' | 'amber' | 'danger' | 'neutral' {
  if (priority === 'urgent') return 'danger';
  if (priority === 'attention') return 'amber';
  if (priority === 'info') return 'info';
  return 'neutral';
}

function concernTone(status: string): 'amber' | 'info' | 'success' | 'neutral' {
  if (status === 'open') return 'amber';
  if (status === 'acknowledged') return 'info';
  if (status === 'resolved') return 'success';
  return 'neutral';
}

export function RecordsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const [tab, setTab] = useState('evaluations');

  const evaluations = useAcademicList(
    tenantId,
    'evaluations',
    { orderBy: 'created_at', limit: 200 },
    tab === 'evaluations',
  );
  const concerns = useAcademicList(
    tenantId,
    'concerns',
    { orderBy: 'created_at', limit: 200 },
    tab === 'concerns',
  );
  const lessons = useAcademicList(
    tenantId,
    'lessons',
    { orderBy: 'created_at', limit: 200 },
    tab === 'lessons',
  );
  const children = useAcademicList(tenantId, 'children', { orderBy: 'created_at', limit: 500 });

  const childNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const child of children.data?.items ?? []) map.set(child.id, child.name);
    return map;
  }, [children.data]);

  const evaluationRows = evaluations.data?.items ?? [];
  const concernRows = concerns.data?.items ?? [];
  const lessonRows = lessons.data?.items ?? [];

  const openConcerns = concernRows.filter((c) => c.status === 'open').length;
  const urgentConcerns = concernRows.filter((c) => c.priority === 'urgent' && c.status !== 'resolved').length;

  const evaluationColumns: Column<Evaluation>[] = [
    {
      key: 'child',
      header: 'Child',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {childNames.get(row.child_id) ?? shortId(row.child_id)}
        </span>
      ),
    },
    {
      key: 'understanding',
      header: 'Understanding',
      render: (row) => <Badge tone="neutral">{row.understanding}</Badge>,
    },
    {
      key: 'participation',
      header: 'Participation',
      render: (row) => <Badge tone="neutral">{row.participation}</Badge>,
    },
    { key: 'behavior', header: 'Behaviour', render: (row) => <Badge tone="neutral">{row.behavior}</Badge> },
    {
      key: 'homework',
      header: 'Homework',
      render: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.homework ?? '—'}</span>,
    },
    {
      key: 'created_at',
      header: 'Recorded',
      render: (row) => (
        <span style={{ color: 'var(--text-subtle)' }}>{formatRelative(row.created_at, locale)}</span>
      ),
    },
  ];

  const concernColumns: Column<Concern>[] = [
    {
      key: 'child',
      header: 'Child',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {childNames.get(row.child_id) ?? shortId(row.child_id)}
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="neutral">{row.category}</Badge> },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <Badge tone={priorityTone(row.priority)} dot>
          {row.priority}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={concernTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'message',
      header: 'Detail',
      render: (row) => (
        <span
          style={{
            color: 'var(--text-muted)',
            display: 'inline-block',
            maxWidth: '40ch',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.message}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Raised',
      render: (row) => (
        <span style={{ color: 'var(--text-subtle)' }}>{formatRelative(row.created_at, locale)}</span>
      ),
    },
  ];

  const lessonColumns: Column<Lesson>[] = [
    {
      key: 'id',
      header: 'Lesson',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.id)}</code>,
    },
    {
      key: 'created_at',
      header: 'Recorded',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.created_at, locale)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Academic Records"
        subtitle="Evaluations, lessons and concerns. Teachers see their own classroom; managers see the nursery."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Evaluations" value={evaluationRows.length} />
        <StatCard label="Open concerns" value={openConcerns} accent="var(--amber-500)" />
        <StatCard label="Urgent concerns" value={urgentConcerns} accent="var(--danger-500)" />
      </div>

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'evaluations', label: 'Evaluations' },
            { value: 'concerns', label: 'Concerns' },
            { value: 'lessons', label: 'Lessons' },
          ]}
          value={tab}
          onChange={setTab}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {tab === 'evaluations' ? (
        <QueryState
          isLoading={evaluations.isLoading}
          error={evaluations.error}
          isEmpty={evaluationRows.length === 0}
          emptyTitle="No evaluations"
          emptyHint="Evaluations submitted by teachers appear here."
          onRetry={() => void evaluations.refetch()}
        >
          <DataTable
            columns={evaluationColumns}
            rows={evaluationRows}
            rowKey={(row) => row.id}
            caption="Evaluations"
          />
        </QueryState>
      ) : tab === 'concerns' ? (
        <QueryState
          isLoading={concerns.isLoading}
          error={concerns.error}
          isEmpty={concernRows.length === 0}
          emptyTitle="No concerns raised"
          emptyHint="Concerns raised about a child appear here."
          onRetry={() => void concerns.refetch()}
        >
          <DataTable
            columns={concernColumns}
            rows={concernRows}
            rowKey={(row) => row.id}
            caption="Concerns"
          />
        </QueryState>
      ) : (
        <QueryState
          isLoading={lessons.isLoading}
          error={lessons.error}
          isEmpty={lessonRows.length === 0}
          emptyTitle="No lessons recorded"
          emptyHint="Lessons appear here once recorded."
          onRetry={() => void lessons.refetch()}
        >
          <DataTable columns={lessonColumns} rows={lessonRows} rowKey={(row) => row.id} caption="Lessons" />
        </QueryState>
      )}
    </>
  );
}
