import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { BillingLedgerItemRow, InstallmentScheduleEntryRow } from '../types/database.types.epic6.js';
import {
  billingLedgerItemFromRow,
  installmentScheduleEntryFromRow,
  type BillingLedgerItem,
  type InstallmentScheduleEntry,
} from '../types/domain.epic6.js';
import type { MarkInstallmentPaidManualInput, MarkLedgerItemPaidManualInput } from '../validation/billing.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class BillingLedgerRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listForChild(childId: string): Promise<BillingLedgerItem[]> {
    const { data, error } = await this.client
      .schema('billing')
      .from('billing_ledger_items')
      .select('*')
      .eq('child_id', childId)
      .order('due_date', { ascending: false });
    if (error) throw toAppError(error);
    return (data as BillingLedgerItemRow[]).map(billingLedgerItemFromRow);
  }

  async listInstallmentEntriesForChild(childId: string): Promise<InstallmentScheduleEntry[]> {
    const { data, error } = await this.client
      .schema('billing')
      .from('installment_schedule_entries')
      .select('*, installment_plans!inner(child_id)')
      .eq('installment_plans.child_id', childId)
      .order('due_date', { ascending: true });
    if (error) throw toAppError(error);
    return (data as InstallmentScheduleEntryRow[]).map(installmentScheduleEntryFromRow);
  }

  // Wraps public.mark_installment_paid_manual (§14.2, migration 5) — for
  // in-person/cash payments with no payment_transactions row (§20).
  async markInstallmentPaidManual(input: MarkInstallmentPaidManualInput): Promise<InstallmentScheduleEntry> {
    const { data, error } = await this.client.rpc('mark_installment_paid_manual', {
      p_installment_entry_id: input.installmentEntryId,
      p_note: input.note ?? null,
    });
    if (error) throw toAppError(error);
    return installmentScheduleEntryFromRow(data as InstallmentScheduleEntryRow);
  }

  // Wraps public.mark_ledger_item_paid_manual (§14.2, migration 5) — the
  // single ledger-side analog of markInstallmentPaidManual, added for
  // EPIC_6_REVIEW.md M2 so a manager's manual "paid" transition always goes
  // through an audited, notification-emitting RPC instead of a bare RLS
  // UPDATE.
  async markLedgerItemPaidManual(input: MarkLedgerItemPaidManualInput): Promise<BillingLedgerItem> {
    const { data, error } = await this.client.rpc('mark_ledger_item_paid_manual', {
      p_ledger_item_id: input.ledgerItemId,
      p_note: input.note ?? null,
    });
    if (error) throw toAppError(error);
    return billingLedgerItemFromRow(data as BillingLedgerItemRow);
  }
}
