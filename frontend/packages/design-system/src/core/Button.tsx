import { type CSSProperties, type MouseEvent, type ReactNode } from 'react';

export interface ButtonProps {
  children?: ReactNode;
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

/**
 * Masar primary action button. Variants: primary (teal), secondary (paper
 * outline), ghost, danger. Sizes sm/md/lg. RTL-aware via inline-flex + gap.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  style = {},
  ...rest
}: ButtonProps) {
  const sizes = {
    sm: { height: 34, padding: '0 14px', fontSize: 'var(--text-sm)', radius: 'var(--radius-sm)', gap: 7 },
    md: { height: 42, padding: '0 18px', fontSize: 'var(--text-base)', radius: 'var(--radius-md)', gap: 8 },
    lg: { height: 52, padding: '0 24px', fontSize: 'var(--text-md)', radius: 'var(--radius-md)', gap: 10 },
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'var(--text-on-brand)', border: '1px solid transparent' },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-strong)',
      border: '1px solid var(--border-strong)',
    },
    ghost: { background: 'transparent', color: 'var(--primary)', border: '1px solid transparent' },
    danger: { background: 'var(--danger-500)', color: '#fff', border: '1px solid transparent' },
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        width: fullWidth ? '100%' : 'auto',
        fontFamily: 'var(--font-sans)',
        fontSize: s.fontSize,
        fontWeight: 'var(--weight-bold)',
        letterSpacing: 'var(--tracking-snug)',
        borderRadius: s.radius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        boxShadow: variant === 'primary' ? 'var(--shadow-sm)' : 'none',
        transition: 'filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        ...v,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.filter = 'brightness(0.94)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'none';
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
