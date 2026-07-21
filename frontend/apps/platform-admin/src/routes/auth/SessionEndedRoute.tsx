import { Button } from '@masar/design-system';
import { AuthAlert, AuthShell } from './authShell';

/**
 * Terminal session states.
 *
 * ══ WHAT THE FRONTEND CAN AND CANNOT KNOW ══
 *
 * `AuthProvider` observes `onAuthStateChange` and reduces every event to
 * `authenticated | unauthenticated`. It does not expose the underlying event,
 * and this phase must not modify it. So the app cannot distinguish, from the
 * auth layer alone:
 *
 *   - a token that expired because refresh failed, from
 *   - a session revoked server-side (`revoke_sessions`, `suspend_staff_account`,
 *     §10.6), from
 *   - a deliberate sign-out.
 *
 * What it CAN know is whether the user asked to leave. `useSessionEndReason`
 * records a deliberate sign-out; any other transition from authenticated to
 * unauthenticated is therefore involuntary, and is presented as such.
 *
 * That distinction is the one that matters to the person looking at the screen:
 * "you signed out" needs no explanation, while "you were signed out" does —
 * §10.6 revokes sessions on suspension and on an admin's explicit revocation,
 * and someone in that situation should be told to contact the nursery rather
 * than left retrying a password they believe is wrong.
 *
 * Naming an involuntary end as *specifically* "revoked" would be a guess, so it
 * is described by what is certain (the session ended, it was not you) and what
 * to do next.
 */

export type SessionEndReason = 'expired' | 'signed-out';

export function SessionEndedRoute({ reason, onSignIn }: { reason: SessionEndReason; onSignIn: () => void }) {
  if (reason === 'signed-out') {
    return (
      <AuthShell title="You're signed out" intro="Sign in again whenever you need to.">
        <Button fullWidth size="lg" onClick={onSignIn}>
          Sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Your session ended" intro="You'll need to sign in again.">
      <AuthAlert tone="info">
        This happens when a session times out, or when the nursery ends it for security — for example after an
        account change. If signing in does not work, contact your nursery.
      </AuthAlert>
      <Button fullWidth size="lg" onClick={onSignIn}>
        Sign in again
      </Button>
    </AuthShell>
  );
}
