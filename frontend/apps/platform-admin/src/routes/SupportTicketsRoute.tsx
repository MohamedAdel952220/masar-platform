import {
  queryKeys,
  realtime,
  useInfinitePlatformList,
  useRealtimeSubscription,
  useRpcMutation,
  type PlatformRow,
} from '@masar/api-client';
import { Badge, Button, Card, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatRelative, shortId } from '../lib/format';

/**
 * Support Tickets — `platform.support_tickets`.
 *
 * §12.1 explicitly records NO tier divergence here: "Support tickets — CRUD,
 * assign (all) for owner/admin; CRUD, assign (all) for support — no
 * divergence, this is support's core job." Every Platform Admin tier can
 * therefore transition a ticket.
 *
 * Creation is deliberately absent: `create_support_ticket` is manager-only
 * (a tenant raises the ticket). Platform Admin triages and resolves.
 *
 * Live via `platform:support_tickets`.
 */

type Ticket = PlatformRow<'support_tickets'>;
type TicketStatus = Ticket['status'];

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved'];

function statusTone(status: TicketStatus): 'amber' | 'info' | 'success' {
  if (status === 'open') return 'amber';
  if (status === 'in_progress') return 'info';
  return 'success';
}

function severityTone(severity: string): 'danger' | 'amber' | 'neutral' {
  if (severity === 'high') return 'danger';
  if (severity === 'med') return 'amber';
  return 'neutral';
}

export function SupportTicketsRoute() {
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');

  const query = useInfinitePlatformList('support_tickets', { orderBy: 'created_at', limit: 25 });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.platform.all() });
  }, [queryClient]);

  useRealtimeSubscription(realtime.platformSupportTickets(), invalidate);

  /**
   * Status transitions go through `update_support_ticket`, which accepts an
   * idempotency key — so a manual retry is safe. Mutations are never
   * auto-retried (the hook hard-codes retry:false), and this is NOT an
   * optimistic update: the RPC branches server-side (it stamps resolved_at and
   * conditionally notifies the reporting manager), so the UI waits for the
   * authoritative row rather than guessing.
   */
  const updateTicket = useRpcMutation('update_support_ticket', {
    idempotent: true,
    invalidate: [[...queryKeys.platform.all()]],
  });

  const allTickets = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.items), [query.data]);
  const tickets = filter === 'all' ? allTickets : allTickets.filter((t) => t.status === filter);

  const counts = useMemo(
    () => ({
      open: allTickets.filter((t) => t.status === 'open').length,
      inProgress: allTickets.filter((t) => t.status === 'in_progress').length,
      resolved: allTickets.filter((t) => t.status === 'resolved').length,
      high: allTickets.filter((t) => t.severity === 'high' && t.status !== 'resolved').length,
    }),
    [allTickets],
  );

  const nextStatus = (status: TicketStatus): TicketStatus | null => {
    if (status === 'open') return 'in_progress';
    if (status === 'in_progress') return 'resolved';
    return null;
  };

  const columns: Column<Ticket>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <div style={{ display: 'grid', gap: 2, maxWidth: '42ch' }}>
          <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
            {row.subject}
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.body}
          </span>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="neutral">{row.category}</Badge> },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={statusTone(row.status)} dot>
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'tenant_id',
      header: 'Tenant',
      render: (row) => <code style={{ fontSize: 'var(--text-2xs)' }}>{shortId(row.tenant_id)}</code>,
    },
    {
      key: 'created_at',
      header: 'Raised',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.created_at, locale)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => {
        const next = nextStatus(row.status);
        if (!next) return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
        const pending = updateTicket.isPending && updateTicket.variables?.p_ticket_id === row.id;
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={updateTicket.isPending}
            onClick={() => updateTicket.mutate({ p_ticket_id: row.id, p_status: next })}
          >
            {pending ? 'Saving…' : next === 'in_progress' ? 'Start' : 'Resolve'}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Support Tickets"
        subtitle="Tenant-raised tickets. All Platform Admin tiers can triage and resolve — §12.1 records no tier divergence for this resource."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Open" value={counts.open} accent="var(--amber-500)" />
        <StatCard label="In progress" value={counts.inProgress} accent="var(--info-500)" />
        <StatCard label="Resolved" value={counts.resolved} accent="var(--success-500)" />
        <StatCard label="High severity unresolved" value={counts.high} accent="var(--danger-500)" />
      </div>

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'all', label: 'All', count: allTickets.length },
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'in_progress', label: 'In progress', count: counts.inProgress },
            { value: 'resolved', label: 'Resolved', count: counts.resolved },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as 'all' | TicketStatus)}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {updateTicket.error ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ErrorState error={updateTicket.error} onRetry={() => updateTicket.reset()} />
        </div>
      ) : null}

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={tickets.length === 0}
        emptyTitle="No support tickets"
        emptyHint={
          filter === 'all'
            ? 'No tenant has raised a ticket yet.'
            : 'No tickets in this state. Try another filter.'
        }
        onRetry={() => void query.refetch()}
      >
        <DataTable
          columns={columns}
          rows={tickets}
          rowKey={(row) => row.id}
          caption={STATUSES.includes(filter as TicketStatus) ? filter + ' tickets' : 'All tickets'}
          hasMore={query.hasNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          isLoadingMore={query.isFetchingNextPage}
        />
      </QueryState>
    </>
  );
}
