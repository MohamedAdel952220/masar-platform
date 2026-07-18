import { z } from 'zod';
import { phoneSchema, nonEmptyString, uuidSchema } from './common.js';

export const tripLegSchema = z.enum(['am', 'pm']);
export const tripChildStatusValueSchema = z.enum(['pending', 'picked_up', 'dropped_off', 'absent']);
export const pickupPersonRelationSchema = z.enum([
  'father', 'mother', 'uncle', 'aunt', 'grandfather', 'grandmother', 'sibling', 'driver', 'other',
]);

export const addBusSchema = z.object({
  number: nonEmptyString('number').max(50),
  plate: nonEmptyString('plate').max(50),
  capacity: z.number().int().positive(),
  serviceArea: z.string().trim().max(200).optional(),
  driver: z.object({
    name: nonEmptyString('name').max(200),
    nameAr: z.string().trim().max(200).optional(),
    phone: phoneSchema,
    nationalId: z.string().trim().max(20).optional(),
  }),
});
export type AddBusInput = z.infer<typeof addBusSchema>;

export const assignBusRiderSchema = z.object({
  busId: uuidSchema,
  childId: uuidSchema,
  pickupAddressOverride: z.string().trim().max(300).optional(),
});
export type AssignBusRiderInput = z.infer<typeof assignBusRiderSchema>;

export const unassignBusRiderSchema = z.object({
  busRiderId: uuidSchema,
});
export type UnassignBusRiderInput = z.infer<typeof unassignBusRiderSchema>;

export const startTripSchema = z.object({
  busId: uuidSchema,
  leg: tripLegSchema,
});
export type StartTripInput = z.infer<typeof startTripSchema>;

export const recordGpsPingSchema = z.object({
  tripId: uuidSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).optional(),
});
export type RecordGpsPingInput = z.infer<typeof recordGpsPingSchema>;

export const updateChildTripStatusSchema = z.object({
  tripId: uuidSchema,
  childId: uuidSchema,
  status: tripChildStatusValueSchema,
});
export type UpdateChildTripStatusInput = z.infer<typeof updateChildTripStatusSchema>;

export const completeTripSchema = z.object({
  tripId: uuidSchema,
});
export type CompleteTripInput = z.infer<typeof completeTripSchema>;

export const createPickupPassSchema = z.object({
  childId: uuidSchema,
  personName: nonEmptyString('personName').max(200),
  relation: pickupPersonRelationSchema,
  idPhotoObjectId: uuidSchema.optional(),
  expiresAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'expiresAt must be a valid date').optional(),
});
export type CreatePickupPassInput = z.infer<typeof createPickupPassSchema>;

export const scanPickupPassSchema = z.object({
  qrToken: nonEmptyString('qrToken').max(200),
});
export type ScanPickupPassInput = z.infer<typeof scanPickupPassSchema>;

export const confirmHandoverSchema = z.object({
  pickupScanEventId: uuidSchema,
});
export type ConfirmHandoverInput = z.infer<typeof confirmHandoverSchema>;

// Fix for EPIC_3_REVIEW.md M4.
export const revokePickupPassSchema = z.object({
  pickupPassId: uuidSchema,
});
export type RevokePickupPassInput = z.infer<typeof revokePickupPassSchema>;
