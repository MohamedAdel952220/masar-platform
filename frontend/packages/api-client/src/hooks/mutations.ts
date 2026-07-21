import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { type AppError } from '../errors';
import { callRpcWithArgs, isNonIdempotentRpc, newIdempotencyKey } from '../rpc/core';
import type { RpcArgs, RpcName, RpcReturns } from '../types/helpers';

/**
 * Mutation hooks (FRONTEND_ARCHITECTURE.md §12).
 *
 * Two hard rules are enforced here rather than left to each call site:
 *
 * 1. Mutations are NEVER auto-retried. Seven deployed RPCs accept no
 *    idempotency key (BACKEND_CERTIFICATION.md §7.1), and two of those record
 *    financial entries — a retry could duplicate a payment.
 *
 * 2. Optimistic updates are permitted ONLY where the server outcome is
 *    deterministic. Anything with server-side branching (payments, approvals,
 *    refunds, state machines) waits for the authoritative response.
 */

export interface RpcMutationOptions<K extends RpcName> {
  /** Query keys to invalidate after a successful call. */
  invalidate?: readonly unknown[][];
  /** Adds a generated idempotency key. Ignored for RPCs that accept none. */
  idempotent?: boolean;
  onSuccess?: (data: RpcReturns<K>) => void;
  onError?: (error: AppError) => void;
}

/**
 * Typed mutation for any deployed RPC.
 *
 * When `idempotent` is set and the RPC accepts `p_idempotency_key`, a key is
 * generated once per mutation instance and reused across a manual retry of the
 * same logical action — which is what makes a retry safe.
 */
export function useRpcMutation<K extends RpcName>(
  name: K,
  options: RpcMutationOptions<K> = {},
): UseMutationResult<RpcReturns<K>, AppError, RpcArgs<K>> {
  const queryClient = useQueryClient();
  const nonIdempotent = isNonIdempotentRpc(name);

  return useMutation<RpcReturns<K>, AppError, RpcArgs<K>>({
    mutationKey: [name],
    // Never auto-retry a mutation — see rule 1 above.
    retry: false,
    mutationFn: async (args: RpcArgs<K>) => {
      const payload =
        options.idempotent && !nonIdempotent
          ? ({ ...(args as object), p_idempotency_key: newIdempotencyKey() } as RpcArgs<K>)
          : args;
      return callRpcWithArgs<K>(name, payload);
    },
    onSuccess: (data) => {
      for (const key of options.invalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      options.onSuccess?.(data);
    },
    onError: (error) => {
      options.onError?.(error);
    },
  });
}

/**
 * Whether a given RPC may be retried by the UI after a failure.
 *
 * `false` means the submit control must stay disabled and the user must be
 * directed to refresh and verify before re-attempting — the frontend mitigation
 * for the seven non-idempotent RPCs.
 */
export function isRetryableRpc(name: RpcName): boolean {
  return !isNonIdempotentRpc(name);
}

/**
 * The only mutations the architecture permits to update optimistically: pure
 * toggles whose server result is fully determined by the request.
 *
 * Deliberately excluded: everything in billing and approvals, every state
 * machine transition, and every non-idempotent RPC.
 */
export const OPTIMISTIC_SAFE_RPCS = [
  'register_device_token',
  'update_notification_preferences',
] as const satisfies readonly RpcName[];
export type OptimisticSafeRpc = (typeof OPTIMISTIC_SAFE_RPCS)[number];

export function isOptimisticSafe(name: RpcName): name is OptimisticSafeRpc {
  return (OPTIMISTIC_SAFE_RPCS as readonly string[]).includes(name);
}

export interface OptimisticOptions<TCache> {
  /** Cache key to update ahead of the server response. */
  queryKey: readonly unknown[];
  /** Produces the next cache value from the previous one. */
  update: (previous: TCache | undefined) => TCache;
}

/**
 * Optimistic mutation, restricted at the type level to the safe list above.
 * Rolls the cache back on error and always revalidates on settle, so the server
 * remains the source of truth.
 */
export function useOptimisticRpcMutation<K extends OptimisticSafeRpc, TCache>(
  name: K,
  optimistic: OptimisticOptions<TCache>,
): UseMutationResult<RpcReturns<K>, AppError, RpcArgs<K>, { previous: TCache | undefined }> {
  const queryClient = useQueryClient();

  return useMutation<RpcReturns<K>, AppError, RpcArgs<K>, { previous: TCache | undefined }>({
    mutationKey: [name],
    retry: false,
    mutationFn: (args: RpcArgs<K>) => callRpcWithArgs<K>(name, args),
    onMutate: async (_args) => {
      await queryClient.cancelQueries({ queryKey: optimistic.queryKey });
      const previous = queryClient.getQueryData<TCache>(optimistic.queryKey);
      queryClient.setQueryData<TCache>(optimistic.queryKey, optimistic.update(previous));
      return { previous };
    },
    onError: (_error, _args, context) => {
      if (context) queryClient.setQueryData<TCache>(optimistic.queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: optimistic.queryKey });
    },
  });
}
