import { useTenancyList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { PageHeader } from '../components/PageHeader';
import { ManagerOnly, QueryState } from '../components/States';
import { formatDate } from '../lib/format';
import { canEditSettings, roleLabel } from '../lib/permissions';

/**
 * Settings — the nursery's own tenant record (§12: manager "R, U own settings
 * only"; RLS returns exactly one row, the caller's own tenant).
 *
 * READ-ONLY IN THIS PHASE, deliberately. Writes in this frontend go through
 * RPCs, and the deployed catalogue contains no tenant-settings RPC — tenant
 * mutation is reserved for Platform Admin flows (`provision-tenant`,
 * suspend/reactivate). Building a direct-table write here would bypass the
 * "RPC for writes" model the architecture settled on, so the editable form is
 * recorded as a follow-up pending a `update_tenant_settings` RPC.
 */

function statusTone(status: string): 'success' | 'info' | 'amber' | 'danger' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'trial') return 'info';
  if (status === 'overdue') return 'amber';
  if (status === 'suspended') return 'danger';
  return 'neutral';
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span
        style={{
          fontSize: 'var(--text-2xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{value}</span>
    </div>
  );
}

export function SettingsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';

  const query = useTenancyList(tenantId, 'tenants', { orderBy: 'created_at', limit: 5 });
  const tenant = query.data?.items[0];

  if (!canEditSettings(claims)) {
    return (
      <>
        <PageHeader title="Settings" subtitle="Your nursery's account details." />
        <ManagerOnly>Nursery settings are visible to managers only.</ManagerOnly>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your nursery's account details, as held by Masar."
        meta={<Badge tone="neutral">Signed in as {roleLabel(claims.role)}</Badge>}
      />

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={!tenant}
        emptyTitle="No nursery record visible"
        emptyHint="Your account is not currently linked to a nursery."
        onRetry={() => void query.refetch()}
      >
        {tenant ? (
          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            <Card padding="lg">
              <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--weight-extra)',
                      color: 'var(--text-strong)',
                    }}
                  >
                    {tenant.name}
                  </span>
                  <Badge tone={statusTone(tenant.status)} dot>
                    {tenant.status}
                  </Badge>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-5)',
                  }}
                >
                  <Field label="Subdomain" value={tenant.slug + '.masar.app'} />
                  <Field label="City" value={tenant.city ?? '—'} />
                  <Field label="Contact" value={tenant.contact_name ?? '—'} />
                  <Field label="Contact email" value={tenant.contact_email ?? '—'} />
                  <Field label="Contact phone" value={tenant.contact_phone ?? '—'} />
                  <Field label="Joined" value={formatDate(tenant.created_at, locale)} />
                  {tenant.trial_ends_at ? (
                    <Field label="Trial ends" value={formatDate(tenant.trial_ends_at, locale)} />
                  ) : null}
                </div>
              </div>
            </Card>

            <Card padding="md">
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                To change your nursery&apos;s plan, contact details or status, please contact Masar support —
                these are handled by the Masar team so billing and provisioning stay consistent.
              </span>
            </Card>
          </div>
        ) : null}
      </QueryState>
    </>
  );
}
