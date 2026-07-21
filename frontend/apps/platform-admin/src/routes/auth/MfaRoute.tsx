import { AppError } from '@masar/api-client';
import {
  challengeTotp,
  enrollTotp,
  listTotpFactors,
  verifyTotpEnrollment,
  type MfaEnrollment,
  type MfaStatus,
} from '@masar/auth';
import { useSignOut } from '../../lib/useSignOut';
import { Badge, Button, Card, CenteredLayout, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useCallback, useEffect, useState } from 'react';

/**
 * MFA gate — mandatory for `platform_admin` (BACKEND_ARCHITECTURE.md §28).
 *
 * Two distinct situations, which `getMfaStatus()` separates:
 *   enrollmentRequired → no verified factor yet; enrol before any data screen
 *   challengeRequired  → factor exists; satisfy AAL2 for this session
 *
 * No data route mounts until one of these completes, so an unenrolled admin can
 * never reach the console.
 */

export function MfaRoute({
  status,
  onSatisfied,
  onRecover,
}: {
  status: MfaStatus;
  onSatisfied: () => void;
  /** Present only on the challenge screen — enrolment has nothing to recover. */
  onRecover?: (() => void) | undefined;
}) {
  const handleSignOut = useSignOut();
  const { locale } = useLocale();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode: 'enrol' | 'challenge' = status.enrollmentRequired ? 'enrol' : 'challenge';

  const describe = useCallback(
    (err: unknown) =>
      err instanceof AppError ? err.localized(locale) : 'Verification failed. Please try again.',
    [locale],
  );

  // Enrolment: request a factor up front so the QR/secret can be shown.
  useEffect(() => {
    if (mode !== 'enrol' || enrollment) return;
    let active = true;
    setBusy(true);
    enrollTotp()
      .then((result) => {
        if (!active) return;
        setEnrollment(result);
        setFactorId(result.factorId);
      })
      .catch((err: unknown) => active && setError(describe(err)))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [mode, enrollment, describe]);

  // Challenge: resolve the existing verified factor.
  useEffect(() => {
    if (mode !== 'challenge' || factorId) return;
    let active = true;
    listTotpFactors()
      .then((factors) => {
        if (!active) return;
        const verified = factors.find((f) => f.verified) ?? factors[0];
        setFactorId(verified?.id ?? null);
      })
      .catch((err: unknown) => active && setError(describe(err)));
    return () => {
      active = false;
    };
  }, [mode, factorId, describe]);

  const submit = async () => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'enrol') await verifyTotpEnrollment(factorId, code.trim());
      else await challengeTotp(factorId, code.trim());
      onSatisfied();
    } catch (err) {
      setError(describe(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CenteredLayout maxWidth={460}>
      <Card padding="lg">
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <Badge tone="teal" dot>
              Two-factor authentication
            </Badge>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-extra)',
                color: 'var(--text-strong)',
              }}
            >
              {mode === 'enrol' ? 'Set up your authenticator' : 'Enter your verification code'}
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {mode === 'enrol'
                ? 'Platform Admin accounts require two-factor authentication. Scan the code below with your authenticator app, then enter the 6-digit code it shows.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </p>
          </div>

          {mode === 'enrol' && enrollment ? (
            <div style={{ display: 'grid', gap: 'var(--space-3)', justifyItems: 'center' }}>
              {enrollment.qr ? (
                <img
                  src={enrollment.qr}
                  alt="Authenticator QR code"
                  style={{
                    width: 176,
                    height: 176,
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2)',
                  }}
                />
              ) : null}
              {enrollment.secret ? (
                <code
                  dir="ltr"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    wordBreak: 'break-all',
                    textAlign: 'center',
                  }}
                >
                  {enrollment.secret}
                </code>
              ) : null}
            </div>
          ) : null}

          <Input
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />

          {error ? (
            <div
              role="alert"
              style={{
                background: 'var(--danger-50)',
                color: 'var(--danger-700)',
                border: '1px solid var(--danger-500)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {error}
            </div>
          ) : null}

          <Button fullWidth disabled={busy || code.length !== 6 || !factorId} onClick={() => void submit()}>
            {busy ? 'Verifying…' : mode === 'enrol' ? 'Verify and continue' : 'Verify'}
          </Button>

          {onRecover ? (
            <Button variant="ghost" size="sm" onClick={onRecover} style={{ minHeight: 44 }}>
              Lost your authenticator?
            </Button>
          ) : null}

          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </Card>
    </CenteredLayout>
  );
}
