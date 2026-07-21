import type { MasarClaims } from '@masar/auth';

/**
 * Teacher App scope helpers (BACKEND_ARCHITECTURE.md §12).
 *
 * IMPORTANT: these are UX affordances only. RLS is the authorization boundary.
 * A teacher's reach is defined server-side by
 * `classroom_id = ANY(public.current_staff_classroom_ids())` on every
 * classroom-scoped table, and by `child_id`-level policies elsewhere. This app
 * therefore performs NO client-side classroom filtering on top of policy — it
 * simply reads, and the database returns only what belongs to this teacher.
 *
 * §12 row for `teacher`, as deployed:
 *   Children ............. R (own classroom)
 *   Classrooms ........... R (own)
 *   Attendance ........... CU (own classroom)   ← the core daily write
 *   Evaluations/Lessons .. CRU (own classroom)
 *   Concerns ............. C, R (own)
 *   Day-path history ..... R (own classroom, today)
 *   AI Reports ........... C (own students), R (own)
 *   Requests ............. C (own), R (own)
 *   Conversations ........ CRU (own)
 *   Notifications ........ R, U (own)
 *   Billing / platform ... no row in the matrix at all — RLS returns nothing
 */

/** Roles permitted to open this portal. */
export function canOpenTeacherApp(claims: MasarClaims): boolean {
  return claims.role === 'teacher';
}

/** Marking and amending a register for the teacher's own classroom. */
export function canMarkAttendance(claims: MasarClaims): boolean {
  return claims.role === 'teacher';
}

/** Submitting evaluations against a lesson in the teacher's own classroom. */
export function canSubmitEvaluation(claims: MasarClaims): boolean {
  return claims.role === 'teacher';
}

/** Creating AI drafts for the teacher's own students (§12: "C own students"). */
export function canDraftReports(claims: MasarClaims): boolean {
  return claims.role === 'teacher';
}

/**
 * Sending a reviewed draft on to the guardian — NOT a teacher capability.
 *
 * §12's AI Reports row gives a teacher `C (own students), R own`; sending sits
 * with the manager's `CRUD (all)`. The deployed RPC agrees and is stricter than
 * any UI gate:
 *
 *   public.send_report_draft:
 *     if public.current_role() <> 'manager' then
 *       raise ... 'PERM_ROLE_DENIED' — 'Only a manager can send a report draft.'
 *
 * This previously returned `claims.role === 'teacher'`, so the Teacher App
 * showed an enabled "Send to family" button that failed server-side on every
 * press. Found by the Phase 9 integration audit; see
 * SYSTEM_INTEGRATION_AUDIT_REPORT.md §3 (I1).
 *
 * The teacher still drafts and reads; the manager reviews and sends from the
 * Dashboard, which is where the human-review gate now lives.
 */
export function canSendReports(_claims: MasarClaims): boolean {
  return false;
}

/**
 * AI usage (§19). The plan cap is enforced SERVER-SIDE by
 * `reports.ai_usage_counters` and the Edge Functions themselves — the client
 * shows remaining headroom so a teacher learns the limit before composing
 * rather than after a rejection, but it never decides the limit.
 *
 * `ai_usage_counters` records `calls_used` per `usage_date`. The plan's own cap
 * lives in `tenancy.plan_catalog`, which a teacher has no read policy for, so
 * the exact ceiling is not displayable here — only usage and the server's
 * answer when the cap is hit.
 */
export interface AiUsageToday {
  callsUsed: number;
  recordedFor: string | null;
}
