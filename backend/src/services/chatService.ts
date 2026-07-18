// ChatService — testable core behind send_message/escalate_conversation
// (§14.2). Defense-in-depth role checks matching the RPC's own (§28
// convention, same as TransportService/SafetyService).
import { AppError } from '../lib/errors.js';
import type { ConversationRepository } from '../repositories/conversationRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { Message, Conversation } from '../types/domain.epic4.js';
import type { SendMessageInput, EscalateConversationInput } from '../validation/comms.schema.js';

export class ChatService {
  constructor(private readonly conversations: ConversationRepository) {}

  async sendMessage(input: SendMessageInput, caller: CallerContext): Promise<Message> {
    if (caller.role !== 'guardian' && caller.role !== 'teacher') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a guardian or teacher can send a message.', 'فقط ولي الأمر أو المعلّم يمكنه إرسال رسالة.');
    }
    return this.conversations.sendMessage(input);
  }

  async escalateConversation(input: EscalateConversationInput, caller: CallerContext): Promise<Conversation> {
    if (caller.role !== 'guardian' && caller.role !== 'teacher') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a guardian or teacher can escalate a conversation.', 'فقط ولي الأمر أو المعلّم يمكنه تصعيد المحادثة.');
    }
    return this.conversations.escalate(input.conversationId, input.reason);
  }
}
