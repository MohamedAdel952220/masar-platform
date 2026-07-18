import { z } from 'zod';
import { phoneSchema, nonEmptyString, uuidSchema } from './common.js';

export const genderSchema = z.enum(['male', 'female']);
export const packageTypeSchema = z.enum(['full_day', 'half_day']);
export const guardianRelationSchema = z.enum(['father', 'mother', 'guardian']);
export const homeworkStatusSchema = z.enum(['done', 'partial', 'none']);

export const childFieldsSchema = z.object({
  name: nonEmptyString('name').max(200),
  nameAr: z.string().trim().max(200).optional(),
  dob: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'dob must be a valid date'),
  gender: genderSchema,
  bloodType: z.string().trim().max(10).optional(),
  allergies: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  package: packageTypeSchema,
  addressLine: z.string().trim().max(300).optional(),
  building: z.string().trim().max(100).optional(),
  area: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  addressLat: z.number().min(-90).max(90).optional(),
  addressLng: z.number().min(-180).max(180).optional(),
  emergencyContactName: z.string().trim().max(200).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  emergencyContactRelation: z.string().trim().max(100).optional(),
  fatherName: z.string().trim().max(200).optional(),
  fatherPhone: z.string().trim().max(30).optional(),
  fatherJob: z.string().trim().max(200).optional(),
  fatherNationalId: z.string().trim().max(20).optional(),
  motherName: z.string().trim().max(200).optional(),
  motherPhone: z.string().trim().max(30).optional(),
  motherJob: z.string().trim().max(200).optional(),
  motherNationalId: z.string().trim().max(20).optional(),
});
export type ChildFieldsInput = z.infer<typeof childFieldsSchema>;

export const guardianFieldsSchema = z.object({
  name: nonEmptyString('name').max(200),
  phone: phoneSchema,
  email: z.string().email().optional(),
  relation: guardianRelationSchema,
});
export type GuardianFieldsInput = z.infer<typeof guardianFieldsSchema>;

export const enrollChildSchema = z.object({
  classroomId: uuidSchema,
  child: childFieldsSchema,
  guardian: guardianFieldsSchema,
});
export type EnrollChildInput = z.infer<typeof enrollChildSchema>;

export const attendanceRecordEntrySchema = z.object({
  childId: uuidSchema,
  present: z.boolean(),
});

export const markAttendanceSchema = z.object({
  classroomId: uuidSchema,
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'date must be a valid date'),
  records: z.array(attendanceRecordEntrySchema).min(1, 'records must contain at least one entry'),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const submitEvaluationSchema = z.object({
  childId: uuidSchema,
  lessonId: uuidSchema,
  understanding: z.number().int().min(1).max(5),
  participation: z.number().int().min(1).max(5),
  behavior: z.number().int().min(1).max(5),
  homework: homeworkStatusSchema,
  note: z.string().trim().max(2000).optional(),
});
export type SubmitEvaluationInput = z.infer<typeof submitEvaluationSchema>;

export const withdrawChildSchema = z.object({
  childId: uuidSchema,
  reason: z.string().trim().max(500).optional(),
});
export type WithdrawChildInput = z.infer<typeof withdrawChildSchema>;

export const suspendChildSchema = z.object({
  childId: uuidSchema,
  reason: z.string().trim().max(500).optional(),
});
export type SuspendChildInput = z.infer<typeof suspendChildSchema>;

export const reactivateChildSchema = z.object({
  childId: uuidSchema,
});
export type ReactivateChildInput = z.infer<typeof reactivateChildSchema>;
