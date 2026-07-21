/**
 * `public` schema — RPC namespace only.
 *
 * It exposes no tables or views; every callable in it is an RPC (see ../rpc).
 * This module exists so the exposed-schema set stays exhaustive.
 */
export const PUBLIC_RELATIONS = [] as const;
export type PublicRelation = never;
