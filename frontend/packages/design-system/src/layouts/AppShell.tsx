import { type ReactNode } from 'react';

export interface AppShellProps {
  /** Portal chrome (top bar / nav). */
  header?: ReactNode;
  /** Side or bottom navigation slot. */
  nav?: ReactNode;
  children: ReactNode;
}

/**
 * Authenticated portal shell. Layout only — no data access, no role logic.
 * Uses logical properties so a single stylesheet serves LTR and RTL
 * (FRONTEND_ARCHITECTURE.md §20).
 */
export function AppShell({ header, nav, children }: AppShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-app)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-body)',
      }}
    >
      {header}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {nav}
        <main style={{ flex: 1, minWidth: 0, padding: 'var(--space-6)' }}>{children}</main>
      </div>
    </div>
  );
}
