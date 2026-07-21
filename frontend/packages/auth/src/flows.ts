import { getSupabaseClient, parseBackendError, unsubscribeAllChannels } from '@masar/api-client';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Authentication flows (FRONTEND_ARCHITECTURE.md §6), grounded in the deployed
 * Auth configuration (BACKEND_ARCHITECTURE.md §10.2):
 *
 *   guardian / teacher / reception / manager / driver → phone + password
 *   platform_admin                                    → email + password + MFA
 *
 * Two invariants this module enforces:
 *  - No credential is ever created or transported by the UI. New accounts are
 *    activated through a one-time link delivered to the account's own phone
 *    (§10.3); this module only *consumes* such a link.
 *  - Sign-out is total: the session ends, every realtime channel is torn down,
 *    and the caller clears the query cache (§13) so no cross-account data
 *    survives.
 */

export interface SignInResult {
  session: Session;
  user: User;
}

/**
 * supabase-js types auth responses as a discriminated union whose `data` is
 * either fully populated or fully null. Narrowing at runtime is both simpler
 * and safer than trying to mirror that union in every wrapper's signature.
 */
interface AuthResponseLike {
  data: { session: Session | null; user: User | null };
  error: unknown;
}

async function unwrapAuth(promise: PromiseLike<unknown>): Promise<SignInResult> {
  const { data, error } = (await promise) as AuthResponseLike;
  if (error) throw parseBackendError(error);
  if (!data?.session || !data?.user) {
    throw parseBackendError({ message: 'Authentication did not return a session.', status: 401 });
  }
  return { session: data.session, user: data.user };
}

/** Tenant-side roles sign in with phone + password. */
export function signInWithPhone(phone: string, password: string): Promise<SignInResult> {
  return unwrapAuth(getSupabaseClient().auth.signInWithPassword({ phone, password }));
}

/** Platform Admin signs in with email + password (MFA challenge follows). */
export function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  return unwrapAuth(getSupabaseClient().auth.signInWithPassword({ email, password }));
}

/**
 * Ends the session everywhere. Realtime channels are torn down first so no
 * socket outlives the credential that authorized it.
 */
export async function signOut(): Promise<void> {
  unsubscribeAllChannels();
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw parseBackendError(error);
}

/** Restores a persisted session on app start. Returns null when signed out. */
export async function restoreSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw parseBackendError(error);
  return data.session;
}

/**
 * Forces a token refresh. supabase-js refreshes automatically; this exists for
 * the explicit case (e.g. after a role change) where the caller needs fresh
 * claims immediately rather than at the next scheduled refresh.
 */
export async function refreshSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.refreshSession();
  if (error) throw parseBackendError(error);
  return data.session;
}

// ---------------------------------------------------------------------------
// Activation and password reset
// ---------------------------------------------------------------------------

/**
 * Completes account activation from a one-time link (§10.3).
 *
 * The link establishes a short-lived session; the account then sets its own
 * password. No password is ever transported to the account by any other means,
 * and a manager never relays a credential.
 */
export async function completeActivation(newPassword: string): Promise<User> {
  const { data, error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
  if (error) throw parseBackendError(error);
  if (!data.user) throw parseBackendError({ message: 'Activation did not return a user.', status: 400 });
  return data.user;
}

/**
 * Requests a password-reset OTP for a phone identity.
 *
 * Delivery depends on the single WhatsApp/SMS provider (§31); an outage blocks
 * reset platform-wide, so callers must surface a clear retry path rather than a
 * generic failure.
 */
export async function requestPhonePasswordReset(phone: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOtp({ phone });
  if (error) throw parseBackendError(error);
}

/** Requests a password-reset email (Platform Admin identities). */
export async function requestEmailPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) throw parseBackendError(error);
}

/** Verifies a phone OTP and establishes a session for the reset flow. */
export async function verifyPhoneOtp(phone: string, token: string): Promise<SignInResult> {
  return unwrapAuth(getSupabaseClient().auth.verifyOtp({ phone, token, type: 'sms' }));
}

/** Sets a new password for the currently-authenticated session. */
export async function setPassword(newPassword: string): Promise<User> {
  const { data, error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
  if (error) throw parseBackendError(error);
  if (!data.user) throw parseBackendError({ message: 'Password update did not return a user.', status: 400 });
  return data.user;
}
