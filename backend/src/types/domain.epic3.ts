// Epic 3 domain (camelCase) types + row<->domain mappers. Separate file from
// domain.ts/domain.epic2.ts, same reasoning as database.types.epic3.ts.
import type {
  BusRow,
  BusRiderRow,
  TripRow,
  TripChildStatusRow,
  GpsPingRow,
  PickupPassRow,
  PickupScanEventRow,
  TripLeg,
  TripStatus,
  TripChildStatusValue,
  PickupPersonRelation,
  PickupPassStatus,
  PickupScanResult,
} from './database.types.epic3.js';

export interface Bus {
  id: string;
  tenantId: string;
  number: string;
  plate: string;
  capacity: number;
  serviceArea: string | null;
  driverId: string | null;
  deletedAt: string | null;
}

export function busFromRow(row: BusRow): Bus {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    number: row.number,
    plate: row.plate,
    capacity: row.capacity,
    serviceArea: row.service_area,
    driverId: row.driver_id,
    deletedAt: row.deleted_at,
  };
}

export interface BusRider {
  id: string;
  busId: string;
  childId: string;
  tenantId: string;
  pickupAddressOverride: string | null;
  active: boolean;
}

export function busRiderFromRow(row: BusRiderRow): BusRider {
  return {
    id: row.id,
    busId: row.bus_id,
    childId: row.child_id,
    tenantId: row.tenant_id,
    pickupAddressOverride: row.pickup_address_override,
    active: row.active,
  };
}

export interface Trip {
  id: string;
  tenantId: string;
  busId: string;
  leg: TripLeg;
  serviceDate: string;
  status: TripStatus;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
}

export function tripFromRow(row: TripRow): Trip {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    busId: row.bus_id,
    leg: row.leg,
    serviceDate: row.service_date,
    status: row.status,
    startedAt: row.started_at,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
  };
}

export interface StartTripResult {
  trip: Trip;
  tripStopRiders: Array<{ tripStopId: string; busRiderId: string; childId: string; sequence: number }>;
}

export interface TripChildStatusRecord {
  id: string;
  tripId: string;
  childId: string;
  tenantId: string;
  status: TripChildStatusValue;
  statusChangedAt: string | null;
  changedBy: string | null;
}

export function tripChildStatusFromRow(row: TripChildStatusRow): TripChildStatusRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    childId: row.child_id,
    tenantId: row.tenant_id,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    changedBy: row.changed_by,
  };
}

export interface GpsPing {
  id: string;
  tripId: string;
  tenantId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speedKph: number | null;
  recordedAt: string;
}

export function gpsPingFromRow(row: GpsPingRow): GpsPing {
  return {
    id: row.id,
    tripId: row.trip_id,
    tenantId: row.tenant_id,
    lat: row.lat,
    lng: row.lng,
    heading: row.heading,
    speedKph: row.speed_kph,
    recordedAt: row.recorded_at,
  };
}

export interface PickupPass {
  id: string;
  tenantId: string;
  childId: string;
  createdBy: string;
  personName: string;
  relation: PickupPersonRelation;
  idPhotoObjectId: string | null;
  qrToken: string;
  status: PickupPassStatus;
  expiresAt: string;
}

export function pickupPassFromRow(row: PickupPassRow): PickupPass {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    childId: row.child_id,
    createdBy: row.created_by,
    personName: row.person_name,
    relation: row.relation,
    idPhotoObjectId: row.id_photo_object_id,
    qrToken: row.qr_token,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

export interface PickupScanEvent {
  id: string;
  tenantId: string;
  pickupPassId: string | null;
  scannedBy: string;
  result: PickupScanResult;
  handoverConfirmed: boolean;
  scannedAt: string;
}

export function pickupScanEventFromRow(row: PickupScanEventRow): PickupScanEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    pickupPassId: row.pickup_pass_id,
    scannedBy: row.scanned_by,
    result: row.result,
    handoverConfirmed: row.handover_confirmed,
    scannedAt: row.scanned_at,
  };
}

export interface ScanPickupPassResult {
  result: PickupScanResult;
  scanEventId: string;
  pass: PickupPass | null;
}
