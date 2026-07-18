// resend-invoice — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §14.2; BACKEND_EXECUTION_PLAN.md Epic 6 §7
// Caller: manager, own tenant only.
//
// §14.2 describes resend_invoice as "RPC + Edge dispatch" — the dispatch
// half (re-notifying the child's guardians) is genuinely an Edge Function
// concern per §14.1 (it composes a fresh comms.enqueue_notification-style
// write, which is service_role-only, plus is the natural home for a future
// "also re-send via WhatsApp/email directly" extension); no separate
// resend_invoice RPC exists because BACKEND_EXECUTION_PLAN.md Epic 6 §8's
// own "RPC Functions Required" list does not name one — only this Edge
// Function is required (§7). This mirrors submit_request/broadcast_
// announcement's own notification fan-out shape (Epic 4/5) but as an Edge
// Function since no new DB row needs creating, only a fresh notification.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole, requireSameTenant } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

interface ResendInvoiceBody {
  invoiceId: string;
  channel?: 'in_app' | 'whatsapp' | 'sms' | 'email';
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    requireRole(caller, ['manager']);
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'Your account is not scoped to a tenant.', 'حسابك غير مرتبط بمؤسسة.');
    }

    const body = (await req.json()) as Partial<ResendInvoiceBody>;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!body.invoiceId || !uuidRe.test(body.invoiceId)) {
      throw new AppError('VALIDATION_FAILED', 'invoiceId must be a valid UUID.', 'يجب أن يكون invoiceId معرّفًا صالحًا.');
    }

    const admin = supabaseAdmin();

    const { data: invoice, error: invoiceErr } = await admin
      .schema('billing')
      .from('invoices')
      .select('id, tenant_id, child_id, invoice_number, total, status')
      .eq('id', body.invoiceId)
      .maybeSingle();
    if (invoiceErr) throw invoiceErr;
    if (!invoice) throw new AppError('NOT_FOUND', 'Invoice not found.', 'لم يتم العثور على الفاتورة.');
    requireSameTenant(caller, invoice.tenant_id as string);

    const { data: links, error: linksErr } = await admin
      .schema('academic')
      .from('child_guardian_links')
      .select('guardian_id')
      .eq('child_id', invoice.child_id as string);
    if (linksErr) throw linksErr;

    let notified = 0;
    for (const link of links ?? []) {
      const { error: notifyErr } = await admin.schema('comms').rpc('enqueue_notification', {
        p_tenant_id: invoice.tenant_id,
        p_recipient_type: 'guardian',
        p_recipient_id: link.guardian_id,
        p_category: 'billing',
        p_title: `Invoice ${invoice.invoice_number}`,
        p_body: `A copy of your invoice for ${invoice.total} has been resent.`,
        p_deep_link: `app://payments/invoices/${invoice.id}`,
      });
      if (notifyErr) {
        console.error(`resend-invoice: enqueue_notification failed for guardian ${link.guardian_id} (non-fatal, continuing):`, notifyErr);
        continue;
      }
      notified += 1;
    }

    return new Response(JSON.stringify({ invoiceId: invoice.id, notified }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
