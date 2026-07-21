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
 * Typed read builders for the `transport` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 */

export const TRANSPORT_RELATIONS = [
  'bus_riders',
  'buses',
  'gps_pings',
  'trip_child_status',
  'trip_stop_riders',
  'trip_stops',
  'trips',
] as const;

export type TransportRelation = (typeof TRANSPORT_RELATIONS)[number];
export type TransportRow<R extends TransportRelation> = Row<'transport', R>;

const db = () => getSupabaseClient().schema('transport');

export interface TransportListOptions<R extends TransportRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof TransportRow<R> & string;
}

export const transport = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `transport.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends TransportRelation>(
    name: R,
    options: TransportListOptions<R> = {},
  ): Promise<Page<TransportRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<TransportRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<TransportRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends TransportRelation>(
    name: R,
    column: keyof TransportRow<R> & string,
    value: string | number | boolean,
  ): Promise<TransportRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: TransportRow<R> | null; error: unknown }>;
    return unwrapMaybe<TransportRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends TransportRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
