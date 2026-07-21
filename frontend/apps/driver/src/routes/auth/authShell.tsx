import { Badge, Button, Card, CenteredLayout } from '@masar/design-system';
import type { ReactNode } from 'react';

/**
 * Shared chrome for every unauthenticated screen in this portal.
 *
 * Extracted so activation, password reset and session-ended screens are
 * visually identical to the sign-in screen that already existed — this phase
 * adds flows, it does not introduce a second visual language.
 *
 * `CenteredLayout` is the design system's own unauthenticated layout; the
 * heading/alert/action rhythm below mirrors `LoginRoute` exactly.
 */

export function AuthShell({
  badge,
  title,
  intro,
  children,
  footer,
  maxWidth = 380,
}: {
  badge?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <CenteredLayout maxWidth={maxWidth}>
      <Card padding="lg">
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)', justifyItems: 'start' }}>
            {badge ? (
              <Badge tone="teal" dot>
                {badge}
              </Badge>
            ) : null}
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-extra)',
                color: 'var(--text-strong)',
              }}
            >
              {title}
            </h1>
            {intro ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{intro}</p>
            ) : null}
          </div>
          {children}
          {footer}
        </div>
      </Card>
    </CenteredLayout>
  );
}

/**
 * Inline alert. `role="alert"` on failures so a screen reader announces them
 * without the user having to hunt for what changed (§21).
 */
export function AuthAlert({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const palette =
    tone === 'error'
      ? { bg: 'var(--danger-50)', fg: 'var(--danger-700)', border: 'var(--danger-500)' }
      : tone === 'success'
        ? { bg: 'var(--teal-50)', fg: 'var(--teal-700)', border: 'var(--teal-500)' }
        : { bg: 'var(--surface-sunken, #f4f4f2)', fg: 'var(--text-body)', border: 'var(--border-subtle)' };

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        background: palette.bg,
        color: palette.fg,
        border: '1px solid ' + palette.border,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        fontSize: 'var(--text-sm)',
      }}
    >
      {children}
    </div>
  );
}

/** Text link styled as a quiet action, ≥44px target (§21). */
export function AuthLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} style={{ minHeight: 44, justifySelf: 'start' }}>
      {children}
    </Button>
  );
}
