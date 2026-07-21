import {
  realtime,
  useApprovalsList,
  useRealtimeSubscription,
  useRpcMutation,
  type ApprovalsRow,
  type RpcArgs,
} from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, Input, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, ManagerOnly, QueryState } from '../components/States';
import { formatDate, formatRelative } from '../lib/format';
import { canReviewApprovals } from '../lib/permissions';

/**
 * Approvals — `approvals.requests` (§12: manager "RUA"; teacher "C, R own").
 *
 * Reviewing is manager-only and goes through `review_request`, which promotes
 * an approved request into an `events` row transactionally. It is NOT an
 * optimistic update: the RPC branches server-side (it creates the event,
 * notifies, and stamps reviewed_by/reviewed_at), so the UI waits for the
 * authoritative result. Mutations are never auto-retried.
 *
 * Live via `tenant:{id}:approvals`.
 */

type Request = ApprovalsRow<'requests'>;

/**
 * The deployed signature is `p_decision approvals.request_status`
 * ('pending' | 'approved' | 'rejected'), but `supabase gen types` mis-mapped
 * the enum and emitted `'PENDING' | 'SUCCESS' | 'ERROR'` instead. Sending the
 * generated literals would fail at runtime with an invalid enum value.
 *
 * The correct RUNTIME values are used here, cast to satisfy the incorrect
 * generated type. api-client is frozen this phase, so the fix (regenerate or
 * patch the type) is recorded in the completion report rather than applied.
 */
type ReviewArgs = RpcArgs<'review_request'>;
const DECISION_APPROVED = 'approved' as unknown as ReviewArgs['p_decision'];
const DECISION_REJECTED = 'rejected' as unknown as ReviewArgs['p_decision'];

function statusTone(status: string): 'amber' | 'success' | 'danger' | 'neutral' {
  if (status === 'pending') return 'amber';
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'neutral';
}

export function ApprovalsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const mayReview = canReviewApprovals(claims);

  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const query = useApprovalsList(tenantId, 'requests', { orderBy: 'created_at', limit: 200 });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);
  useRealtimeSubscription(
    tenantId ? realtime.tenantApprovals(tenantId) : null,
    invalidate,
    Boolean(tenantId),
  );

  const review = useRpcMutation('review_request', {
    idempotent: true,
    onSuccess: () => {
      setRejectingId(null);
      setReason('');
      invalidate();
    },
  });

  const all = useMemo(() => query.data?.items ?? [], [query.data]);
  const rows = filter === 'all' ? all : all.filter((r) => r.status === filter);

  const counts = useMemo(
    () => ({
      pending: all.filter((r) => r.status === 'pending').length,
      approved: all.filter((r) => r.status === 'approved').length,
      rejected: all.filter((r) => r.status === 'rejected').length,
    }),
    [all],
  );

  const columns: Column<Request>[] = [
    {
      key: 'title',
      header: 'Request',
      render: (row) => (
        <div style={{ display: 'grid', maxWidth: '38ch' }}>
          <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
            {row.title}
          </span>
          {row.note ? (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.note}
            </span>
          ) : null}
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => <Badge tone="neutral">{row.type}</Badge> },
    {
      key: 'request_date',
      header: 'Requested for',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatDate(row.request_date, locale)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={statusTone(row.status)} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Submitted',
      render: (row) => (
        <span style={{ color: 'var(--text-subtle)' }}>{formatRelative(row.created_at, locale)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Decision',
      render: (row) => {
        if (!mayReview || row.status !== 'pending')
          return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
        if (rejectingId === row.id) {
          return (
            <span style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <Input
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ minWidth: 160 }}
              />
              <Button
                size="sm"
                variant="danger"
                disabled={review.isPending || reason.trim().length === 0}
                onClick={() =>
                  review.mutate({
                    p_request_id: row.id,
                    p_decision: DECISION_REJECTED,
                    p_rejection_reason: reason.trim(),
                  })
                }
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={review.isPending}
                onClick={() => setRejectingId(null)}
              >
                Cancel
              </Button>
            </span>
          );
        }
        return (
          <span style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
            <Button
              size="sm"
              disabled={review.isPending}
              onClick={() => review.mutate({ p_request_id: row.id, p_decision: DECISION_APPROVED })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={review.isPending}
              onClick={() => setRejectingId(row.id)}
            >
              Reject
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Teacher-submitted requests for events, trips and exams. Approving promotes the request into a scheduled event."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard label="Pending" value={counts.pending} accent="var(--amber-500)" />
        <StatCard label="Approved" value={counts.approved} accent="var(--success-500)" />
        <StatCard label="Rejected" value={counts.rejected} accent="var(--danger-500)" />
      </div>

      {!mayReview ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>
            Approving and rejecting requests is a manager action. You can review your own submissions.
          </ManagerOnly>
        </div>
      ) : null}

      {review.error ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ErrorState error={review.error} onRetry={() => review.reset()} />
        </div>
      ) : null}

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'approved', label: 'Approved', count: counts.approved },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
            { value: 'all', label: 'All', count: all.length },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as typeof filter)}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyTitle="No requests"
        emptyHint="Requests submitted by teachers appear here for review."
        onRetry={() => void query.refetch()}
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Requests" />
      </QueryState>
    </>
  );
}
