import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { ConversationRow, MessageRow } from '../types/database.types.epic4.js';
import { conversationFromRow, messageFromRow, type Conversation, type Message } from '../types/domain.epic4.js';
import type { SendMessageInput } from '../validation/comms.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class ConversationRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Wraps public.send_message (§14.2, migration 6) — idempotency-key
  // supported (send_message is not a natural upsert).
  async sendMessage(input: SendMessageInput): Promise<Message> {
    const { data, error } = await this.client.rpc('send_message', {
      p_body: input.body,
      p_conversation_id: input.conversationId ?? null,
      p_child_id: input.childId ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return messageFromRow(data as MessageRow);
  }

  async escalate(conversationId: string, reason?: string | null): Promise<Conversation> {
    const { data, error } = await this.client.rpc('escalate_conversation', { p_conversation_id: conversationId, p_reason: reason ?? null });
    if (error) throw toAppError(error);
    return conversationFromRow(data as ConversationRow);
  }

  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await this.client.schema('comms').from('conversations').select('*').eq('id', id).maybeSingle();
    if (error) throw toAppError(error);
    return data ? conversationFromRow(data as ConversationRow) : null;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await this.client
      .schema('comms')
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true });
    if (error) throw toAppError(error);
    return (data as MessageRow[]).map(messageFromRow);
  }
}
