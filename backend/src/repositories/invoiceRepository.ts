import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { InvoiceRow, InvoiceLineRow } from '../types/database.types.epic6.js';
import { invoiceFromRow, invoiceLineFromRow, type Invoice, type InvoiceLine } from '../types/domain.epic6.js';
import type { GenerateInvoiceInput } from '../validation/billing.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class InvoiceRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listForChild(childId: string): Promise<Invoice[]> {
    const { data, error } = await this.client
      .schema('billing')
      .from('invoices')
      .select('*')
      .eq('child_id', childId)
      .order('issued_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as InvoiceRow[]).map(invoiceFromRow);
  }

  async listLines(invoiceId: string): Promise<InvoiceLine[]> {
    const { data, error } = await this.client
      .schema('billing')
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId);
    if (error) throw toAppError(error);
    return (data as InvoiceLineRow[]).map(invoiceLineFromRow);
  }

  // Wraps public.generate_invoice (§14.2, migration 5) — idempotency-key
  // supported (a retry must not create a second invoice and burn a second
  // sequential invoice_number).
  async generate(input: GenerateInvoiceInput): Promise<Invoice> {
    const { data, error } = await this.client.rpc('generate_invoice', {
      p_child_id: input.childId,
      p_items: input.items.map((item) => ({
        description: item.description,
        feeItemId: item.feeItemId ?? null,
        ledgerItemId: item.ledgerItemId ?? null,
        installmentEntryId: item.installmentEntryId ?? null,
        amount: item.amount,
      })),
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return invoiceFromRow(data as InvoiceRow);
  }

  // Direct table update under RLS (invoices_update_manager_void, migration
  // 4) — the one narrow, non-cascading transition granted without a
  // bespoke RPC.
  async void(invoiceId: string): Promise<Invoice> {
    const { data, error } = await this.client
      .schema('billing')
      .from('invoices')
      .update({ status: 'void' })
      .eq('id', invoiceId)
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return invoiceFromRow(data as InvoiceRow);
  }
}
