import { describe, it, expect } from 'vitest';
import {
  sendMessageSchema,
  escalateConversationSchema,
  broadcastAnnouncementSchema,
  registerDeviceTokenSchema,
  updateNotificationPreferencesSchema,
} from '../../src/validation/comms.schema.js';

const conversationId = '11111111-1111-1111-1111-111111111111';
const childId = '22222222-2222-2222-2222-222222222222';

describe('sendMessageSchema', () => {
  it('accepts a body with conversationId', () => {
    expect(sendMessageSchema.safeParse({ body: 'Hi', conversationId }).success).toBe(true);
  });

  it('accepts a body with childId (new conversation)', () => {
    expect(sendMessageSchema.safeParse({ body: 'Hi', childId }).success).toBe(true);
  });

  it('rejects a body with neither conversationId nor childId', () => {
    expect(sendMessageSchema.safeParse({ body: 'Hi' }).success).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(sendMessageSchema.safeParse({ body: '  ', conversationId }).success).toBe(false);
  });
});

describe('escalateConversationSchema', () => {
  it('accepts a valid payload', () => {
    expect(escalateConversationSchema.safeParse({ conversationId }).success).toBe(true);
  });

  it('rejects a non-uuid conversationId', () => {
    expect(escalateConversationSchema.safeParse({ conversationId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('broadcastAnnouncementSchema', () => {
  const base = { title: 'Hi', body: 'x', channels: ['in_app'] };

  it('accepts a tenant-scoped payload with audience only', () => {
    expect(broadcastAnnouncementSchema.safeParse({ ...base, audience: 'all' }).success).toBe(true);
  });

  it('accepts a platform-wide payload with platformAudience only', () => {
    expect(broadcastAnnouncementSchema.safeParse({ ...base, platformAudience: 'all_schools' }).success).toBe(true);
  });

  it('rejects a payload with neither audience nor platformAudience', () => {
    expect(broadcastAnnouncementSchema.safeParse(base).success).toBe(false);
  });

  it('rejects a payload with both audience and platformAudience', () => {
    expect(broadcastAnnouncementSchema.safeParse({ ...base, audience: 'all', platformAudience: 'all_schools' }).success).toBe(false);
  });

  it('rejects an empty channels array', () => {
    expect(broadcastAnnouncementSchema.safeParse({ ...base, audience: 'all', channels: [] }).success).toBe(false);
  });

  // Fix for EPIC_4_REVIEW.md H1.
  it('rejects audience "classroom" with no classroomId', () => {
    expect(broadcastAnnouncementSchema.safeParse({ ...base, audience: 'classroom' }).success).toBe(false);
  });

  it('accepts audience "classroom" with a classroomId', () => {
    const classroomId = '33333333-3333-3333-3333-333333333333';
    expect(broadcastAnnouncementSchema.safeParse({ ...base, audience: 'classroom', classroomId }).success).toBe(true);
  });

  it('accepts a non-classroom audience with no classroomId', () => {
    expect(broadcastAnnouncementSchema.safeParse({ ...base, audience: 'teachers' }).success).toBe(true);
  });
});

describe('registerDeviceTokenSchema', () => {
  it('accepts a valid payload', () => {
    expect(registerDeviceTokenSchema.safeParse({ platform: 'ios', token: 'tok-abc' }).success).toBe(true);
  });

  it('rejects an invalid platform', () => {
    expect(registerDeviceTokenSchema.safeParse({ platform: 'windows', token: 'tok-abc' }).success).toBe(false);
  });
});

describe('updateNotificationPreferencesSchema', () => {
  it('accepts a valid payload', () => {
    expect(updateNotificationPreferencesSchema.safeParse({ category: 'chat_message', channel: 'push', enabled: false }).success).toBe(true);
  });

  it('rejects an invalid channel', () => {
    expect(updateNotificationPreferencesSchema.safeParse({ category: 'chat_message', channel: 'carrier_pigeon', enabled: false }).success).toBe(false);
  });
});
