import { z } from 'zod';
import { phoneSchema, slugSchema, nonEmptyString } from './common.js';

export const planCodeSchema = z.enum(['starter', 'growth', 'premium']);

export const provisionTenantSchema = z.object({
  name: nonEmptyString('name').max(200),
  slug: slugSchema,
  city: z.string().trim().max(100).optional(),
  planCode: planCodeSchema,
  contactName: nonEmptyString('contactName').max(200),
  contactEmail: z.string().email().optional(),
  ownerName: nonEmptyString('ownerName').max(200),
  ownerPhone: phoneSchema,
});

export type ProvisionTenantInput = z.infer<typeof provisionTenantSchema>;

export const suspendTenantSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export type SuspendTenantInput = z.infer<typeof suspendTenantSchema>;
