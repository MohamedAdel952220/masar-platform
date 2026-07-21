import { AppError } from '@masar/api-client';
import { listTotpFactors, unenrollTotp } from '@masar/auth';
import { Badge, Button, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useCallback, useEffect, useState } from 'react';
import { AuthAlert, AuthLink, AuthShell } from './authShell';

/**
 * MFA recovery — replacing a lost authenticator.
 *
 * ══ WHAT RECOVERY CAN AND CANNOT BE HERE ══
 *
 * Supabase TOTP has no backup codes, and the deployed backend has no
 * MFA-reset RPC or Edge Function: `revoke-sessions` ends sessions but leaves
 * the factor intact, and `regenerate-activation-link` reissues a password link,
 * which does not touch AAL2. So there is no path — and this phase may not
 * invent one — by which a locked-out admin recovers unaided.
 *
 * What the deployed API *does* allow is `unenrollTotp`, which requires an
 * authenticated session. That splits recovery cleanly in two:
 *
 *   STILL SIGNED IN (factor works, phone about to be replaced)
 *     → remove the old factor here and enrol the new device. This is the case
 *       that is actually solvable in-app, and it is the one worth making easy,
 *       because handled in advance it prevents the other case entirely.
 *
 *   LOCKED OUT (authenticator already gone)
 *     → not solvable in-app, by construction. AAL2 is required before any
 *       authenticated call, so `unenrollTotp` is itself unreachable. The screen
 *       says so plainly and directs the admin to another owner-tier admin with
 *       Supabase project access, rather than offering an action that will fail.
 *
 * Telling someone honestly that they cannot self-recover is better than a
 * "recovery" button that returns PERM_ROLE_DENIED — and the state that leads
 * there is preventable, which is what the pre-emptive path above is for.
 */

export function MfaRecoveryRoute({ onBack, onReEnrol }: { onBack: () => void; onReEnrol: () => void }) {
  const { locale } = useLocale();
  const [factors, setFactors] = useState<{ id: string; friendlyName: string | null; verified: boolean }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const describe = useCallback(
    (err: unknown) => (err instanceof AppError ? err.localized(locale) : 'That did not work. Try again.'),
    [locale],
  );

  const load = useCallback(() => {
    setLoading(true);
    listTotpFactors()
      .then(setFactors)
      .catch((err: unknown) => setError(describe(err)))
      .finally(() => setLoading(false));
  }, [describe]);

  useEffect(load, [load]);

  const remove = async (factorId: string) => {
    setBusyId(factorId);
    setError(null);
    try {
      await unenrollTotp(factorId);
      setRemoved(true);
      load();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AuthShell
      badge="Two-factor authentication"
      title="Replace your authenticator"
      intro="Use this before you lose access to your current device."
      maxWidth={440}
    >
      {removed ? (
        <AuthAlert tone="success">
          That authenticator was removed. Set up a new one to keep access to the console.
        </AuthAlert>
      ) : null}

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Registered authenticators
        </span>

        {loading ? (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Loading…</span>
        ) : factors.length === 0 ? (
          <Card padding="md">
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              No authenticator is registered. You will be asked to set one up on your next sign-in.
            </span>
          </Card>
        ) : (
          factors.map((f) => (
            <Card key={f.id} padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                    {f.friendlyName ?? 'Authenticator'}
                  </span>
                  <Badge tone={f.verified ? 'success' : 'neutral'} dot>
                    {f.verified ? 'Active' : 'Not verified'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === f.id}
                  onClick={() => void remove(f.id)}
                >
                  {busyId === f.id ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Button fullWidth onClick={onReEnrol}>
        Set up a new authenticator
      </Button>

      <AuthAlert tone="info">
        <strong>Already lost your authenticator?</strong> It cannot be reset from here — two-factor
        verification is required before any account action, so this screen is unreachable without it. Ask
        another owner-tier Platform Admin to remove the factor from the Supabase project.
      </AuthAlert>

      <AuthLink onClick={onBack}>Back</AuthLink>
    </AuthShell>
  );
}
