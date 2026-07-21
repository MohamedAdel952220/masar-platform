import { useEffect, useState } from 'react';
import { ActivateRoute } from './ActivateRoute';
import { ResetPasswordRoute } from './ResetPasswordRoute';
import { SessionEndedRoute } from './SessionEndedRoute';
import { LoginRoute } from './LoginRoute';
import { readAuthLinkState } from './authLink';
import { useSessionEndReason } from './useSessionEndReason';

/**
 * The unauthenticated surface of this portal: sign in, activate, reset, or
 * explain why a session ended.
 *
 * ══ WHY THIS IS NOT REACT-ROUTER ROUTING ══
 *
 * Every portal's router is mounted INSIDE `AuthGate`, which renders the login
 * screen instead of the router whenever there is no session. So no react-router
 * route can ever match while signed out — an unauthenticated `/activate` URL
 * would never reach the router at all.
 *
 * Rather than restructure six routers (a redesign this phase forbids), the
 * unauthenticated surface owns its own small view state, and deep links are
 * honoured by reading the URL on mount. `AuthGate` renders this instead of
 * `LoginRoute`; nothing else about any portal's routing changes.
 *
 * Entry points:
 *   /activate…            → activation
 *   ?code= / ?token= / ?error=  → activation (a link came back)
 *   /reset, /forgot       → password reset
 *   anything else         → sign in
 */

type View = 'sign-in' | 'activate' | 'reset';

function initialView(): View {
  if (typeof window === 'undefined') return 'sign-in';
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/activate')) return 'activate';
  if (path.startsWith('/reset') || path.startsWith('/forgot')) return 'reset';

  // A returning auth link may land on any path; classify by its parameters.
  const state = readAuthLinkState(false);
  if (state.kind !== 'none') return 'activate';
  return 'sign-in';
}

export function UnauthenticatedFlow({ appName }: { appName: string }) {
  const [view, setView] = useState<View>('sign-in');
  const { reason, clear } = useSessionEndReason();

  useEffect(() => {
    setView(initialView());
  }, []);

  // A session that just ended takes precedence over any deep link.
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

  if (view === 'activate') {
    return (
      <ActivateRoute
        appName={appName}
        onGoToSignIn={() => setView('sign-in')}
        onGoToReset={() => setView('reset')}
      />
    );
  }

  if (view === 'reset') {
    return <ResetPasswordRoute onGoToSignIn={() => setView('sign-in')} />;
  }

  return <LoginRoute onForgotPassword={() => setView('reset')} onActivate={() => setView('activate')} />;
}
