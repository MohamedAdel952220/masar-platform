// InvoiceService — testable core behind generate_invoice/invoice reads/void
// (§14.2).
import { AppError } from '../lib/errors.js';
import type { InvoiceRepository } from '../repositories/invoiceRepository.js';
import type { CallerContext } from '../types/domain.js';
import type { Invoice, InvoiceLine } from '../types/domain.epic6.js';
import type { GenerateInvoiceInput } from '../validation/billing.schema.js';

export class InvoiceService {
  constructor(private readonly invoices: InvoiceRepository) {}

  async listForChild(childId: string, caller: CallerContext): Promise<Invoice[]> {
    if (caller.role !== 'guardian' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view these invoices.', 'غير مصرح لك بعرض هذه الفواتير.');
    }
    return this.invoices.listForChild(childId);
  }

  async listLines(invoiceId: string, caller: CallerContext): Promise<InvoiceLine[]> {
    if (caller.role !== 'guardian' && caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'You are not authorized to view this invoice.', 'غير مصرح لك بعرض هذه الفاتورة.');
    }
    return this.invoices.listLines(invoiceId);
  }

  async generate(input: GenerateInvoiceInput, caller: CallerContext): Promise<Invoice> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can generate an invoice.', 'فقط المدير يمكنه إصدار فاتورة.');
    }
    return this.invoices.generate(input);
  }

  async void(invoiceId: string, caller: CallerContext): Promise<Invoice> {
    if (caller.role !== 'manager') {
      throw new AppError('PERM_ROLE_DENIED', 'Only a manager can void an invoice.', 'فقط المدير يمكنه إلغاء الفاتورة.');
    }
    return this.invoices.void(invoiceId);
  }
}
