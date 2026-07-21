import type { MasarClaims } from '@masar/auth';

/**
 * Nursery Dashboard permission helpers (BACKEND_ARCHITECTURE.md §12).
 *
 * IMPORTANT: these are UX affordances only. RLS is the authorization boundary —
 * every action hidden here still fails correctly server-side if invoked
 * directly, and every row a caller may read is decided by policy, not by this
 * file. The purpose is to avoid presenting a control that would be rejected.
 *
 * MANAGER is the Dashboard's primary role: §12 gives it CRUD across children,
 * classrooms, staff, attendance override, approvals, billing, cameras and
 * announcements — all scoped to its own tenant.
 *
 * TEACHER VISIBILITY: a teacher's own app is the Teacher App, but if a teacher
 * identity opens this portal the console must degrade correctly rather than
 * break. RLS already narrows what they can read — attendance and evaluations to
 * their own classroom (`classroom_id = ANY(current_staff_classroom_ids())`),
 * children to their own classroom, and nothing at all on billing or platform
 * tables. The portal adds NO extra client-side filtering on top of that (which
 * would duplicate policy); it only hides manager-only write controls so a
 * teacher is never shown an action the server would reject.
 */

export type DashboardRole = 'manager' | 'teacher';

/** Roles permitted to open this portal at all. */
export function canOpenDashboard(claims: MasarClaims): boolean {
  return claims.role === 'manager' || claims.role === 'teacher';
}

/** Manager-only: full CRUD across the tenant (§12). */
export function isManager(claims: MasarClaims): boolean {
  return claims.role === 'manager';
}

/** Teacher: classroom-scoped read access, no tenant-wide writes. */
export function isTeacher(claims: MasarClaims): boolean {
  return claims.role === 'teacher';
}

/** Enrolment, withdrawal, suspension, staff onboarding. */
export const canManageChildren = isManager;
/** Classroom create/edit. */
export const canManageClassrooms = isManager;
/** Staff onboarding, suspension, reactivation. */
export const canManageStaff = isManager;
/** Attendance override (§12: manager has "R, CU (override)"). */
export const canOverrideAttendance = isManager;
/** Approve/reject requests (§12: manager has "RUA"). */
export const canReviewApprovals = isManager;
/** Invoices, payment verification, manual payment marking. */
export const canManageBilling = isManager;
/** Camera CRUD including the admin_disabled toggle (§17). */
export const canManageCameras = isManager;
/** Tenant-wide announcements. */
export const canBroadcast = isManager;
/** Sending AI report drafts to guardians. */
export const canSendReports = isManager;
/** Tenant settings (§12: manager has "R, U own settings only"). */
export const canEditSettings = isManager;

/** Label for the role chip in the top bar. */
export function roleLabel(role: string | null): string {
  if (role === 'manager') return 'Manager';
  if (role === 'teacher') return 'Teacher';
  return 'Unknown';
}
