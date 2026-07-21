import { getSupabaseClient } from '../client';
import type { Row } from '../types/helpers';
import {
  DEFAULT_PAGE_SIZE,
  unwrap,
  unwrapMaybe,
  type KeysetOptions,
  type Page,
  type PostgrestLike,
} from './factory';

/**
 * Typed read builders for the `billing` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 */

export const BILLING_RELATIONS = [
  'billing_ledger_items',
  'fee_item_applicability',
  'fee_items',
  'installment_plans',
  'installment_schedule_entries',
  'invoice_lines',
  'invoice_number_counters',
  'invoices',
  'payment_transactions',
] as const;

export type BillingRelation = (typeof BILLING_RELATIONS)[number];
export type BillingRow<R extends BillingRelation> = Row<'billing', R>;

const db = () => getSupabaseClient().schema('billing');

export interface BillingListOptions<R extends BillingRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof BillingRow<R> & string;
}

export const billing = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `billing.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends BillingRelation>(
    name: R,
    options: BillingListOptions<R> = {},
  ): Promise<Page<BillingRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<BillingRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<BillingRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends BillingRelation>(
    name: R,
    column: keyof BillingRow<R> & string,
    value: string | number | boolean,
  ): Promise<BillingRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: BillingRow<R> | null; error: unknown }>;
    return unwrapMaybe<BillingRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends BillingRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
