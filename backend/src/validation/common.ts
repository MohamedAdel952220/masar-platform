import { z } from 'zod';

// E.164 phone format — matches the CHECK constraint on tenancy.tenant_phone_registry.phone
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Phone must be in E.164 format, e.g. +201001234567');

// Matches tenancy.tenants.slug CHECK constraint
export const slugSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/, 'Slug must be lowercase, DNS-safe, 3-32 characters');

export const uuidSchema = z.string().uuid();

export const nonEmptyString = (label: string) =>
  z.string().trim().min(1, `${label} is required`);
