import type { Database } from './database.generated';

/**
 * Type helpers over the generated Database. Everything the frontend knows about
 * backend shapes is derived from here — no row, enum, or signature is
 * hand-copied anywhere in this package.
 */

/**
 * Schema keys that actually describe a schema. The generated Database also
 * carries a `__InternalSupabase` metadata key, which is excluded structurally
 * (rather than by name) so a future metadata key cannot silently break this.
 */
export type SchemaName = {
  [K in keyof Database]: Database[K] extends { Tables: unknown; Views: unknown } ? K : never;
}[keyof Database] &
  string;

/** Table names within a schema. */
export type TableName<S extends SchemaName> = keyof Database[S]['Tables'] & string;

/** View names within a schema. */
export type ViewName<S extends SchemaName> = keyof Database[S]['Views'] & string;

/** Any readable relation (table or view) within a schema. */
export type RelationName<S extends SchemaName> = TableName<S> | ViewName<S>;

type TableRow<S extends SchemaName, R> =
  R extends TableName<S> ? (Database[S]['Tables'][R] extends { Row: infer T } ? T : never) : never;

type ViewRow<S extends SchemaName, R> =
  R extends ViewName<S> ? (Database[S]['Views'][R] extends { Row: infer T } ? T : never) : never;

/** Row type of any relation (table or view). */
export type Row<S extends SchemaName, R extends RelationName<S>> = TableRow<S, R> | ViewRow<S, R>;

/** Insert payload for a table. */
export type Insert<S extends SchemaName, R extends TableName<S>> = Database[S]['Tables'][R] extends {
  Insert: infer T;
}
  ? T
  : never;

/** Update payload for a table. */
export type Update<S extends SchemaName, R extends TableName<S>> = Database[S]['Tables'][R] extends {
  Update: infer T;
}
  ? T
  : never;

/** Enum values for a schema. */
export type Enums<S extends SchemaName, E extends keyof Database[S]['Enums']> = Database[S]['Enums'][E];

/** Every RPC deployed in the `public` schema. */
export type RpcName = keyof Database['public']['Functions'] & string;

export type RpcArgs<K extends RpcName> = Database['public']['Functions'][K] extends { Args: infer A }
  ? A
  : never;

export type RpcReturns<K extends RpcName> = Database['public']['Functions'][K] extends { Returns: infer R }
  ? R
  : never;
