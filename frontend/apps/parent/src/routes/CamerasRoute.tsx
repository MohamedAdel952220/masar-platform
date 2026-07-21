import { invokeEdgeFunction, useMediaList, type MediaRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatDateTime, formatRelative } from '../lib/format';
import { isCameraViewable } from '../lib/parent';

/**
 * Camera viewing.
 *
 * AUTHORIZATION IS ENTIRELY SERVER-SIDE. Two independent gates apply, and this
 * screen relies on both rather than reimplementing either:
 *
 *  - RLS decides which cameras a guardian can even see (§12: their own child's
 *    classroom, via `media.camera_classroom_links`). No client-side classroom
 *    filtering is applied here — the list is what the database returned.
 *  - The `camera-stream-token` Edge Function decides whether a token is issued,
 *    and mints a SHORT-LIVED one. The token is the actual access grant; the
 *    button below merely asks for it.
 *
 * §17: `online` and `admin_disabled` are INDEPENDENT booleans, never collapsed
 * into a single status. A camera can be online yet administratively disabled —
 * and the two cases are shown differently, because "temporarily off" and
 * "turned off by the nursery" mean different things to a parent.
 *
 * The token is held in component state only: never persisted, never logged,
 * and dropped when the screen unmounts. The relay URL it pairs with is an
 * external media relay, not a Supabase endpoint.
 */

type Camera = MediaRow<'cameras'>;

interface StreamGrant {
  cameraId: string;
  relayUrl: string;
  expiresAt: string;
}

function statusBadge(camera: Camera) {
  if (camera.admin_disabled) return <Badge tone="neutral">Turned off by the nursery</Badge>;
  if (!camera.online)
    return (
      <Badge tone="amber" dot>
        Offline
      </Badge>
    );
  return (
    <Badge tone="success" dot>
      Live
    </Badge>
  );
}

export function CamerasRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';

  const [grant, setGrant] = useState<StreamGrant | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const cameras = useMediaList(tenantId, 'cameras', { orderBy: 'name', ascending: true, limit: 50 });
  const rows = (cameras.data?.items ?? []).filter((c) => c.deleted_at === null);

  const requestStream = async (camera: Camera) => {
    setRequesting(camera.id);
    setError(null);
    setGrant(null);
    try {
      const result = await invokeEdgeFunction('camera-stream-token', { cameraId: camera.id });
      // The token itself is intentionally not stored beyond this call — the
      // relay consumes it, and keeping a copy around only widens exposure.
      setGrant({ cameraId: camera.id, relayUrl: result.relayUrl, expiresAt: result.expiresAt });
    } catch (err) {
      setError(err);
    } finally {
      setRequesting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Cameras"
        subtitle="Your child's classroom, while the nursery has viewing enabled."
        meta={<Badge tone="neutral">Access is granted per view and expires</Badge>}
      />

      {error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState error={error} onRetry={() => setError(null)} />
        </div>
      ) : null}

      <QueryState
        isLoading={cameras.isLoading}
        error={cameras.error}
        isEmpty={rows.length === 0}
        emptyTitle="No cameras available to you"
        emptyHint="Cameras appear here only when the nursery has enabled viewing for your child's classroom."
        onRetry={() => void cameras.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {rows.map((camera) => {
            const viewable = isCameraViewable(camera);
            const active = grant?.cameraId === camera.id;
            return (
              <Card key={camera.id} padding="md">
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Icon name="video" size={20} />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {camera.name}
                    </span>
                    {statusBadge(camera)}
                  </div>

                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                    {camera.zone} · {camera.resolution}
                    {camera.last_heartbeat_at
                      ? ' · last seen ' + formatRelative(camera.last_heartbeat_at, locale)
                      : ''}
                  </span>

                  {camera.admin_disabled ? (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      The nursery has turned viewing off for this camera.
                    </span>
                  ) : !camera.online ? (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      This camera is not reporting right now. It will return on its own.
                    </span>
                  ) : null}

                  <Button
                    size="sm"
                    disabled={!viewable || requesting === camera.id}
                    onClick={() => void requestStream(camera)}
                  >
                    {requesting === camera.id ? 'Requesting…' : 'Watch'}
                  </Button>

                  {active && grant ? (
                    <Card padding="sm" accent="var(--primary)">
                      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                          Stream authorized. Access expires {formatDateTime(grant.expiresAt, locale)}.
                        </span>
                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                          The video player is delivered by the mobile shell; this build shows the grant only.
                        </span>
                      </div>
                    </Card>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </QueryState>
    </>
  );
}
