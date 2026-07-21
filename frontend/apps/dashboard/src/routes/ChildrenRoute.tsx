import { useAcademicList, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, Card, Input, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ManagerOnly, QueryState } from '../components/States';
import { formatDate } from '../lib/format';
import { canManageChildren } from '../lib/permissions';

/**
 * Children — `academic.children` (§12: manager CRUD; teacher R own classroom).
 *
 * RLS decides which children return: a manager sees the whole tenant, a teacher
 * only their own classroom. No client-side scoping is applied on top of policy.
 *
 * Enrolment and withdrawal are manager-only and run through the `enroll-child`
 * Edge Function and `withdraw_child` RPC. This phase surfaces the roster and
 * its state; the enrolment form is a documented follow-up rather than a
 * half-built control.
 */

type Child = AcademicRow<'children'>;

function membershipTone(status: string): 'success' | 'amber' | 'danger' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'overdue') return 'amber';
  if (status === 'suspended') return 'danger';
  return 'neutral';
}

export function ChildrenRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const [search, setSearch] = useState('');

  const query = useAcademicList(tenantId, 'children', { orderBy: 'created_at', limit: 500 });
  const all = useMemo(() => (query.data?.items ?? []).filter((c) => c.deleted_at === null), [query.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.name_ar ?? '').toLowerCase().includes(term),
    );
  }, [all, search]);

  const active = all.filter((c) => c.membership_status === 'active').length;
  const overdue = all.filter((c) => c.membership_status === 'overdue').length;
  const suspended = all.filter((c) => c.membership_status === 'suspended').length;

  const columns: Column<Child>[] = [
    {
      key: 'name',
      header: 'Child',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Avatar name={row.name} size={32} />
          <div style={{ display: 'grid' }}>
            <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
              {row.name}
            </span>
            {row.name_ar ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{row.name_ar}</span>
            ) : null}
          </div>
        </div>
      ),
    },
    { key: 'package', header: 'Package', render: (row) => <Badge tone="neutral">{row.package}</Badge> },
    {
      key: 'membership_status',
      header: 'Membership',
      render: (row) => (
        <Badge tone={membershipTone(row.membership_status)} dot>
          {row.membership_status}
        </Badge>
      ),
    },
    {
      key: 'day_path_status',
      header: 'Today',
      render: (row) => <Badge tone="teal">{row.day_path_status}</Badge>,
    },
    {
      key: 'enrolled_at',
      header: 'Enrolled',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.enrolled_at, locale)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Children"
        subtitle="The nursery roster. Your account sees the children your role is permitted to see."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Active" value={active} accent="var(--success-500)" />
        <StatCard label="Overdue" value={overdue} accent="var(--amber-500)" />
        <StatCard label="Suspended" value={suspended} accent="var(--danger-500)" />
        <StatCard label="Total" value={all.length} />
      </div>

      {!canManageChildren(claims) ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>
            Enrolment, withdrawal and suspension are manager actions. You are viewing your classroom roster.
          </ManagerOnly>
        </div>
      ) : null}

      <Card padding="md" style={{ marginBottom: 'var(--space-5)' }}>
        <Input
          label="Search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyTitle={all.length === 0 ? 'No children enrolled' : 'No children match that search'}
        emptyHint={all.length === 0 ? 'Enrolled children appear here.' : 'Try a different name.'}
        onRetry={() => void query.refetch()}
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Roster" />
      </QueryState>
    </>
  );
}
