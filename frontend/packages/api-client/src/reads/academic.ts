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
 * Typed read builders for the `academic` schema.
 *
 * Every relation is reachable through PostgREST and governed by RLS — the
 * database decides which rows return. Row types derive from the generated
 * Database type, so nothing here restates a backend contract.
 *
 * View(s): v_child_attendance_summary.
 * These are access-controlled analytics surfaces. The underlying analytics.*
 * materialized views are NOT exposed and carry no client grant; each view
 * applies its own fail-closed predicate server-side.
 */

export const ACADEMIC_RELATIONS = [
  'attendance_records',
  'child_guardian_links',
  'children',
  'classrooms',
  'concerns',
  'day_path_events',
  'evaluations',
  'lessons',
  'subjects',
  'v_child_attendance_summary',
] as const;

export type AcademicRelation = (typeof ACADEMIC_RELATIONS)[number];
export type AcademicRow<R extends AcademicRelation> = Row<'academic', R>;

const db = () => getSupabaseClient().schema('academic');

export interface AcademicListOptions<R extends AcademicRelation> extends KeysetOptions {
  /** Column to order and paginate by. Must be unique + monotonic. */
  orderBy?: keyof AcademicRow<R> & string;
}

export const academic = {
  /**
   * Schema-scoped client for bespoke queries (embeds, filters, aggregates).
   * Natively typed by supabase-js: `academic.raw().from('...').select(...)`.
   */
  raw: () => db(),

  /** Keyset-paginated list (§14.3 — cursor-based, never offset). */
  async list<R extends AcademicRelation>(
    name: R,
    options: AcademicListOptions<R> = {},
  ): Promise<Page<AcademicRow<R>>> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const ascending = options.ascending ?? false;
    let query = db()
      .from(name as never)
      .select('*')
      .limit(limit) as unknown as PostgrestLike<AcademicRow<R>>;
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending });
      if (options.cursor) {
        query = ascending
          ? query.gt(options.orderBy, options.cursor)
          : query.lt(options.orderBy, options.cursor);
      }
    }
    const rows = await unwrap<AcademicRow<R>[]>(query);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    const nextCursor = last && options.orderBy ? String(last[options.orderBy] ?? '') || null : null;
    return { items: rows, nextCursor };
  },

  /** Single row matched on a typed column. Returns null when RLS hides it. */
  async one<R extends AcademicRelation>(
    name: R,
    column: keyof AcademicRow<R> & string,
    value: string | number | boolean,
  ): Promise<AcademicRow<R> | null> {
    const query = db()
      .from(name as never)
      .select('*')
      .eq(column, value)
      .maybeSingle() as unknown as PromiseLike<{ data: AcademicRow<R> | null; error: unknown }>;
    return unwrapMaybe<AcademicRow<R>>(query);
  },

  /** Exact row count, honouring RLS. */
  async count<R extends AcademicRelation>(name: R): Promise<number> {
    const result = (await db()
      .from(name as never)
      .select('*', { count: 'exact', head: true })) as unknown as { count: number | null; error: unknown };
    if (result.error) throw result.error;
    return result.count ?? 0;
  },
} as const;
