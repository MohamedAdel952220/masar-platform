// AddBusService — testable core behind the add-bus Edge Function (§10.3,
// §14.2, §25.3 saga/compensation pattern). Direct extension of add-staff's
// pattern (Epic 2), generalized to identity.driver_profiles +
// transport.buses. Same no-plaintext-credential design (§10.3): no password
// is ever set or returned, an activation link is dispatched to the new
// driver's own phone.
import { AppError } from '../lib/errors.js';
import type { DriverProfileRepository } from '../repositories/driverProfileRepository.js';
import type { BusRepository } from '../repositories/busRepository.js';
import type { TenantPhoneRegistryRepository } from '../repositories/tenantProvisioningRepository.js';
import type { AuthAdminPort } from './authAdminPort.js';
import type { ActivationLinkPort } from './activationLinkPort.js';
import type { AuditLogger } from '../audit/auditLogger.js';
import type { AddBusInput } from '../validation/transport.schema.js';
import type { Bus } from '../types/domain.epic3.js';

export interface AddBusResult {
  bus: Bus;
  driver: { id: string; name: string; phone: string; activationSent: boolean };
}

export class AddBusService {
  constructor(
    private readonly drivers: DriverProfileRepository,
    private readonly buses: BusRepository,
    private readonly phoneRegistry: TenantPhoneRegistryRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly activation: ActivationLinkPort,
    private readonly audit: AuditLogger,
  ) {}

  async add(input: AddBusInput, tenantId: string, actorId: string): Promise<AddBusResult> {
    const isTaken = await this.phoneRegistry.isPhoneTaken(tenantId, input.driver.phone);
    if (isTaken) {
      throw new AppError('VALIDATION_DUPLICATE_PHONE', 'This phone number is already registered in your tenant.', 'رقم الهاتف هذا مسجّل بالفعل في مؤسستك.');
    }

    // Saga pattern (§25.3): Auth call first, DB write second, compensating
    // delete of the Auth user if the DB write fails. Unlike enroll-child
    // (EPIC_2_REVIEW.md C3), there is no second write to atomically compose
    // here — createWithDriver (BusRepository) sets driver_id in the same
    // INSERT as the bus row, so it is atomic by construction.
    const authUser = await this.authAdmin.createUser({
      phone: input.driver.phone,
      appMetadata: { tenant_id: tenantId, role: 'driver', app_access: ['driver'] },
      userMetadata: { name: input.driver.name },
    });

    let driverProfile;
    try {
      driverProfile = await this.drivers.create({
        id: authUser.id,
        tenantId,
        name: input.driver.name,
        nameAr: input.driver.nameAr ?? null,
        phone: input.driver.phone,
        nationalId: input.driver.nationalId ?? null,
        createdBy: actorId,
      });
    } catch (err) {
      await this.authAdmin.deleteUser(authUser.id).catch((compErr) => {
        console.error(`Compensating deleteUser failed for ${authUser.id} — manual cleanup required.`, compErr);
      });
      throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the driver profile.', 'فشل إنشاء ملف السائق.');
    }

    let bus;
    try {
      bus = await this.buses.createWithDriver({
        tenantId,
        number: input.number,
        plate: input.plate,
        capacity: input.capacity,
        serviceArea: input.serviceArea ?? null,
        driverId: driverProfile.id,
      });
    } catch (err) {
      // Fix for EPIC_3_REVIEW.md H4: driver_profiles.id references
      // auth.users(id) ON DELETE RESTRICT — deleteUser alone would fail
      // silently (caught by the old bare .catch()) because the
      // driver_profiles row created just above still references it. Delete
      // that row first, then the Auth user, so this compensation actually
      // succeeds instead of leaving an orphaned Auth user + driver profile.
      try {
        await this.drivers.delete(driverProfile.id);
        await this.authAdmin.deleteUser(authUser.id);
      } catch (compErr) {
        console.error(`Compensating cleanup failed for ${authUser.id} — manual cleanup required.`, compErr);
      }
      throw new AppError('EXTERNAL_AUTH_ADMIN_FAILURE', 'Failed to create the bus.', 'فشل إنشاء الحافلة.');
    }

    await this.phoneRegistry.register({ tenantId, phone: input.driver.phone, accountType: 'driver', accountId: authUser.id });

    const activationResult = await this.activation.send({
      phone: input.driver.phone,
      name: input.driver.name,
      appLabel: 'Driver App',
      userId: authUser.id,
    });

    await this.audit.record({
      tenantId,
      actorType: 'staff',
      actorId,
      action: 'added_bus',
      targetType: 'buses',
      targetId: bus.id,
    });

    return {
      bus,
      driver: { id: driverProfile.id, name: driverProfile.name, phone: driverProfile.phone, activationSent: activationResult.delivered },
    };
  }
}
