import { Badge } from '@masar/design-system';
import { TRIP_LEG_LABEL, TRIP_STATUS_LABEL, asTripLeg, asTripStatus } from '../lib/enums';
import { useTripContext } from '../lib/tripContext';

/**
 * Persistent status strip: trip state, GPS state, connectivity.
 *
 * Always visible in the chrome, on every screen, because a driver must be able
 * to answer "is the nursery still seeing me?" without navigating. Discovering
 * mid-route that position stopped transmitting twenty minutes ago is the
 * failure this strip exists to prevent.
 *
 * The three signals are shown separately and never merged into one badge —
 * "offline", "GPS denied" and "trip finished" have completely different
 * remedies, and collapsing them would tell the driver to fix the wrong thing.
 */
export function StatusStrip() {
  const { activeTrip, gps } = useTripContext();

  const status = activeTrip ? asTripStatus(activeTrip.status) : null;
  const leg = activeTrip ? asTripLeg(activeTrip.leg) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
        padding: '0 var(--space-5) var(--space-3)',
      }}
    >
      {activeTrip ? (
        <Badge tone="teal" dot>
          {leg ? TRIP_LEG_LABEL[leg] : activeTrip.leg} ·{' '}
          {status ? TRIP_STATUS_LABEL[status] : activeTrip.status}
        </Badge>
      ) : (
        <Badge tone="neutral">No trip running</Badge>
      )}

      {!gps.online ? (
        <Badge tone="amber" dot>
          Offline
        </Badge>
      ) : null}

      {activeTrip ? (
        gps.permission === 'denied' ? (
          <Badge tone="amber" dot>
            Location off
          </Badge>
        ) : gps.permission === 'unsupported' ? (
          <Badge tone="amber">No GPS</Badge>
        ) : gps.stale ? (
          <Badge tone="amber" dot>
            Signal lost
          </Badge>
        ) : gps.tracking && gps.fix ? (
          <Badge tone="success" dot>
            {gps.movement === 'moving' ? 'Moving' : 'Stopped'}
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Finding you…
          </Badge>
        )
      ) : null}
    </div>
  );
}
