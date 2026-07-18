// ai-draft-report — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §14.2, §19; BACKEND_EXECUTION_PLAN.md Epic 8 §7, §10
// Fix pass: EPIC_8_REVIEW.md C1, H1, H2, M2, L3.
// Caller: teacher (own classroom/students) or manager (tenant-wide) — §12's
// own "Teacher: C (own students)" / "Manager: CRUD (all)" cells.
//
// Fix for EPIC_8_REVIEW.md C1: scope resolution (classroom lookup, child
// lookup, evaluations/attendance metrics) now runs through a CALLER-SCOPED
// client (supabaseAsCaller, carrying the caller's own JWT), not the
// service-role admin client. This means the frozen Epic 2 RLS policies
// (classrooms_select_teacher/children_select_teacher/evaluations_select_
// teacher/attendance_select_teacher — all scoped via
// public.current_staff_classroom_ids()) enforce a teacher's own-classroom
// restriction automatically, with zero hand-rolled duplicate authorization
// logic in this file (the previous version checked only tenant_id, never
// classroom ownership, letting any teacher draft a report for any child in
// the tenant). A manager's own tenant-wide RLS policies mean this change is
// a no-op for manager callers. This also means every finding from
// EPIC_8_REVIEW.md's C1 is now covered by the existing, already-tested
// tests/rls/epic8_rls_adversarial.sql suite (extended in this fix pass —
// see EPIC_8_FIX_REPORT.md), partially mitigating L1 (no Deno test runner
// exists in this sandbox to directly test this Edge Function).
//
// Fix for EPIC_8_REVIEW.md H1: the whole mutating sequence (usage-cap
// increment through batch/draft creation) is wrapped in withIdempotency
// (_shared/idempotency.ts), the same shared mechanism initiate-payment and
// enroll-child already use — a retry with the same x-idempotency-key header
// now replays the original response instead of double-charging the usage
// cap and creating a duplicate batch.
//
// Fix for EPIC_8_REVIEW.md H2: the batch-insert + draft-insert/job-enqueue
// sequence, previously three separate REST round-trips, is now one call to
// reports.create_ai_report_batch (migration 7) — one Postgres transaction.
//
// Fix for EPIC_8_REVIEW.md M2: MAX_BATCH_SIZE caps the resolved child count
// before any usage-cap increment or LLM call happens (defense-in-depth
// re-checked inside create_ai_report_batch itself, migration 7).
//
// Fix for EPIC_8_REVIEW.md L3: LLM calls for the sync path now run with a
// bounded concurrency (mapWithConcurrency) instead of one unbounded
// Promise.all — immaterial against the current stub, relevant once a real
// provider is wired in.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin, supabaseAsCaller } from '../_shared/supabaseAdmin.ts';
import { toAppError } from '../_shared/rpcError.ts';
import { withIdempotency, readIdempotencyKey } from '../_shared/idempotency.ts';
import { draftReportWithLLM } from '../_shared/llmProvider.ts';

type ReportType = 'monthly_progress' | 'subject_report' | 'behavior_social' | 'attendance_summary';
type ReportScope = 'classroom' | 'children';

const REPORT_TYPES: ReportType[] = ['monthly_progress', 'subject_report', 'behavior_social', 'attendance_summary'];
const REPORT_SCOPES: ReportScope[] = ['classroom', 'children'];

// §19's own "(e.g., >10 children)" example — the literal threshold this
// Epic's sync/background split is built around.
const SYNC_BATCH_THRESHOLD = 10;
const METRICS_WINDOW_DAYS = 30;
const MAX_TOPIC_LENGTH = 200;
// Fix for EPIC_8_REVIEW.md M2 — re-checked server-side (migration 7's own
// v_max_batch_size) as defense-in-depth; the two constants are intentionally
// equal and each carries a comment pointing at its counterpart.
const MAX_BATCH_SIZE = 500;
// Fix for EPIC_8_REVIEW.md L3 — a small, deliberate concurrency cap rather
// than firing the whole batch's LLM calls at once.
const LLM_CONCURRENCY = 5;

interface Body {
  scope: ReportScope;
  type: ReportType;
  topic?: string | null;
  classroomId?: string;
  childIds?: string[];
}

interface ChildRow {
  id: string;
  name: string;
}

interface ChildMetrics {
  evaluationCount: number;
  averageUnderstanding: number | null;
  averageParticipation: number | null;
  averageBehavior: number | null;
  homeworkDoneRatio: number | null;
  attendanceRecordCount: number;
  attendanceRate: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

// Deterministic, non-LLM fallback (§19) — mirrors ai-polish-note's own
// fallback discipline: never fail the caller's request over an LLM outage.
function buildFallbackReportBody(childName: string, type: ReportType, topic: string | null, metrics: ChildMetrics): string {
  const topicLine = topic ? ` on "${topic}"` : '';
  const parts = [`${childName}'s ${type.replace(/_/g, ' ')} report${topicLine}.`];
  if (metrics.averageUnderstanding !== null) {
    parts.push(`Average understanding: ${metrics.averageUnderstanding}/5, participation: ${metrics.averageParticipation}/5, behavior: ${metrics.averageBehavior}/5 (${metrics.evaluationCount} evaluations in the last ${METRICS_WINDOW_DAYS} days).`);
  }
  if (metrics.attendanceRate !== null) {
    parts.push(`Attendance rate: ${Math.round(metrics.attendanceRate * 100)}% (${metrics.attendanceRecordCount} recorded days).`);
  }
  return parts.join(' ');
}

// Fix for EPIC_8_REVIEW.md L3 — bounded-concurrency map, replacing a single
// unbounded Promise.all over the whole batch.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new AppError('AUTH_MISSING_TOKEN', 'You must be signed in.', 'يجب تسجيل الدخول أولاً.');

    const caller = await requireCaller(req);
    requireRole(caller, ['teacher', 'manager']);
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'Your account is not scoped to a tenant.', 'حسابك غير مرتبط بمؤسسة.');
    }

    const body = (await req.json()) as Partial<Body>;

    if (!body.scope || !REPORT_SCOPES.includes(body.scope as ReportScope)) {
      throw new AppError('VALIDATION_FAILED', `scope must be one of: ${REPORT_SCOPES.join(', ')}`, 'قيمة scope غير صالحة');
    }
    if (!body.type || !REPORT_TYPES.includes(body.type as ReportType)) {
      throw new AppError('VALIDATION_FAILED', `type must be one of: ${REPORT_TYPES.join(', ')}`, 'قيمة type غير صالحة');
    }
    const topic = typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : null;
    if (topic && topic.length > MAX_TOPIC_LENGTH) {
      throw new AppError('VALIDATION_FAILED', `topic must be at most ${MAX_TOPIC_LENGTH} characters`, `يجب ألا يتجاوز topic ${MAX_TOPIC_LENGTH} حرفًا`);
    }

    // Fix for EPIC_8_REVIEW.md C1 — RLS-scoped, not service-role. A teacher
    // querying a classroom/child outside current_staff_classroom_ids()
    // simply gets zero rows back, which the existing NOT_FOUND/count-mismatch
    // handling below already treats correctly — no new authorization logic
    // needed here beyond switching which client performs these reads.
    const callerClient = supabaseAsCaller(authHeader);

    const scope = body.scope as ReportScope;
    const type = body.type as ReportType;
    let classroomId: string | null = null;
    let children: ChildRow[] = [];

    if (scope === 'classroom') {
      if (!body.classroomId) {
        throw new AppError('VALIDATION_FAILED', 'classroomId is required when scope is "classroom"', 'classroomId مطلوب عند scope="classroom"');
      }
      if (body.childIds && body.childIds.length > 0) {
        throw new AppError('VALIDATION_FAILED', 'childIds must not be provided when scope is "classroom"', 'لا يجب إرسال childIds عند scope="classroom"');
      }
      classroomId = body.classroomId;

      const { data: classroom, error: classroomErr } = await callerClient
        .schema('academic')
        .from('classrooms')
        .select('id, tenant_id')
        .eq('id', classroomId)
        .is('deleted_at', null)
        .maybeSingle();
      if (classroomErr) throw toAppError(classroomErr);
      if (!classroom || classroom.tenant_id !== caller.tenantId) {
        // Fix for EPIC_8_REVIEW.md C1: for a teacher, this branch is now
        // also reached when the classroom exists and belongs to the
        // tenant but is outside the teacher's own current_staff_
        // classroom_ids() — RLS (classrooms_select_teacher) makes the row
        // invisible, so `classroom` is null exactly as if it didn't exist.
        throw new AppError('NOT_FOUND', 'Classroom not found.', 'لم يتم العثور على الفصل.');
      }

      const { data: classroomChildren, error: childrenErr } = await callerClient
        .schema('academic')
        .from('children')
        .select('id, name')
        .eq('classroom_id', classroomId)
        .eq('tenant_id', caller.tenantId)
        .is('deleted_at', null);
      if (childrenErr) throw toAppError(childrenErr);
      children = (classroomChildren ?? []) as ChildRow[];
    } else {
      const requestedIds = Array.from(new Set(body.childIds ?? []));
      if (requestedIds.length === 0) {
        throw new AppError('VALIDATION_FAILED', 'childIds must contain at least one child when scope is "children"', 'يجب إرسال طفل واحد على الأقل عند scope="children"');
      }
      if (requestedIds.length > MAX_BATCH_SIZE) {
        throw new AppError('VALIDATION_FAILED', `childIds cannot exceed ${MAX_BATCH_SIZE} entries`, `لا يمكن أن يتجاوز childIds ${MAX_BATCH_SIZE} عنصرًا`);
      }

      const { data: foundChildren, error: childrenErr } = await callerClient
        .schema('academic')
        .from('children')
        .select('id, name')
        .in('id', requestedIds)
        .eq('tenant_id', caller.tenantId)
        .is('deleted_at', null);
      if (childrenErr) throw toAppError(childrenErr);
      children = (foundChildren ?? []) as ChildRow[];
      if (children.length !== requestedIds.length) {
        // Fix for EPIC_8_REVIEW.md C1: for a teacher, this now also fires
        // when a requested child exists and is in the tenant but outside
        // the teacher's own classroom(s) — children_select_teacher's RLS
        // makes that row invisible, producing the same count mismatch as a
        // genuinely nonexistent id.
        throw new AppError('NOT_FOUND', 'One or more children were not found.', 'لم يتم العثور على طفل واحد أو أكثر.');
      }
    }

    if (children.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'No children were resolved for this request.', 'لم يتم تحديد أي أطفال لهذا الطلب.');
    }
    if (children.length > MAX_BATCH_SIZE) {
      throw new AppError('VALIDATION_FAILED', `A single AI report batch cannot exceed ${MAX_BATCH_SIZE} children.`, `لا يمكن أن تتجاوز دفعة تقارير الذكاء الاصطناعي الواحدة ${MAX_BATCH_SIZE} طفلاً.`);
    }

    const admin = supabaseAdmin();

    // Fix for EPIC_8_REVIEW.md H1 — the whole mutating sequence (usage
    // increment through batch/draft creation) is idempotency-key-protected
    // as one unit: a retry with the same key never re-increments the usage
    // counter and never calls create_ai_report_batch a second time.
    const result = await withIdempotency(
      admin,
      { key: readIdempotencyKey(req), tenantId: caller.tenantId, callerId: caller.userId, rpcName: 'ai-draft-report' },
      async () => {
        // §3.20.1/§19: one cap-check-and-increment per batch call, not per
        // child — matches ai-polish-note's shared mechanism, and matches
        // §3.20.1's own "per call" framing (a 40-child classroom batch is
        // one call, not 40).
        const { error: usageErr } = await admin.schema('reports').rpc('increment_ai_usage', { p_tenant_id: caller.tenantId });
        if (usageErr) throw toAppError(usageErr);

        const childIds = children.map((c) => c.id);

        if (children.length > SYNC_BATCH_THRESHOLD) {
          // Fix for EPIC_8_REVIEW.md H2 — one atomic RPC call instead of a
          // separate batch-insert + job-insert.
          const { data: batchResult, error: batchErr } = await admin.schema('reports').rpc('create_ai_report_batch', {
            p_tenant_id: caller.tenantId,
            p_caller_id: caller.userId,
            p_caller_role: caller.role,
            p_type: type,
            p_scope: scope,
            p_classroom_id: classroomId,
            p_topic: topic,
            p_child_ids: childIds,
            p_drafts: null,
          });
          if (batchErr) throw toAppError(batchErr);
          return { status: 202, body: batchResult as { batchId: string; mode: 'queued'; jobId: string; childCount: number } };
        }

        const sinceDate = new Date(Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [{ data: evalRows, error: evalErr }, { data: attRows, error: attErr }] = await Promise.all([
          callerClient
            .schema('academic')
            .from('evaluations')
            .select('child_id, understanding, participation, behavior, homework')
            .in('child_id', childIds)
            .gte('created_at', sinceDate),
          callerClient
            .schema('academic')
            .from('attendance_records')
            .select('child_id, present')
            .in('child_id', childIds)
            .gte('date', sinceDate),
        ]);
        if (evalErr) throw toAppError(evalErr);
        if (attErr) throw toAppError(attErr);

        const metricsByChild = new Map<string, ChildMetrics>();
        for (const child of children) {
          const childEvals = (evalRows ?? []).filter((r) => r.child_id === child.id);
          const childAtt = (attRows ?? []).filter((r) => r.child_id === child.id);
          const homeworkDone = childEvals.filter((r) => r.homework === 'done').length;
          const presentCount = childAtt.filter((r) => r.present).length;
          metricsByChild.set(child.id, {
            evaluationCount: childEvals.length,
            averageUnderstanding: average(childEvals.map((r) => r.understanding as number)),
            averageParticipation: average(childEvals.map((r) => r.participation as number)),
            averageBehavior: average(childEvals.map((r) => r.behavior as number)),
            homeworkDoneRatio: childEvals.length > 0 ? Math.round((homeworkDone / childEvals.length) * 100) / 100 : null,
            attendanceRecordCount: childAtt.length,
            attendanceRate: childAtt.length > 0 ? Math.round((presentCount / childAtt.length) * 100) / 100 : null,
          });
        }

        const draftPayload = await mapWithConcurrency(children, LLM_CONCURRENCY, async (child) => {
          const metrics = metricsByChild.get(child.id)!;
          let reportBody: string;
          try {
            const llmResult = await draftReportWithLLM({ childName: child.name, type, topic, metrics: metrics as unknown as Record<string, unknown> });
            reportBody = llmResult.body;
          } catch (err) {
            console.error(`LLM draft-report call failed for child ${child.id}, falling back to deterministic template:`, err);
            reportBody = buildFallbackReportBody(child.name, type, topic, metrics);
          }
          return { childId: child.id, body: reportBody, metrics };
        });

        // Fix for EPIC_8_REVIEW.md H2 — one atomic RPC call instead of a
        // separate batch-insert + draft-insert.
        const { data: batchResult, error: batchErr } = await admin.schema('reports').rpc('create_ai_report_batch', {
          p_tenant_id: caller.tenantId,
          p_caller_id: caller.userId,
          p_caller_role: caller.role,
          p_type: type,
          p_scope: scope,
          p_classroom_id: classroomId,
          p_topic: topic,
          p_child_ids: childIds,
          p_drafts: draftPayload,
        });
        if (batchErr) throw toAppError(batchErr);
        return { status: 201, body: batchResult as { batchId: string; mode: 'sync' } };
      },
    );

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
