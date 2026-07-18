// generate-invoice-pdf — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §14.1, §26; BACKEND_EXECUTION_PLAN.md Epic 6 §7, §11
//
// Background job processor for job_type='invoice_pdf_generation'
// (enqueued by billing.enqueue_invoice_pdf_job, migration 6, on every
// billing.invoices INSERT). Same shape as notification-dispatch/index.ts
// (Epic 4): service-role-only auth, atomic batch claim via
// jobs.claim_background_jobs (reused directly, not duplicated — this
// function is the second, generic consumer that RPC's own p_job_type
// parameter was designed for from the start, EPIC_4_REVIEW.md C2's fix).
// Invoked by a scheduled poller or manually by an operator — actual pg_cron
// registration is out of scope for this sandboxed delivery, same
// "staged structurally, not registered" precedent as notification-dispatch
// itself (EPIC_4_COMPLETION_REPORT.md).
//
// PDF rendering is STUBBED (no PDF library is available in this sandboxed
// delivery — same explicit, documented limitation class as Epic 4's
// notification provider stubs): a small placeholder text blob is uploaded
// to the generated-documents bucket at a deterministic path
// ({tenantId}/invoices/{invoiceId}.pdf, §21's own path convention), and
// invoices.pdf_object_id is set to a generated placeholder uuid (the same
// pattern initiate-payment/index.ts uses for receipt_object_id — see that
// file's comment for the full "no media.storage_objects table yet"
// rationale, Epic 7).
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

const BATCH_SIZE = 20;

interface JobRow {
  id: string;
  payload: { invoiceId?: string };
  attempts: number;
  max_attempts: number;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
      throw new AppError('AUTH_MISSING_TOKEN', 'This function is service-role only.', 'هذه الوظيفة مخصصة لدور الخدمة فقط.');
    }

    const admin = supabaseAdmin();

    const { data: jobs, error: claimErr } = await admin
      .schema('jobs')
      .rpc('claim_background_jobs', { p_job_type: 'invoice_pdf_generation', p_batch_size: BATCH_SIZE });
    if (claimErr) throw claimErr;

    const claimedJobs = (jobs ?? []) as JobRow[];
    const { succeeded, failed } = await processBatch(admin, claimedJobs);

    return new Response(
      JSON.stringify({ processed: claimedJobs.length, succeeded, failed }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});

async function processBatch(admin: ReturnType<typeof supabaseAdmin>, jobs: JobRow[]): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const invoiceId = job.payload?.invoiceId;
    try {
      if (!invoiceId) throw new Error('job payload missing invoiceId');

      const { data: invoice, error: invoiceErr } = await admin
        .schema('billing')
        .from('invoices')
        .select('id, tenant_id, invoice_number, total, issued_at')
        .eq('id', invoiceId)
        .maybeSingle();
      if (invoiceErr) throw invoiceErr;
      if (!invoice) throw new Error(`invoice ${invoiceId} not found`);

      const { data: lines, error: linesErr } = await admin
        .schema('billing')
        .from('invoice_lines')
        .select('description, amount')
        .eq('invoice_id', invoiceId);
      if (linesErr) throw linesErr;

      const placeholderPdf = renderPlaceholderPdf(invoice, lines ?? []);
      const objectPath = `${invoice.tenant_id}/invoices/${invoice.id}.pdf`;

      const { error: uploadErr } = await admin.storage
        .from('generated-documents')
        .upload(objectPath, placeholderPdf, { contentType: 'application/pdf', upsert: true });
      if (uploadErr) throw uploadErr;

      const pdfObjectId = crypto.randomUUID();
      const { error: updateErr } = await admin
        .schema('billing')
        .from('invoices')
        .update({ pdf_object_id: pdfObjectId })
        .eq('id', invoiceId);
      if (updateErr) throw updateErr;

      await admin.schema('jobs').from('background_job_queue').update({ status: 'succeeded', completed_at: new Date().toISOString() }).eq('id', job.id);
      succeeded += 1;
    } catch (err) {
      const attempts = job.attempts + 1;
      const isExhausted = attempts >= job.max_attempts;
      await admin
        .schema('jobs')
        .from('background_job_queue')
        .update({
          status: isExhausted ? 'failed' : 'queued',
          attempts,
          last_error: err instanceof Error ? err.message : String(err),
          next_attempt_at: new Date(Date.now() + Math.min(30_000 * 2 ** attempts, 30 * 60_000)).toISOString(),
        })
        .eq('id', job.id);
      failed += 1;
      console.error(`generate-invoice-pdf job ${job.id} failed (attempt ${attempts}):`, err);
    }
  }

  return { succeeded, failed };
}

function renderPlaceholderPdf(
  invoice: { invoice_number: string; total: number; issued_at: string },
  lines: Array<{ description: string; amount: number }>,
): Uint8Array {
  // Not a real PDF renderer (no PDF library in this sandbox) — a plain-text
  // placeholder with a .pdf content-type, purely so the storage/DB plumbing
  // (bucket upload, pdf_object_id linkage, generated-documents' existing
  // read policy) is fully exercised end-to-end. Swap this function's body
  // for a real PDF library call when one is available; no caller changes.
  const lineText = lines.map((l) => `  ${l.description}: ${l.amount}`).join('\n');
  const text = `INVOICE ${invoice.invoice_number}\nIssued: ${invoice.issued_at}\nTotal: ${invoice.total}\n\nLines:\n${lineText}\n`;
  return new TextEncoder().encode(text);
}
