// Epic 3 snake_case row types, kept separate from database.types.ts/.epic2.ts
// for the same reason those files are separate: repositories are the only
// place that ever sees a raw DB row shape.

export type TripLeg = 'am' | 'pm';
export type TripStatus = 'scheduled' | 'moving' | 'arrived' | 'completed' | 'cancelled';
export type TripChildStatusValue = 'pending' | 'picked_up' | 'dropped_off' | 'absent';
export type PickupPersonRelation =
  | 'father' | 'mother' | 'uncle' | 'aunt' | 'grandfather' | 'grandmother' | 'sibling' | 'driver' | 'other';
export type PickupPassStatus = 'active' | 'expired' | 'revoked';
export type PickupScanResult = 'valid' | 'invalid_expired' | 'invalid_unknown' | 'invalid_revoked';

export interface BusRow {
  id: string;
  tenant_id: string;
  number: string;
  plate: string;
  capacity: number;
  service_area: string | null;
  driver_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusRiderRow {
  id: string;
  bus_id: string;
  child_id: string;
  tenant_id: string;
  pickup_address_override: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripRow {
  id: string;
  tenant_id: string;
  bus_id: string;
  leg: TripLeg;
  service_date: string;
  status: TripStatus;
  started_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripChildStatusRow {
  id: string;
  trip_id: string;
  child_id: string;
  tenant_id: string;
  status: TripChildStatusValue;
  status_changed_at: string | null;
  changed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GpsPingRow {
  id: string;
  trip_id: string;
  tenant_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kph: number | null;
  recorded_at: string;
}

export interface PickupPassRow {
  id: string;
  tenant_id: string;
  child_id: string;
  created_by: string;
  person_name: string;
  relation: PickupPersonRelation;
  id_photo_object_id: string | null;
  qr_token: string;
  status: PickupPassStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface PickupScanEventRow {
  id: string;
  tenant_id: string;
  pickup_pass_id: string | null;
  scanned_by: string;
  result: PickupScanResult;
  handover_confirmed: boolean;
  scanned_at: string;
}
