import { useRpcMutation } from '@masar/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { ChildTripStatus } from './enums';

/**
 * Child status updates — `update_child_trip_status`.
 *
 * ══ ONE OF THE SEVEN NON-IDEMPOTENT RPCs ══
 *
 * It accepts no idempotency key, so a duplicate call is a duplicate state
 * transition with its own notification fan-out to the family. Three
 * consequences, all implemented here rather than left to each screen:
 *
 *  1. **`retry: false`** — hard-coded inside `useRpcMutation`.
 *  2. **No optimistic update.** `update_child_trip_status` is not on
 *     `OPTIMISTIC_SAFE_RPCS`, so `useOptimisticRpcMutation` could not accept it
 *     even if asked. The row the server returns is the truth; the UI waits.
 *  3. **The control is not re-armed after a failure.** This is the one that
 *     takes deliberate code. `retry: false` stops the *client* retrying; it does
 *     nothing about a driver tapping again because nothing visibly happened.
 *     After a failed call the child is put in a "needs checking" state and the
 *     button is withdrawn until the driver refreshes and sees real server state.
 *
 * A driver marking the same child boarded twice sends the family two
 * "picked up" notifications, which is exactly the confusion the seven-RPC rule
 * exists to prevent.
 */

export interface ChildStatusUpdater {
  /** Children whose update is in flight or has failed — controls are withdrawn. */
  lockedChildIds: ReadonlySet<string>;
  /** Children whose last attempt failed and need the driver to re-check. */
  failedChildIds: ReadonlySet<string>;
  isPending: boolean;
  error: unknown;
  update: (tripId: string, childId: string, status: ChildTripStatus) => void;
  /** Clears the error banner and re-arms every withdrawn control. */
  reset: () => void;
}

export function useChildStatusUpdate(): ChildStatusUpdater {
  const queryClient = useQueryClient();
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [lastChildId, setLastChildId] = useState<string | null>(null);

  const mutation = useRpcMutation('update_child_trip_status', {
    onSuccess: () => {
      // Success releases the lock: server state now matches what the driver did.
      setLocked((prev) => {
        if (!lastChildId) return prev;
        const next = new Set(prev);
        next.delete(lastChildId);
        return next;
      });
      void queryClient.invalidateQueries();
    },
    onError: () => {
      // Failure KEEPS the lock and adds a failure marker. Deliberately not
      // re-armed — see the note above.
      if (lastChildId) setFailed((prev) => new Set(prev).add(lastChildId));
    },
  });

  const update = useCallback(
    (tripId: string, childId: string, status: ChildTripStatus) => {
      if (locked.has(childId)) return;
      setLastChildId(childId);
      setLocked((prev) => new Set(prev).add(childId));
      mutation.mutate({ p_trip_id: tripId, p_child_id: childId, p_status: status });
    },
    [locked, mutation],
  );

  const reset = useCallback(() => {
    setLocked(new Set());
    setFailed(new Set());
    setLastChildId(null);
    mutation.reset();
    void queryClient.invalidateQueries();
  }, [mutation, queryClient]);

  return {
    lockedChildIds: locked,
    failedChildIds: failed,
    isPending: mutation.isPending,
    error: mutation.error,
    update,
    reset,
  };
}
