import { useAcademicList, useRpcMutation, type AcademicRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, Button, Card, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatDate, todayIso } from '../lib/format';
import { canMarkAttendance } from '../lib/teacher';

/**
 * Attendance register — the teacher's core daily write (§12: teacher
 * "CU own classroom").
 *
 * `mark_attendance(p_classroom_id, p_date, p_records)` replaces the whole
 * register for a classroom on a date, so this screen submits every child at
 * once rather than one row at a time.
 *
 * IDEMPOTENCY: this RPC accepts no idempotency key, yet it is *not* one of the
 * seven non-idempotent RPCs — because it is a natural upsert-by-unique-key
 * (`attendance_records` is unique on `(child_id, date)`), which §14.3
 * explicitly exempts. Re-submitting the same classroom and date overwrites the
 * same rows rather than duplicating them, so a retry is safe by construction.
 * The mutation is still never auto-retried (the hook hard-codes retry:false).
 *
 * NOT OPTIMISTIC: the RPC writes the register and queues guardian
 * notifications server-side, so the UI waits for the authoritative result.
 *
 * Children come back RLS-scoped to this teacher's own classroom; no
 * client-side filtering is applied on top of policy.
 */

type Child = AcademicRow<'children'>;

export function AttendanceRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const mayMark = canMarkAttendance(claims);

  const [date, setDate] = useState(todayIso);
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const classrooms = useAcademicList(tenantId, 'classrooms', { orderBy: 'name', ascending: true, limit: 50 });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });
  const records = useAcademicList(tenantId, 'attendance_records', { orderBy: 'date', limit: 500 });

  const rooms = useMemo(
    () => (classrooms.data?.items ?? []).filter((c) => c.deleted_at === null),
    [classrooms.data],
  );
  const activeRoom = classroomId ?? rooms[0]?.id ?? null;

  const roster = useMemo(
    () =>
      (children.data?.items ?? []).filter(
        (c) => c.deleted_at === null && (activeRoom === null || c.classroom_id === activeRoom),
      ),
    [children.data, activeRoom],
  );

  /** Existing register for the selected day, if one was already marked. */
  const existing = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of records.data?.items ?? []) {
      if (row.date === date && (activeRoom === null || row.classroom_id === activeRoom)) {
        map.set(row.child_id, row.present);
      }
    }
    return map;
  }, [records.data, date, activeRoom]);

  // Seed the form from the saved register whenever the day or room changes.
  useEffect(() => {
    const seeded: Record<string, boolean> = {};
    for (const child of roster) seeded[child.id] = existing.get(child.id) ?? true;
    setMarks(seeded);
    setDirty(false);
  }, [date, activeRoom, roster, existing]);

  const markAttendance = useRpcMutation('mark_attendance', {
    onSuccess: () => {
      setDirty(false);
      void queryClient.invalidateQueries();
    },
  });

  const presentCount = roster.filter((c) => marks[c.id]).length;
  const alreadyMarked = existing.size > 0;

  const setChild = (childId: string, present: boolean) => {
    setMarks((prev) => ({ ...prev, [childId]: present }));
    setDirty(true);
  };

  const submit = () => {
    if (!activeRoom) return;
    markAttendance.mutate({
      p_classroom_id: activeRoom,
      p_date: date,
      p_records: roster.map((child) => ({ child_id: child.id, present: marks[child.id] ?? false })),
    });
  };

  return (
    <>
      <PageHeader
        title="Register"
        subtitle={formatDate(date, locale)}
        meta={
          alreadyMarked ? (
            <Badge tone="success" dot>
              Marked — editing replaces the saved register
            </Badge>
          ) : (
            <Badge tone="amber" dot>
              Not marked yet
            </Badge>
          )
        }
      />

      {rooms.length > 1 ? (
        <div
          style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}
        >
          {rooms.map((room) => {
            const active = room.id === activeRoom;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setClassroomId(room.id)}
                style={{
                  minHeight: 44,
                  padding: '0 var(--space-4)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-subtle)'),
                  background: active ? 'var(--teal-50)' : 'var(--surface-card)',
                  color: active ? 'var(--primary)' : 'var(--text-body)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)',
                  cursor: 'pointer',
                }}
              >
                {room.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <Card padding="md" style={{ marginBottom: 'var(--space-4)' }}>
        <Input label="Date" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
      </Card>

      {markAttendance.error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState error={markAttendance.error} onRetry={() => markAttendance.reset()} />
        </div>
      ) : null}

      {markAttendance.isSuccess && !dirty ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Card padding="md" accent="var(--success-500)">
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
              Register saved. Guardians are notified by the nursery&apos;s notification settings.
            </span>
          </Card>
        </div>
      ) : null}

      <QueryState
        isLoading={children.isLoading || classrooms.isLoading}
        error={children.error ?? classrooms.error}
        isEmpty={roster.length === 0}
        emptyTitle="No children in your classroom"
        emptyHint="Children assigned to your classroom appear here."
        onRetry={() => void children.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {roster.map((child: Child) => {
            const present = marks[child.id] ?? true;
            return (
              <Card key={child.id} padding="md">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Avatar name={child.name} size={40} status={present ? 'present' : 'absent'} />
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
                  <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                    <Button
                      size="sm"
                      variant={present ? 'primary' : 'secondary'}
                      disabled={!mayMark || markAttendance.isPending}
                      onClick={() => setChild(child.id, true)}
                    >
                      Present
                    </Button>
                    <Button
                      size="sm"
                      variant={!present ? 'danger' : 'secondary'}
                      disabled={!mayMark || markAttendance.isPending}
                      onClick={() => setChild(child.id, false)}
                    >
                      Absent
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </QueryState>

      {roster.length > 0 && mayMark ? (
        <div
          style={{
            position: 'sticky',
            insetBlockEnd: 'var(--space-4)',
            marginBlockStart: 'var(--space-5)',
            display: 'grid',
            gap: 'var(--space-2)',
          }}
        >
          <Card padding="md">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', flex: 1 }}>
                {presentCount} of {roster.length} present
              </span>
              <Button size="lg" disabled={markAttendance.isPending || !activeRoom} onClick={submit}>
                {markAttendance.isPending ? 'Saving…' : alreadyMarked ? 'Update register' : 'Submit register'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
