import { type CSSProperties, type ReactNode } from 'react';

export interface BadgeProps {
  children?: ReactNode;
  /** Color family. @default "neutral" */
  tone?: 'neutral' | 'teal' | 'amber' | 'success' | 'danger' | 'info';
  /** Filled background instead of tinted surface. @default false */
  solid?: boolean;
  /** Show a leading status dot. @default false */
  dot?: boolean;
  style?: CSSProperties;
}

/**
 * Compact status/label chip. tone sets the color family; soft (default) uses a
 * tinted surface, solid uses a filled background. Optional leading dot.
 */
export function Badge({
  children,
  tone = 'neutral',
  solid = false,
  dot = false,
  style = {},
  ...rest
}: BadgeProps) {
  const tones = {
    neutral: {
      soft: ['var(--neutral-200)', 'var(--neutral-700)'],
      solid: ['var(--neutral-700)', '#fff'],
      d: 'var(--neutral-500)',
    },
    teal: {
      soft: ['var(--teal-50)', 'var(--teal-700)'],
      solid: ['var(--teal-600)', '#fff'],
      d: 'var(--teal-500)',
    },
    amber: {
      soft: ['var(--amber-50)', 'var(--amber-700)'],
      solid: ['var(--amber-500)', '#1C1C1A'],
      d: 'var(--amber-500)',
    },
    success: {
      soft: ['var(--success-50)', 'var(--success-700)'],
      solid: ['var(--success-500)', '#fff'],
      d: 'var(--success-500)',
    },
    danger: {
      soft: ['var(--danger-50)', 'var(--danger-700)'],
      solid: ['var(--danger-500)', '#fff'],
      d: 'var(--danger-500)',
    },
    info: {
      soft: ['var(--info-50)', 'var(--info-700)'],
      solid: ['var(--info-500)', '#fff'],
      d: 'var(--info-500)',
    },
  } as const;
  const t = tones[tone] || tones.neutral;
  const [bg, fg] = solid ? t.solid : t.soft;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: dot ? '0 10px 0 8px' : '0 10px',
        background: bg,
        color: fg,
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-bold)',
        letterSpacing: '.01em',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: '50%', background: solid ? 'currentColor' : t.d }}
        />
      )}
      {children}
    </span>
  );
}
