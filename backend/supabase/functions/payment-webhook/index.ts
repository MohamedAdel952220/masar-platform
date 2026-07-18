// payment-webhook — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §14.1, §20; BACKEND_EXECUTION_PLAN.md Epic 6 §7-8
// Caller: the payment gateway/PSP itself — a PUBLIC endpoint (no Supabase
// JWT; PSPs never carry one), matching §20's own description exactly:
// "payment_webhook_handler — Edge Function, public endpoint with signature
// verification, called by the payment provider". `verify_jwt = false` for
// this function specifically (supabase/config.toml's [functions.payment-webhook]
// section) — every other Edge Function in this codebase keeps the platform
// default (JWT required); this is the one deliberate, documented exception.
//
// Idempotent by construction on two independent axes: (1) provider_reference
// is unique where non-null (migration 3, §20) so a duplicate webhook
// delivery for an event this endpoint has never seen before cannot create a
// second payment_transactions row (there never is one to create here — see
// below); (2) billing.settle_payment_transaction's own atomic
// UPDATE...WHERE status guard (migration 5) makes a duplicate delivery for
// an ALREADY-settled transaction a safe no-op. This is the Acceptance
// Criteria's "a duplicate webhook delivery never double-credits a ledger"
// requirement, satisfied without this function needing any idempotency-key
// machinery of its own.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { verifyWebhookSignature } from '../_shared/paymentGateway.ts';

interface WebhookBody {
  providerReference: string;
  status: 'succeeded' | 'failed';
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const rawBody = await req.text();
    if (!verifyWebhookSignature(req, rawBody)) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid webhook signature.', 'توقيع غير صالح لهذا الإشعار.');
    }

    let body: Partial<WebhookBody>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new AppError('VALIDATION_FAILED', 'Invalid JSON body.', 'محتوى JSON غير صالح.');
    }
    if (!body.providerReference || !body.status || !['succeeded', 'failed'].includes(body.status)) {
      throw new AppError('VALIDATION_FAILED', 'providerReference and a valid status are required.', 'يلزم providerReference وحالة صالحة.');
    }

    const admin = supabaseAdmin();

    const { data: existing, error: lookupErr } = await admin
      .schema('billing')
      .from('payment_transactions')
      .select('id')
      .eq('provider_reference', body.providerReference)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    if (!existing) {
      // Unknown reference — log for investigation but still ack with 200 so
      // the PSP stops retrying an event we will never be able to act on
      // (matches §25.4's "provider error details are logged server-side...
      // never passed through raw" posture, applied to the inbound side).
      console.error('payment-webhook: unknown provider_reference', body.providerReference);
      return new Response(JSON.stringify({ acknowledged: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const { error: settleErr } = await admin
      .schema('billing')
      .rpc('settle_payment_transaction', {
        p_payment_transaction_id: existing.id,
        p_new_status: body.status,
        p_actor_staff_id: null,
      });
    if (settleErr) throw settleErr;

    return new Response(JSON.stringify({ acknowledged: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
