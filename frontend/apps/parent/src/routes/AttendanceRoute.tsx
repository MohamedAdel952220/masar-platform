import { useAcademicList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StalenessIndicator } from '../components/StalenessIndicator';
import { QueryState } from '../components/States';
import { formatDate, formatNumber } from '../lib/format';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Attendance summary.
 *
 * Two sources, deliberately shown together:
 *
 *  1. `academic.v_child_attendance_summary` — the ANALYTICS surface. It reads
 *     from a materialized view refreshed by a scheduled job, so it is a
 *     SNAPSHOT, not live. `computed_at` is therefore rendered via
 *     `StalenessIndicator` and is NOT optional (§12, EPIC_10_REVIEW M3) —
 *     `pg_cron` is not installed on the deployed project, so in practice no
 *     refresh currently runs and the figure can be arbitrarily old.
 *
 *  2. `academic.attendance_records` — the LIVE table. Today's mark lands here
 *     immediately, well before any snapshot catches up.
 *
 * Showing only (1) would tell a parent their child was absent today when the
 * teacher marked them present an hour ago. The recent-days list is what makes
 * the snapshot's staleness legible rather than merely disclosed.
 *
 * The analytics schema is never queried directly — this reads the definer view
 * in `academic`, which is the only exposed path.
 */

export function AttendanceRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { selected } = useSelectedChild();

  const summary = useAcademicList(tenantId, 'v_child_attendance_summary', {
    orderBy: 'child_id',
    ascending: true,
    limit: 50,
  });
  const records = useAcademicList(tenantId, 'attendance_records', {
    orderBy: 'date',
    limit: 60,
  });

  const mine = useMemo(() => {
    if (!selected) return null;
    return (summary.data?.items ?? []).find((r) => r.child_id === selected.id) ?? null;
  }, [summary.data, selected]);

  const myRecords = useMemo(() => {
    if (!selected) return [];
    return (records.data?.items ?? []).filter((r) => r.child_id === selected.id);
  }, [records.data, selected]);

  const pct = mine?.attendance_pct ?? null;
  const present = mine?.present_days ?? 0;
  const total = mine?.total_days ?? 0;

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={selected ? selected.name + "'s record this term." : undefined}
        meta={<StalenessIndicator computedAt={mine?.computed_at} />}
      />

      <QueryState
        isLoading={summary.isLoading}
        error={summary.error}
        isEmpty={!selected}
        emptyTitle="No child selected"
        onRetry={() => void summary.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <StatCard
              label="Attendance"
              value={pct === null ? '—' : formatNumber(Math.round(pct), locale)}
              unit={pct === null ? undefined : '%'}
            />
            <StatCard label="Days present" value={formatNumber(present, locale)} />
            <StatCard label="Days counted" value={formatNumber(total, locale)} />
          </div>

          {mine === null ? (
            <Card padding="lg">
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                No snapshot has been computed for {selected?.name ?? 'this child'} yet. The recent days below
                are read live and are accurate regardless.
              </span>
            </Card>
          ) : null}

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span
                style={{
                  flex: 1,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-bold)',
                  letterSpacing: 'var(--tracking-caps)',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                Recent days
              </span>
              <Badge tone="neutral">Live</Badge>
            </div>

            <QueryState
              isLoading={records.isLoading}
              error={records.error}
              isEmpty={myRecords.length === 0}
              emptyTitle="No attendance recorded yet"
              emptyHint="Days appear here once the teacher marks the register."
              onRetry={() => void records.refetch()}
            >
              {myRecords.map((r) => (
                <Card key={r.id} padding="sm">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                      {formatDate(r.date, locale)}
                    </span>
                    <Badge tone={r.present ? 'success' : 'amber'} dot>
                      {r.present ? 'Present' : 'Absent'}
                    </Badge>
                  </div>
                </Card>
              ))}
            </QueryState>
          </div>
        </div>
      </QueryState>
    </>
  );
}
