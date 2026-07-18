// API handlers for assign-bus-rider / unassign-bus-rider / start-trip /
// record-gps-ping / update-child-trip-status / complete-trip /
// create-pickup-pass / scan-pickup-pass / confirm-handover — mirrors the
// nine corresponding RPCs (§14.2), same shape as academicRecords.ts (Epic 2).
import {
  assignBusRiderSchema,
  unassignBusRiderSchema,
  startTripSchema,
  recordGpsPingSchema,
  updateChildTripStatusSchema,
  completeTripSchema,
  createPickupPassSchema,
  scanPickupPassSchema,
  confirmHandoverSchema,
  revokePickupPassSchema,
} from '../../validation/transport.schema.js';
import { AppError } from '../../lib/errors.js';
import type { TransportService } from '../../services/transportService.js';
import type { SafetyService } from '../../services/safetyService.js';
import type { CallerContext } from '../../types/domain.js';
import type { BusRider, StartTripResult, GpsPing, TripChildStatusRecord, Trip, PickupPass, ScanPickupPassResult, PickupScanEvent } from '../../types/domain.epic3.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function assignBusRiderRoute(service: TransportService, caller: CallerContext, rawBody: unknown): Promise<BusRider> {
  const parsed = assignBusRiderSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.assignBusRider(parsed.data, caller);
}

export async function unassignBusRiderRoute(service: TransportService, caller: CallerContext, rawBody: unknown): Promise<BusRider> {
  const parsed = unassignBusRiderSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.unassignBusRider(parsed.data, caller);
}

export async function startTripRoute(service: TransportService, caller: CallerContext, rawBody: unknown): Promise<StartTripResult> {
  const parsed = startTripSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.startTrip(parsed.data, caller);
}

export async function recordGpsPingRoute(service: TransportService, caller: CallerContext, rawBody: unknown): Promise<GpsPing> {
  const parsed = recordGpsPingSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.recordGpsPing(parsed.data, caller);
}

export async function updateChildTripStatusRoute(service: TransportService, caller: CallerContext, rawBody: unknown): Promise<TripChildStatusRecord> {
  const parsed = updateChildTripStatusSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.updateChildTripStatus(parsed.data, caller);
}

export async function completeTripRoute(service: TransportService, caller: CallerContext, rawBody: unknown): Promise<Trip> {
  const parsed = completeTripSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.completeTrip(parsed.data, caller);
}

export async function createPickupPassRoute(service: SafetyService, caller: CallerContext, rawBody: unknown): Promise<PickupPass> {
  const parsed = createPickupPassSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.createPickupPass(parsed.data, caller);
}

export async function scanPickupPassRoute(service: SafetyService, caller: CallerContext, rawBody: unknown): Promise<ScanPickupPassResult> {
  const parsed = scanPickupPassSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.scanPickupPass(parsed.data, caller);
}

export async function confirmHandoverRoute(service: SafetyService, caller: CallerContext, rawBody: unknown): Promise<PickupScanEvent> {
  const parsed = confirmHandoverSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.confirmHandover(parsed.data, caller);
}

// Fix for EPIC_3_REVIEW.md M4.
export async function revokePickupPassRoute(service: SafetyService, caller: CallerContext, rawBody: unknown): Promise<PickupPass> {
  const parsed = revokePickupPassSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.revokePickupPass(parsed.data, caller);
}
