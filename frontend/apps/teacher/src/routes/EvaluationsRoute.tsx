import { useAcademicList, useRpcMutation, type AcademicRow, type RpcArgs } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatRelative } from '../lib/format';
import { canSubmitEvaluation } from '../lib/teacher';

/**
 * Evaluations — `submit_evaluation` (§12: teacher "CRU own classroom").
 *
 * The RPC requires a lesson: `submit_evaluation(p_child_id, p_lesson_id,
 * p_understanding, p_participation, p_behavior, p_homework, p_note?)`. A
 * teacher therefore picks the lesson first, then the child.
 *
 * NOT OPTIMISTIC and never auto-retried: the RPC writes the evaluation and may
 * feed downstream reporting, so the UI waits for the authoritative row.
 * `submit_evaluation` takes no idempotency key but is a natural
 * upsert-by-unique-key on (child, lesson), which §14.3 exempts.
 *
 * Lessons, children and existing evaluations all return RLS-scoped to this
 * teacher's own classroom; nothing is filtered client-side on top.
 */

type Evaluation = AcademicRow<'evaluations'>;
type SubmitArgs = RpcArgs<'submit_evaluation'>;
type HomeworkStatus = SubmitArgs['p_homework'];

const SCORES = [1, 2, 3, 4, 5] as const;
const HOMEWORK: HomeworkStatus[] = ['done', 'partial', 'none'];

function ScorePicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <span
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-body)',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="group" aria-label={label}>
        {SCORES.map((score) => {
          const active = score === value;
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(score)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 'var(--radius-md)',
                border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-subtle)'),
                background: active ? 'var(--teal-50)' : 'var(--surface-card)',
                color: active ? 'var(--primary)' : 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EvaluationsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const maySubmit = canSubmitEvaluation(claims);

  const [childId, setChildId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [understanding, setUnderstanding] = useState(3);
  const [participation, setParticipation] = useState(3);
  const [behavior, setBehavior] = useState(3);
  const [homework, setHomework] = useState<HomeworkStatus>('done');
  const [note, setNote] = useState('');

  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });
  const lessons = useAcademicList(tenantId, 'lessons', { orderBy: 'date', limit: 60 });
  const evaluations = useAcademicList(tenantId, 'evaluations', { orderBy: 'created_at', limit: 60 });

  const roster = useMemo(
    () => (children.data?.items ?? []).filter((c) => c.deleted_at === null),
    [children.data],
  );
  const lessonRows = useMemo(() => lessons.data?.items ?? [], [lessons.data]);
  const evaluationRows = useMemo(() => evaluations.data?.items ?? [], [evaluations.data]);

  const childNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const child of roster) map.set(child.id, child.name);
    return map;
  }, [roster]);

  const submit = useRpcMutation('submit_evaluation', {
    onSuccess: () => {
      setNote('');
      setChildId('');
      void queryClient.invalidateQueries();
    },
  });

  const ready = maySubmit && childId.length > 0 && lessonId.length > 0;

  return (
    <>
      <PageHeader title="Evaluations" subtitle="Record how a child did in a lesson." />

      {submit.error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState error={submit.error} onRetry={() => submit.reset()} />
        </div>
      ) : null}

      {submit.isSuccess ? (
        <Card padding="md" accent="var(--success-500)" style={{ marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>Evaluation saved.</span>
        </Card>
      ) : null}

      <Card padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <label
              htmlFor="lesson"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-body)',
              }}
            >
              Lesson
            </label>
            <select
              id="lesson"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              disabled={!maySubmit}
              style={{
                minHeight: 44,
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-subtle)',
                background: 'var(--surface-card)',
                color: 'var(--text-strong)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
              }}
            >
              <option value="">Select a lesson…</option>
              {lessonRows.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {(lesson.title_en ?? lesson.title_ar ?? 'Lesson') + ' · ' + lesson.date}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <label
              htmlFor="child"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-body)',
              }}
            >
              Child
            </label>
            <select
              id="child"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              disabled={!maySubmit}
              style={{
                minHeight: 44,
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-subtle)',
                background: 'var(--surface-card)',
                color: 'var(--text-strong)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
              }}
            >
              <option value="">Select a child…</option>
              {roster.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>

          <ScorePicker
            label="Understanding"
            value={understanding}
            onChange={setUnderstanding}
            disabled={!maySubmit}
          />
          <ScorePicker
            label="Participation"
            value={participation}
            onChange={setParticipation}
            disabled={!maySubmit}
          />
          <ScorePicker label="Behaviour" value={behavior} onChange={setBehavior} disabled={!maySubmit} />

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-body)',
              }}
            >
              Homework
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="group" aria-label="Homework">
              {HOMEWORK.map((status) => {
                const active = status === homework;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={active}
                    disabled={!maySubmit}
                    onClick={() => setHomework(status)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-subtle)'),
                      background: active ? 'var(--teal-50)' : 'var(--surface-card)',
                      color: active ? 'var(--primary)' : 'var(--text-body)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)',
                      cursor: 'pointer',
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!maySubmit}
          />

          <Button
            size="lg"
            fullWidth
            disabled={!ready || submit.isPending}
            onClick={() =>
              submit.mutate({
                p_child_id: childId,
                p_lesson_id: lessonId,
                p_understanding: understanding,
                p_participation: participation,
                p_behavior: behavior,
                p_homework: homework,
                ...(note.trim() ? { p_note: note.trim() } : {}),
              })
            }
          >
            {submit.isPending ? 'Saving…' : 'Save evaluation'}
          </Button>
        </div>
      </Card>

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
        Recent
      </span>

      <QueryState
        isLoading={evaluations.isLoading}
        error={evaluations.error}
        isEmpty={evaluationRows.length === 0}
        emptyTitle="No evaluations yet"
        emptyHint="Evaluations you record appear here."
        onRetry={() => void evaluations.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {evaluationRows.slice(0, 15).map((row: Evaluation) => (
            <Card key={row.id} padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>
                  {childNames.get(row.child_id) ?? row.child_id.slice(0, 8)}
                </span>
                <Badge tone="neutral">U{row.understanding}</Badge>
                <Badge tone="neutral">P{row.participation}</Badge>
                <Badge tone="neutral">B{row.behavior}</Badge>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                  {formatRelative(row.created_at, locale)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </>
  );
}
