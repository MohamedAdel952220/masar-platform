import { useEffect, useState } from 'react';
import { LoginRoute } from './LoginRoute';
import { ResetPasswordRoute } from './ResetPasswordRoute';
import { SessionEndedRoute } from './SessionEndedRoute';
import { readAuthLinkState } from './authLink';
import { useSessionEndReason } from './useSessionEndReason';

/**
 * The unauthenticated surface of the Platform Admin console.
 *
 * As in the tenant portals, the console's react-router tree is mounted inside
 * `AuthGate` and therefore never matches while signed out; this small view
 * state owns the signed-out screens instead. See the tenant portals'
 * `UnauthenticatedFlow` for the full reasoning.
 *
 * There is deliberately no activation screen here. §10.3 provisioning covers
 * tenant-side identities (manager, teacher, reception, guardian, driver);
 * Platform Admin accounts have no provisioning Edge Function at all and are
 * created directly against the project, so an "activate your admin account"
 * screen would describe a flow that does not exist. Password reset by email is
 * the deployed recovery path and is what is offered.
 *
 * Entry points:
 *   /reset, /forgot        → password reset
 *   ?code= / ?error=       → password reset (a link came back)
 *   anything else          → sign in
 */

type View = 'sign-in' | 'reset';

function initialView(): View {
  if (typeof window === 'undefined') return 'sign-in';
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/reset') || path.startsWith('/forgot')) return 'reset';
  return readAuthLinkState(false).kind === 'none' ? 'sign-in' : 'reset';
}

export function UnauthenticatedFlow() {
  const [view, setView] = useState<View>('sign-in');
  const { reason, clear } = useSessionEndReason();

  useEffect(() => {
    setView(initialView());
  }, []);

  if (reason) {
    return (
      <SessionEndedRoute
        reason={reason}
        onSignIn={() => {
          clear();
          setView('sign-in');
        }}
      />
    );
  }

  if (view === 'reset') {
    return <ResetPasswordRoute onGoToSignIn={() => setView('sign-in')} />;
  }

  return <LoginRoute onForgotPassword={() => setView('reset')} />;
}
