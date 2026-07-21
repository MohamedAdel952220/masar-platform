import { callRpc } from '@masar/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * GPS tracking for an active trip.
 *
 * ══ REAL GEOLOCATION ONLY ══
 *
 * Positions come from `navigator.geolocation.watchPosition`. Nothing here
 * fabricates, replays, or interpolates a fix. When the device cannot produce a
 * position the tracker says so and sends nothing — a made-up coordinate on a
 * screen a parent is watching would be worse than an honest gap.
 *
 * ══ THREE INDEPENDENT RATES, DELIBERATELY ══
 *
 * These are three different problems and are tuned separately:
 *
 *  1. **Device sampling** — `watchPosition` fires as often as the OS decides.
 *     Not ours to control.
 *  2. **Server cadence: one ping per 7s** (§18 specifies 5–10s), further gated
 *     by a movement threshold. This is the battery and write-volume budget.
 *     `record_gps_ping` is a high-frequency insert; §30 models ~500 rows/hour
 *     per active bus-leg on this cadence.
 *  3. **UI render: at most 1/second** (§15, §29). Ping frequency is a backend
 *     decision; render frequency is a UI one, and the architecture is explicit
 *     that they must not be coupled.
 *
 * ══ BATTERY ══
 *
 * `battery impact is a first-order design constraint` (§29). Four measures:
 *
 *  - **Movement threshold.** A bus stopped at a school gate for ten minutes
 *    should not transmit 85 identical coordinates. Below `MOVEMENT_THRESHOLD_M`
 *    of displacement the ping is skipped...
 *  - **...but a heartbeat still runs.** Skipping forever would make a parked bus
 *    indistinguishable from a crashed app, so a stationary bus still reports
 *    every `HEARTBEAT_MS`. Silence must mean something.
 *  - **`maximumAge`** lets the OS hand back a recent cached fix instead of
 *    powering the radio for a fresh one.
 *  - **The watch is torn down the moment the trip is not active.** No trip, no
 *    GPS hardware. This is the single largest saving available.
 *
 * ══ OFFLINE ══
 *
 * §14: *"Offline detection with an explicit banner; queued actions are not
 * silently replayed against non-idempotent endpoints."*
 *
 * So when the device is offline this tracker DOES NOT QUEUE. It keeps tracking
 * locally, marks pings as dropped, and reports that state for the UI to show.
 * A backlog of stale coordinates flushed on reconnect would draw a bus moving
 * through positions it left ten minutes ago — actively misleading to the parent
 * watching the map. The architecture forbids inventing sync, and here that
 * prohibition is also the correct behaviour.
 */

/** §18 cadence: 5–10 s. 7 s sits mid-band. */
const PING_INTERVAL_MS = 7_000;
/** §15/§29 render cap, independent of ping cadence. */
const RENDER_INTERVAL_MS = 1_000;
/** Below this displacement a ping is skipped as noise rather than movement. */
const MOVEMENT_THRESHOLD_M = 25;
/** A stationary bus still reports this often, so silence stays meaningful. */
const HEARTBEAT_MS = 60_000;
/** Above this speed the bus is described as moving regardless of displacement. */
const MOVING_SPEED_KPH = 3;
/** A fix older than this is treated as stale rather than current. */
const STALE_FIX_MS = 30_000;

export type GpsPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';
export type MovementState = 'moving' | 'stopped' | 'unknown';

export interface GpsFix {
  lat: number;
  lng: number;
  headingDeg: number | null;
  speedKph: number | null;
  accuracyM: number | null;
  at: number;
}

export interface GpsState {
  /** Whether the tracker is currently watching the device. */
  tracking: boolean;
  permission: GpsPermission;
  /** Most recent fix, re-rendered at most once per second. */
  fix: GpsFix | null;
  movement: MovementState;
  /** Browser connectivity. Pings are not attempted while false. */
  online: boolean;
  /** Server-accepted pings this trip. */
  sent: number;
  /** Pings skipped because the bus had not moved — the battery saving, visible. */
  skipped: number;
  /** Pings not attempted because the device was offline. Never replayed. */
  dropped: number;
  lastSentAt: number | null;
  /** Last ping rejection. `record_gps_ping` refuses terminal trips. */
  lastError: unknown;
  /** True when the newest fix is older than the stale threshold. */
  stale: boolean;
}

function haversineMetres(a: GpsFix, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - a.lat);
  const dLng = toRad(bLng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const INITIAL: GpsState = {
  tracking: false,
  permission: 'prompt',
  fix: null,
  movement: 'unknown',
  online: true,
  sent: 0,
  skipped: 0,
  dropped: 0,
  lastSentAt: null,
  lastError: null,
  stale: false,
};

export function useGpsTracker(tripId: string | null, enabled: boolean): GpsState {
  const [state, setState] = useState<GpsState>(INITIAL);

  // Refs hold the hot path. None of this should cause a render.
  const latestFix = useRef<GpsFix | null>(null);
  const lastSentFix = useRef<GpsFix | null>(null);
  const lastRenderAt = useRef(0);
  const watchId = useRef<number | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlight = useRef(false);
  const onlineRef = useRef(true);

  const active = enabled && tripId !== null;

  // ---- connectivity -------------------------------------------------------
  useEffect(() => {
    const read = () => {
      const value = typeof navigator === 'undefined' ? true : navigator.onLine;
      onlineRef.current = value;
      setState((s) => (s.online === value ? s : { ...s, online: value }));
    };
    read();
    window.addEventListener('online', read);
    window.addEventListener('offline', read);
    return () => {
      window.removeEventListener('online', read);
      window.removeEventListener('offline', read);
    };
  }, []);

  // ---- render pump: publishes the newest fix at most once per second ------
  const publish = useCallback(() => {
    const fix = latestFix.current;
    if (!fix) return;
    const now = Date.now();
    if (now - lastRenderAt.current < RENDER_INTERVAL_MS) return;
    lastRenderAt.current = now;

    const previous = lastSentFix.current;
    let movement: MovementState = 'unknown';
    if (fix.speedKph !== null) {
      movement = fix.speedKph >= MOVING_SPEED_KPH ? 'moving' : 'stopped';
    } else if (previous) {
      movement = haversineMetres(previous, fix.lat, fix.lng) >= MOVEMENT_THRESHOLD_M ? 'moving' : 'stopped';
    }

    setState((s) => ({ ...s, fix, movement, stale: now - fix.at > STALE_FIX_MS }));
  }, []);

  // ---- watch the device ---------------------------------------------------
  useEffect(() => {
    if (!active) {
      setState((s) => ({ ...s, tracking: false }));
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState((s) => ({ ...s, permission: 'unsupported', tracking: false }));
      return;
    }

    setState((s) => ({ ...s, tracking: true, permission: 'prompt' }));

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const c = position.coords;
        latestFix.current = {
          lat: c.latitude,
          lng: c.longitude,
          headingDeg: Number.isFinite(c.heading) ? c.heading : null,
          // The Geolocation API reports m/s; the column is km/h.
          speedKph: Number.isFinite(c.speed) && c.speed !== null ? c.speed * 3.6 : null,
          accuracyM: Number.isFinite(c.accuracy) ? c.accuracy : null,
          at: position.timestamp,
        };
        setState((s) => (s.permission === 'granted' ? s : { ...s, permission: 'granted' }));
        publish();
      },
      (error) => {
        // 1 === PERMISSION_DENIED. Anything else is a transient position
        // failure (no signal, timeout) and must not be reported as a refusal.
        setState((s) =>
          error.code === 1
            ? { ...s, permission: 'denied', tracking: false }
            : { ...s, lastError: error, stale: true },
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );

    renderTimer.current = setInterval(publish, RENDER_INTERVAL_MS);

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (renderTimer.current !== null) {
        clearInterval(renderTimer.current);
        renderTimer.current = null;
      }
      latestFix.current = null;
      lastSentFix.current = null;
      setState((s) => ({ ...s, tracking: false, fix: null, movement: 'unknown' }));
    };
  }, [active, publish]);

  // ---- ping the server on the §18 cadence ---------------------------------
  useEffect(() => {
    if (!active || tripId === null) return;

    const tick = async () => {
      const fix = latestFix.current;
      if (!fix || inFlight.current) return;

      // Offline: count it and move on. Never queue (§14).
      if (!onlineRef.current) {
        setState((s) => ({ ...s, dropped: s.dropped + 1 }));
        return;
      }

      const previous = lastSentFix.current;
      const moved = previous === null ? Infinity : haversineMetres(previous, fix.lat, fix.lng);
      const sinceLastSend = previous === null ? Infinity : fix.at - previous.at;

      if (moved < MOVEMENT_THRESHOLD_M && sinceLastSend < HEARTBEAT_MS) {
        setState((s) => ({ ...s, skipped: s.skipped + 1 }));
        return;
      }

      inFlight.current = true;
      try {
        await callRpc('record_gps_ping', {
          p_trip_id: tripId,
          p_lat: fix.lat,
          p_lng: fix.lng,
          ...(fix.headingDeg === null ? {} : { p_heading: fix.headingDeg }),
          ...(fix.speedKph === null ? {} : { p_speed_kph: fix.speedKph }),
        });
        lastSentFix.current = fix;
        setState((s) => ({ ...s, sent: s.sent + 1, lastSentAt: Date.now(), lastError: null }));
      } catch (err) {
        // A terminal trip rejects pings by design; surface it and let the
        // screen stop tracking rather than retrying into a closed trip.
        setState((s) => ({ ...s, lastError: err }));
      } finally {
        inFlight.current = false;
      }
    };

    pingTimer.current = setInterval(() => void tick(), PING_INTERVAL_MS);
    return () => {
      if (pingTimer.current !== null) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
    };
  }, [active, tripId]);

  return state;
}

export const GPS_TUNING = {
  pingIntervalMs: PING_INTERVAL_MS,
  renderIntervalMs: RENDER_INTERVAL_MS,
  movementThresholdM: MOVEMENT_THRESHOLD_M,
  heartbeatMs: HEARTBEAT_MS,
  staleFixMs: STALE_FIX_MS,
} as const;
