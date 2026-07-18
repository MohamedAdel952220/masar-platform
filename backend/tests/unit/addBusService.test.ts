import { describe, it, expect, vi } from 'vitest';
import { AddBusService } from '../../src/services/addBusService.js';
import type { AddBusInput } from '../../src/validation/transport.schema.js';
import type { Bus } from '../../src/types/domain.epic3.js';

function makeBus(overrides: Partial<Bus> = {}): Bus {
  return { id: 'bus-1', tenantId: 'tenant-1', number: 'B-12', plate: 'ABC-123', capacity: 20, serviceArea: null, driverId: 'driver-1', deletedAt: null, ...overrides };
}

function buildHarness(opts: { isPhoneTaken?: boolean; driverCreateFails?: boolean; busCreateFails?: boolean } = {}) {
  const deleteUserCalls: string[] = [];
  const deleteDriverCalls: string[] = [];
  const drivers = {
    create: vi.fn(async () => ({ id: 'driver-1', tenantId: 'tenant-1', busId: null, name: 'Karim Adel', nameAr: null, phone: '+201007778888', deletedAt: null })),
    delete: vi.fn(async (id: string) => {
      deleteDriverCalls.push(id);
    }),
  };
  const buses = { createWithDriver: vi.fn(async () => makeBus()) };
  const phoneRegistry = { register: vi.fn(async () => undefined), isPhoneTaken: vi.fn(async () => opts.isPhoneTaken ?? false) };
  const authAdmin = {
    createUser: vi.fn(async () => ({ id: 'driver-1' })),
    deleteUser: vi.fn(async (id: string) => {
      deleteUserCalls.push(id);
    }),
    signOutGlobal: vi.fn(async () => undefined),
  };
  const activation = { send: vi.fn(async () => ({ delivered: true, channel: 'whatsapp_stub' as const, activationUrl: 'https://app.masar.app/activate/x' })) };
  const audit = { record: vi.fn(async () => undefined) };

  if (opts.driverCreateFails) {
    drivers.create = vi.fn(async () => {
      throw new Error('duplicate key value violates unique constraint');
    });
  }
  if (opts.busCreateFails) {
    buses.createWithDriver = vi.fn(async () => {
      throw new Error('bus insert failed');
    });
  }

  // deno-lint-ignore no-explicit-any
  const service = new AddBusService(drivers as any, buses as any, phoneRegistry as any, authAdmin as any, activation as any, audit as any);
  return { service, drivers, buses, phoneRegistry, authAdmin, activation, audit, deleteUserCalls, deleteDriverCalls };
}

const validInput: AddBusInput = {
  number: 'B-12',
  plate: 'ABC-123',
  capacity: 20,
  driver: { name: 'Karim Adel', phone: '+201007778888' },
};

describe('AddBusService.add', () => {
  it('happy path: creates Auth+driver profile+bus, registers phone, sends activation, writes audit log', async () => {
    const h = buildHarness();
    const result = await h.service.add(validInput, 'tenant-1', 'manager-1');

    expect(result.driver.activationSent).toBe(true);
    expect(h.authAdmin.createUser).toHaveBeenCalledTimes(1);
    expect(h.drivers.create).toHaveBeenCalledTimes(1);
    expect(h.buses.createWithDriver).toHaveBeenCalledWith(expect.objectContaining({ driverId: 'driver-1', number: 'B-12' }));
    expect(h.phoneRegistry.register).toHaveBeenCalledWith(expect.objectContaining({ phone: '+201007778888', accountType: 'driver' }));
    expect(h.activation.send).toHaveBeenCalledTimes(1);
    expect(h.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'added_bus' }));
  });

  it('rejects a phone already registered in the tenant, before touching Auth', async () => {
    const h = buildHarness({ isPhoneTaken: true });
    await expect(h.service.add(validInput, 'tenant-1', 'manager-1')).rejects.toMatchObject({ code: 'VALIDATION_DUPLICATE_PHONE' });
    expect(h.authAdmin.createUser).not.toHaveBeenCalled();
  });

  it('saga compensation: deletes the just-created Auth user if the driver_profiles insert fails', async () => {
    const h = buildHarness({ driverCreateFails: true });
    await expect(h.service.add(validInput, 'tenant-1', 'manager-1')).rejects.toMatchObject({ code: 'EXTERNAL_AUTH_ADMIN_FAILURE' });
    expect(h.deleteUserCalls).toEqual(['driver-1']);
  });

  it('saga compensation: deletes the driver_profiles row THEN the Auth user if the bus insert fails (EPIC_3_REVIEW.md H4)', async () => {
    const h = buildHarness({ busCreateFails: true });
    await expect(h.service.add(validInput, 'tenant-1', 'manager-1')).rejects.toMatchObject({ code: 'EXTERNAL_AUTH_ADMIN_FAILURE' });
    expect(h.deleteDriverCalls).toEqual(['driver-1']);
    expect(h.deleteUserCalls).toEqual(['driver-1']);
  });

  it('never returns a password anywhere in the result', async () => {
    const h = buildHarness();
    const result = await h.service.add(validInput, 'tenant-1', 'manager-1');
    expect(JSON.stringify(result)).not.toMatch(/password/i);
  });
});
