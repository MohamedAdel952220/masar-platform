import { getSupabaseClient, parseBackendError } from '@masar/api-client';

/**
 * MFA (TOTP) support — mandatory for the `platform_admin` role
 * (BACKEND_ARCHITECTURE.md §28).
 *
 * The enrolment gate belongs at the Platform Admin shell: an unenrolled admin
 * is routed to enrolment before any data screen. This module provides the
 * primitives; it does not decide policy.
 */

export type AssuranceLevel = 'aal1' | 'aal2';

export interface MfaEnrollment {
  factorId: string;
  /** otpauth:// URI for the authenticator app. */
  uri: string;
  /** QR code as an SVG string, when the server provides one. */
  qr: string | null;
  secret: string | null;
}

export interface MfaStatus {
  /** Assurance level this session currently holds. */
  current: AssuranceLevel | null;
  /** Assurance level the account is required to reach. */
  next: AssuranceLevel | null;
  /** True when the account must complete a challenge to proceed. */
  challengeRequired: boolean;
  /** True when the account has no verified factor and must enrol. */
  enrollmentRequired: boolean;
}

/** Reads the session's current vs required assurance level. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw parseBackendError(error);

  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  if (factorsError) throw parseBackendError(factorsError);

  const hasVerifiedFactor = (factors.totp ?? []).some((f) => f.status === 'verified');
  const current = (data.currentLevel as AssuranceLevel | null) ?? null;
  const next = (data.nextLevel as AssuranceLevel | null) ?? null;

  return {
    current,
    next,
    challengeRequired: next === 'aal2' && current !== 'aal2' && hasVerifiedFactor,
    enrollmentRequired: next === 'aal2' && !hasVerifiedFactor,
  };
}

/** Begins TOTP enrolment; returns the URI/QR to present to the authenticator. */
export async function enrollTotp(friendlyName = 'Masar Platform Admin'): Promise<MfaEnrollment> {
  const { data, error } = await getSupabaseClient().auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });
  if (error) throw parseBackendError(error);
  return {
    factorId: data.id,
    uri: data.totp.uri,
    qr: data.totp.qr_code ?? null,
    secret: data.totp.secret ?? null,
  };
}

/** Completes enrolment by verifying the first code from the authenticator. */
export async function verifyTotpEnrollment(factorId: string, code: string): Promise<void> {
  const client = getSupabaseClient();
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
  if (challengeError) throw parseBackendError(challengeError);

  const { error } = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw parseBackendError(error);
}

/** Satisfies an AAL2 challenge at sign-in for an already-enrolled factor. */
export async function challengeTotp(factorId: string, code: string): Promise<void> {
  const client = getSupabaseClient();
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
  if (challengeError) throw parseBackendError(challengeError);

  const { error } = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw parseBackendError(error);
}

/** Lists enrolled TOTP factors for the current account. */
export async function listTotpFactors(): Promise<
  { id: string; friendlyName: string | null; verified: boolean }[]
> {
  const { data, error } = await getSupabaseClient().auth.mfa.listFactors();
  if (error) throw parseBackendError(error);
  return (data.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    verified: f.status === 'verified',
  }));
}

/** Removes an enrolled factor. */
export async function unenrollTotp(factorId: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.mfa.unenroll({ factorId });
  if (error) throw parseBackendError(error);
}
