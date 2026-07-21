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
 * Typed read builders for the `reports` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 */

export const REPORTS_RELATIONS = ['ai_report_batches', 'ai_report_drafts', 'ai_usage_counters'] as const;

export type ReportsRelation = (typeof REPORTS_RELATIONS)[number];
export type ReportsRow<R extends ReportsRelation> = Row<'reports', R>;

const db = () => getSupabaseClient().schema('reports');

export interface ReportsListOptions<R extends ReportsRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof ReportsRow<R> & string;
}

export const reports = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `reports.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends ReportsRelation>(
    name: R,
    options: ReportsListOptions<R> = {},
  ): Promise<Page<ReportsRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<ReportsRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<ReportsRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends ReportsRelation>(
    name: R,
    column: keyof ReportsRow<R> & string,
    value: string | number | boolean,
  ): Promise<ReportsRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: ReportsRow<R> | null; error: unknown }>;
    return unwrapMaybe<ReportsRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends ReportsRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
