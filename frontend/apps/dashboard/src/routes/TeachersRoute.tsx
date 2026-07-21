import { useAcademicList, useIdentityList, type IdentityRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ManagerOnly, QueryState } from '../components/States';
import { formatDate, formatNumber } from '../lib/format';
import { canManageStaff } from '../lib/permissions';

/**
 * Staff — `identity.staff_profiles` (§12: manager CRUD own tenant).
 *
 * The "Classroom scope" column is deliberate: it shows the classroom each
 * teacher is assigned to, which is exactly the boundary their RLS applies
 * (`classroom_id = ANY(current_staff_classroom_ids())`). A manager can
 * therefore see at a glance what each teacher can and cannot read — teacher
 * visibility made legible rather than implicit.
 *
 * Onboarding, suspension and reactivation are manager-only and run through the
 * `add-staff` / `suspend-staff-account` / `reactivate-staff-account` Edge
 * Functions; suspension synchronously revokes sessions (§10.6).
 */

type Staff = IdentityRow<'staff_profiles'>;

function employmentTone(status: string): 'success' | 'amber' | 'danger' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'on_leave') return 'amber';
  if (status === 'terminated') return 'danger';
  return 'neutral';
}

export function TeachersRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const [role, setRole] = useState<'all' | 'manager' | 'teacher' | 'reception'>('all');

  const staff = useIdentityList(tenantId, 'staff_profiles', { orderBy: 'created_at', limit: 300 });
  const classrooms = useAcademicList(tenantId, 'classrooms', {
    orderBy: 'name',
    ascending: true,
    limit: 200,
  });

  const classroomNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of classrooms.data?.items ?? []) map.set(room.id, room.name);
    return map;
  }, [classrooms.data]);

  const all = useMemo(() => (staff.data?.items ?? []).filter((s) => s.deleted_at === null), [staff.data]);
  const rows = role === 'all' ? all : all.filter((s) => s.role === role);

  const counts = useMemo(
    () => ({
      manager: all.filter((s) => s.role === 'manager').length,
      teacher: all.filter((s) => s.role === 'teacher').length,
      reception: all.filter((s) => s.role === 'reception').length,
      onLeave: all.filter((s) => s.employment_status === 'on_leave').length,
    }),
    [all],
  );

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: 'Staff member',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Avatar name={row.name} size={32} />
          <div style={{ display: 'grid' }}>
            <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
              {row.name}
            </span>
            <span dir="ltr" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {row.phone}
            </span>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => <Badge tone="neutral">{row.role}</Badge> },
    {
      key: 'scope',
      header: 'Classroom scope',
      render: (row) => {
        if (row.role !== 'teacher') {
          return <span style={{ color: 'var(--text-subtle)' }}>Tenant-wide</span>;
        }
        const name = row.primary_classroom_id ? classroomNames.get(row.primary_classroom_id) : null;
        return name ? (
          <Badge tone="teal">{name}</Badge>
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>Unassigned</span>
        );
      },
    },
    {
      key: 'employment_status',
      header: 'Status',
      render: (row) => (
        <Badge tone={employmentTone(row.employment_status)} dot>
          {row.employment_status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      numeric: true,
      render: (row) =>
        row.rating === null ? (
          <span style={{ color: 'var(--text-subtle)' }}>Not rated</span>
        ) : (
          formatNumber(Number(row.rating), locale)
        ),
    },
    {
      key: 'join_date',
      header: 'Joined',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.join_date, locale)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Managers, teachers and reception. The classroom scope column shows the boundary each teacher's access is limited to."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Teachers" value={counts.teacher} accent="var(--role-teacher)" />
        <StatCard label="Managers" value={counts.manager} accent="var(--role-manager)" />
        <StatCard label="Reception" value={counts.reception} />
        <StatCard label="On leave" value={counts.onLeave} accent="var(--amber-500)" />
      </div>

      {!canManageStaff(claims) ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>Adding, suspending and reactivating staff are manager actions.</ManagerOnly>
        </div>
      ) : null}

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Tabs
          items={[
            { value: 'all', label: 'All', count: all.length },
            { value: 'teacher', label: 'Teachers', count: counts.teacher },
            { value: 'manager', label: 'Managers', count: counts.manager },
            { value: 'reception', label: 'Reception', count: counts.reception },
          ]}
          value={role}
          onChange={(value) => setRole(value as typeof role)}
        />
      </div>

      <QueryState
        isLoading={staff.isLoading}
        error={staff.error}
        isEmpty={rows.length === 0}
        emptyTitle="No staff records"
        emptyHint="Staff appear here once onboarded."
        onRetry={() => void staff.refetch()}
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Staff" />
      </QueryState>
    </>
  );
}
