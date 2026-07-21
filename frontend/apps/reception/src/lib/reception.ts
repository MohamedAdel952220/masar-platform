import type { MasarClaims } from '@masar/auth';

/**
 * Reception App scope helpers (BACKEND_ARCHITECTURE.md §12).
 *
 * IMPORTANT: these are UX affordances only. RLS is the authorization boundary,
 * and both scan RPCs additionally re-check `current_role() = 'reception'`
 * server-side — so a forged client cannot scan or confirm anything.
 *
 * §12 row for `reception`, as deployed. It is a NARROW role, and the narrowness
 * is the point — this is a front-desk terminal, not an admin console:
 *   Children ............ R (all, NAME/PHOTO/PARENT ONLY)
 *   Classrooms .......... R (all, names only)
 *   Pickup passes ....... R (VALIDATE VIA SCAN — see below)
 *   Pickup scan events .. C, R (own tenant)
 *   Day-path history .... C (system-generated, via handover)
 *   Buses/Trips ......... R (today's trip), U (confirm child pickup/drop-off)
 *   Trip stops/riders ... R (today's trip)
 *   Announcements ....... R (targeted)
 *   Notifications ....... R, U (own)
 *   Activity log ........ R, C (system-generated)
 *   Device tokens ....... CRUD (own)
 *   Notification prefs .. CRUD (own)
 *
 * Everything absent from that list is absent here: no attendance, no
 * evaluations, no concerns, no billing, no chat, no cameras, no AI reports.
 *
 * ══ THE PICKUP-PASS TWO-LAYER CONTROL (§13.4) ══
 *
 * This app must NEVER list `safety.pickup_passes`.
 *
 * A pass is reachable only by exact `qr_token` match, through the
 * `scan_pickup_pass` RPC. The token is deliberately not the row's UUID — it is
 * opaque and high-entropy precisely so RLS can permit a reception lookup BY
 * TOKEN without permitting reception to enumerate every family's pickup
 * arrangements.
 *
 * §13.4 is explicit that RLS alone does not forbid a `SELECT *` here, and that
 * withholding the list query path at the API layer is an INTENTIONAL SECOND
 * LAYER rather than redundancy. That second layer is this application's
 * responsibility, and it is honoured literally: `useSafetyList` is never called
 * for `pickup_passes` anywhere in this app. Screens that would seem to want it
 * ("today's visitors", "child pickup") are built from `pickup_scan_events`
 * instead — the record of who actually presented themselves at this desk.
 */

export function canOpenReceptionApp(claims: MasarClaims): boolean {
  return claims.role === 'reception';
}

/** Scanning and confirming are both role-gated server-side; mirrored here for UX. */
export function canScanPickupPass(claims: MasarClaims): boolean {
  return claims.role === 'reception';
}

export function canConfirmHandover(claims: MasarClaims): boolean {
  return claims.role === 'reception';
}

// ---------------------------------------------------------------------------
// Scan result contract
// ---------------------------------------------------------------------------

/**
 * `scan_pickup_pass` is typed `Returns: Json` in the generated types, because
 * PostgREST cannot describe a `jsonb_build_object` shape. The deployed function
 * returns exactly:
 *
 *   { result: pickup_scan_result, scanEventId: uuid, pass: pickup_passes | null }
 *
 * so the shape is narrowed here, once, with a runtime guard rather than a bare
 * cast — an unchecked `as` would turn a backend contract change into a blank
 * screen at a physical handover desk instead of a legible error.
 */

export type ScanResult = 'valid' | 'invalid_expired' | 'invalid_unknown' | 'invalid_revoked';

export interface ScannedPass {
  id: string;
  child_id: string;
  person_name: string;
  relation: string;
  status: string;
  expires_at: string;
  created_at: string;
  id_photo_object_id: string | null;
}

export interface ScanOutcome {
  result: ScanResult;
  scanEventId: string;
  /** Null when the token matched nothing — the scan is still logged (§3.32). */
  pass: ScannedPass | null;
}

const RESULTS: readonly string[] = ['valid', 'invalid_expired', 'invalid_unknown', 'invalid_revoked'];

export function parseScanOutcome(raw: unknown): ScanOutcome {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Unexpected scan response from the server.');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj['result'] !== 'string' || !RESULTS.includes(obj['result'])) {
    throw new Error('Unexpected scan result from the server.');
  }
  if (typeof obj['scanEventId'] !== 'string') {
    throw new Error('Scan response is missing its event reference.');
  }
  return {
    result: obj['result'] as ScanResult,
    scanEventId: obj['scanEventId'],
    pass: (obj['pass'] as ScannedPass | null) ?? null,
  };
}

/** Only a `valid` scan can proceed to handover — `confirm_handover` re-checks. */
export function isScanValid(result: ScanResult): boolean {
  return result === 'valid';
}

/**
 * What the front-desk operator is told for each outcome. Deliberately
 * non-accusatory: an expired pass is usually a family who renewed late, not an
 * abduction attempt, and the operator needs to de-escalate rather than alarm.
 * Every one of these still routes to "check with the office" — reception is
 * never asked to adjudicate.
 */
export const SCAN_COPY: Record<ScanResult, { title: string; detail: string }> = {
  valid: {
    title: 'Pass is valid',
    detail: 'Check the person in front of you against the details below before confirming.',
  },
  invalid_expired: {
    title: 'This pass has expired',
    detail: 'Do not hand over the child. Ask the office to issue a new pass.',
  },
  invalid_revoked: {
    title: 'This pass has been revoked',
    detail: 'Do not hand over the child. Contact the office before doing anything else.',
  },
  invalid_unknown: {
    title: 'This code is not recognised',
    detail: 'Do not hand over the child. It may be from another nursery, or mistyped.',
  },
};

/**
 * The server rate-limits scanning to 30 attempts per 60 seconds per operator
 * and returns `VALIDATION_FAILED` past that. Surfaced so the desk sees a real
 * explanation rather than a generic failure during a busy pickup window.
 */
export const SCAN_RATE_LIMIT = { attempts: 30, windowSeconds: 60 } as const;
