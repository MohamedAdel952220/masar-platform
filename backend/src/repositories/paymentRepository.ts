import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { PaymentTransactionRow } from '../types/database.types.epic6.js';
import { paymentTransactionFromRow, type PaymentTransaction } from '../types/domain.epic6.js';
import type { VerifyPaymentInput, RefundPaymentInput } from '../validation/billing.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class PaymentRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Creation goes through the initiate-payment Edge Function (service_role
  // client) — no direct RLS INSERT policy exists on payment_transactions
  // (migration 4, EPIC_5_REVIEW.md H2's lesson), so this repository has no
  // create() method; the API layer calls the Edge Function directly.

  async listForChild(childId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await this.client
      .schema('billing')
      .from('payment_transactions')
      .select('*')
      .eq('child_id', childId)
      .order('initiated_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as PaymentTransactionRow[]).map(paymentTransactionFromRow);
  }

  async listForTenant(tenantId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await this.client
      .schema('billing')
      .from('payment_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('initiated_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as PaymentTransactionRow[]).map(paymentTransactionFromRow);
  }

  // Wraps public.verify_payment (§14.2, migration 5) — manual methods only.
  async verify(input: VerifyPaymentInput): Promise<PaymentTransaction> {
    const { data, error } = await this.client.rpc('verify_payment', {
      p_payment_transaction_id: input.paymentTransactionId,
      p_decision: input.decision,
      p_note: input.note ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return paymentTransactionFromRow(data as PaymentTransactionRow);
  }

  // Wraps public.refund_payment (§14.2, migration 5).
  async refund(input: RefundPaymentInput): Promise<PaymentTransaction> {
    const { data, error } = await this.client.rpc('refund_payment', {
      p_payment_transaction_id: input.paymentTransactionId,
      p_reason: input.reason ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return paymentTransactionFromRow(data as PaymentTransactionRow);
  }
}
