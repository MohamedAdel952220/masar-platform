import { useAcademicList, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, StatCard } from '@masar/design-system';
import { useMemo } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ManagerOnly, QueryState } from '../components/States';
import { canManageClassrooms } from '../lib/permissions';

/**
 * Classrooms — `academic.classrooms` (§12: manager CRUD; teacher R own).
 *
 * Occupancy is derived from the RLS-scoped children read, so the counts a
 * teacher sees reflect only their own classroom rather than the whole tenant.
 */

type Classroom = AcademicRow<'classrooms'>;

export function ClassroomsRoute() {
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';

  const classrooms = useAcademicList(tenantId, 'classrooms', {
    orderBy: 'name',
    ascending: true,
    limit: 200,
  });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'created_at', limit: 500 });

  const rows = useMemo(
    () => (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null),
    [classrooms.data],
  );

  const occupancy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const child of children.data?.items ?? []) {
      if (child.deleted_at !== null || !child.classroom_id) continue;
      counts.set(child.classroom_id, (counts.get(child.classroom_id) ?? 0) + 1);
    }
    return counts;
  }, [children.data]);

  const totalCapacity = rows.reduce((sum, room) => sum + room.capacity, 0);
  const totalEnrolled = rows.reduce((sum, room) => sum + (occupancy.get(room.id) ?? 0), 0);

  const columns: Column<Classroom>[] = [
    {
      key: 'name',
      header: 'Classroom',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {row.color_tag ? (
            <span
              style={{ width: 10, height: 10, borderRadius: '50%', background: row.color_tag, flex: 'none' }}
            />
          ) : null}
          <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
            {row.name}
          </span>
        </div>
      ),
    },
    { key: 'grade', header: 'Grade', render: (row) => <Badge tone="neutral">{row.grade}</Badge> },
    {
      key: 'age',
      header: 'Age range',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>
          {row.age_min_months}-{row.age_max_months} months
        </span>
      ),
    },
    {
      key: 'occupancy',
      header: 'Enrolled / capacity',
      numeric: true,
      render: (row) => {
        const enrolled = occupancy.get(row.id) ?? 0;
        const full = enrolled >= row.capacity;
        return (
          <span
            style={{
              fontWeight: 'var(--weight-semibold)',
              color: full ? 'var(--amber-700)' : 'var(--text-strong)',
            }}
          >
            {enrolled} / {row.capacity}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Classrooms" subtitle="Rooms, grade bands and current occupancy." />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Classrooms" value={rows.length} />
        <StatCard label="Enrolled" value={totalEnrolled} accent="var(--primary)" />
        <StatCard label="Total capacity" value={totalCapacity} />
      </div>

      {!canManageClassrooms(claims) ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>Creating and editing classrooms is a manager action.</ManagerOnly>
        </div>
      ) : null}

      <QueryState
        isLoading={classrooms.isLoading}
        error={classrooms.error}
        isEmpty={rows.length === 0}
        emptyTitle="No classrooms"
        emptyHint="Classrooms appear here once created."
        onRetry={() => void classrooms.refetch()}
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Classrooms" />
      </QueryState>
    </>
  );
}
