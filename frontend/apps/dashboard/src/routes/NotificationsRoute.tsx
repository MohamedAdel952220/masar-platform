import { useCommsList, useRpcMutation, type CommsRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, Input, StatCard, Tabs } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, ManagerOnly, QueryState } from '../components/States';
import { formatRelative } from '../lib/format';
import { canBroadcast } from '../lib/permissions';

/**
 * Notifications — announcements sent by the nursery, plus the delivered
 * notification feed.
 *
 * Broadcasting is manager-only (§12: "Announcements — manager CRUD own
 * tenant"). `broadcast_announcement` fans out to announcement_recipients and
 * triggers dispatch; it accepts an idempotency key so a manual retry is safe,
 * and it is never auto-retried. It is NOT optimistic — the fan-out and channel
 * selection happen server-side, so the UI waits for the authoritative row.
 */

type Announcement = CommsRow<'announcements'>;
type Notification = CommsRow<'notifications'>;

function priorityTone(priority: string): 'neutral' | 'amber' | 'danger' {
  if (priority === 'urgent') return 'danger';
  if (priority === 'important') return 'amber';
  return 'neutral';
}

export function NotificationsRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const mayBroadcast = canBroadcast(claims);

  const [tab, setTab] = useState('announcements');
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const announcements = useCommsList(
    tenantId,
    'announcements',
    { orderBy: 'created_at', limit: 100 },
    tab === 'announcements',
  );
  const notifications = useCommsList(
    tenantId,
    'notifications',
    { orderBy: 'created_at', limit: 100 },
    tab === 'feed',
  );

  const announcementRows = announcements.data?.items ?? [];
  const notificationRows = notifications.data?.items ?? [];

  const broadcast = useRpcMutation('broadcast_announcement', {
    idempotent: true,
    onSuccess: () => {
      setComposing(false);
      setTitle('');
      setBody('');
      void queryClient.invalidateQueries();
    },
  });

  const sent = announcementRows.filter((a) => a.sent_at !== null).length;
  const scheduled = announcementRows.filter((a) => a.sent_at === null && a.scheduled_for !== null).length;

  const announcementColumns: Column<Announcement>[] = [
    {
      key: 'title',
      header: 'Announcement',
      render: (row) => (
        <div style={{ display: 'grid', maxWidth: '40ch' }}>
          <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
            {row.title}
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
    {
      key: 'audience',
      header: 'Audience',
      render: (row) => <Badge tone="neutral">{row.audience ?? 'all'}</Badge>,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => <Badge tone={priorityTone(row.priority)}>{row.priority}</Badge>,
    },
    {
      key: 'sent_at',
      header: 'Sent',
      render: (row) =>
        row.sent_at ? (
          <span style={{ color: 'var(--text-muted)' }}>{formatRelative(row.sent_at, locale)}</span>
        ) : (
          <Badge tone="amber">Not sent</Badge>
        ),
    },
  ];

  const notificationColumns: Column<Notification>[] = [
    {
      key: 'title',
      header: 'Notification',
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>{row.title}</span>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="neutral">{row.category}</Badge> },
    {
      key: 'recipient_type',
      header: 'Recipient',
      render: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.recipient_type}</span>,
    },
    {
      key: 'created_at',
      header: 'Sent',
      render: (row) => (
        <span style={{ color: 'var(--text-subtle)' }}>{formatRelative(row.created_at, locale)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Announcements you have sent, and the notification feed for your nursery."
        actions={
          mayBroadcast && !composing ? (
            <Button onClick={() => setComposing(true)}>New announcement</Button>
          ) : undefined
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
        <StatCard label="Sent" value={sent} accent="var(--success-500)" />
        <StatCard label="Scheduled" value={scheduled} accent="var(--amber-500)" />
        <StatCard label="Total announcements" value={announcementRows.length} />
      </div>

      {!mayBroadcast ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ManagerOnly>Broadcasting announcements is a manager action.</ManagerOnly>
        </div>
      ) : null}

      {composing ? (
        <Card padding="lg" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
              New announcement
            </span>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input label="Message" value={body} onChange={(e) => setBody(e.target.value)} />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button
                disabled={broadcast.isPending || title.trim().length === 0 || body.trim().length === 0}
                onClick={() => broadcast.mutate({ p_title: title.trim(), p_body: body.trim() })}
              >
                {broadcast.isPending ? 'Sending…' : 'Send'}
              </Button>
              <Button variant="ghost" disabled={broadcast.isPending} onClick={() => setComposing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {broadcast.error ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ErrorState error={broadcast.error} onRetry={() => broadcast.reset()} />
        </div>
      ) : null}

      <Card padding="none" style={{ marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
        <Tabs
          items={[
            { value: 'announcements', label: 'Announcements', count: announcementRows.length },
            { value: 'feed', label: 'Notification feed', count: notificationRows.length },
          ]}
          value={tab}
          onChange={setTab}
          style={{ padding: '0 var(--space-4)' }}
        />
      </Card>

      {tab === 'announcements' ? (
        <QueryState
          isLoading={announcements.isLoading}
          error={announcements.error}
          isEmpty={announcementRows.length === 0}
          emptyTitle="No announcements"
          emptyHint="Announcements you send appear here."
          onRetry={() => void announcements.refetch()}
        >
          <DataTable
            columns={announcementColumns}
            rows={announcementRows}
            rowKey={(row) => row.id}
            caption="Announcements"
          />
        </QueryState>
      ) : (
        <QueryState
          isLoading={notifications.isLoading}
          error={notifications.error}
          isEmpty={notificationRows.length === 0}
          emptyTitle="No notifications"
          emptyHint="Delivered notifications appear here."
          onRetry={() => void notifications.refetch()}
        >
          <DataTable
            columns={notificationColumns}
            rows={notificationRows}
            rowKey={(row) => row.id}
            caption="Notification feed"
          />
        </QueryState>
      )}
    </>
  );
}
