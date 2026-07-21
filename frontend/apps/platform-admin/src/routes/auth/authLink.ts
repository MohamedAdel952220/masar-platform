/**
 * Reads the result of a Supabase auth link out of the current URL.
 *
 * ══ WHAT PRODUCES THESE URLS ══
 *
 * The client is configured with `flowType: 'pkce'` and `detectSessionInUrl:
 * true` (see `packages/api-client/src/client.ts`), so supabase-js itself
 * exchanges a `?code=…` for a session before any of our code runs, and
 * `onAuthStateChange` fires. This module therefore does NOT exchange anything —
 * it only classifies what the URL says happened, so the landing screen can show
 * the right state.
 *
 * Failures arrive as query OR hash parameters depending on the flow that
 * produced them, so both are read. That is defensive parsing of an existing
 * contract, not a new one.
 *
 * ══ THE STUBBED PROVISIONING LINK ══
 *
 * `backend/supabase/functions/_shared/activation.ts` is explicitly stubbed
 * (Epic 1 decision, to be replaced in Epic 4). It builds
 *
 *     {ACTIVATION_LINK_BASE_URL}/{userId}?token={crypto.randomUUID()}
 *
 * and logs it instead of sending it. That `token` is a random UUID stored
 * nowhere and verifiable by nothing, so following such a link cannot establish
 * a session. `LEGACY_STUB` classifies that shape specifically, so the landing
 * screen can say so plainly rather than failing as "invalid link" and sending
 * the user round a loop that cannot terminate.
 */

export type AuthLinkState =
  | { kind: 'none' }
  | { kind: 'session' }
  | { kind: 'expired'; description: string | null }
  | { kind: 'invalid'; description: string | null }
  | { kind: 'legacy-stub' };

function readParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const query = new URLSearchParams(window.location.search);
  // Implicit-flow errors land in the fragment; merge both sources.
  const hash = window.location.hash.startsWith('#')
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams();
  for (const [k, v] of hash) if (!query.has(k)) query.append(k, v);
  return query;
}

export function readAuthLinkState(hasSession: boolean): AuthLinkState {
  const params = readParams();
  const error = params.get('error');
  const errorCode = params.get('error_code');
  const description = params.get('error_description');

  if (error || errorCode) {
    // Supabase reports a consumed or timed-out one-time link this way.
    const expired = errorCode === 'otp_expired' || (description ?? '').toLowerCase().includes('expired');
    return expired ? { kind: 'expired', description } : { kind: 'invalid', description };
  }

  // The stubbed provisioning link: a bare `token` with no PKCE `code`.
  if (params.has('token') && !params.has('code') && !hasSession) {
    return { kind: 'legacy-stub' };
  }

  if (hasSession) return { kind: 'session' };
  return { kind: 'none' };
}

/**
 * Strips auth parameters from the address bar once handled, so a refresh does
 * not re-trigger a consumed link and a one-time code is not left sitting in
 * browser history.
 */
export function clearAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const key of ['code', 'token', 'type', 'error', 'error_code', 'error_description']) {
    url.searchParams.delete(key);
  }
  url.hash = '';
  window.history.replaceState({}, '', url.toString());
}
