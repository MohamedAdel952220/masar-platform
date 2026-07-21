import { z } from 'zod';
import { uuidSchema } from './common.js';

// Cursor-based pagination (§14.3 "cursor-based everywhere ... never offset
// pagination") — EPIC_10_REVIEW.md L1. Cursor values are uuid-validated here,
// which is also what makes them safe to embed in the keyset filter the
// repository builds.
const limitSchema = z.number().int().min(1).max(500).optional();

// Child attendance summary list filter. The exposed view
// academic.v_child_attendance_summary applies the authoritative fail-closed
// tenant/role predicate; these are optional narrowing filters only.
export const listChildAttendanceSummarySchema = z.object({
  childId: uuidSchema.optional(),
  classroomId: uuidSchema.optional(),
  limit: limitSchema,
  // Keyset cursor over the view's unique grain (child_id, classroom_id).
  cursor: z
    .object({
      childId: uuidSchema,
      classroomId: uuidSchema,
    })
    .optional(),
});
export type ListChildAttendanceSummaryInput = z.infer<typeof listChildAttendanceSummarySchema>;

// Tenant billing / health summary list filter (Platform-Admin-only surfaces).
// Keyset cursor over the unique grain (tenant_id).
export const listTenantSummarySchema = z.object({
  tenantId: uuidSchema.optional(),
  limit: limitSchema,
  cursor: uuidSchema.optional(),
});
export type ListTenantSummaryInput = z.infer<typeof listTenantSummarySchema>;
