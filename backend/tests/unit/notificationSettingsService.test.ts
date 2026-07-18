import { describe, it, expect, vi } from 'vitest';
import { NotificationSettingsService } from '../../src/services/notificationSettingsService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { Notification, DeviceToken, NotificationPreference } from '../../src/types/domain.epic4.js';

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    tenantId: 'tenant-1',
    recipientType: 'guardian',
    recipientId: 'guardian-1',
    category: 'chat_message',
    title: 'New message',
    body: 'Hi',
    deepLink: null,
    severity: 'info',
    readAt: null,
    createdAt: '2026-07-19T08:00:00Z',
    ...overrides,
  };
}

function buildHarness() {
  const notifications = {
    listOwn: vi.fn(async () => [makeNotification()]),
    markRead: vi.fn(async () => makeNotification({ readAt: '2026-07-19T09:00:00Z' })),
    registerDeviceToken: vi.fn(async () => ({ id: 'dt-1', recipientType: 'guardian', recipientId: 'guardian-1', platform: 'ios', token: 'tok' }) as DeviceToken),
    updatePreference: vi.fn(async () => ({ id: 'pref-1', recipientType: 'guardian', recipientId: 'guardian-1', category: 'chat_message', channel: 'push', enabled: false }) as NotificationPreference),
  };
  // deno-lint-ignore no-explicit-any
  const service = new NotificationSettingsService(notifications as any);
  return { service, notifications };
}

const guardianCaller: CallerContext = { userId: 'guardian-1', tenantId: 'tenant-1', role: 'guardian', platformAdminTier: null };

describe('NotificationSettingsService', () => {
  it('lists own notifications', async () => {
    const h = buildHarness();
    const result = await h.service.listOwn(guardianCaller);
    expect(result).toHaveLength(1);
    expect(h.notifications.listOwn).toHaveBeenCalled();
  });

  it('marks a notification read', async () => {
    const h = buildHarness();
    const result = await h.service.markRead({ notificationId: 'notif-1' }, guardianCaller);
    expect(result.readAt).not.toBeNull();
  });

  it('registers a device token', async () => {
    const h = buildHarness();
    await h.service.registerDeviceToken({ platform: 'ios', token: 'tok' }, guardianCaller);
    expect(h.notifications.registerDeviceToken).toHaveBeenCalledWith({ platform: 'ios', token: 'tok' });
  });

  it('updates a notification preference', async () => {
    const h = buildHarness();
    const result = await h.service.updatePreference({ category: 'chat_message', channel: 'push', enabled: false }, guardianCaller);
    expect(result.enabled).toBe(false);
  });
});
