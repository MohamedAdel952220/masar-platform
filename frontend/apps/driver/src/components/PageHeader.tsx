import type { ReactNode } from 'react';

/** Consistent page title block. Tokens only — no new visual language. */
export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  /** Right-aligned (inline-end) action slot. */
  actions?: ReactNode;
  /** Secondary line below the subtitle — e.g. a staleness indicator. */
  meta?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-extra)',
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-strong)',
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: '68ch' }}>
            {subtitle}
          </p>
        ) : null}
        {meta}
      </div>
      {actions ? (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>{actions}</div>
      ) : null}
    </header>
  );
}
