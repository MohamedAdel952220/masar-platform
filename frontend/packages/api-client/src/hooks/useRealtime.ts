import { useEffect, useRef } from 'react';
import type { ChangePayload } from '../realtime';

/**
 * Binds a realtime subscription to component lifetime.
 *
 * `subscribe` is one of the factories on `realtime` (e.g.
 * `realtime.tripPosition(tripId)`). The handler is kept in a ref so a changing
 * callback identity never tears the channel down and re-establishes it.
 */
export function useRealtimeSubscription<TRow>(
  subscribe: ((onChange: (payload: ChangePayload<TRow>) => void) => () => void) | null,
  onChange: (payload: ChangePayload<TRow>) => void,
  enabled = true,
): void {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    if (!enabled || !subscribe) return;
    const unsubscribe = subscribe((payload) => handlerRef.current(payload));
    return unsubscribe;
  }, [subscribe, enabled]);
}
