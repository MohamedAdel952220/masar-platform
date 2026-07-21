import { useAuth } from '@masar/auth';
import { useSignOut } from '../../lib/useSignOut';
import { Badge, Button, Card, CenteredLayout } from '@masar/design-system';
import type { ReactNode } from 'react';
import { LoadingState } from '../../components/States';
import { canOpenParentApp } from '../../lib/parent';
import { SelectedChildProvider } from '../../lib/SelectedChildProvider';
import { UnauthenticatedFlow } from './UnauthenticatedFlow';

/**
 * Entry gate for the Parent App.
 *
 *   1. session resolving   → spinner
 *   2. no session          → login
 *   3. role is not guardian → wrong-app notice
 *   4. otherwise           → the app
 *
 * No MFA: mandatory for platform_admin only (§28).
 *
 * The role check gates on the `role` claim so a manager or guardian sees a
 * clear message instead of an empty app. RLS remains the boundary — a
 * non-teacher would read nothing here anyway.
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

  if (status !== 'authenticated') return <UnauthenticatedFlow appName="Masar for Families" />;

  if (!canOpenParentApp(claims)) {
    return (
      <CenteredLayout>
        <Card padding="lg" accent="var(--amber-500)">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Badge tone="amber" dot>
              Wrong app
            </Badge>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
              This app is for families. Your account signs in to a different Masar app.
            </p>
            <Button variant="secondary" onClick={handleSignOut} style={{ justifySelf: 'start' }}>
              Sign out
            </Button>
          </div>
        </Card>
      </CenteredLayout>
    );
  }

  // The child selector wraps the whole app: nearly every screen is scoped to
  // one child, and the list it selects from is already RLS-narrowed.
  return <SelectedChildProvider>{children}</SelectedChildProvider>;
}
