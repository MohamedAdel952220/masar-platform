import { AppError } from '@masar/api-client';
import { Badge, Button, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import type { ReactNode } from 'react';

/**
 * The four terminal states every data surface must distinguish
 * (FRONTEND_ARCHITECTURE.md §15). Under RLS an empty result is frequently a
 * *permission* outcome, so empty copy never implies data loss.
 *
 * Composed entirely from design-system primitives and tokens — no new visual
 * language is introduced.
 */

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-sunken)',
            opacity: 1 - i * 0.12,
          }}
        />
      ))}
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-subtle)',
        }}
      >
        Loading…
      </span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card padding="lg">
      <div style={{ display: 'grid', gap: 'var(--space-2)', textAlign: 'center' }}>
        <span
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--text-strong)',
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {hint ?? 'Nothing is visible here for your account.'}
        </span>
      </div>
    </Card>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { locale } = useLocale();
  const appError = error instanceof AppError ? error : null;
  const message = appError ? appError.localized(locale) : 'Something went wrong.';
  const forbidden = appError?.code === 'PERM_ROLE_DENIED';

  return (
    <Card padding="lg" accent={forbidden ? 'var(--amber-500)' : 'var(--danger-500)'}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Badge tone={forbidden ? 'amber' : 'danger'} dot>
            {forbidden ? 'Not permitted' : 'Error'}
          </Badge>
          {appError ? (
            <code style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{appError.code}</code>
          ) : null}
        </div>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{message}</span>
        {onRetry && !forbidden ? (
          <Button variant="secondary" size="sm" onClick={onRetry} style={{ justifySelf: 'start' }}>
            Try again
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Renders when something falls outside the teacher's classroom scope.
 * Distinct from ErrorState: nothing failed — the row simply is not theirs to
 * see. RLS enforces this regardless of what the UI shows.
 */
export function OutOfScope({ children }: { children?: ReactNode }) {
  return (
    <Card padding="md" accent="var(--amber-500)">
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <Badge tone="amber">Not in your scope</Badge>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {children ?? 'This is not something your account can see.'}
        </span>
      </div>
    </Card>
  );
}

/**
 * Convenience wrapper that renders the right state for a query result.
 * Keeps every page's loading/error/empty handling identical.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyHint,
  onRetry,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyTitle: string;
  emptyHint?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle} hint={emptyHint} />;
  return <>{children}</>;
}
