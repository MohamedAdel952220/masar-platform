import { AppError } from '@masar/api-client';
import { requestEmailPasswordReset, setPassword, useAuth } from '@masar/auth';
import { Button, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useEffect, useState } from 'react';
import { SetPasswordForm } from './SetPasswordForm';
import { AuthAlert, AuthLink, AuthShell } from './authShell';
import { clearAuthParamsFromUrl, readAuthLinkState } from './authLink';

/**
 * Platform Admin password reset — email identity (§10.2).
 *
 * Two deployed primitives:
 *
 *   requestEmailPasswordReset(email, redirectTo) → auth.resetPasswordForEmail
 *   setPassword(newPassword)                     → auth.updateUser({ password })
 *
 * Between them the user leaves the app entirely: Supabase emails a link, and
 * following it returns to `redirectTo` with a PKCE `?code=` that supabase-js
 * exchanges for a session before this component mounts (`detectSessionInUrl`).
 * So this screen has two distinct entry conditions, and reads the URL to tell
 * them apart:
 *
 *   no session + no link params → ask for the email address
 *   session established by link → set the new password
 *   link error                  → expired or invalid
 *
 * `redirectTo` is the app's own origin, so the returning link lands back here
 * rather than on a Supabase-hosted page.
 *
 * MFA is unaffected: resetting a password does not clear an enrolled factor,
 * and the AAL2 challenge still applies on the next sign-in. That is the correct
 * behaviour — a password reset is not a second-factor bypass.
 */

type Step = 'request' | 'sent' | 'password' | 'done' | 'expired' | 'invalid';

export function ResetPasswordRoute({ onGoToSignIn }: { onGoToSignIn: () => void }) {
  const { locale } = useLocale();
  const { status, session } = useAuth();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Classify how we arrived: a returning reset link, or a cold start.
  useEffect(() => {
    if (status === 'loading') return;
    const link = readAuthLinkState(session !== null);
    if (link.kind === 'session') {
      clearAuthParamsFromUrl();
      setStep('password');
    } else if (link.kind === 'expired') {
      setStep('expired');
    } else if (link.kind === 'invalid') {
      setStep('invalid');
    }
  }, [status, session]);

  const send = async () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError('Enter a valid email address');
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const redirectTo = typeof window === 'undefined' ? undefined : window.location.origin + '/reset';
      await requestEmailPasswordReset(value, redirectTo);
      setStep('sent');
    } catch (err) {
      setError(
        err instanceof AppError
          ? err.localized(locale)
          : 'Could not send the reset email. Please try again shortly.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthShell badge="Password saved" title="Your password is set" intro="Sign in with your new password.">
        <Button fullWidth onClick={onGoToSignIn}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  if (step === 'password') {
    return (
      <AuthShell
        badge="Almost done"
        title="Choose a new password"
        intro="Two-factor authentication still applies the next time you sign in."
      >
        <SetPasswordForm
          submitLabel="Save password"
          pendingLabel="Saving…"
          onSubmit={setPassword}
          onDone={() => setStep('done')}
        />
      </AuthShell>
    );
  }

  if (step === 'sent') {
    return (
      <AuthShell title="Check your email" intro={'We sent a reset link to ' + email + '.'}>
        <AuthAlert tone="info">
          The link is single-use and expires shortly. If it does not arrive, check spam before requesting
          another.
        </AuthAlert>
        <AuthLink onClick={() => setStep('request')}>Use a different address</AuthLink>
        <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
      </AuthShell>
    );
  }

  if (step === 'expired' || step === 'invalid') {
    return (
      <AuthShell
        title={step === 'expired' ? 'This link has expired' : "This link isn't valid"}
        intro="Reset links are single-use and time-limited."
      >
        <AuthAlert tone="error">Request a new reset email to continue.</AuthAlert>
        <Button fullWidth onClick={() => setStep('request')}>
          Request a new link
        </Button>
        <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      intro="Enter your Masar admin email and we'll send you a reset link."
    >
      <Input
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        dir="ltr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        {...(fieldError ? { error: fieldError } : {})}
      />

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      <Button fullWidth disabled={busy} onClick={() => void send()}>
        {busy ? 'Sending…' : 'Send reset link'}
      </Button>

      <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
    </AuthShell>
  );
}
