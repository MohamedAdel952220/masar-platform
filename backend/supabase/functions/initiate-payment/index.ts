// initiate-payment — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §14.1, §14.2, §20; BACKEND_EXECUTION_PLAN.md Epic 6 §7-8
// Caller: guardian, own child only.
//
// An Edge Function (not an RPC) because it calls an external service (the
// payment gateway/PSP, §14.1's own "Use an Edge Function when... the
// operation needs to call an external service" rule) — stubbed via
// _shared/paymentGateway.ts (see that file's header for why).
//
// billing.payment_transactions has no direct guardian-facing RLS INSERT
// policy (migration 4) — this Edge Function's DB write goes through the
// service_role admin client, exactly like every other Edge Function that
// performs a correctness-critical write a bare RLS grant would let a
// client forge (EPIC_5_REVIEW.md H2's lesson: a guardian must never be
// able to simply INSERT a row claiming status='succeeded').
//
// Scope decision (documented, not left implicit): every payment in Epic 6
// targets an existing billing.invoices row — BACKEND_ARCHITECTURE.md
// §14.2's conceptual initiate_payment(child_id, invoice_id | ledger_items[],
// method) signature allows targeting bare ledger_items[] with no invoice at
// all; this Epic requires invoiceId so the ledger-reconciliation seam
// (billing.settle_payment_transaction, migration 5) has exactly one,
// well-defined settlement path. See EPIC_6_COMPLETION_REPORT.md's
// Architectural Decisions for the full reasoning.
//
// Fix for EPIC_6_REVIEW.md H1: an invoice can now have at most one
// in-flight (initiated/pending_verification) payment_transactions row at
// all — enforced at the DB layer by
// payment_transactions_one_inflight_per_invoice (migration 3). This
// function checks for an existing in-flight row FIRST and returns it
// instead of calling the gateway/creating a duplicate, so the common
// "double-tap" case gets a clean, idempotent response rather than a raw
// constraint-violation error.
//
// Fix for EPIC_6_REVIEW.md H2: the guardian's actual uploaded receipt path
// is now verified to exist in storage before a pending_verification row is
// created, and is persisted (receipt_file_path) so a manager reviewing the
// payment later can actually retrieve it — previously the filename was
// validated for presence and then discarded, leaving the receipt
// permanently unreviewable.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole, requireSameTenant } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { withIdempotency, readIdempotencyKey } from '../_shared/idempotency.ts';
import { createPaymentIntent, generateFawryCode } from '../_shared/paymentGateway.ts';

type PaymentMethod = 'bank_transfer' | 'instapay' | 'wallet' | 'fawry';
const MANUAL_METHODS: PaymentMethod[] = ['bank_transfer', 'fawry'];

interface InitiatePaymentBody {
  childId: string;
  invoiceId: string;
  method: PaymentMethod;
  // Required for bank_transfer only — the filename of a receipt the
  // guardian already uploaded to payment-receipts/{tenantId}/{guardianId}/
  // (migration 7's own guardian-write policy) before calling this function.
  receiptFileName?: string;
}

function validate(body: Partial<InitiatePaymentBody>): InitiatePaymentBody {
  const errors: string[] = [];
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body.childId || !uuidRe.test(body.childId)) errors.push('childId must be a valid UUID');
  if (!body.invoiceId || !uuidRe.test(body.invoiceId)) errors.push('invoiceId must be a valid UUID');
  if (!body.method || !['bank_transfer', 'instapay', 'wallet', 'fawry'].includes(body.method)) errors.push('method must be one of bank_transfer, instapay, wallet, fawry');
  if (body.method === 'bank_transfer' && (!body.receiptFileName || !body.receiptFileName.trim())) errors.push('receiptFileName is required for bank_transfer');

  if (errors.length) throw new AppError('VALIDATION_FAILED', errors.join('; '), 'تحقق من صحة البيانات المدخلة.');
  return body as InitiatePaymentBody;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    requireRole(caller, ['guardian']);
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'Your account is not scoped to a tenant.', 'حسابك غير مرتبط بمؤسسة.');
    }

    const body = validate(await req.json());
    const admin = supabaseAdmin();
    const idempotencyKey = readIdempotencyKey(req);

    const result = await withIdempotency(
      admin,
      { key: idempotencyKey, tenantId: caller.tenantId, callerId: caller.userId, rpcName: 'initiate-payment' },
      () => runInitiatePayment(admin, body, caller),
    );

    return new Response(JSON.stringify(result), { status: 201, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});

async function runInitiatePayment(admin: ReturnType<typeof supabaseAdmin>, body: InitiatePaymentBody, caller: Awaited<ReturnType<typeof requireCaller>>) {
  // Re-verify ownership server-side (§14.3) — never trust the client's own
  // assertion that this child is theirs.
  const { data: link } = await admin
    .schema('academic')
    .from('child_guardian_links')
    .select('child_id')
    .eq('child_id', body.childId)
    .eq('guardian_id', caller.userId)
    .maybeSingle();
  if (!link) {
    throw new AppError('PERM_ROLE_DENIED', 'This is not your child.', 'هذا ليس طفلك.');
  }

  const { data: invoice, error: invoiceErr } = await admin
    .schema('billing')
    .from('invoices')
    .select('id, tenant_id, child_id, total, status')
    .eq('id', body.invoiceId)
    .maybeSingle();
  if (invoiceErr) throw invoiceErr;
  if (!invoice || invoice.child_id !== body.childId) {
    throw new AppError('NOT_FOUND', 'Invoice not found.', 'لم يتم العثور على الفاتورة.');
  }
  requireSameTenant(caller, invoice.tenant_id as string);
  if (invoice.status !== 'unpaid') {
    throw new AppError('STATE_ALREADY_PROCESSED', 'This invoice is not awaiting payment.', 'هذه الفاتورة ليست بانتظار الدفع.');
  }

  // Fix for EPIC_6_REVIEW.md H1: return the existing in-flight payment
  // instead of creating a duplicate — the common "double-tap"/retry case.
  // payment_transactions_one_inflight_per_invoice (migration 3) is the
  // authoritative backstop for any case this check doesn't catch (e.g. a
  // genuine race between two near-simultaneous requests).
  const { data: existingInFlight, error: existingErr } = await admin
    .schema('billing')
    .from('payment_transactions')
    .select('*')
    .eq('invoice_id', invoice.id)
    .in('status', ['initiated', 'pending_verification'])
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existingInFlight) {
    return { paymentTransaction: existingInFlight, redirectUrl: null, fawryReferenceCode: null };
  }

  const amount = invoice.total as number;
  const isManual = MANUAL_METHODS.includes(body.method);

  let providerReference: string;
  let redirectUrl: string | null = null;
  let receiptObjectId: string | null = null;
  let receiptFilePath: string | null = null;
  let fawryReferenceCode: string | null = null;

  // Fix for EPIC_6_REVIEW.md H2: verify the guardian actually uploaded this
  // file before ever creating a pending_verification row for it —
  // previously receiptFileName was validated for presence only, never
  // checked against storage. Deliberately OUTSIDE the gateway try/catch
  // below — this is a validation failure, not a provider-call failure, and
  // must surface as VALIDATION_FAILED, not get relabeled
  // EXTERNAL_PAYMENT_GATEWAY_FAILURE.
  let folderPath = '';
  if (body.method === 'bank_transfer') {
    folderPath = `${invoice.tenant_id}/${caller.userId}`;
    const { data: listing, error: listErr } = await admin.storage.from('payment-receipts').list(folderPath, {
      search: body.receiptFileName,
    });
    if (listErr) throw listErr;
    const uploaded = listing?.some((f) => f.name === body.receiptFileName);
    if (!uploaded) {
      throw new AppError(
        'VALIDATION_FAILED',
        'The receipt file could not be found — please upload it before initiating payment.',
        'لم يتم العثور على ملف الإيصال — برجاء رفعه قبل بدء الدفع.',
      );
    }
  }

  try {
    if (body.method === 'bank_transfer') {
      providerReference = `bank-transfer-${crypto.randomUUID()}`;
      // pdf_object_id-style placeholder (migration 3's own comment on this
      // pattern) — media.storage_objects doesn't exist until Epic 7, so
      // there is no row to create for the already-uploaded receipt.
      // receiptFilePath (below) is the real, persisted, reviewable path —
      // this placeholder id exists only for eventual Epic 7 FK continuity.
      receiptObjectId = crypto.randomUUID();
      receiptFilePath = `payment-receipts/${folderPath}/${body.receiptFileName}`;
    } else if (body.method === 'fawry') {
      const fawry = await generateFawryCode({ amount, childId: body.childId, tenantId: invoice.tenant_id as string });
      providerReference = fawry.providerReference;
      fawryReferenceCode = fawry.referenceCode;
    } else {
      const intent = await createPaymentIntent({ amount, method: body.method, childId: body.childId, tenantId: invoice.tenant_id as string });
      providerReference = intent.providerReference;
      redirectUrl = intent.redirectUrl;
    }
  } catch (err) {
    console.error('Payment gateway call failed:', err);
    throw new AppError('EXTERNAL_PAYMENT_GATEWAY_FAILURE', 'Failed to initiate payment with the provider.', 'فشل بدء الدفع مع مزوّد الخدمة.');
  }

  const { data: payment, error: paymentErr } = await admin
    .schema('billing')
    .from('payment_transactions')
    .insert({
      tenant_id: invoice.tenant_id,
      child_id: body.childId,
      invoice_id: invoice.id,
      method: body.method,
      amount,
      // §20: manual methods reach pending_verification as part of THIS
      // same compound action ("guardian submits + uploads receipt... or
      // generates a Fawry reference code -> pending_verification");
      // gateway methods stay at initiated until the webhook fires.
      status: isManual ? 'pending_verification' : 'initiated',
      provider_reference: providerReference,
      receipt_object_id: receiptObjectId,
      receipt_file_path: receiptFilePath,
    })
    .select('*')
    .single();
  if (paymentErr) throw paymentErr;

  return {
    paymentTransaction: payment,
    redirectUrl,
    fawryReferenceCode,
  };
}
