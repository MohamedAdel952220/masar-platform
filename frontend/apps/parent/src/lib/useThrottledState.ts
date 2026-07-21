import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State that re-renders at most once per `intervalMs`.
 *
 * This exists for the live trip screen. `transport.gps_pings` inserts arrive on
 * the `trip:{id}:position` channel as fast as the bus's device emits them —
 * several per second is normal — and rendering every one would burn a parent's
 * battery for motion no eye can resolve. FRONTEND_ARCHITECTURE.md §15 caps GPS
 * at **one render per second**; this enforces that cap.
 *
 * The semantics are "leading edge, then trailing": the first value paints
 * immediately (a parent opening the screen should not wait a second for the
 * bus to appear), subsequent values inside the window are coalesced, and the
 * most recent one paints when the window closes. No position is skipped
 * permanently — only superseded ones are dropped, which is exactly right for a
 * position, where only the latest value has meaning.
 */
export function useThrottledState<T>(initial: T, intervalMs = 1000): [T, (value: T) => void] {
  const [rendered, setRendered] = useState<T>(initial);
  const lastPaintedAt = useRef(0);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pending trailing update must never outlive the component.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const push = useCallback(
    (value: T) => {
      const now = Date.now();
      const elapsed = now - lastPaintedAt.current;

      if (elapsed >= intervalMs) {
        lastPaintedAt.current = now;
        pending.current = null;
        if (timer.current !== null) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        setRendered(value);
        return;
      }

      // Inside the window: keep only the newest value and paint it when the
      // window closes.
      pending.current = { value };
      if (timer.current !== null) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const queued = pending.current;
        pending.current = null;
        if (queued) {
          lastPaintedAt.current = Date.now();
          setRendered(queued.value);
        }
      }, intervalMs - elapsed);
    },
    [intervalMs],
  );

  return [rendered, push];
}
