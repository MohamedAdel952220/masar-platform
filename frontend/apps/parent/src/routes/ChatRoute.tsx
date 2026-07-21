import {
  realtime,
  useCommsList,
  useRealtimeSubscription,
  useRpcMutation,
  type CommsRow,
} from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Badge, Button, Card, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatRelative } from '../lib/format';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Chat with the nursery.
 *
 * STARTING A CONVERSATION: `send_message` takes `p_child_id` OR
 * `p_conversation_id`. Passing the child id lets the RPC resolve the existing
 * thread or create one server-side — which is why this screen never has to
 * create a conversation row itself, and why a parent with no history can just
 * start typing.
 *
 * `send_message` carries an idempotency key (manual retry safe) and is never
 * auto-retried — `useRpcMutation` hard-codes `retry: false`. It is NOT
 * optimistic: the RPC resolves the conversation, writes the message and queues
 * notification fan-out, so the UI waits for the authoritative row rather than
 * guessing which thread the message landed in.
 *
 * ESCALATION IS NOT A PARENT ACTION. `escalate_conversation` is a staff RPC;
 * a guardian sees that a thread has been escalated but cannot escalate it. The
 * status badge reflects that read-only relationship.
 *
 * Realtime: `conversation:{id}:messages` for the OPEN thread only — the
 * narrowest filter §15 allows, re-subscribed when the selection changes.
 */

type Message = CommsRow<'messages'>;

function statusTone(status: string): 'neutral' | 'amber' | 'success' {
  if (status === 'escalated') return 'amber';
  if (status === 'closed') return 'success';
  return 'neutral';
}

export function ChatRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const { selected } = useSelectedChild();

  const [openId, setOpenId] = useState<string | null>(null);
  const [body, setBody] = useState('');

  const conversations = useCommsList(tenantId, 'conversations', { orderBy: 'updated_at', limit: 50 });
  const messages = useCommsList(tenantId, 'messages', { orderBy: 'sent_at', limit: 300 });

  const invalidate = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);
  useRealtimeSubscription(openId ? realtime.conversationMessages(openId) : null, invalidate, Boolean(openId));

  const rows = useMemo(() => conversations.data?.items ?? [], [conversations.data]);

  /** Threads about the currently selected child. */
  const mine = useMemo(
    () => (selected ? rows.filter((c) => c.child_id === selected.id) : rows),
    [rows, selected],
  );

  const thread = useMemo(
    () =>
      (messages.data?.items ?? [])
        .filter((m) => m.conversation_id === openId)
        .slice()
        .sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1)),
    [messages.data, openId],
  );

  const send = useRpcMutation('send_message', {
    idempotent: true,
    onSuccess: (row) => {
      setBody('');
      // A first message creates the thread server-side; follow the parent into
      // whichever conversation the RPC actually resolved to.
      if (!openId) setOpenId(row.conversation_id);
      invalidate();
    },
  });

  const submit = () => {
    const text = body.trim();
    if (text.length === 0) return;
    if (openId) send.mutate({ p_conversation_id: openId, p_body: text });
    else if (selected) send.mutate({ p_child_id: selected.id, p_body: text });
  };

  const composer = (
    <Card padding="md" style={{ position: 'sticky', insetBlockEnd: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <Input
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write to the nursery…"
        />
        <Button
          size="lg"
          disabled={send.isPending || body.trim().length === 0 || (!openId && !selected)}
          onClick={submit}
        >
          {send.isPending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </Card>
  );

  const open = mine.find((c) => c.id === openId) ?? null;

  if (openId && open) {
    return (
      <>
        <PageHeader
          title="Nursery"
          subtitle={selected ? 'About ' + selected.name + '.' : undefined}
          actions={
            <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
              Back
            </Button>
          }
          meta={
            <Badge tone={statusTone(open.status)} dot>
              {open.status === 'escalated' ? 'Escalated by the nursery' : open.status}
            </Badge>
          }
        />

        {send.error ? (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <ErrorState error={send.error} onRetry={() => send.reset()} />
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {thread.length === 0 ? (
            <Card padding="md">
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No messages yet.</span>
            </Card>
          ) : (
            thread.map((message: Message) => {
              const fromMe = message.sender_type === 'guardian';
              return (
                <div
                  key={message.id}
                  style={{ display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start' }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: fromMe ? 'var(--teal-50)' : 'var(--surface-card)',
                      border: '1px solid ' + (fromMe ? 'var(--teal-500)' : 'var(--border-subtle)'),
                      display: 'grid',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-strong)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {message.body}
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                      {formatRelative(message.sent_at, locale)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {composer}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Chat" subtitle="Message your child's nursery." />

      {send.error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState error={send.error} onRetry={() => send.reset()} />
        </div>
      ) : null}

      <QueryState
        isLoading={conversations.isLoading}
        error={conversations.error}
        isEmpty={false}
        emptyTitle="No conversations"
        onRetry={() => void conversations.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {mine.length === 0 ? (
            <Card padding="md">
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                You have no conversations yet. Write below and the nursery will receive it.
              </span>
            </Card>
          ) : (
            mine.map((conversation) => (
              <Card key={conversation.id} padding="md" interactive onClick={() => setOpenId(conversation.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'grid', minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                      Nursery
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                      {formatRelative(conversation.updated_at, locale)}
                    </span>
                  </div>
                  <Badge tone={statusTone(conversation.status)} dot>
                    {conversation.status}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>

        {composer}
      </QueryState>
    </>
  );
}
