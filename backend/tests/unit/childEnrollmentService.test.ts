import { describe, it, expect, vi } from 'vitest';
import { ChildEnrollmentService } from '../../src/services/childEnrollmentService.js';
import type { EnrollChildInput } from '../../src/validation/academic.schema.js';
import type { Child, GuardianProfile } from '../../src/types/domain.epic2.js';

function makeChild(overrides: Partial<Child> = {}): Child {
  return {
    id: 'child-1',
    tenantId: 'tenant-1',
    name: 'Yousef Adel',
    nameAr: null,
    dob: '2020-05-14',
    gender: 'male',
    classroomId: 'classroom-1',
    package: 'full_day',
    membershipStatus: 'active',
    dayPathStatus: 'at_home',
    deletedAt: null,
    ...overrides,
  };
}

function makeGuardian(overrides: Partial<GuardianProfile> = {}): GuardianProfile {
  return {
    id: 'guardian-1',
    tenantId: 'tenant-1',
    name: 'Mona Adel',
    phone: '+201002223344',
    email: null,
    preferredLanguage: 'ar',
    deletedAt: null,
    ...overrides,
  };
}

function buildHarness(opts: { existingPhone?: { accountId: string; accountType: 'staff' | 'guardian' | 'driver' } | null; guardianCreateFails?: boolean } = {}) {
  const deleteUserCalls: string[] = [];

  const guardians = { create: vi.fn(async () => makeGuardian()) };
  const phoneLookup = { findByTenantAndPhone: vi.fn(async () => opts.existingPhone ?? null) };
  const phoneRegistry = { register: vi.fn(async () => undefined), isPhoneTaken: vi.fn(async () => false) };
  const children = {
    // enrollWithGuardian is the single atomic call the service now uses
    // (fix for EPIC_2_REVIEW.md C3) — enroll/linkGuardian are kept on the
    // repository interface for backward compatibility but are no longer
    // called by this service, so they're intentionally NOT part of this
    // harness (a stray call to either would surface as "not a function").
    enrollWithGuardian: vi.fn(async () => makeChild()),
    findById: vi.fn(async () => makeChild()),
    withdraw: vi.fn(async () => makeChild()),
    suspend: vi.fn(async () => makeChild()),
    reactivate: vi.fn(async () => makeChild()),
  };
  const authAdmin = {
    createUser: vi.fn(async () => ({ id: 'guardian-1' })),
    deleteUser: vi.fn(async (id: string) => {
      deleteUserCalls.push(id);
    }),
    signOutGlobal: vi.fn(async () => undefined),
  };
  const activation = { send: vi.fn(async () => ({ delivered: true, channel: 'whatsapp_stub' as const, activationUrl: 'https://app.masar.app/activate/x' })) };
  const audit = { record: vi.fn(async () => undefined) };

  if (opts.guardianCreateFails) {
    guardians.create = vi.fn(async () => {
      throw new Error('duplicate key value violates unique constraint');
    });
  }

  // deno-lint-ignore no-explicit-any
  const service = new ChildEnrollmentService(guardians as any, phoneLookup as any, phoneRegistry as any, children as any, authAdmin as any, activation as any, audit as any);
  return { service, guardians, phoneLookup, phoneRegistry, children, authAdmin, activation, audit, deleteUserCalls };
}

const validInput: EnrollChildInput = {
  classroomId: 'classroom-1',
  child: { name: 'Yousef Adel', dob: '2020-05-14', gender: 'male', package: 'full_day' },
  guardian: { name: 'Mona Adel', phone: '+201002223344', relation: 'mother' },
};

describe('ChildEnrollmentService.enroll', () => {
  it('happy path (new guardian): creates guardian Auth+profile, then ATOMICALLY enrolls the child and links the guardian in one call, sends activation, writes audit log', async () => {
    const h = buildHarness();
    const result = await h.service.enroll(validInput, 'tenant-1', 'manager-1');

    expect(result.child.id).toBe('child-1');
    expect(result.guardian.isNew).toBe(true);
    expect(result.guardian.activationSent).toBe(true);

    expect(h.authAdmin.createUser).toHaveBeenCalledTimes(1);
    expect(h.guardians.create).toHaveBeenCalledTimes(1);
    expect(h.phoneRegistry.register).toHaveBeenCalledWith(expect.objectContaining({ phone: '+201002223344', accountType: 'guardian' }));
    // Fix for EPIC_2_REVIEW.md C3: exactly ONE call performs both the child
    // insert and the guardian link, not two separate calls.
    expect(h.children.enrollWithGuardian).toHaveBeenCalledTimes(1);
    expect(h.children.enrollWithGuardian).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', classroomId: 'classroom-1', guardianId: 'guardian-1', relation: 'mother' }),
    );
    expect(h.activation.send).toHaveBeenCalledTimes(1);
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'enrolled_child' }));
  });

  it('sibling case: reuses an existing guardian by phone instead of creating a new Auth identity', async () => {
    const h = buildHarness({ existingPhone: { accountId: 'guardian-existing', accountType: 'guardian' } });
    const result = await h.service.enroll(validInput, 'tenant-1', 'manager-1');

    expect(result.guardian.isNew).toBe(false);
    expect(result.guardian.activationSent).toBe(false);
    expect(h.authAdmin.createUser).not.toHaveBeenCalled();
    expect(h.guardians.create).not.toHaveBeenCalled();
    expect(h.activation.send).not.toHaveBeenCalled();
    expect(h.children.enrollWithGuardian).toHaveBeenCalledWith(expect.objectContaining({ guardianId: 'guardian-existing' }));
  });

  it('rejects a phone already registered to a non-guardian account', async () => {
    const h = buildHarness({ existingPhone: { accountId: 'staff-1', accountType: 'staff' } });
    await expect(h.service.enroll(validInput, 'tenant-1', 'manager-1')).rejects.toMatchObject({ code: 'VALIDATION_DUPLICATE_PHONE' });
    expect(h.authAdmin.createUser).not.toHaveBeenCalled();
  });

  it('saga compensation: deletes the just-created Auth user if the guardian_profiles insert fails (§25.3)', async () => {
    const h = buildHarness({ guardianCreateFails: true });
    await expect(h.service.enroll(validInput, 'tenant-1', 'manager-1')).rejects.toMatchObject({ code: 'EXTERNAL_AUTH_ADMIN_FAILURE' });

    expect(h.authAdmin.createUser).toHaveBeenCalledTimes(1);
    expect(h.deleteUserCalls).toEqual(['guardian-1']);
    expect(h.children.enrollWithGuardian).not.toHaveBeenCalled();
  });

  it('does not compensate the guardian if the atomic enroll-and-link call fails afterward (guardian remains valid for a retry)', async () => {
    const h = buildHarness();
    h.children.enrollWithGuardian = vi.fn(async () => {
      throw new Error('Classroom is at full capacity');
    });

    await expect(h.service.enroll(validInput, 'tenant-1', 'manager-1')).rejects.toThrow();
    expect(h.authAdmin.deleteUser).not.toHaveBeenCalled();
  });

  it('regression test for EPIC_2_REVIEW.md C3: a failure inside the atomic call never leaves a partial result — the service does not attempt any separate follow-up write', async () => {
    const h = buildHarness();
    h.children.enrollWithGuardian = vi.fn(async () => {
      throw new Error('link_child_guardian failed');
    });

    await expect(h.service.enroll(validInput, 'tenant-1', 'manager-1')).rejects.toThrow();
    // No separate "link" or "unlink" call exists on the repository anymore
    // for this service to have called — the only write path is the single
    // atomic RPC wrapped by enrollWithGuardian, which either fully succeeds
    // or fully fails server-side (migration 7). Asserting call count stays
    // at exactly 1 (the attempt itself) proves the service doesn't retry or
    // fall back to a non-atomic two-step sequence internally.
    expect(h.children.enrollWithGuardian).toHaveBeenCalledTimes(1);
  });

  it('never returns a password anywhere in the result', async () => {
    const h = buildHarness();
    const result = await h.service.enroll(validInput, 'tenant-1', 'manager-1');
    expect(JSON.stringify(result)).not.toMatch(/password/i);
  });
});
