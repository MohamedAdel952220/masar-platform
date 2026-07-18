// ai-polish-note — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §14.2, §19; BACKEND_EXECUTION_PLAN.md Epic 8 §7
// Caller: teacher (evaluations are teacher-authored, §12's own "Evaluations/
// Lessons | ... | CRU (own classroom) [Teacher] | ... | R [Manager]" row —
// manager never writes an evaluation's note directly, so has no need for
// this action either).
//
// An Edge Function (not an RPC) because it calls an external service (the
// LLM provider, stubbed via _shared/llmProvider.ts), matching §14.1's "use
// an Edge Function when the operation needs to call an external service"
// rule, exactly like Epic 6's initiate-payment and Epic 7's
// camera-stream-token.
//
// This function does NOT write to academic.evaluations at all — it is a
// pure "raw text in, polished text out" transformation (plus the usage-cap
// side effect); persisting the polished note back onto a specific
// evaluation row happens through the existing, frozen Epic 2
// evaluations_update_teacher RLS UPDATE policy the Dashboard/Teacher App
// already uses for editing any other evaluation field, which this Epic
// neither needs nor is permitted to modify.
//
// §19 Acceptance Criteria: "LLM provider failure/timeout falls back to the
// deterministic template without failing the user's request" — the
// try/catch below is that fallback; a failed LLM call never surfaces as an
// error to the caller, it silently degrades to buildFallbackPolishedNote.
//
// Fix for EPIC_8_REVIEW.md H1: the usage-cap increment + LLM call (or
// fallback) is now wrapped in withIdempotency (_shared/idempotency.ts), the
// same shared mechanism initiate-payment/enroll-child/ai-draft-report use —
// a retry with the same x-idempotency-key header replays the original
// {polishedText, usedFallback} response instead of double-charging the
// tenant's daily AI-call cap.
//
// Fix for EPIC_8_REVIEW.md M4: a successful call now writes an audit-log
// entry (action=note_polished) — previously neither AI Edge Function
// recorded who requested AI-generated content, unlike every comparable
// mutating Edge Function elsewhere in this codebase (e.g. add-staff's
// added_staff entry). p_target_id is null: this function is a stateless
// text transform with no specific evaluations row to target (see the
// header comment above on why no DB write happens here at all).
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { toAppError } from '../_shared/rpcError.ts';
import { withIdempotency, readIdempotencyKey } from '../_shared/idempotency.ts';
import { polishNoteWithLLM } from '../_shared/llmProvider.ts';

interface Body {
  rawText: string;
}

const MAX_RAW_TEXT_LENGTH = 5000;

// Deterministic, non-LLM fallback (§19) — a safe, minimal transformation
// (trim, capitalize, ensure terminal punctuation) rather than returning the
// raw text completely unchanged, so the caller can always tell "polishing
// happened" is at least structurally true even in fallback mode.
export function buildFallbackPolishedNote(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return trimmed;
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    requireRole(caller, ['teacher']);
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'Your account is not scoped to a tenant.', 'حسابك غير مرتبط بمؤسسة.');
    }

    const body = (await req.json()) as Partial<Body>;
    if (!body.rawText || !body.rawText.trim()) {
      throw new AppError('VALIDATION_FAILED', 'rawText is required', 'rawText مطلوب');
    }
    if (body.rawText.length > MAX_RAW_TEXT_LENGTH) {
      throw new AppError('VALIDATION_FAILED', `rawText must be at most ${MAX_RAW_TEXT_LENGTH} characters`, `يجب ألا يتجاوز rawText ${MAX_RAW_TEXT_LENGTH} حرفًا`);
    }

    const admin = supabaseAdmin();

    const result = await withIdempotency(
      admin,
      { key: readIdempotencyKey(req), tenantId: caller.tenantId, callerId: caller.userId, rpcName: 'ai-polish-note' },
      async () => {
        // §3.20.1/§19: atomic cap-check-and-increment, shared with
        // ai-draft-report — the single committed mechanism, not duplicated
        // per-function logic.
        const { error: usageErr } = await admin.schema('reports').rpc('increment_ai_usage', { p_tenant_id: caller.tenantId });
        if (usageErr) throw toAppError(usageErr);

        let polishedText: string;
        let usedFallback = false;
        try {
          const llmResult = await polishNoteWithLLM(body.rawText as string);
          polishedText = llmResult.polishedText;
        } catch (err) {
          console.error('LLM polish-note call failed, falling back to deterministic template:', err);
          polishedText = buildFallbackPolishedNote(body.rawText as string);
          usedFallback = true;
        }

        const { error: auditErr } = await admin.rpc('write_audit_log', {
          p_tenant_id: caller.tenantId,
          p_actor_type: 'staff',
          p_actor_id: caller.userId,
          p_action: 'note_polished',
          p_target_type: 'reports',
          p_target_id: null,
        });
        if (auditErr) {
          console.error('write_audit_log failed for note_polished (non-fatal — the note was already polished):', auditErr);
        }

        return { polishedText, usedFallback };
      },
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
