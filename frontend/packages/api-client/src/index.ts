/**
 * @masar/api-client — the ONLY module that talks to the backend.
 *
 * Contract source of truth: `types/database.generated.ts`, produced from the
 * live deployed database. Read builders, RPC wrappers, realtime channels, and
 * query hooks all derive their types from it, so no backend contract is
 * duplicated anywhere in the frontend.
 */

// Client + environment
export { getSupabaseClient, resetSupabaseClient, type MasarClient } from './client';
export { getEnv, resetEnvCache, type MasarEnv } from './env';

// Errors
export { AppError, parseBackendError, type AppErrorCode, type AppErrorInit } from './errors';

// Types
export type { Database, Json } from './types/database.generated';
export * from './types/helpers';
export * from './types/database';
export * from './types/domain';

// Query keys
export { queryKeys, type QueryKeys } from './queryKeys';

// Reads (13 exposed schemas)
export * from './reads';

// Writes (RPC)
export * from './rpc';

// Edge Functions
export {
  invokeEdgeFunction,
  isClientForbiddenEdgeFunction,
  EDGE_FUNCTIONS,
  CLIENT_FORBIDDEN_EDGE_FUNCTIONS,
  type EdgeFunctionName,
  type EdgeFunctionContracts,
  type EdgeFunctionRequest,
  type EdgeFunctionResponse,
  type ClientForbiddenEdgeFunction,
} from './edge-functions';

// Realtime
export {
  realtime,
  channelNames,
  unsubscribeAllChannels,
  type ChangeEvent,
  type ChangePayload,
  type Realtime,
} from './realtime';

// Storage (read-only — see §16)
export { createSignedUrl, BUCKETS, SIGNED_URL_TTL, type BucketName } from './storage';

// Providers + hooks
export { QueryProvider, createQueryClient, STALE_TIMES } from './providers/QueryProvider';
export * from './hooks';
