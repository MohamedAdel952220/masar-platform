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
 * Typed read builders for the `safety` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 */

export const SAFETY_RELATIONS = ['pickup_passes', 'pickup_scan_events', 'pickup_scan_rate_limits'] as const;

export type SafetyRelation = (typeof SAFETY_RELATIONS)[number];
export type SafetyRow<R extends SafetyRelation> = Row<'safety', R>;

const db = () => getSupabaseClient().schema('safety');

export interface SafetyListOptions<R extends SafetyRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof SafetyRow<R> & string;
}

export const safety = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `safety.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends SafetyRelation>(
    name: R,
    options: SafetyListOptions<R> = {},
  ): Promise<Page<SafetyRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<SafetyRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<SafetyRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends SafetyRelation>(
    name: R,
    column: keyof SafetyRow<R> & string,
    value: string | number | boolean,
  ): Promise<SafetyRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: SafetyRow<R> | null; error: unknown }>;
    return unwrapMaybe<SafetyRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends SafetyRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
