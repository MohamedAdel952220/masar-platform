import { describe, it, expect, vi } from 'vitest';
import { AddStaffService } from '../../src/services/addStaffService.js';
import type { AddStaffInput } from '../../src/validation/staff.schema.js';
import type { StaffProfile } from '../../src/types/domain.js';

function makeStaff(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: 'staff-2',
    tenantId: 'tenant-1',
    role: 'teacher',
    name: 'Sara Mahmoud',
    nameAr: null,
    phone: '+201009998888',
    email: null,
    employmentStatus: 'active',
    deletedAt: null,
    ...overrides,
  };
}

function buildHarness(opts: { isPhoneTaken?: boolean; staffCreateFails?: boolean } = {}) {
  const deleteUserCalls: string[] = [];
  const staff = { create: vi.fn(async () => makeStaff()) };
  const phoneRegistry = { register: vi.fn(async () => undefined), isPhoneTaken: vi.fn(async () => opts.isPhoneTaken ?? false) };
  const authAdmin = {
    createUser: vi.fn(async () => ({ id: 'staff-2' })),
    deleteUser: vi.fn(async (id: string) => {
      deleteUserCalls.push(id);
    }),
    signOutGlobal: vi.fn(async () => undefined),
  };
  const activation = { send: vi.fn(async () => ({ delivered: true, channel: 'whatsapp_stub' as const, activationUrl: 'https://app.masar.app/activate/x' })) };
  const audit = { record: vi.fn(async () => undefined) };

  if (opts.staffCreateFails) {
    staff.create = vi.fn(async () => {
      throw new Error('duplicate key value violates unique constraint');
    });
  }

  // deno-lint-ignore no-explicit-any
  const service = new AddStaffService(staff as any, phoneRegistry as any, authAdmin as any, activation as any, audit as any);
  return { service, staff, phoneRegistry, authAdmin, activation, audit, deleteUserCalls };
}

const validInput: AddStaffInput = {
  tenantId: 'tenant-1',
  role: 'teacher',
  name: 'Sara Mahmoud',
  phone: '+201009998888',
};

describe('AddStaffService.add', () => {
  it('happy path: creates Auth+profile, registers phone, sends activation, writes audit log', async () => {
    const h = buildHarness();
    const result = await h.service.add(validInput, 'manager-1');

    expect(result.staff.activationSent).toBe(true);
    expect(h.authAdmin.createUser).toHaveBeenCalledTimes(1);
    expect(h.staff.create).toHaveBeenCalledTimes(1);
    expect(h.phoneRegistry.register).toHaveBeenCalledWith(expect.objectContaining({ phone: '+201009998888', accountType: 'staff' }));
    expect(h.activation.send).toHaveBeenCalledTimes(1);
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'added_staff' }));
  });

  it('rejects an attempt to create a manager account through add-staff', async () => {
    const h = buildHarness();
    await expect(h.service.add({ ...validInput, role: 'manager' as AddStaffInput['role'] }, 'manager-1')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(h.authAdmin.createUser).not.toHaveBeenCalled();
  });

  it('rejects a phone already registered in the tenant, before touching Auth', async () => {
    const h = buildHarness({ isPhoneTaken: true });
    await expect(h.service.add(validInput, 'manager-1')).rejects.toMatchObject({ code: 'VALIDATION_DUPLICATE_PHONE' });
    expect(h.authAdmin.createUser).not.toHaveBeenCalled();
  });

  it('saga compensation: deletes the just-created Auth user if the staff_profiles insert fails', async () => {
    const h = buildHarness({ staffCreateFails: true });
    await expect(h.service.add(validInput, 'manager-1')).rejects.toMatchObject({ code: 'EXTERNAL_AUTH_ADMIN_FAILURE' });
    expect(h.deleteUserCalls).toEqual(['staff-2']);
  });

  it('never returns a password anywhere in the result', async () => {
    const h = buildHarness();
    const result = await h.service.add(validInput, 'manager-1');
    expect(JSON.stringify(result)).not.toMatch(/password/i);
  });
});
