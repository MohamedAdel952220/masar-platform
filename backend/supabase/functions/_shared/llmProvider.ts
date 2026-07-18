// LLM provider port. STUBBED in Epic 8 by the same explicit pattern Epic 1
// used for _shared/activation.ts, Epic 4 used for
// _shared/notificationProviders.ts, Epic 6 used for
// _shared/paymentGateway.ts, and Epic 7 used for _shared/mediaRelay.ts
// (BACKEND_EXECUTION_PLAN.md Epic 8 §13: "LLM provider — API key
// provisioning, fallback-template behavior verified before this Epic is
// considered done" — not achievable in this sandboxed delivery, and
// provider selection is explicitly a vendor decision outside this
// document's scope).
//
// polishNoteWithLLM/draftReportWithLLM are the only two functions that need
// to change when a real LLM vendor is wired up — every caller
// (ai-polish-note/index.ts, ai-draft-report/index.ts) is already written
// against these signatures, and both callers already implement their own
// try/catch-to-deterministic-template fallback (§19: "LLM provider
// failure/timeout falls back to the deterministic template without failing
// the user's request") — the fallback itself is the CALLER's
// responsibility, not this port's, so the fallback logic is identical
// whether this stub or a real vendor throws.
//
// LLM_PROVIDER_SIMULATE_FAILURE=true (an Edge Function secret) makes this
// stub throw unconditionally — the supported, documented way to exercise
// the fallback-template path in a staging/test environment without a real
// provider outage (§20's own "LLM provider simulated outage" test
// scenario).
export interface PolishNoteResult {
  polishedText: string;
}

export interface DraftReportContext {
  childName: string;
  type: string;
  topic: string | null;
  metrics: Record<string, unknown>;
}

export interface DraftReportResult {
  body: string;
}

function simulateFailureIfConfigured(label: string): void {
  if (Deno.env.get('LLM_PROVIDER_SIMULATE_FAILURE') === 'true') {
    throw new Error(`Simulated LLM provider outage (${label})`);
  }
}

export async function polishNoteWithLLM(rawText: string): Promise<PolishNoteResult> {
  simulateFailureIfConfigured('polish-note');
  console.info('[llm-provider:polish-note:stub]', { length: rawText.length });
  const trimmed = rawText.trim();
  const polished = trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
  return { polishedText: polished.endsWith('.') || polished.length === 0 ? polished : `${polished}.` };
}

export async function draftReportWithLLM(context: DraftReportContext): Promise<DraftReportResult> {
  simulateFailureIfConfigured('draft-report');
  console.info('[llm-provider:draft-report:stub]', { childName: context.childName, type: context.type });
  const topicLine = context.topic ? ` on "${context.topic}"` : '';
  return {
    body: `${context.childName}'s ${context.type.replace(/_/g, ' ')} report${topicLine}: based on recent classroom activity, ${context.childName} is progressing well. See the attached metrics for a detailed breakdown.`,
  };
}
