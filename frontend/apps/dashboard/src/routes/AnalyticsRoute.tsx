import { useAcademicList, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { StalenessIndicator } from '../components/StalenessIndicator';
import { formatNumber } from '../lib/format';

/**
 * Analytics — `academic.v_child_attendance_summary`.
 *
 * This is the access-controlled view over the materialized view in the
 * internal `analytics` schema. The MV is never queried directly: it is not
 * PostgREST-exposed and carries no client grant. The view is SECURITY-scoped
 * server-side, so a teacher sees only their own classroom's rows and a manager
 * the whole tenant — this page applies no filtering of its own.
 *
 * The `computed_at` staleness indicator is REQUIRED, not decorative: this is a
 * materialized snapshot refreshed by a scheduled job, and `pg_cron` is not
 * enabled on the deployed project, so the percentages are not live. Presenting
 * them as current would misrepresent the data.
 *
 * NOTE ON GRAIN: the view is grained per (child, classroom), not per child —
 * a deliberate backend fix so a teacher never sees an attendance percentage
 * that spans a classroom their RLS forbids.
 */

type Summary = AcademicRow<'v_child_attendance_summary'>;

export function AnalyticsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';

  const summary = useAcademicList(tenantId, 'v_child_attendance_summary', {
    orderBy: 'child_id',
    ascending: true,
    limit: 500,
  });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'created_at', limit: 500 });
  const classrooms = useAcademicList(tenantId, 'classrooms', {
    orderBy: 'name',
    ascending: true,
    limit: 200,
  });

  const childNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const child of children.data?.items ?? []) map.set(child.id, child.name);
    return map;
  }, [children.data]);

  const classroomNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of classrooms.data?.items ?? []) map.set(room.id, room.name);
    return map;
  }, [classrooms.data]);

  const rows = useMemo(() => summary.data?.items ?? [], [summary.data]);
  const computedAt = rows[0]?.computed_at;

  const stats = useMemo(() => {
    if (rows.length === 0) return { average: 0, below80: 0, perfect: 0 };
    let total = 0;
    let below80 = 0;
    let perfect = 0;
    for (const row of rows) {
      const pct = Number(row.attendance_pct ?? 0);
      total += pct;
      if (pct < 80) below80 += 1;
      if (pct === 100) perfect += 1;
    }
    return { average: Math.round(total / rows.length), below80, perfect };
  }, [rows]);

  const columns: Column<Summary>[] = [
    {
      key: 'child',
      header: 'Child',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {row.child_id ? (childNames.get(row.child_id) ?? row.child_id.slice(0, 8)) : '—'}
        </span>
      ),
    },
    {
      key: 'classroom',
      header: 'Classroom',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>
          {row.classroom_id ? (classroomNames.get(row.classroom_id) ?? row.classroom_id.slice(0, 8)) : '—'}
        </span>
      ),
    },
    {
      key: 'present_days',
      header: 'Present',
      numeric: true,
      render: (row) => formatNumber(row.present_days, locale),
    },
    {
      key: 'total_days',
      header: 'Days',
      numeric: true,
      render: (row) => formatNumber(row.total_days, locale),
    },
    {
      key: 'attendance_pct',
      header: 'Attendance',
      numeric: true,
      render: (row) => {
        const pct = Number(row.attendance_pct ?? 0);
        const tone = pct >= 90 ? 'success' : pct >= 80 ? 'neutral' : 'amber';
        return <Badge tone={tone}>{formatNumber(pct, locale)}%</Badge>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Per-child attendance, aggregated within each classroom. This is a materialized snapshot, not a live query."
        meta={<StalenessIndicator computedAt={computedAt} />}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard
          label="Average attendance"
          value={formatNumber(stats.average, locale)}
          unit="%"
          accent="var(--primary)"
        />
        <StatCard label="Below 80%" value={stats.below80} accent="var(--amber-500)" />
        <StatCard label="Perfect attendance" value={stats.perfect} accent="var(--success-500)" />
        <StatCard label="Records" value={rows.length} />
      </div>

      <QueryState
        isLoading={summary.isLoading}
        error={summary.error}
        isEmpty={rows.length === 0}
        emptyTitle="No attendance analytics available"
        emptyHint="The snapshot is empty. This view is refreshed by a scheduled job, which is not currently registered on this project."
        onRetry={() => void summary.refetch()}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.child_id) + ':' + String(row.classroom_id)}
          caption="Attendance snapshot"
        />
      </QueryState>
    </>
  );
}
