// Epic 6 domain (camelCase) types + row<->domain mappers.
import type {
  FeeItemRow,
  BillingLedgerItemRow,
  InstallmentPlanRow,
  InstallmentScheduleEntryRow,
  InvoiceRow,
  InvoiceLineRow,
  PaymentTransactionRow,
  FeeCycle,
  FeeScope,
  BillingStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from './database.types.epic6.js';

export interface FeeItem {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string | null;
  icon: string | null;
  cycle: FeeCycle;
  scope: FeeScope;
  required: boolean;
  price: number;
  active: boolean;
}

export function feeItemFromRow(row: FeeItemRow): FeeItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    nameAr: row.name_ar,
    icon: row.icon,
    cycle: row.cycle,
    scope: row.scope,
    required: row.required,
    price: Number(row.price),
    active: row.active,
  };
}

export interface BillingLedgerItem {
  id: string;
  tenantId: string;
  childId: string;
  feeItemId: string;
  periodLabel: string;
  amountDue: number;
  amountPaid: number;
  status: BillingStatus;
  dueDate: string;
}

export function billingLedgerItemFromRow(row: BillingLedgerItemRow): BillingLedgerItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    childId: row.child_id,
    feeItemId: row.fee_item_id,
    periodLabel: row.period_label,
    amountDue: Number(row.amount_due),
    amountPaid: Number(row.amount_paid),
    status: row.status,
    dueDate: row.due_date,
  };
}

export interface InstallmentPlan {
  id: string;
  tenantId: string;
  childId: string;
  feeItemId: string;
  label: string;
  installmentCount: number;
}

export function installmentPlanFromRow(row: InstallmentPlanRow): InstallmentPlan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    childId: row.child_id,
    feeItemId: row.fee_item_id,
    label: row.label,
    installmentCount: row.installment_count,
  };
}

export interface InstallmentScheduleEntry {
  id: string;
  planId: string;
  tenantId: string;
  sequence: number;
  label: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidAt: string | null;
  status: BillingStatus;
}

export function installmentScheduleEntryFromRow(row: InstallmentScheduleEntryRow): InstallmentScheduleEntry {
  return {
    id: row.id,
    planId: row.plan_id,
    tenantId: row.tenant_id,
    sequence: row.sequence,
    label: row.label,
    amount: Number(row.amount),
    dueDate: row.due_date,
    paid: row.paid,
    paidAt: row.paid_at,
    status: row.status,
  };
}

export interface Invoice {
  id: string;
  tenantId: string;
  childId: string;
  invoiceNumber: string;
  issuedAt: string;
  total: number;
  status: InvoiceStatus;
  pdfObjectId: string | null;
}

export function invoiceFromRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    childId: row.child_id,
    invoiceNumber: row.invoice_number,
    issuedAt: row.issued_at,
    total: Number(row.total),
    status: row.status,
    pdfObjectId: row.pdf_object_id,
  };
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  tenantId: string;
  description: string;
  feeItemId: string | null;
  ledgerItemId: string | null;
  installmentEntryId: string | null;
  amount: number;
}

export function invoiceLineFromRow(row: InvoiceLineRow): InvoiceLine {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    tenantId: row.tenant_id,
    description: row.description,
    feeItemId: row.fee_item_id,
    ledgerItemId: row.ledger_item_id,
    installmentEntryId: row.installment_entry_id,
    amount: Number(row.amount),
  };
}

export interface PaymentTransaction {
  id: string;
  tenantId: string;
  childId: string;
  invoiceId: string | null;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  providerReference: string | null;
  receiptObjectId: string | null;
  receiptFilePath: string | null;
  initiatedAt: string;
  settledAt: string | null;
}

export function paymentTransactionFromRow(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    childId: row.child_id,
    invoiceId: row.invoice_id,
    method: row.method,
    amount: Number(row.amount),
    status: row.status,
    providerReference: row.provider_reference,
    receiptObjectId: row.receipt_object_id,
    receiptFilePath: row.receipt_file_path,
    initiatedAt: row.initiated_at,
    settledAt: row.settled_at,
  };
}
