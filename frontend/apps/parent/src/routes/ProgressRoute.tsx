import { useAcademicList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { QueryState } from '../components/States';
import { formatDate } from '../lib/format';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Academic progress — evaluations joined to the lessons they were given for.
 *
 * A guardian gets **R** on their own child's evaluations and on lessons (§12).
 * Scores are 1–5 on three axes; showing the raw number alone is meaningless to
 * a parent, so each is rendered as a filled scale with its label.
 *
 * `note_ai_polished` is surfaced honestly: where a teacher used AI to polish
 * their note, the parent is told. Concealing that would misrepresent authorship
 * of something a parent reads as a personal message about their child.
 */

const AXES = [
  { key: 'understanding', label: 'Understanding' },
  { key: 'participation', label: 'Participation' },
  { key: 'behavior', label: 'Behaviour' },
] as const;

function Scale({ label, score }: { label: string; score: number }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ flex: 1, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{label}</span>
        <span
          style={{
            fontSize: 'var(--text-2xs)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--text-body)',
          }}
        >
          {score}/5
        </span>
      </div>
      <div role="img" aria-label={label + ': ' + score + ' out of 5'} style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 'var(--radius-pill)',
              background: n <= score ? 'var(--primary)' : 'var(--border-subtle)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ProgressRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const { selected } = useSelectedChild();

  const evaluations = useAcademicList(tenantId, 'evaluations', {
    orderBy: 'created_at',
    limit: 100,
  });
  const lessons = useAcademicList(tenantId, 'lessons', { orderBy: 'date', limit: 200 });

  const lessonById = useMemo(() => {
    const map = new Map<string, { title: string; date: string }>();
    for (const l of lessons.data?.items ?? []) {
      map.set(l.id, {
        title: (locale === 'ar' && l.title_ar ? l.title_ar : l.title_en) || 'Lesson',
        date: l.date,
      });
    }
    return map;
  }, [lessons.data, locale]);

  const mine = useMemo(() => {
    if (!selected) return [];
    return (evaluations.data?.items ?? []).filter((e) => e.child_id === selected.id);
  }, [evaluations.data, selected]);

  return (
    <>
      <PageHeader
        title="Progress"
        subtitle={
          selected
            ? 'How ' + (selected.name.split(' ')[0] ?? selected.name) + ' is doing, lesson by lesson.'
            : undefined
        }
      />

      <QueryState
        isLoading={evaluations.isLoading}
        error={evaluations.error}
        isEmpty={mine.length === 0}
        emptyTitle="No evaluations yet"
        emptyHint="Teachers add these as lessons are completed."
        onRetry={() => void evaluations.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {mine.map((e) => {
            const lesson = lessonById.get(e.lesson_id);
            return (
              <Card key={e.id} padding="md">
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {lesson?.title ?? 'Lesson'}
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      {formatDate(lesson?.date ?? e.created_at, locale)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {AXES.map((axis) => (
                      <Scale key={axis.key} label={axis.label} score={e[axis.key]} />
                    ))}
                  </div>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}
                  >
                    <Badge tone={e.homework === 'done' ? 'success' : 'amber'} dot>
                      Homework: {e.homework}
                    </Badge>
                    {e.note_ai_polished ? <Badge tone="info">Note polished with AI</Badge> : null}
                  </div>

                  {e.note ? (
                    <p
                      lang={locale}
                      style={{
                        margin: 0,
                        fontSize: 'var(--text-sm)',
                        lineHeight: 1.6,
                        color: 'var(--text-body)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {e.note}
                    </p>
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
