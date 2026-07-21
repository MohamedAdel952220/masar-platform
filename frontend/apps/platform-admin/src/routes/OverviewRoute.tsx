import {
  queryKeys,
  realtime,
  usePlatformList,
  useRealtimeSubscription,
  useTenancyList,
} from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card, StatCard } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StalenessIndicator } from '../components/StalenessIndicator';
import { formatRelative } from '../lib/format';
import { canManageBilling, tierLabel } from '../lib/tier';

/**
 * Overview — the console's dashboard shell.
 *
 * Aggregates the surfaces each dedicated page owns, so an admin lands on a
 * single operational picture. Every figure comes from a hook already provided
 * by @masar/api-client; nothing is computed against a schema this console does
 * not otherwise read.
 *
 * Live: `platform:tenants` and `platform:support_tickets` both invalidate the
 * platform namespace so the tiles stay current.
 */

function SectionLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-link)',
        textDecoration: 'none',
      }}
    >
      {children} →
    </Link>
  );
}

export function OverviewRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.platform.all() });
  }, [queryClient]);

  useRealtimeSubscription(realtime.platformSupportTickets(), invalidate);
  useRealtimeSubscription(realtime.platformTenants(), invalidate);

  const health = usePlatformList('service_health_status', {
    orderBy: 'service_code',
    ascending: true,
    limit: 50,
  });
  const tickets = usePlatformList('support_tickets', { orderBy: 'created_at', limit: 100 });
  const tenants = useTenancyList('platform', 'tenants', { orderBy: 'created_at', limit: 200 });
  const summary = usePlatformList('v_tenant_health_summary', {
    orderBy: 'tenant_id',
    ascending: true,
    limit: 200,
  });

  const healthRows = health.data?.items ?? [];
  const ticketRows = tickets.data?.items ?? [];
  const tenantRows = tenants.data?.items ?? [];
  const summaryRows = summary.data?.items ?? [];

  const servicesDown = healthRows.filter((r) => r.status === 'down' || r.status === 'degraded').length;
  const openTickets = ticketRows.filter((t) => t.status !== 'resolved').length;
  const highSeverity = ticketRows.filter((t) => t.severity === 'high' && t.status !== 'resolved').length;
  const activeTenants = tenantRows.filter((t) => t.status === 'active').length;
  const attentionTenants = tenantRows.filter(
    (t) => t.status === 'overdue' || t.status === 'suspended',
  ).length;

  const lastCheck = healthRows
    .map((r) => r.checked_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={'Signed in as a ' + tierLabel(claims.platformAdminTier) + '-tier Platform Admin.'}
        meta={
          <span
            style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Badge tone="neutral" dot>
              Service check {formatRelative(lastCheck, locale)}
            </Badge>
            {!canManageBilling(claims) ? <Badge tone="amber">Read-only billing</Badge> : null}
          </span>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-7)',
        }}
      >
        <StatCard label="Active tenants" value={activeTenants} accent="var(--success-500)" />
        <StatCard label="Tenants needing attention" value={attentionTenants} accent="var(--amber-500)" />
        <StatCard label="Open tickets" value={openTickets} accent="var(--info-500)" />
        <StatCard label="High severity" value={highSeverity} accent="var(--danger-500)" />
        <StatCard label="Services degraded/down" value={servicesDown} accent="var(--danger-500)" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
              Service health
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {healthRows.length === 0
                ? 'No health records yet.'
                : servicesDown === 0
                  ? 'All tracked services are reporting up.'
                  : servicesDown + ' service(s) need attention.'}
            </span>
            <SectionLink to="/service-health">View service health</SectionLink>
          </div>
        </Card>

        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
              Support queue
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {openTickets === 0 ? 'No open tickets.' : openTickets + ' ticket(s) awaiting triage.'}
            </span>
            <SectionLink to="/support">Open support tickets</SectionLink>
          </div>
        </Card>

        <Card padding="lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
              Tenant snapshot
            </span>
            <StalenessIndicator computedAt={summaryRows[0]?.computed_at} />
            <SectionLink to="/analytics">View analytics</SectionLink>
          </div>
        </Card>
      </div>
    </>
  );
}
