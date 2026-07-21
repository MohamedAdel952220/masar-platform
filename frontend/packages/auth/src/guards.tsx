import type { Portal, Role } from '@masar/api-client';
import { type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { canOpenPortal } from './claims';

/**
 * Route guards (FRONTEND_ARCHITECTURE.md §7).
 *
 * These are NAVIGATIONAL, not security. RLS is the authority — a guard exists
 * only to keep a user off a screen that would render empty or dead-end. Any
 * action a guard hides must still fail correctly server-side if invoked.
 */

export interface GuardProps {
  children: ReactNode;
  /** Rendered while the session is still resolving. */
  fallback?: ReactNode;
  /** Rendered when the guard denies access. */
  denied?: ReactNode;
}

export function RequireAuth({ children, fallback = null, denied = null }: GuardProps) {
  const { status } = useAuth();
  if (status === 'loading') return <>{fallback}</>;
  if (status !== 'authenticated') return <>{denied}</>;
  return <>{children}</>;
}

export interface RequirePortalProps extends GuardProps {
  portal: Portal;
}

/** Enforces the `app_access` claim for this portal bundle. */
export function RequirePortal({ portal, children, fallback = null, denied = null }: RequirePortalProps) {
  const { status, claims } = useAuth();
  if (status === 'loading') return <>{fallback}</>;
  if (status !== 'authenticated' || !canOpenPortal(claims, portal)) return <>{denied}</>;
  return <>{children}</>;
}

export interface RequireRoleProps extends GuardProps {
  roles: Role[];
}

export function RequireRole({ roles, children, fallback = null, denied = null }: RequireRoleProps) {
  const { status, claims } = useAuth();
  if (status === 'loading') return <>{fallback}</>;
  if (status !== 'authenticated' || !claims.role || !roles.includes(claims.role)) return <>{denied}</>;
  return <>{children}</>;
}
