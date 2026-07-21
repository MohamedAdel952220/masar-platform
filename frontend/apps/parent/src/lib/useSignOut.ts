import { signOut } from '@masar/auth';
import { markDeliberateSignOut } from '../routes/auth/useSessionEndReason';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Sign out AND purge the query cache.
 *
 * FRONTEND_ARCHITECTURE.md §13 makes this non-negotiable:
 *
 *   "Cache is cleared entirely on logout and on account switch — non-negotiable,
 *    because RLS makes visibility identity-dependent."
 *
 * `@masar/auth`'s `signOut()` tears down realtime channels but deliberately does
 * NOT touch TanStack Query — its own doc comment says "Callers must also clear
 * the query cache (see §13)". Until the Phase 9 integration audit, no caller in
 * any of the six portals did, so cached rows outlived the credential that
 * authorized them for up to `gcTime` (30 minutes).
 *
 * That matters most exactly where these apps run: a shared reception terminal,
 * a nursery tablet, a driver's handset. Sign out, hand the device over, and the
 * next person's first render could paint the previous user's children, messages
 * or billing rows before any refetch corrected it.
 *
 * Order is deliberate: sign out first, so `onAuthStateChange` unmounts the
 * authenticated tree and cancels in-flight queries, then clear whatever remains.
 * Clearing first would leave a window in which a resolving query repopulates the
 * cache with the old identity's data.
 */
export function useSignOut(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    // Records intent, so an involuntary session end is distinguishable (§10.6).
    markDeliberateSignOut();
    void signOut().finally(() => {
      queryClient.clear();
    });
  }, [queryClient]);
}
