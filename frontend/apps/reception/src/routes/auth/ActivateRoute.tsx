import { completeActivation, useAuth } from '@masar/auth';
import { Button } from '@masar/design-system';
import { useEffect, useState } from 'react';
import { SetPasswordForm } from './SetPasswordForm';
import { AuthAlert, AuthLink, AuthShell } from './authShell';
import { clearAuthParamsFromUrl, readAuthLinkState, type AuthLinkState } from './authLink';

/**
 * Account activation.
 *
 * ══ THE FLOW ══
 *
 * §10.3: provisioning never sets a password. The account is created without one
 * and a single-use link is dispatched to the account's own phone. Following it
 * establishes a short-lived session; the account then sets its own password.
 * A manager never sees or relays a credential.
 *
 * supabase-js does the exchange itself (`flowType: 'pkce'`,
 * `detectSessionInUrl: true`), so by the time this screen mounts the session
 * either exists or the URL explains why it does not. This screen classifies
 * that and nothing more — see `authLink.ts`.
 *
 * ══ STATES ══
 *
 *   session      → set a password, then done
 *   expired      → link timed out or was already used; request a fresh one
 *   invalid      → malformed or unrecognised link
 *   legacy-stub  → the URL shape the CURRENTLY DEPLOYED stub produces, which
 *                  cannot be completed at all (see below)
 *   none         → arrived here without a link
 *
 * ══ WHY `legacy-stub` EXISTS ══
 *
 * `_shared/activation.ts` is explicitly stubbed pending Epic 4. It fabricates
 * `{base}/{userId}?token={crypto.randomUUID()}` and logs it rather than sending
 * it. That token is stored nowhere and verifies against nothing, so no session
 * can result. Rather than let such a link fail as a generic error and send
 * someone round a loop that cannot terminate, it is detected and named, and the
 * user is routed to the OTP path — which uses deployed, working primitives.
 */

type Phase = 'checking' | 'link' | 'password' | 'done';

export function ActivateRoute({
  appName,
  onGoToSignIn,
  onGoToReset,
}: {
  appName: string;
  onGoToSignIn: () => void;
  onGoToReset: () => void;
}) {
  const { status, session } = useAuth();
  const [phase, setPhase] = useState<Phase>('checking');
  const [link, setLink] = useState<AuthLinkState>({ kind: 'none' });

  useEffect(() => {
    if (status === 'loading') return;
    const state = readAuthLinkState(session !== null);
    setLink(state);
    if (state.kind === 'session') {
      clearAuthParamsFromUrl();
      setPhase('password');
    } else {
      setPhase('link');
    }
  }, [status, session]);

  if (phase === 'checking') {
    return <AuthShell title="Checking your link…" intro="One moment." children={<span />} />;
  }

  if (phase === 'done') {
    return (
      <AuthShell
        badge="Account ready"
        title="You're all set"
        intro={'Your password is saved. You can now sign in to ' + appName + '.'}
      >
        <Button fullWidth size="lg" onClick={onGoToSignIn}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  if (phase === 'password') {
    return (
      <AuthShell
        badge="Activate your account"
        title="Choose a password"
        intro="This is the password you'll use to sign in from now on. Nobody at the nursery can see it."
      >
        <SetPasswordForm
          submitLabel="Save password"
          pendingLabel="Saving…"
          onSubmit={completeActivation}
          onDone={() => setPhase('done')}
        />
      </AuthShell>
    );
  }

  if (link.kind === 'legacy-stub') {
    return (
      <AuthShell
        title="This link can't be used yet"
        intro="Activation links are not being delivered on this environment yet."
      >
        <AuthAlert tone="info">
          Your account exists, but this particular link cannot activate it. You can set your password using a
          code sent to your phone instead.
        </AuthAlert>
        <Button fullWidth size="lg" onClick={onGoToReset}>
          Set my password by SMS code
        </Button>
        <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
      </AuthShell>
    );
  }

  if (link.kind === 'expired') {
    return (
      <AuthShell title="This link has expired" intro="Activation links are single-use and time-limited.">
        <AuthAlert tone="error">
          Ask your nursery to send a new activation message, or set your password using a code sent to your
          phone.
        </AuthAlert>
        <Button fullWidth size="lg" onClick={onGoToReset}>
          Send me a code instead
        </Button>
        <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
      </AuthShell>
    );
  }

  if (link.kind === 'invalid') {
    return (
      <AuthShell title="This link isn't valid" intro="It may have been mistyped or already used.">
        <AuthAlert tone="error">
          {link.description ?? 'We could not recognise this activation link.'}
        </AuthAlert>
        <Button fullWidth size="lg" onClick={onGoToReset}>
          Send me a code instead
        </Button>
        <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Activate your account"
      intro="Open the activation link your nursery sent you, or set a password using a code sent to your phone."
    >
      <Button fullWidth size="lg" onClick={onGoToReset}>
        Send me a code
      </Button>
      <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
    </AuthShell>
  );
}
