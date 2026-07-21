import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

export interface CardProps {
  children?: ReactNode;
  /** @default "md" */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Lift + deepen shadow on hover. @default false */
  interactive?: boolean;
  /** Left accent stripe color (e.g. a role accent token). */
  accent?: string | null;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  style?: CSSProperties;
}

/**
 * Surface container. padding sm/md/lg, optional accent left-stripe by role,
 * interactive lift on hover when onClick is set.
 */
export function Card({
  children,
  padding = 'md',
  interactive = false,
  accent = null,
  onClick,
  style = {},
  ...rest
}: CardProps) {
  const pads = { none: 0, sm: 'var(--space-4)', md: 'var(--space-6)', lg: 'var(--space-7)' };
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: pads[padding] ?? pads.md,
        boxShadow: interactive && hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        borderLeft: accent ? `3px solid ${accent}` : '1px solid var(--border-subtle)',
        transform: interactive && hover ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
