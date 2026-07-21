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
 * Typed read builders for the `identity` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 */

export const IDENTITY_RELATIONS = [
  'driver_profiles',
  'guardian_profiles',
  'platform_admins',
  'service_accounts',
  'staff_feedback',
  'staff_leave_records',
  'staff_profiles',
  'staff_subjects',
] as const;

export type IdentityRelation = (typeof IDENTITY_RELATIONS)[number];
export type IdentityRow<R extends IdentityRelation> = Row<'identity', R>;

const db = () => getSupabaseClient().schema('identity');

export interface IdentityListOptions<R extends IdentityRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof IdentityRow<R> & string;
}

export const identity = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `identity.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends IdentityRelation>(
    name: R,
    options: IdentityListOptions<R> = {},
  ): Promise<Page<IdentityRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<IdentityRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<IdentityRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends IdentityRelation>(
    name: R,
    column: keyof IdentityRow<R> & string,
    value: string | number | boolean,
  ): Promise<IdentityRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: IdentityRow<R> | null; error: unknown }>;
    return unwrapMaybe<IdentityRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends IdentityRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
