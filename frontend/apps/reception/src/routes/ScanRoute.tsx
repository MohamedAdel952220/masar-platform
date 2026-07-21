import { callRpc, useAcademicList, useRpcMutation } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, Button, Card, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState } from '../components/States';
import { formatDateTime } from '../lib/format';
import {
  SCAN_COPY,
  canConfirmHandover,
  canScanPickupPass,
  isScanValid,
  parseScanOutcome,
  type ScanOutcome,
} from '../lib/reception';

/**
 * QR scan → pass validation → guardian verification → handover confirmation.
 *
 * This is the whole reason the Reception App exists, and it is deliberately one
 * screen rather than four: a handover is a single continuous interaction with a
 * person standing at the desk, and routing between steps would lose the scan
 * state on a back-swipe mid-handover.
 *
 * ══ THE PASS IS NEVER LISTED, ONLY SCANNED (§13.4) ══
 *
 * `safety.pickup_passes` is not queried anywhere in this app. A pass is reached
 * only by exact `qr_token` through `scan_pickup_pass`. The token is opaque and
 * high-entropy precisely so that reception can validate one pass without being
 * able to enumerate every family's pickup arrangements. §13.4 states that
 * withholding the list query path is an intentional second layer on top of RLS
 * — so it is withheld here literally, not approximated.
 *
 * ══ HOW THE TOKEN IS CAPTURED ══
 *
 * The input is autofocused and submits on Enter. That is not a fallback for a
 * missing camera: front-desk QR readers are USB/Bluetooth HID devices that
 * behave exactly like a keyboard — they type the token and press Enter. This
 * input IS the scanner path for that hardware, and it doubles as manual entry
 * when a code must be read aloud over the phone. A camera-based scanner needs
 * the Capacitor shell and is a later roadmap stage.
 *
 * ══ SERVER-AUTHORITATIVE HANDOVER ══
 *
 * `confirm_handover` is one of the SEVEN NON-IDEMPOTENT RPCs. It performs an
 * atomic `UPDATE ... WHERE result = 'valid' AND NOT handover_confirmed`, so a
 * double-confirm cannot double-hand-over — the second call fails with
 * `STATE_ALREADY_PROCESSED`. The client never decides that a handover happened:
 * it asks, and the server's row is the record. Server-side the same call also
 * moves the child's day-path to `delivered` and enqueues the guardian
 * notification, which is why none of that is attempted here.
 *
 * Because it is non-idempotent, `useRpcMutation` hard-codes `retry: false` AND
 * the confirm button is not re-armed after a failure — the operator is told to
 * re-scan and verify rather than being invited to press again. Blind re-pressing
 * is precisely the hazard the seven-RPC rule exists to prevent.
 */

type Phase = 'idle' | 'scanning' | 'result' | 'confirmed';

export function ScanRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const mayScan = canScanPickupPass(claims);
  const mayConfirm = canConfirmHandover(claims);

  const [token, setToken] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [scanError, setScanError] = useState<unknown>(null);
  /** The operator's explicit statement that they checked the person's ID. */
  const [identityChecked, setIdentityChecked] = useState(false);
  /** Set when a confirm attempt fails — the control stays disarmed (see above). */
  const [confirmFailed, setConfirmFailed] = useState(false);
  /**
   * Bumped on every reset so the token field remounts and re-takes focus. The
   * design system's `Input` does not forward a ref (and is frozen this phase),
   * so remount-with-autoFocus is how the reader stays armed between handovers —
   * a desk operator must never have to tap the field before the next scan.
   */
  const [formKey, setFormKey] = useState(0);

  // Children are readable tenant-wide for reception (§12: name/photo/parent
  // only). This resolves the scanned pass's child_id to a name so the operator
  // can say it out loud — the pass itself carries only the collector's name.
  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 500 });

  const childName = useMemo(() => {
    if (!outcome?.pass) return null;
    const child = (children.data?.items ?? []).find((c) => c.id === outcome.pass?.child_id);
    return child ? (locale === 'ar' && child.name_ar ? child.name_ar : child.name) : null;
  }, [children.data, outcome, locale]);

  const confirm = useRpcMutation('confirm_handover', {
    onSuccess: () => {
      setPhase('confirmed');
      void queryClient.invalidateQueries();
    },
    onError: () => {
      // Deliberately NOT re-armed. See the non-idempotent note above.
      setConfirmFailed(true);
    },
  });

  const reset = () => {
    setToken('');
    setOutcome(null);
    setScanError(null);
    setIdentityChecked(false);
    setConfirmFailed(false);
    confirm.reset();
    setPhase('idle');
    setFormKey((n) => n + 1);
  };

  const runScan = async () => {
    const trimmed = token.trim();
    if (trimmed.length === 0 || phase === 'scanning') return;
    setPhase('scanning');
    setScanError(null);
    setIdentityChecked(false);
    setConfirmFailed(false);
    try {
      const raw = await callRpc('scan_pickup_pass', { p_qr_token: trimmed });
      setOutcome(parseScanOutcome(raw));
      setPhase('result');
      // Every attempt — valid or not — is logged server-side (§3.32), so the
      // activity log stays truthful even when the desk is refusing entry.
      void queryClient.invalidateQueries();
    } catch (err) {
      setScanError(err);
      setPhase('idle');
    }
  };

  const copy = outcome ? SCAN_COPY[outcome.result] : null;
  const valid = outcome ? isScanValid(outcome.result) : false;

  if (!mayScan) {
    return (
      <>
        <PageHeader title="Scan" />
        <Card padding="lg">
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Only reception staff can scan a pickup pass.
          </span>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Scan a pickup pass"
        subtitle="Scan the family's QR code, or type the code if it is being read to you."
      />

      {phase === 'idle' || phase === 'scanning' ? (
        <Card padding="lg">
          <form
            key={formKey}
            onSubmit={(e) => {
              e.preventDefault();
              void runScan();
            }}
            style={{ display: 'grid', gap: 'var(--space-4)' }}
          >
            <Input
              autoFocus
              label="Pickup code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Scan or type the code"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
            />
            <Button type="submit" size="lg" disabled={phase === 'scanning' || token.trim().length === 0}>
              {phase === 'scanning' ? 'Checking…' : 'Check pass'}
            </Button>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
              A handheld reader types the code and submits automatically.
            </span>
          </form>
        </Card>
      ) : null}

      {scanError ? (
        <div style={{ marginBlockStart: 'var(--space-4)' }}>
          <ErrorState error={scanError} onRetry={() => setScanError(null)} />
        </div>
      ) : null}

      {phase === 'result' && outcome && copy ? (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Card padding="lg" accent={valid ? 'var(--status-done)' : 'var(--status-live)'}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--weight-extra)',
                    color: 'var(--text-strong)',
                  }}
                >
                  {copy.title}
                </span>
                <Badge tone={valid ? 'success' : 'amber'} dot>
                  {valid ? 'Valid' : 'Do not hand over'}
                </Badge>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{copy.detail}</span>
            </div>
          </Card>

          {valid && outcome.pass ? (
            <>
              <Card padding="lg">
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-bold)',
                      letterSpacing: 'var(--tracking-caps)',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Verify the person collecting
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <Avatar name={outcome.pass.person_name} size={56} />
                    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 'var(--text-lg)',
                          fontWeight: 'var(--weight-extra)',
                          color: 'var(--text-strong)',
                        }}
                      >
                        {outcome.pass.person_name}
                      </span>
                      <Badge tone="info">{outcome.pass.relation}</Badge>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      Collecting{' '}
                      <strong style={{ color: 'var(--text-strong)' }}>{childName ?? 'a child'}</strong>
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      Pass valid until {formatDateTime(outcome.pass.expires_at, locale)}
                    </span>
                  </div>

                  {/*
                    The pass may carry an ID photo, but `id_photo_object_id`
                    points into `storage_objects`, a subsystem that was never
                    implemented (BACKEND_CERTIFICATION §7.3) — so there is no
                    path to resolve. Rather than silently drop an identity check
                    at a child handover desk, the requirement is stated and
                    moved to physical ID.
                  */}
                  <Card padding="sm">
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                      {outcome.pass.id_photo_object_id
                        ? 'This pass has a stored ID photo, but photo storage is not yet available in this build. Check physical ID.'
                        : 'No ID photo is stored for this pass. Check physical ID.'}
                    </span>
                  </Card>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      minHeight: 44,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-body)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={identityChecked}
                      onChange={(e) => setIdentityChecked(e.target.checked)}
                      style={{ width: 20, height: 20 }}
                    />
                    I have checked this person&apos;s ID and it matches the pass
                  </label>
                </div>
              </Card>

              {confirm.error ? <ErrorState error={confirm.error} /> : null}

              {confirmFailed ? (
                <Card padding="md" accent="var(--status-live)">
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                      Do not press confirm again
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                      The handover may already have been recorded. Start a new scan to check the current state
                      before doing anything else.
                    </span>
                    <Button variant="secondary" onClick={reset}>
                      Start again
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card padding="lg" style={{ position: 'sticky', insetBlockEnd: 'var(--space-3)' }}>
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    <Button
                      size="lg"
                      disabled={!mayConfirm || !identityChecked || confirm.isPending}
                      onClick={() => confirm.mutate({ p_pickup_scan_event_id: outcome.scanEventId })}
                    >
                      {confirm.isPending ? 'Confirming…' : 'Confirm handover'}
                    </Button>
                    {!identityChecked ? (
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                        Confirm the ID check above before completing the handover.
                      </span>
                    ) : null}
                    <Button variant="secondary" onClick={reset}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Button size="lg" onClick={reset}>
              Scan another code
            </Button>
          )}
        </div>
      ) : null}

      {phase === 'confirmed' && outcome ? (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Card padding="lg" accent="var(--status-done)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <span
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--weight-extra)',
                  color: 'var(--text-strong)',
                }}
              >
                Handover recorded
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                {childName ?? 'The child'} was handed to {outcome.pass?.person_name ?? 'the collector'}. The
                family has been notified automatically.
              </span>
            </div>
          </Card>
          <Button size="lg" onClick={reset}>
            Next pickup
          </Button>
        </div>
      ) : null}
    </>
  );
}
