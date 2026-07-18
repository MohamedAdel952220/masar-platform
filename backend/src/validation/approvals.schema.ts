import { z } from 'zod';
import { nonEmptyString, phoneSchema, uuidSchema } from './common.js';

export const requestTypeSchema = z.enum(['event', 'trip', 'exam']);
export const examKindSchema = z.enum(['weekly', 'monthly']);
export const requestDecisionSchema = z.enum(['approved', 'rejected']);
export const rsvpAttendeeSchema = z.enum(['child', 'father', 'mother', 'both']);

// Matches the DB's `time` (time without time zone) column — HH:MM or
// HH:MM:SS, 24-hour.
//
// Fix for EPIC_5_REVIEW.md L2: the previous regex (`^\d{2}:\d{2}(:\d{2})?$`)
// checked shape only — "99:99" passed Zod and was rejected only by
// Postgres's own time-literal parser, surfacing as a generic constraint-
// violation error instead of a precise Zod field error. Range-checks the
// hour/minute/second components directly instead.
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be a valid 24-hour HH:MM or HH:MM:SS value');

// Same L2 fix, applied to dates: z.string().date() checks YYYY-MM-DD shape
// only, not calendar validity ("2026-02-30" passes it). Round-trips through
// Date.UTC and compares components back — an invalid calendar date rolls
// over (e.g. Feb 30 -> Mar 2) and fails the comparison.
const isValidCalendarDate = (value: string): boolean => {
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

export const submitRequestSchema = z
  .object({
    type: requestTypeSchema,
    title: nonEmptyString('title').max(200),
    requestDate: z.string().date().refine(isValidCalendarDate, { message: 'requestDate must be a valid calendar date' }),
    requestTime: timeSchema.optional(),
    classroomId: uuidSchema.optional(),
    subjectId: uuidSchema.optional(),
    examKind: examKindSchema.optional(),
    note: z.string().trim().max(2000).optional(),
    place: z.string().trim().max(200).optional(),
    // Fix for EPIC_5_REVIEW.md L4: constrained to at most 2 decimal places,
    // matching the DB column's numeric(10,2) precision — previously a
    // caller could pass e.g. 100.999 and get it silently rounded by
    // Postgres rather than a clean validation error naming the problem.
    price: z.number().min(0).multipleOf(0.01).optional(),
    attachmentObjectId: uuidSchema.optional(),
    idempotencyKey: uuidSchema.optional(),
  })
  // Fix-forward application of EPIC_4_REVIEW.md H1's lesson at the Zod
  // layer too (layer 1 of the 3-layer fix — this schema, submit_request's
  // own RPC-level check, and the requests_exam_kind_requires_exam /
  // requests_trip_fields_require_trip DB constraints, migration 2).
  //
  // Fix for EPIC_5_REVIEW.md M4: previously only required examKind WHEN
  // type==='exam', but never rejected examKind being supplied for a
  // non-exam type — asymmetric with the DB's requests_exam_kind_requires_exam
  // constraint (which enforces both directions) and with this schema's own
  // trip-fields refine below (which is already symmetric). Now matches the
  // DB constraint exactly in both directions.
  .refine((v) => (v.type === 'exam' ? Boolean(v.examKind) : v.examKind === undefined), {
    message: 'examKind is required when type is "exam", and must not be set otherwise',
  })
  .refine((v) => v.type === 'trip' || (v.place === undefined && v.price === undefined), {
    message: 'place and price are only valid when type is "trip"',
  });
export type SubmitRequestInput = z.infer<typeof submitRequestSchema>;

export const reviewRequestSchema = z
  .object({
    requestId: uuidSchema,
    decision: requestDecisionSchema,
    rejectionReason: z.string().trim().max(1000).optional(),
    idempotencyKey: uuidSchema.optional(),
  })
  .refine((v) => v.decision !== 'rejected' || Boolean(v.rejectionReason), {
    message: 'rejectionReason is required when decision is "rejected"',
  });
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;

export const updateRsvpSchema = z.object({
  eventId: uuidSchema,
  childId: uuidSchema,
  attendee: rsvpAttendeeSchema,
  extraGuestName: z.string().trim().max(200).optional(),
  extraGuestRelation: z.string().trim().max(100).optional(),
  contactPhone: phoneSchema.optional(),
});
export type UpdateRsvpInput = z.infer<typeof updateRsvpSchema>;

export const registerForTripSchema = z.object({
  eventId: uuidSchema,
  childId: uuidSchema,
});
export type RegisterForTripInput = z.infer<typeof registerForTripSchema>;

export const cancelTripRegistrationSchema = z.object({
  registrationId: uuidSchema,
});
export type CancelTripRegistrationInput = z.infer<typeof cancelTripRegistrationSchema>;
