import { useAcademicList, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, Input, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ManagerOnly, QueryState } from '../components/States';
import { formatDate, formatNumber } from '../lib/format';
import { canOverrideAttendance } from '../lib/permissions';

/**
 * Attendance — `academic.attendance_records` (§12: manager "R, CU (override)";
 * teacher "CU own classroom").
 *
 * Marking is the Teacher App's job (`mark_attendance` takes a whole classroom
 * and date). The Dashboard is the manager's oversight surface: who was marked,
 * by whom, and whether guardians were notified. A manager override control is
 * gated but not built in this phase — `mark_attendance` replaces a full
 * classroom register, so a single-child override needs its own deliberate
 * flow rather than a repurposed bulk call.
 */

type Attendance = AcademicRow<'attendance_records'>;

export function AttendanceRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const records = useAcademicList(tenantId, 'attendance_records', { orderBy: 'date', limit: 500 });
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

  const all = useMemo(() => records.data?.items ?? [], [records.data]);
  const rows = useMemo(() => all.filter((r) => r.date === date), [all, date]);

  const present = rows.filter((r) => r.present).length;
  const absent = rows.length - present;
  const notified = rows.filter((r) => r.notified_parent).length;
  const rate = rows.length === 0 ? 0 : Math.round((present / rows.length) * 100);

  const columns: Column<Attendance>[] = [
    {
      key: 'child',
      header: 'Child',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {childNames.get(row.child_id) ?? row.child_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'classroom',
      header: 'Classroom',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>
          {classroomNames.get(row.classroom_id) ?? row.classroom_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'present',
      header: 'Attendance',
      render: (row) => (
        <Badge tone={row.present ? 'success' : 'danger'} dot>
          {row.present ? 'Present' : 'Absent'}
        </Badge>
      ),
    },
    {
      key: 'notified_parent',
      header: 'Guardian notified',
      render: (row) =>
        row.notified_parent ? (
          <Badge tone="teal">Notified</Badge>
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>Not sent</span>
        ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.date, locale)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Daily register oversight. Teachers mark attendance in the Teacher App; this is the review surface."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Present" value={present} accent="var(--success-500)" />
        <StatCard label="Absent" value={absent} accent="var(--danger-500)" />
        <StatCard
          label="Attendance rate"
          value={formatNumber(rate, locale)}
          unit="%"
          accent="var(--primary)"
        />
        <StatCard label="Guardians notified" value={notified} />
      </div>

      {!canOverrideAttendance(claims) ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>Overriding a marked register is a manager action.</ManagerOnly>
        </div>
      ) : null}

      <Card padding="md" style={{ marginBottom: 'var(--space-5)' }}>
        <Input label="Date" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
      </Card>

      <QueryState
        isLoading={records.isLoading}
        error={records.error}
        isEmpty={rows.length === 0}
        emptyTitle="No register for this date"
        emptyHint="Attendance has not been marked for the selected day, or your account cannot see it."
        onRetry={() => void records.refetch()}
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption={'Register for ' + date} />
      </QueryState>
    </>
  );
}
