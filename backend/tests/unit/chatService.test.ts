import { describe, it, expect, vi } from 'vitest';
import { ChatService } from '../../src/services/chatService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { Message, Conversation } from '../../src/types/domain.epic4.js';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    senderType: 'guardian',
    senderId: 'guardian-1',
    body: 'Hello',
    sentAt: '2026-07-19T08:00:00Z',
    readAt: null,
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    tenantId: 'tenant-1',
    guardianId: 'guardian-1',
    childId: 'child-1',
    subjectId: null,
    staffId: 'teacher-1',
    status: 'open',
    escalatedAt: null,
    escalationReason: null,
    ...overrides,
  };
}

function buildHarness() {
  const conversations = {
    sendMessage: vi.fn(async () => makeMessage()),
    escalate: vi.fn(async () => makeConversation({ status: 'escalated' })),
    findById: vi.fn(async () => makeConversation()),
    listMessages: vi.fn(async () => [makeMessage()]),
  };
  // deno-lint-ignore no-explicit-any
  const service = new ChatService(conversations as any);
  return { service, conversations };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };

describe('ChatService.sendMessage', () => {
  it('allows a guardian to send a message', async () => {
    const h = buildHarness();
    await h.service.sendMessage({ body: 'Hi', conversationId: 'conv-1' }, guardianCaller);
    expect(h.conversations.sendMessage).toHaveBeenCalled();
  });

  it('allows a teacher to send a message', async () => {
    const h = buildHarness();
    await h.service.sendMessage({ body: 'Hi', conversationId: 'conv-1' }, teacherCaller);
    expect(h.conversations.sendMessage).toHaveBeenCalled();
  });

  it('rejects a manager sending a message directly (matrix: CRU is guardian/teacher only)', async () => {
    const h = buildHarness();
    await expect(h.service.sendMessage({ body: 'Hi', conversationId: 'conv-1' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.conversations.sendMessage).not.toHaveBeenCalled();
  });
});

describe('ChatService.escalateConversation', () => {
  it('allows a guardian to escalate their own conversation', async () => {
    const h = buildHarness();
    const result = await h.service.escalateConversation({ conversationId: 'conv-1' }, guardianCaller);
    expect(result.status).toBe('escalated');
    expect(h.conversations.escalate).toHaveBeenCalledWith('conv-1', undefined);
  });

  it('rejects a manager escalating a conversation (self-escalation is not a thing)', async () => {
    const h = buildHarness();
    await expect(h.service.escalateConversation({ conversationId: 'conv-1' }, managerCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });
});
