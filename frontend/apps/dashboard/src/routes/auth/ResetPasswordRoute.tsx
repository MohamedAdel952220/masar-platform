import { AppError } from '@masar/api-client';
import { requestPhonePasswordReset, setPassword, verifyPhoneOtp } from '@masar/auth';
import { Button, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useState } from 'react';
import { SetPasswordForm } from './SetPasswordForm';
import { AuthAlert, AuthLink, AuthShell } from './authShell';
import { otpSchema, phoneSchema } from './password';

/**
 * Password reset — and, in practice, the working activation path.
 *
 * Three deployed primitives, in order:
 *
 *   requestPhonePasswordReset(phone)  → auth.signInWithOtp({ phone })
 *   verifyPhoneOtp(phone, code)       → auth.verifyOtp(...)  → session
 *   setPassword(newPassword)          → auth.updateUser({ password })
 *
 * ══ WHY THIS ALSO ACTIVATES AN ACCOUNT ══
 *
 * A provisioned account is a real phone identity that simply has no password
 * yet (§10.3). Verifying an OTP on that phone establishes a session exactly as
 * it would for a password reset, and the account then sets its first password.
 * The distinction between "activate" and "reset" is one of user intent, not of
 * mechanism — which is why this screen is reachable from the activation screen
 * when the dispatched link cannot be used.
 *
 * ══ DELIVERY DEPENDS ON A PROVIDER ══
 *
 * `flows.ts` warns that a single WhatsApp/SMS provider gates this
 * platform-wide, and `config.toml` currently has `[auth.sms.twilio] enabled =
 * false` (wiring is per-environment via secrets). If no provider is configured
 * the request step fails, so the failure state names that possibility instead
 * of blaming the phone number.
 *
 * The phone is carried between steps in component state only — never persisted.
 */

type Step = 'request' | 'verify' | 'password' | 'done';

export function ResetPasswordRoute({
  onGoToSignIn,
  title = 'Reset your password',
  intro = "Enter your phone number and we'll send you a 6-digit code.",
}: {
  onGoToSignIn: () => void;
  title?: string;
  intro?: string;
}) {
  const { locale } = useLocale();
  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const describe = (err: unknown, fallback: string) =>
    err instanceof AppError ? err.localized(locale) : fallback;

  const sendCode = async () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number');
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      await requestPhonePasswordReset(parsed.data);
      setPhone(parsed.data);
      setStep('verify');
    } catch (err) {
      setError(
        describe(
          err,
          'We could not send a code. This may be a problem with the message service rather than your number — please try again shortly, or contact your nursery.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      await verifyPhoneOtp(phone, parsed.data);
      setStep('password');
    } catch (err) {
      setError(describe(err, 'That code was not accepted. It may have expired — request a new one.'));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthShell badge="Password saved" title="Your password is set" intro="You can sign in with it now.">
        <Button fullWidth size="lg" onClick={onGoToSignIn}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  if (step === 'password') {
    return (
      <AuthShell
        badge="Almost done"
        title="Choose a password"
        intro="This is the password you'll use to sign in from now on."
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

  if (step === 'verify') {
    return (
      <AuthShell
        title="Enter your code"
        intro={'We sent a 6-digit code to ' + phone + '. It expires shortly.'}
      >
        <Input
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          {...(fieldError ? { error: fieldError } : {})}
        />

        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

        <Button fullWidth size="lg" disabled={busy || code.length !== 6} onClick={() => void verify()}>
          {busy ? 'Checking…' : 'Verify code'}
        </Button>

        <AuthLink
          onClick={() => {
            setCode('');
            setError(null);
            setStep('request');
          }}
        >
          Use a different number
        </AuthLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={title} intro={intro}>
      <Input
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="username"
        dir="ltr"
        placeholder="+201001234567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        {...(fieldError ? { error: fieldError } : {})}
      />

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      <Button fullWidth size="lg" disabled={busy} onClick={() => void sendCode()}>
        {busy ? 'Sending…' : 'Send code'}
      </Button>

      <AuthLink onClick={onGoToSignIn}>Back to sign in</AuthLink>
    </AuthShell>
  );
}
