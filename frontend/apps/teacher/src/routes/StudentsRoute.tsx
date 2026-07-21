import { useAcademicList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, Card, Input, StatusPill, type ChildStatus } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatDate } from '../lib/format';

/**
 * Student profiles — `academic.children`, RLS-scoped to the teacher's own
 * classroom (§12: teacher "R own classroom").
 *
 * PII DISCIPLINE (§28): a teacher's screen shows what teaching requires —
 * name, classroom state, allergies and the emergency contact. Financial fields,
 * national IDs and parent employment details are deliberately not surfaced,
 * even where a row technically carries them.
 */

/**
 * `academic.children.day_path_status` is the deployed enum `day_path_status`
 * (snake_case: at_home, in_bus, classroom, playing, nap, delivered). The design
 * system's `ChildStatus` uses kebab-case and adds two presentation-only states
 * (`arrived`, `left`) that no column ever produces.
 *
 * Mapping between them is required. Previously this file held a list of
 * `ChildStatus` values and tested the DB value against it, so `at_home` and
 * `in_bus` never matched and those two states rendered no pill at all.
 */
const DAY_PATH_PILL: Record<string, ChildStatus> = {
  at_home: 'at-home',
  in_bus: 'in-bus',
  classroom: 'classroom',
  playing: 'playing',
  nap: 'nap',
  delivered: 'delivered',
};

function toPillStatus(v: string): ChildStatus | null {
  return DAY_PATH_PILL[v] ?? null;
}

export function StudentsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });
  const all = useMemo(() => (query.data?.items ?? []).filter((c) => c.deleted_at === null), [query.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.name_ar ?? '').toLowerCase().includes(term),
    );
  }, [all, search]);

  return (
    <>
      <PageHeader title="Students" subtitle="Children in your classroom." />

      <Card padding="md" style={{ marginBottom: 'var(--space-4)' }}>
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
        emptyTitle={all.length === 0 ? 'No children in your classroom' : 'No match'}
        emptyHint={all.length === 0 ? 'Children assigned to you appear here.' : 'Try a different name.'}
        onRetry={() => void query.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {rows.map((child) => {
            const open = openId === child.id;
            const pill = toPillStatus(child.day_path_status);
            return (
              <Card key={child.id} padding="md" interactive onClick={() => setOpenId(open ? null : child.id)}>
                <div style={{ display: 'grid', gap: open ? 'var(--space-4)' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Avatar name={child.name} src={null} size={44} />
                    <div style={{ display: 'grid', minWidth: 0, flex: 1 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                        {child.name}
                      </span>
                      {child.name_ar ? (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {child.name_ar}
                        </span>
                      ) : null}
                    </div>
                    {pill ? <StatusPill status={pill} lang={locale} size="sm" /> : null}
                  </div>

                  {open ? (
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      {child.allergies ? (
                        <Card padding="sm" accent="var(--danger-500)">
                          <div style={{ display: 'grid', gap: 2 }}>
                            <span
                              style={{
                                fontSize: 'var(--text-2xs)',
                                fontWeight: 'var(--weight-bold)',
                                textTransform: 'uppercase',
                                letterSpacing: 'var(--tracking-caps)',
                                color: 'var(--danger-700)',
                              }}
                            >
                              Allergies
                            </span>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                              {child.allergies}
                            </span>
                          </div>
                        </Card>
                      ) : null}

                      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                        <Row label="Package" value={<Badge tone="neutral">{child.package}</Badge>} />
                        <Row
                          label="Membership"
                          value={<Badge tone="neutral">{child.membership_status}</Badge>}
                        />
                        <Row label="Date of birth" value={<span>{formatDate(child.dob, locale)}</span>} />
                        <Row label="Blood type" value={<span>{child.blood_type ?? '—'}</span>} />
                        <Row
                          label="Emergency contact"
                          value={
                            <span dir="ltr">
                              {child.emergency_contact_name ?? '—'}
                              {child.emergency_contact_phone ? ' · ' + child.emergency_contact_phone : ''}
                            </span>
                          }
                        />
                      </div>
                    </div>
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 120 }}>{label}</span>
      <span style={{ color: 'var(--text-strong)' }}>{value}</span>
    </div>
  );
}
