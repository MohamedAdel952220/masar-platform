import { describe, it, expect, vi } from 'vitest';
import { sendMessageRoute, broadcastAnnouncementRoute, registerDeviceTokenRoute } from '../../src/api/routes/comms.js';
import type { CallerContext } from '../../src/types/domain.js';

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'guardian', platformAdminTier: null };
const managerCaller: CallerContext = { userId: 'manager-1', tenantId: '11111111-1111-1111-1111-111111111111', role: 'manager', platformAdminTier: null };

describe('sendMessageRoute — validation', () => {
  it('rejects a body missing both conversationId and childId', async () => {
    const service = { sendMessage: vi.fn() } as unknown as import('../../src/services/chatService.js').ChatService;
    await expect(sendMessageRoute(service, guardianCaller, { body: 'Hi' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(service.sendMessage).not.toHaveBeenCalled();
  });

  it('passes a valid body through to the service', async () => {
    const service = { sendMessage: vi.fn(async () => ({ id: 'msg-1' })) } as unknown as import('../../src/services/chatService.js').ChatService;
    await sendMessageRoute(service, guardianCaller, { body: 'Hi', conversationId: '11111111-1111-1111-1111-111111111111' });
    expect(service.sendMessage).toHaveBeenCalledWith({ body: 'Hi', conversationId: '11111111-1111-1111-1111-111111111111' }, guardianCaller);
  });
});

describe('broadcastAnnouncementRoute — validation', () => {
  it('rejects an invalid body', async () => {
    const service = { broadcast: vi.fn() } as unknown as import('../../src/services/announcementService.js').AnnouncementService;
    await expect(broadcastAnnouncementRoute(service, managerCaller, { title: '', body: '' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('registerDeviceTokenRoute', () => {
  it('passes a valid body through to the service', async () => {
    const service = { registerDeviceToken: vi.fn(async () => ({ id: 'dt-1' })) } as unknown as import('../../src/services/notificationSettingsService.js').NotificationSettingsService;
    await registerDeviceTokenRoute(service, guardianCaller, { platform: 'ios', token: 'tok-abc' });
    expect(service.registerDeviceToken).toHaveBeenCalledWith({ platform: 'ios', token: 'tok-abc' }, guardianCaller);
  });
});
