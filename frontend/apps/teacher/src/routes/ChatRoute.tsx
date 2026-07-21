import {
  realtime,
  useAcademicList,
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

/**
 * Chat — `comms.conversations` / `comms.messages` (§12: teacher "CRU own").
 *
 * LIVE via `conversation:{id}:messages` — the narrowest filter §15 allows. One
 * subscription at a time, for the open conversation only, torn down when the
 * selection changes. Never a tenant-wide firehose.
 *
 * `send_message` carries an idempotency key so a manual retry is safe, and is
 * never auto-retried. It is NOT optimistic: the RPC resolves or creates the
 * conversation, writes the message, and queues notification fan-out
 * server-side, so the UI waits for the authoritative row rather than guessing
 * which conversation the message landed in.
 *
 * Conversations return RLS-scoped to those this teacher participates in.
 */

type Conversation = CommsRow<'conversations'>;
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

  const [openId, setOpenId] = useState<string | null>(null);
  const [body, setBody] = useState('');

  const conversations = useCommsList(tenantId, 'conversations', { orderBy: 'updated_at', limit: 100 });
  const messages = useCommsList(tenantId, 'messages', { orderBy: 'sent_at', limit: 300 });
  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 200 });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useRealtimeSubscription(openId ? realtime.conversationMessages(openId) : null, invalidate, Boolean(openId));

  const conversationRows = useMemo(() => conversations.data?.items ?? [], [conversations.data]);
  const childNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const child of children.data?.items ?? []) map.set(child.id, child.name);
    return map;
  }, [children.data]);

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
    onSuccess: () => {
      setBody('');
      invalidate();
    },
  });

  const openConversation = conversationRows.find((c) => c.id === openId) ?? null;

  if (openId && openConversation) {
    return (
      <>
        <PageHeader
          title={childNames.get(openConversation.child_id ?? '') ?? 'Conversation'}
          subtitle="Messages with this child's family."
          actions={
            <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
              Back
            </Button>
          }
          meta={
            <Badge tone={statusTone(openConversation.status)} dot>
              {openConversation.status}
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
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                No messages yet. Say hello.
              </span>
            </Card>
          ) : (
            thread.map((message: Message) => {
              const mine = message.sender_type === 'staff';
              return (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: mine ? 'var(--teal-50)' : 'var(--surface-card)',
                      border: '1px solid ' + (mine ? 'var(--teal-500)' : 'var(--border-subtle)'),
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

        <Card padding="md" style={{ position: 'sticky', insetBlockEnd: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Input
              label="Message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message…"
            />
            <Button
              size="lg"
              disabled={send.isPending || body.trim().length === 0}
              onClick={() => send.mutate({ p_conversation_id: openId, p_body: body.trim() })}
            >
              {send.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Chat" subtitle="Conversations with the families in your classroom." />

      <QueryState
        isLoading={conversations.isLoading}
        error={conversations.error}
        isEmpty={conversationRows.length === 0}
        emptyTitle="No conversations"
        emptyHint="Conversations with families appear here."
        onRetry={() => void conversations.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {conversationRows.map((conversation: Conversation) => (
            <Card key={conversation.id} padding="md" interactive onClick={() => setOpenId(conversation.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                    {childNames.get(conversation.child_id ?? '') ?? 'Conversation'}
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
          ))}
        </div>
      </QueryState>
    </>
  );
}
