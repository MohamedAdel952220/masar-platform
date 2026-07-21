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
 * Typed read builders for the `comms` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 */

export const COMMS_RELATIONS = [
  'announcement_recipients',
  'announcements',
  'conversations',
  'device_tokens',
  'messages',
  'notification_deliveries',
  'notification_preferences',
  'notifications',
] as const;

export type CommsRelation = (typeof COMMS_RELATIONS)[number];
export type CommsRow<R extends CommsRelation> = Row<'comms', R>;

const db = () => getSupabaseClient().schema('comms');

export interface CommsListOptions<R extends CommsRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof CommsRow<R> & string;
}

export const comms = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `comms.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends CommsRelation>(
    name: R,
    options: CommsListOptions<R> = {},
  ): Promise<Page<CommsRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<CommsRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<CommsRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends CommsRelation>(
    name: R,
    column: keyof CommsRow<R> & string,
    value: string | number | boolean,
  ): Promise<CommsRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: CommsRow<R> | null; error: unknown }>;
    return unwrapMaybe<CommsRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends CommsRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
