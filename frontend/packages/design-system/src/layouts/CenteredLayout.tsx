import { type ReactNode } from 'react';

export interface CenteredLayoutProps {
  children: ReactNode;
  /** Max content width in px. @default 420 */
  maxWidth?: number;
}

/**
 * Centered single-column layout used by unauthenticated and terminal screens
 * (auth, errors). Layout only.
 */
export function CenteredLayout({ children, maxWidth = 420 }: CenteredLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        background: 'var(--surface-app)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-body)',
      }}
    >
      <div style={{ width: '100%', maxWidth }}>{children}</div>
    </div>
  );
}
