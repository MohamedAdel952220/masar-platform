import type { Database } from './database.generated';

/**
 * Frontend-facing constants. Anything that exists in the database is DERIVED
 * from the generated types rather than restated, so a backend change surfaces
 * as a type error instead of silent drift.
 */

/** The 13 PostgREST-exposed schemas. `analytics` is deliberately absent — it is
 *  not exposed, and its data is reachable only through the three
 *  access-controlled views (academic.v_child_attendance_summary,
 *  platform.v_tenant_billing_summary, platform.v_tenant_health_summary). */
export const EXPOSED_SCHEMAS = [
  'public',
  'tenancy',
  'identity',
  'academic',
  'transport',
  'safety',
  'comms',
  'approvals',
  'billing',
  'media',
  'reports',
  'platform',
  'jobs',
] as const satisfies readonly (keyof Database)[];
export type ExposedSchema = (typeof EXPOSED_SCHEMAS)[number];

/** Tenant-side staff roles, derived from identity.staff_role. */
export type StaffRole = Database['identity']['Enums']['staff_role'];

/** Full role set as carried in the JWT app_metadata `role` claim. */
export const ROLES = ['guardian', 'teacher', 'reception', 'manager', 'driver', 'platform_admin'] as const;
export type Role = (typeof ROLES)[number];

/** Platform Admin tiers (BACKEND_ARCHITECTURE.md §12.1). */
export const PLATFORM_ADMIN_TIERS = ['owner', 'admin', 'support'] as const;
export type PlatformAdminTier = (typeof PLATFORM_ADMIN_TIERS)[number];

/** Portal identifiers, matching the `app_access` JWT claim. `dashboard`,
 *  `parent`, `teacher`, `reception`, `driver` mirror tenancy.app_code; the
 *  Platform Admin console is not a tenant app and so is not in that enum. */
export type AppCode = Database['tenancy']['Enums']['app_code'];
export const PORTALS = ['parent', 'teacher', 'reception', 'driver', 'dashboard', 'platform-admin'] as const;
export type Portal = (typeof PORTALS)[number];
