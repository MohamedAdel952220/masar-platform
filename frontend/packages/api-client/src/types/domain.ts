/** Shared domain primitives used across the client. */

export type UUID = string;
/** ISO-8601 timestamp string as returned by PostgREST. */
export type Timestamp = string;
export type Locale = 'en' | 'ar';

/**
 * Standard list options accepted by read builders.
 * (The paged result envelope lives in `reads/factory` as `Page<T>`.)
 */
export interface ListOptions<TCursor = string> {
  limit?: number;
  cursor?: TCursor | undefined;
}
