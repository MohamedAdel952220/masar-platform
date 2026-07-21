import { parseBackendError } from '../errors';

/**
 * READS — PostgREST + RLS (FRONTEND_ARCHITECTURE.md §5.1).
 *
 * Rules enforced across every schema module in this directory:
 *  - Only the 13 exposed schemas are reachable. `analytics` is not exposed;
 *    its aggregates come from the three access-controlled views only.
 *  - RLS is the authorization boundary. A read never sends tenant_id as a
 *    *security* filter — the database applies it.
 *  - Pagination is keyset/cursor-based, never offset (§14.3).
 */

/** Page size default for every list builder. */
export const DEFAULT_PAGE_SIZE = 50;

/** Keyset pagination options (§14.3 — cursor-based, never offset). */
export interface KeysetOptions {
  /** Page size. @default 50 */
  limit?: number;
  /** Ordering-column value from the last row of the previous page. */
  cursor?: string | undefined;
  /** @default false (newest-first is the common case) */
  ascending?: boolean;
}

/** A page of rows plus the cursor that fetches the next one. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * The narrow slice of the PostgREST builder the list helpers use. Declaring it
 * structurally keeps supabase-js's deep generic types from leaking into every
 * schema module's signature while preserving row typing at the boundary.
 */
export interface PostgrestLike<TRow> extends PromiseLike<{ data: TRow[] | null; error: unknown }> {
  order(column: string, options: { ascending: boolean }): PostgrestLike<TRow>;
  gt(column: string, value: string): PostgrestLike<TRow>;
  lt(column: string, value: string): PostgrestLike<TRow>;
}

/** Unwraps a PostgREST result, normalising any error to AppError. */
export async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw parseBackendError(error);
  return data as T;
}

/** Unwraps a maybe-single result (null when no row is visible under RLS). */
export async function unwrapMaybe<T>(
  promise: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T | null> {
  const { data, error } = await promise;
  if (error) throw parseBackendError(error);
  return data;
}
