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
 * Typed read builders for the `jobs` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 */

export const JOBS_RELATIONS = ['background_job_queue', 'idempotency_keys', 'scheduled_job_runs'] as const;

export type JobsRelation = (typeof JOBS_RELATIONS)[number];
export type JobsRow<R extends JobsRelation> = Row<'jobs', R>;

const db = () => getSupabaseClient().schema('jobs');

export interface JobsListOptions<R extends JobsRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof JobsRow<R> & string;
}

export const jobs = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `jobs.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends JobsRelation>(name: R, options: JobsListOptions<R> = {}): Promise<Page<JobsRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<JobsRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<JobsRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends JobsRelation>(
    name: R,
    column: keyof JobsRow<R> & string,
    value: string | number | boolean,
  ): Promise<JobsRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: JobsRow<R> | null; error: unknown }>;
    return unwrapMaybe<JobsRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends JobsRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
