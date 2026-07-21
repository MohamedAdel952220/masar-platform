import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime, formatRelative } from '../lib/format';
import { useTripContext } from '../lib/tripContext';
import { GPS_TUNING } from '../lib/useGpsTracker';

/**
 * GPS status — what the nursery can currently see, and why.
 *
 * This screen exists because "am I being tracked?" is a question a driver is
 * entitled to a straight answer to. It is deliberately explicit about the
 * tracking rather than discreet: someone whose location is transmitted to their
 * employer should be able to see exactly when it starts, when it stops, how
 * often it is sent, and what is being sent.
 *
 * Every number here is real. Nothing on this screen is simulated, smoothed, or
 * inferred — the counters come from actual `record_gps_ping` outcomes.
 */

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{label}</span>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-strong)',
          }}
        >
          {value}
        </span>
      </div>
      {hint ? <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{hint}</span> : null}
    </div>
  );
}

export function GpsRoute() {
  const { locale } = useLocale();
  const { activeTrip, gps } = useTripContext();

  const permissionCopy: Record<typeof gps.permission, { label: string; detail: string }> = {
    granted: { label: 'Allowed', detail: 'This device is providing your position.' },
    denied: {
      label: 'Blocked',
      detail:
        'Location is turned off for this app. The nursery cannot see the bus, and parents will see no movement. Enable it in your device settings.',
    },
    prompt: { label: 'Not yet allowed', detail: 'Your device has not been asked, or has not answered yet.' },
    unsupported: {
      label: 'Not available',
      detail: 'This device cannot provide a location. Tell the office — the run will not be trackable.',
    },
  };

  const permission = permissionCopy[gps.permission];

  return (
    <>
      <PageHeader
        title="Location"
        subtitle="What the nursery can see while you drive."
        meta={
          <span style={{ display: 'inline-flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge tone={gps.tracking ? 'success' : 'neutral'} dot>
              {gps.tracking ? 'Sharing' : 'Not sharing'}
            </Badge>
            <Badge tone={gps.online ? 'neutral' : 'amber'} dot>
              {gps.online ? 'Connected' : 'Offline'}
            </Badge>
          </span>
        }
      />

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {!activeTrip ? (
          <Card padding="lg">
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                Your location is not being shared
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Position is only sent while a run is under way. When you finish a run, tracking stops
                immediately — nothing is recorded between runs.
              </span>
            </div>
          </Card>
        ) : null}

        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
              Device location: {permission.label}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{permission.detail}</span>
          </div>
        </Card>

        {!gps.online ? (
          <Card padding="lg" accent="var(--status-live)">
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                No connection
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                Positions are not being sent and are <strong>not</strong> saved up to send later. When the
                connection returns, sharing resumes from where you are then — parents will see a gap, not a
                replay of where you have been.
              </span>
            </div>
          </Card>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <StatCard label="Positions sent" value={gps.sent} />
          <StatCard label="Skipped (parked)" value={gps.skipped} />
          <StatCard label="Missed (offline)" value={gps.dropped} />
        </div>

        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Current position
            </span>
            {gps.fix ? (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <Line label="Coordinates" value={gps.fix.lat.toFixed(5) + ', ' + gps.fix.lng.toFixed(5)} />
                <Line
                  label="Speed"
                  value={gps.fix.speedKph === null ? 'Unknown' : Math.round(gps.fix.speedKph) + ' km/h'}
                />
                <Line
                  label="Movement"
                  value={
                    gps.movement === 'moving' ? 'Moving' : gps.movement === 'stopped' ? 'Stopped' : 'Unknown'
                  }
                />
                <Line
                  label="Accuracy"
                  value={gps.fix.accuracyM === null ? 'Unknown' : '±' + Math.round(gps.fix.accuracyM) + ' m'}
                />
                <Line
                  label="Fix taken"
                  value={formatDateTime(new Date(gps.fix.at).toISOString(), locale)}
                  hint={gps.stale ? 'This fix is old — your device has lost signal.' : undefined}
                />
                <Line
                  label="Last sent"
                  value={
                    gps.lastSentAt === null
                      ? 'Not yet'
                      : formatRelative(new Date(gps.lastSentAt).toISOString(), locale)
                  }
                />
              </div>
            ) : (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No position yet.</span>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              How this works
            </span>
            <Line
              label="Sent every"
              value={GPS_TUNING.pingIntervalMs / 1000 + ' seconds'}
              hint="Only while a run is active."
            />
            <Line
              label="Skipped if you have moved less than"
              value={GPS_TUNING.movementThresholdM + ' m'}
              hint="Saves battery and data when the bus is parked."
            />
            <Line
              label="But always sent at least every"
              value={GPS_TUNING.heartbeatMs / 1000 + ' seconds'}
              hint="So a parked bus is never mistaken for a lost signal."
            />
            <Line
              label="Screen updates at most"
              value="once per second"
              hint="Independent of how often positions are sent."
            />
          </div>
        </Card>
      </div>
    </>
  );
}
