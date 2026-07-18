// TransportService — testable core behind assign_bus_rider, unassign_bus_rider,
// start_trip, record_gps_ping, update_child_trip_status, complete_trip
// (§14.2). These RPCs already enforce role/tenant checks at the database
// layer (migration 6) — this service duplicates the same checks at the API
// layer for clean, testable error messages before ever reaching Postgres,
// matching AcademicRecordService's convention (Epic 2, §28).
import { AppError } from '../lib/errors.js';
import type { BusRepository } from '../repositories/busRepository.js';
import type { TripRepository } from '../repositories/tripRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { Bus, BusRider, StartTripResult, TripChildStatusRecord, GpsPing, Trip } from '../types/domain.epic3.js';
import type {
  AssignBusRiderInput,
  UnassignBusRiderInput,
  StartTripInput,
  RecordGpsPingInput,
  UpdateChildTripStatusInput,
  CompleteTripInput,
} from '../validation/transport.schema.js';

export class TransportService {
  constructor(
    private readonly buses: BusRepository,
    private readonly trips: TripRepository,
  ) {}

  async assignBusRider(input: AssignBusRiderInput, caller: CallerContext): Promise<BusRider> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can assign a bus rider.', 'فقط المدير يمكنه تعيين راكب حافلة.');
    }
    return this.buses.assignRider(input);
  }

  async unassignBusRider(input: UnassignBusRiderInput, caller: CallerContext): Promise<BusRider> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can unassign a bus rider.', 'فقط المدير يمكنه إلغاء تعيين راكب حافلة.');
    }
    return this.buses.unassignRider(input.busRiderId);
  }

  async startTrip(input: StartTripInput, caller: CallerContext): Promise<StartTripResult> {
    if (caller.role !== 'driver') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a driver can start a trip.', 'فقط السائق يمكنه بدء الرحلة.');
    }
    return this.trips.start(input.busId, input.leg);
  }

  async recordGpsPing(input: RecordGpsPingInput, caller: CallerContext): Promise<GpsPing> {
    if (caller.role !== 'driver') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a driver can record a GPS ping.', 'فقط السائق يمكنه تسجيل موقع GPS.');
    }
    return this.trips.recordGpsPing(input);
  }

  async updateChildTripStatus(input: UpdateChildTripStatusInput, caller: CallerContext): Promise<TripChildStatusRecord> {
    if (caller.role !== 'driver' && caller.role !== 'reception') {
      throw new AppError('PERM_ROLE_DENIED', "Only a driver or reception can update a child's trip status.", 'فقط السائق أو موظف الاستقبال يمكنه تحديث حالة رحلة الطفل.');
    }
    return this.trips.updateChildStatus(input);
  }

  async completeTrip(input: CompleteTripInput, caller: CallerContext): Promise<Trip> {
    if (caller.role !== 'driver') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a driver can complete a trip.', 'فقط السائق يمكنه إنهاء الرحلة.');
    }
    return this.trips.complete(input.tripId);
  }

  async findBus(id: string): Promise<Bus | null> {
    return this.buses.findById(id);
  }
}
