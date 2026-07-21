import { useAuth } from '@masar/auth';
import { useSignOut } from '../../lib/useSignOut';
import { Badge, Button, Card, CenteredLayout } from '@masar/design-system';
import type { ReactNode } from 'react';
import { LoadingState } from '../../components/States';
import { canOpenDashboard } from '../../lib/permissions';
import { UnauthenticatedFlow } from './UnauthenticatedFlow';

/**
 * Entry gate for the Nursery Dashboard.
 *
 *   1. session resolving          → spinner
 *   2. no session                 → login
 *   3. role outside manager/teacher → wrong-portal notice
 *   4. otherwise                  → the console
 *
 * No MFA step: MFA is mandatory for platform_admin only (§28); tenant-side
 * roles authenticate with phone + password in v1.
 *
 * The role check gates on the `role` claim rather than `app_access` for the
 * same reason the Platform Admin portal does — it exists so a guardian or
 * driver sees a clear message instead of an empty console. RLS remains the
 * authorization boundary.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const handleSignOut = useSignOut();
  const { status, claims } = useAuth();

  if (status === 'loading') {
    return (
      <CenteredLayout>
        <LoadingState rows={2} />
      </CenteredLayout>
    );
  }

  if (status !== 'authenticated') return <UnauthenticatedFlow appName="the nursery dashboard" />;

  if (!canOpenDashboard(claims)) {
    return (
      <CenteredLayout>
        <Card padding="lg" accent="var(--amber-500)">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Badge tone="amber" dot>
              Wrong portal
            </Badge>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
              The Dashboard is for nursery managers. Your account signs in to a different Masar app.
            </p>
            <Button variant="secondary" onClick={handleSignOut} style={{ justifySelf: 'start' }}>
              Sign out
            </Button>
          </div>
        </Card>
      </CenteredLayout>
    );
  }

  return <>{children}</>;
}
