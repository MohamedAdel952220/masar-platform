import { useAcademicList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { OutOfScope, QueryState } from '../components/States';
import { formatDate, todayIso } from '../lib/format';

/**
 * Classroom dashboard — the teacher's own room (§12: teacher "R own").
 *
 * RLS returns only the classroom(s) this teacher is assigned to, so an empty
 * result means the teacher genuinely has no assignment — surfaced as an
 * explicit state rather than a blank screen.
 */
export function ClassroomRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const today = todayIso();

  const classrooms = useAcademicList(tenantId, 'classrooms', { orderBy: 'name', ascending: true, limit: 50 });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });
  const lessons = useAcademicList(tenantId, 'lessons', { orderBy: 'date', limit: 40 });
  const records = useAcademicList(tenantId, 'attendance_records', { orderBy: 'date', limit: 300 });

  const rooms = useMemo(
    () => (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null),
    [classrooms.data],
  );
  const room = rooms[0] ?? null;
  const roster = useMemo(
    () => (children.data?.items ?? []).filter((c) => c.deleted_at === null),
    [children.data],
  );
  const lessonRows = useMemo(() => lessons.data?.items ?? [], [lessons.data]);
  const todayRegister = useMemo(
    () => (records.data?.items ?? []).filter((r) => r.date === today),
    [records.data, today],
  );

  if (!classrooms.isLoading && rooms.length === 0) {
    return (
      <>
        <PageHeader title="Classroom" subtitle="Your assigned room." />
        <OutOfScope>
          You are not currently assigned to a classroom. Ask your manager to assign you, then this will fill
          in.
        </OutOfScope>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={room?.name ?? 'Classroom'}
        subtitle={
          room ? room.grade + ' · ' + room.age_min_months + '-' + room.age_max_months + ' months' : undefined
        }
        meta={room?.color_tag ? <Badge tone="teal">Room colour set</Badge> : undefined}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <StatCard label="Children" value={roster.length} accent="var(--primary)" />
        <StatCard label="Capacity" value={room?.capacity ?? '—'} />
        <StatCard label="Marked today" value={todayRegister.length} accent="var(--success-500)" />
      </div>

      <span
        style={{
          display: 'block',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Recent lessons
      </span>

      <QueryState
        isLoading={lessons.isLoading}
        error={lessons.error}
        isEmpty={lessonRows.length === 0}
        emptyTitle="No lessons recorded"
        emptyHint="Lessons for your classroom appear here."
        onRetry={() => void lessons.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {lessonRows.slice(0, 12).map((lesson) => (
            <Card key={lesson.id} padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>
                  {lesson.title_en ?? lesson.title_ar ?? 'Lesson'}
                </span>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                  {formatDate(lesson.date, locale)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </>
  );
}
