// Epic 6 snake_case row types, kept separate from database.types(.epicN).ts
// for the same reason those files are separate: repositories are the only
// place that ever sees a raw DB row shape.

export type FeeCycle = 'monthly' | 'per_term' | 'once_per_year' | 'one_time';
export type FeeScope = 'all' | 'optional';
export type BillingStatus = 'unbilled' | 'due' | 'partially_paid' | 'paid' | 'overdue';
export type InvoiceStatus = 'unpaid' | 'paid' | 'void';
export type PaymentMethod = 'bank_transfer' | 'instapay' | 'wallet' | 'fawry';
export type PaymentStatus = 'initiated' | 'pending_verification' | 'succeeded' | 'failed' | 'refunded';

export interface FeeItemRow {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  icon: string | null;
  cycle: FeeCycle;
  scope: FeeScope;
  required: boolean;
  price: number;
  active: boolean;
}

export interface BillingLedgerItemRow {
  id: string;
  tenant_id: string;
  child_id: string;
  fee_item_id: string;
  period_label: string;
  amount_due: number;
  amount_paid: number;
  status: BillingStatus;
  due_date: string;
}

export interface InstallmentPlanRow {
  id: string;
  tenant_id: string;
  child_id: string;
  fee_item_id: string;
  label: string;
  installment_count: number;
}

export interface InstallmentScheduleEntryRow {
  id: string;
  plan_id: string;
  tenant_id: string;
  sequence: number;
  label: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
  status: BillingStatus;
}

export interface InvoiceRow {
  id: string;
  tenant_id: string;
  child_id: string;
  invoice_number: string;
  issued_at: string;
  total: number;
  status: InvoiceStatus;
  pdf_object_id: string | null;
}

export interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  tenant_id: string;
  description: string;
  fee_item_id: string | null;
  // Fix for EPIC_6_REVIEW.md C1: the explicit obligation this line pays
  // down, when one is referenced — see billing.settle_payment_transaction's
  // migration 5 comment for the full before/after reasoning.
  ledger_item_id: string | null;
  installment_entry_id: string | null;
  amount: number;
}

export interface PaymentTransactionRow {
  id: string;
  tenant_id: string;
  child_id: string;
  invoice_id: string | null;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  provider_reference: string | null;
  receipt_object_id: string | null;
  // Fix for EPIC_6_REVIEW.md H2: the real, reviewable storage path for a
  // bank-transfer receipt upload.
  receipt_file_path: string | null;
  initiated_at: string;
  settled_at: string | null;
}
