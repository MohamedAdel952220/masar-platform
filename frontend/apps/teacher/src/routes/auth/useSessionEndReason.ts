import { useAuth } from '@masar/auth';
import { useEffect, useRef, useState } from 'react';
import type { SessionEndReason } from './SessionEndedRoute';

/**
 * Distinguishes a deliberate sign-out from an involuntary session end.
 *
 * `AuthProvider` exposes only `authenticated | unauthenticated`, and this phase
 * must not change that contract. So the signal is derived here instead: the app
 * marks its own sign-out via `markDeliberateSignOut()`, and any OTHER
 * authenticated → unauthenticated transition is, by elimination, involuntary —
 * a refresh that failed, or a session revoked server-side (§10.6).
 *
 * `sessionStorage` rather than component state, because a sign-out unmounts the
 * tree that would have held it. Scoped to the tab and cleared on read, so it
 * cannot leak into a later session.
 */

const KEY = 'masar.auth.deliberate-signout';

export function markDeliberateSignOut(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Private mode or storage disabled — the reason degrades to "expired",
    // which is the safer of the two messages to show by mistake.
  }
}

function consumeDeliberateFlag(): boolean {
  try {
    const found = sessionStorage.getItem(KEY) === '1';
    if (found) sessionStorage.removeItem(KEY);
    return found;
  } catch {
    return false;
  }
}

/**
 * Returns a reason once the session has ended, or null while signed in / still
 * resolving. `clear()` dismisses it so the sign-in form can be shown.
 */
export function useSessionEndReason(): { reason: SessionEndReason | null; clear: () => void } {
  const { status } = useAuth();
  const wasAuthenticated = useRef(false);
  const [reason, setReason] = useState<SessionEndReason | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      wasAuthenticated.current = true;
      setReason(null);
      return;
    }
    if (status === 'unauthenticated' && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      setReason(consumeDeliberateFlag() ? 'signed-out' : 'expired');
    }
  }, [status]);

  return { reason, clear: () => setReason(null) };
}
