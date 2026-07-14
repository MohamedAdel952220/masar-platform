import { z } from 'zod';
import { phoneSchema, nonEmptyString, uuidSchema } from './common.js';

export const staffRoleSchema = z.enum(['manager', 'teacher', 'reception']);

export const addStaffSchema = z.object({
  tenantId: uuidSchema,
  role: staffRoleSchema,
  name: nonEmptyString('name').max(200),
  nameAr: z.string().trim().max(200).optional(),
  phone: phoneSchema,
  email: z.string().email().optional(),
  nationalId: z.string().trim().max(20).optional(),
});

export type AddStaffInput = z.infer<typeof addStaffSchema>;

export const suspendStaffSchema = z.object({
  staffId: uuidSchema,
  reason: z.string().trim().max(500).optional(),
});
export type SuspendStaffInput = z.infer<typeof suspendStaffSchema>;

export const reactivateStaffSchema = z.object({
  staffId: uuidSchema,
});
export type ReactivateStaffInput = z.infer<typeof reactivateStaffSchema>;

export const revokeSessionsSchema = z.object({
  userId: uuidSchema,
});
export type RevokeSessionsInput = z.infer<typeof revokeSessionsSchema>;

export const regenerateActivationLinkSchema = z.object({
  userId: uuidSchema,
});
export type RegenerateActivationLinkInput = z.infer<typeof regenerateActivationLinkSchema>;
