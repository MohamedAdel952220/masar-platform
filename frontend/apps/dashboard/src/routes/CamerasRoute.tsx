import { realtime, useMediaList, useRealtimeSubscription, type MediaRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ManagerOnly, QueryState } from '../components/States';
import { formatRelative } from '../lib/format';
import { canManageCameras } from '../lib/permissions';

/**
 * Cameras — `media.cameras` metadata only (§17).
 *
 * Video never flows through Postgres or Realtime; only camera *metadata* does.
 * Live viewing requires a `camera-stream-token` Edge Function call against the
 * external media relay, which is a player concern rather than a list concern
 * and is not built in this phase.
 *
 * THE KEY DISTINCTION (§17): `online` and `admin_disabled` are INDEPENDENT
 * booleans, not one status. "Offline" (heartbeat lost) and "Disabled by
 * manager" are different states with different remedies, and the UI must not
 * collapse them. A camera is viewable only when `online && !admin_disabled`.
 *
 * Live via `tenant:{id}:cameras` (heartbeat-driven) and the separate
 * `tenant:{id}:cameras:heartbeat` channel, which §15 keeps distinct precisely
 * so the Dashboard can tell "I just disabled this" from "it went offline".
 */

type Camera = MediaRow<'cameras'>;

type Viewability = { label: string; tone: 'success' | 'amber' | 'danger' };

function viewability(camera: Camera): Viewability {
  if (camera.admin_disabled) return { label: 'Disabled by manager', tone: 'amber' };
  if (!camera.online) return { label: 'Offline', tone: 'danger' };
  return { label: 'Viewable', tone: 'success' };
}

export function CamerasRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';

  const query = useMediaList(tenantId, 'cameras', { orderBy: 'name', ascending: true, limit: 200 });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useRealtimeSubscription(tenantId ? realtime.tenantCameras(tenantId) : null, invalidate, Boolean(tenantId));
  useRealtimeSubscription(
    tenantId ? realtime.tenantCamerasHeartbeat(tenantId) : null,
    invalidate,
    Boolean(tenantId),
  );

  const rows = useMemo(() => (query.data?.items ?? []).filter((c) => c.deleted_at === null), [query.data]);

  const viewable = rows.filter((c) => c.online && !c.admin_disabled).length;
  const offline = rows.filter((c) => !c.online && !c.admin_disabled).length;
  const disabled = rows.filter((c) => c.admin_disabled).length;

  const columns: Column<Camera>[] = [
    {
      key: 'name',
      header: 'Camera',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>{row.name}</span>
      ),
    },
    { key: 'zone', header: 'Zone', render: (row) => <Badge tone="neutral">{row.zone}</Badge> },
    {
      key: 'viewability',
      header: 'State',
      render: (row) => {
        const state = viewability(row);
        return (
          <Badge tone={state.tone} dot>
            {state.label}
          </Badge>
        );
      },
    },
    {
      key: 'resolution',
      header: 'Resolution',
      render: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.resolution}</span>,
    },
    {
      key: 'has_audio',
      header: 'Audio',
      render: (row) =>
        row.has_audio ? (
          <Badge tone="teal">Yes</Badge>
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>No</span>
        ),
    },
    {
      key: 'last_heartbeat_at',
      header: 'Last heartbeat',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.last_heartbeat_at, locale)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Cameras"
        subtitle="Camera status for your nursery. Offline and manager-disabled are separate states with different remedies."
        meta={
          <Badge tone="teal" dot>
            Live
          </Badge>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Viewable" value={viewable} accent="var(--success-500)" />
        <StatCard label="Offline" value={offline} accent="var(--danger-500)" />
        <StatCard label="Disabled by manager" value={disabled} accent="var(--amber-500)" />
        <StatCard label="Total" value={rows.length} />
      </div>

      {!canManageCameras(claims) ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>Adding cameras and toggling availability are manager actions.</ManagerOnly>
        </div>
      ) : null}

      <Card padding="md" style={{ marginBottom: 'var(--space-5)' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Live video is served by the external media relay, not by Masar&apos;s database. Only camera status
          is shown here.
        </span>
      </Card>

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyTitle="No cameras registered"
        emptyHint="Cameras appear here once added to your nursery."
        onRetry={() => void query.refetch()}
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Cameras" />
      </QueryState>
    </>
  );
}
