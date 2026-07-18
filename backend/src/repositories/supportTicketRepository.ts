// SupportTicketRepository — platform.support_tickets (§3.52). Creation and
// every status/assignment change route through migration 4's RPCs
// (create_support_ticket, update_support_ticket) — no direct RLS INSERT/
// UPDATE exists for anyone (migration 3), so this repository has no create/
// update method that touches the table directly.
import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { SupportTicketRow } from '../types/database.types.epic9.js';
import { supportTicketFromRow, type SupportTicket } from '../types/domain.epic9.js';
import type { CreateSupportTicketInput, UpdateSupportTicketInput } from '../validation/platformOps.schema.js';
import { toAppError } from '../lib/rpcError.js';

const DEFAULT_PAGE_SIZE = 200;

export class SupportTicketRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async list(filters: { status?: string } = {}, opts: { limit?: number; offset?: number } = {}): Promise<SupportTicket[]> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    let query = this.client
      .schema('platform')
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as SupportTicketRow[]).map(supportTicketFromRow);
  }

  async findById(ticketId: string): Promise<SupportTicket | null> {
    const { data, error } = await this.client.schema('platform').from('support_tickets').select('*').eq('id', ticketId).maybeSingle();
    if (error) throw toAppError(error);
    return data ? supportTicketFromRow(data as SupportTicketRow) : null;
  }

  async create(input: CreateSupportTicketInput): Promise<SupportTicket> {
    const { data, error } = await this.client.rpc('create_support_ticket', {
      p_subject: input.subject,
      p_body: input.body,
      p_category: input.category,
      p_severity: input.severity,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return supportTicketFromRow(data as SupportTicketRow);
  }

  async update(input: UpdateSupportTicketInput): Promise<SupportTicket> {
    const { data, error } = await this.client.rpc('update_support_ticket', {
      p_ticket_id: input.ticketId,
      p_status: input.status ?? null,
      p_assigned_to: input.assignedTo ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) throw toAppError(error);
    return supportTicketFromRow(data as SupportTicketRow);
  }
}
