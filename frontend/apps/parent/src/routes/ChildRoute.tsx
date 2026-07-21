import { useAcademicList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, Card, StatusPill } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { toChildStatus } from '../lib/dayPath';
import { formatDate } from '../lib/format';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Child profile.
 *
 * The row a guardian receives from `academic.children` is wide — it includes
 * both parents' national IDs, jobs and phone numbers. A guardian is entitled to
 * their own family's data, so unlike the Teacher App there is no redaction
 * here; what is shown is organised rather than filtered.
 *
 * Everything on this screen is read-only. §12 gives a guardian **R** on their
 * own child; enrolment details are changed by the nursery, and the screen says
 * so instead of presenting inert edit affordances.
 */

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <span
        style={{
          fontSize: 'var(--text-2xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padding="lg">
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>{title}</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {children}
        </div>
      </div>
    </Card>
  );
}

export function ChildRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { selected, isLoading, error, refetch } = useSelectedChild();

  const classrooms = useAcademicList(tenantId, 'classrooms', { orderBy: 'name', ascending: true, limit: 50 });
  const classroomName = useMemo(() => {
    if (!selected) return null;
    return (classrooms.data?.items ?? []).find((c) => c.id === selected.classroom_id)?.name ?? null;
  }, [classrooms.data, selected]);

  return (
    <>
      <PageHeader title="Profile" subtitle="Enrolment details held by the nursery." />

      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={!selected}
        emptyTitle="No child selected"
        onRetry={refetch}
      >
        {selected ? (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <Card padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <Avatar name={selected.name} size={56} />
                <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--weight-extra)',
                      color: 'var(--text-strong)',
                    }}
                  >
                    {locale === 'ar' && selected.name_ar ? selected.name_ar : selected.name}
                  </span>
                  <StatusPill
                    status={toChildStatus(selected.day_path_status)}
                    lang={locale === 'ar' ? 'ar' : 'en'}
                    size="sm"
                  />
                </div>
              </div>
            </Card>

            <Section title="Enrolment">
              <Field label="Classroom" value={classroomName} />
              <Field label="Package" value={selected.package} />
              <Field label="Membership" value={selected.membership_status} />
              <Field label="Enrolled" value={formatDate(selected.enrolled_at, locale)} />
              <Field label="Date of birth" value={formatDate(selected.dob, locale)} />
              <Field label="Gender" value={selected.gender} />
            </Section>

            <Section title="Health & safety">
              <Field label="Blood type" value={selected.blood_type} />
              <Field label="Allergies" value={selected.allergies} />
              <Field label="Emergency contact" value={selected.emergency_contact_name} />
              <Field label="Emergency phone" value={selected.emergency_contact_phone} />
              <Field label="Relation" value={selected.emergency_contact_relation} />
            </Section>

            <Section title="Family">
              <Field label="Father" value={selected.father_name} />
              <Field label="Father's phone" value={selected.father_phone} />
              <Field label="Mother" value={selected.mother_name} />
              <Field label="Mother's phone" value={selected.mother_phone} />
            </Section>

            <Section title="Address">
              <Field label="Address" value={selected.address_line} />
              <Field label="Building" value={selected.building} />
              <Field label="Area" value={selected.area} />
              <Field label="City" value={selected.city} />
            </Section>

            <Card padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Badge tone="neutral">Read-only</Badge>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  To correct anything here, message the nursery from the Chat tab.
                </span>
              </div>
            </Card>
          </div>
        ) : null}
      </QueryState>
    </>
  );
}
