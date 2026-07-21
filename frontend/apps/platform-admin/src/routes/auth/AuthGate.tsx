import { getMfaStatus, useAuth, type MfaStatus } from '@masar/auth';
import { useSignOut } from '../../lib/useSignOut';
import { Badge, Button, Card, CenteredLayout } from '@masar/design-system';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LoadingState } from '../../components/States';
import { MfaRecoveryRoute } from './MfaRecoveryRoute';
import { UnauthenticatedFlow } from './UnauthenticatedFlow';
import { MfaRoute } from './MfaRoute';

/**
 * The single entry gate for the Platform Admin console.
 *
 * Order of checks:
 *   1. session resolving        → spinner
 *   2. no session               → login
 *   3. role is not platform_admin → wrong-portal notice (sign out)
 *   4. MFA enrolment/challenge outstanding → MFA screen
 *   5. otherwise                → the console
 *
 * On the role check: this portal gates on the `role` claim rather than
 * `app_access`, because `app_access` mirrors `tenancy.app_code`, whose enum
 * covers only the five tenant apps (dashboard, parent, teacher, reception,
 * driver) — the Platform Admin console is not a tenant app and has no code
 * there. RLS (`is_platform_admin()`) remains the authorization boundary
 * regardless; this check exists purely so a tenant-side user sees a clear
 * message instead of an empty console.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const handleSignOut = useSignOut();
  const { status, claims } = useAuth();
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [mfaChecked, setMfaChecked] = useState(false);

  const isPlatformAdmin = claims.role === 'platform_admin';

  const refreshMfa = useCallback(() => {
    setMfaChecked(false);
    getMfaStatus()
      .then(setMfa)
      .catch(() => setMfa(null))
      .finally(() => setMfaChecked(true));
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !isPlatformAdmin) {
      setMfa(null);
      setMfaChecked(false);
      return;
    }
    refreshMfa();
  }, [status, isPlatformAdmin, refreshMfa]);

  if (status === 'loading') {
    return (
      <CenteredLayout>
        <LoadingState rows={2} />
      </CenteredLayout>
    );
  }

  if (status !== 'authenticated') return <UnauthenticatedFlow />;

  if (!isPlatformAdmin) {
    return (
      <CenteredLayout>
        <Card padding="lg" accent="var(--amber-500)">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Badge tone="amber" dot>
              Wrong portal
            </Badge>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
              This console is for Masar Platform Admin accounts. Your account signs in to a different Masar
              app.
            </p>
            <Button variant="secondary" onClick={handleSignOut} style={{ justifySelf: 'start' }}>
              Sign out
            </Button>
          </div>
        </Card>
      </CenteredLayout>
    );
  }

  if (!mfaChecked) {
    return (
      <CenteredLayout>
        <LoadingState rows={2} />
      </CenteredLayout>
    );
  }

  // Recovery is reachable from the challenge screen (lost authenticator) and
  // from a satisfied session (replacing a device before it is lost).
  if (recovering) {
    return (
      <MfaRecoveryRoute
        onBack={() => {
          setRecovering(false);
          refreshMfa();
        }}
        onReEnrol={() => {
          setRecovering(false);
          refreshMfa();
        }}
      />
    );
  }

  if (mfa && (mfa.enrollmentRequired || mfa.challengeRequired)) {
    return (
      <MfaRoute
        status={mfa}
        onSatisfied={refreshMfa}
        onRecover={mfa.challengeRequired ? () => setRecovering(true) : undefined}
      />
    );
  }

  return <>{children}</>;
}
