// Payment gateway/PSP provider port. STUBBED in Epic 6 by the same explicit
// pattern Epic 1 used for _shared/activation.ts and Epic 4 used for
// _shared/notificationProviders.ts (BACKEND_EXECUTION_PLAN.md Epic 6 §13:
// "Payment gateway/PSP (contracting, sandbox, then production credentials —
// the other hard external-vendor gate in this plan)" — not achievable in
// this sandboxed delivery, and PSP selection is explicitly a vendor
// decision the architecture doc itself defers (§20: "PSP-agnostic").
//
// Each function is the ONLY place that needs to change when a real PSP is
// wired up — every caller (initiate-payment/index.ts, payment-webhook/
// index.ts) is already written against these signatures.

export interface PaymentIntentResult {
  providerReference: string;
  redirectUrl: string | null;
}

export interface FawryCodeResult {
  providerReference: string;
  referenceCode: string;
}

// Gateway-backed methods (instapay, wallet) — §20: "initiated -> PSP
// webhook -> succeeded/failed automatically". This call only ever produces
// the `initiated` half; the webhook (stubbed separately, via
// verifyWebhookSignature below, called by a human/test tool in this
// sandboxed delivery rather than a real PSP) produces the terminal state.
export async function createPaymentIntent(params: {
  amount: number;
  method: 'instapay' | 'wallet';
  childId: string;
  tenantId: string;
}): Promise<PaymentIntentResult> {
  console.info('[payment-gateway:create-intent:stub]', params);
  return {
    providerReference: `stub-intent-${crypto.randomUUID()}`,
    redirectUrl: null,
  };
}

// Manual method (fawry) — §20: "generates a Fawry reference code ->
// pending_verification". The guardian pays this code at a physical kiosk;
// Masar never observes that payment directly (reconciled manually by a
// Manager via verify_payment, same as bank_transfer).
export async function generateFawryCode(params: { amount: number; childId: string; tenantId: string }): Promise<FawryCodeResult> {
  console.info('[payment-gateway:fawry-code:stub]', params);
  const code = Math.floor(100000000 + Math.random() * 900000000).toString();
  return { providerReference: `stub-fawry-${crypto.randomUUID()}`, referenceCode: code };
}

// PSP webhook signature verification — real PSPs sign their webhook body
// with a shared secret (HMAC, typically). Stubbed to a simple shared-secret
// header check (PAYMENT_WEBHOOK_SECRET) so the structure (verify before
// trusting the body) is correct and payment-webhook/index.ts never needs to
// change when a real PSP's actual signature scheme is wired in — only this
// function's body does.
export function verifyWebhookSignature(req: Request, _rawBody: string): boolean {
  const expected = Deno.env.get('PAYMENT_WEBHOOK_SECRET');
  if (!expected) {
    // No secret configured in this environment — sandbox/dev mode, matches
    // Epic 4's provider stubs' own "always succeeds" posture. A production
    // deployment MUST set PAYMENT_WEBHOOK_SECRET before this endpoint is
    // exposed to a real PSP.
    return true;
  }
  return req.headers.get('x-webhook-secret') === expected;
}
