import { type CSSProperties, type ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Delta text, e.g. "+12%". Omit to hide. */
  delta?: string | null;
  /** @default "up" */
  deltaDir?: 'up' | 'down';
  icon?: ReactNode;
  /** Accent for icon tile. @default primary teal */
  accent?: string;
  style?: CSSProperties;
}

/**
 * StatCard — a single dashboard metric: value, label, optional delta and icon.
 * Used across manager, accountant, and supervisor overviews.
 */
export function StatCard({
  label,
  value,
  unit = '',
  delta = null,
  deltaDir = 'up',
  icon = null,
  accent = 'var(--primary)',
  style = {},
}: StatCardProps) {
  const positive = deltaDir === 'up';
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'var(--font-sans)',
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-sm)',
              background: 'color-mix(in srgb, ' + accent + ' 12%, transparent)',
              color: accent,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--weight-extra)',
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-strong)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-muted)',
            }}
          >
            {unit}
          </span>
        )}
      </div>
      {delta !== null && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-bold)',
            color: positive ? 'var(--success-700)' : 'var(--danger-700)',
          }}
        >
          <span>{positive ? '▲' : '▼'}</span>
          {delta}
        </span>
      )}
    </div>
  );
}
