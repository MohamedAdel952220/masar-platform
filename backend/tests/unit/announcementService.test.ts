import { describe, it, expect, vi } from 'vitest';
import { AnnouncementService } from '../../src/services/announcementService.js';
import type { CallerContext } from '../../src/types/domain.js';
import type { Announcement } from '../../src/types/domain.epic4.js';
import type { BroadcastAnnouncementInput } from '../../src/validation/comms.schema.js';

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'ann-1',
    tenantId: 'tenant-1',
    createdBy: 'manager-1',
    audience: 'all',
    platformAudience: null,
    classroomId: null,
    title: 'Heads up',
    body: 'School closed tomorrow',
    priority: 'normal',
    channels: ['in_app'],
    scheduledFor: null,
    sentAt: '2026-07-19T08:00:00Z',
    ...overrides,
  } as Announcement;
}

function buildHarness() {
  const announcements = { broadcast: vi.fn(async () => makeAnnouncement()), listForTenant: vi.fn(async () => [makeAnnouncement()]) };
  // deno-lint-ignore no-explicit-any
  const service = new AnnouncementService(announcements as any);
  return { service, announcements };
}

const managerCaller: CallerContext = { userId: 'manager-1', tenantId: 'tenant-1', role: 'manager', platformAdminTier: null };
const ownerCaller: CallerContext = { userId: 'admin-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'owner' };
const supportCaller: CallerContext = { userId: 'support-1', tenantId: null, role: 'platform_admin', platformAdminTier: 'support' };
const teacherCaller: CallerContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher', platformAdminTier: null };

const tenantInput: BroadcastAnnouncementInput = { title: 'Heads up', body: 'x', audience: 'all', priority: 'normal', channels: ['in_app'] };
const platformInput: BroadcastAnnouncementInput = { title: 'Heads up', body: 'x', platformAudience: 'all_schools', priority: 'normal', channels: ['in_app'] };

describe('AnnouncementService.broadcast', () => {
  it('allows a manager to broadcast to their own tenant', async () => {
    const h = buildHarness();
    await h.service.broadcast(tenantInput, managerCaller);
    expect(h.announcements.broadcast).toHaveBeenCalledWith(tenantInput);
  });

  it('rejects a manager broadcast with no audience', async () => {
    const h = buildHarness();
    await expect(h.service.broadcast({ ...tenantInput, audience: undefined }, managerCaller)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(h.announcements.broadcast).not.toHaveBeenCalled();
  });

  it('allows an owner-tier platform admin to broadcast platform-wide', async () => {
    const h = buildHarness();
    await h.service.broadcast(platformInput, ownerCaller);
    expect(h.announcements.broadcast).toHaveBeenCalledWith(platformInput);
  });

  it('rejects a support-tier platform admin broadcasting platform-wide (§12.1: owner/admin only)', async () => {
    const h = buildHarness();
    await expect(h.service.broadcast(platformInput, supportCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
    expect(h.announcements.broadcast).not.toHaveBeenCalled();
  });

  it('rejects a teacher broadcasting an announcement', async () => {
    const h = buildHarness();
    await expect(h.service.broadcast(tenantInput, teacherCaller)).rejects.toMatchObject({ code: 'PERM_ROLE_DENIED' });
  });

  // Fix for EPIC_4_REVIEW.md H1 — layer 2 of the 3-layer fix.
  it('rejects a classroom-audience broadcast with no classroomId, before ever calling the repository', async () => {
    const h = buildHarness();
    await expect(h.service.broadcast({ ...tenantInput, audience: 'classroom', classroomId: undefined }, managerCaller)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(h.announcements.broadcast).not.toHaveBeenCalled();
  });

  it('allows a classroom-audience broadcast when classroomId is provided', async () => {
    const h = buildHarness();
    const input = { ...tenantInput, audience: 'classroom' as const, classroomId: '33333333-3333-3333-3333-333333333333' };
    await h.service.broadcast(input, managerCaller);
    expect(h.announcements.broadcast).toHaveBeenCalledWith(input);
  });
});
