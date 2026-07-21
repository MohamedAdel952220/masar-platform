import { getSupabaseClient } from '../client';
import { parseBackendError } from '../errors';
import type { RpcArgs, RpcName, RpcReturns } from '../types/helpers';

/**
 * WRITES — RPC only (FRONTEND_ARCHITECTURE.md §5.2).
 *
 * Every mutation goes through a SECURITY DEFINER RPC; the frontend never writes
 * to a table directly, even where RLS would permit it.
 *
 * `callRpc` is generic over the generated function catalogue, so *every*
 * deployed RPC is strongly typed — arguments and return value both — without a
 * single hand-written signature.
 */
/**
 * Argument tuple for an RPC. Zero-argument functions generate `Args: never` in
 * the catalogue, so they are called as `callRpc('current_role')` with no second
 * parameter. The tuple wrapper stops the conditional distributing over `never`.
 */
export type RpcArgsTuple<K extends RpcName> = [RpcArgs<K>] extends [never] ? [] : [args: RpcArgs<K>];

export async function callRpc<K extends RpcName>(name: K, ...rest: RpcArgsTuple<K>): Promise<RpcReturns<K>> {
  return callRpcWithArgs(name, rest[0] ?? {});
}

/**
 * Invoke an RPC when the argument object is only known at runtime — used by the
 * generic mutation hooks, where `K` is still an unresolved type parameter and
 * the variadic tuple above cannot be satisfied structurally. Callers reaching
 * for this must already have a typed `RpcArgs<K>` value in hand; the return
 * type stays exact.
 */
export async function callRpcWithArgs<K extends RpcName>(name: K, args: unknown): Promise<RpcReturns<K>> {
  const { data, error } = await getSupabaseClient().rpc(name, args as never);
  if (error) throw parseBackendError(error);
  return data as RpcReturns<K>;
}

/**
 * RPCs that do NOT accept an idempotency key on the deployed backend
 * (BACKEND_CERTIFICATION.md §7.1). Treated as NON-RETRYABLE: never auto-retried,
 * and callers must disable the submit control on dispatch. The two
 * manual-payment RPCs are the material risk — a double-submit records a
 * duplicate payment against a child's ledger.
 */
export const NON_IDEMPOTENT_RPCS = [
  'mark_installment_paid_manual',
  'mark_ledger_item_paid_manual',
  'confirm_handover',
  'update_child_trip_status',
  'withdraw_child',
  'escalate_conversation',
  'advance_tenant_provisioning',
] as const satisfies readonly RpcName[];
export type NonIdempotentRpc = (typeof NON_IDEMPOTENT_RPCS)[number];

export function isNonIdempotentRpc(name: RpcName): name is NonIdempotentRpc {
  return (NON_IDEMPOTENT_RPCS as readonly string[]).includes(name);
}

/**
 * RPCs the frontend must NEVER call, even though PostgREST grants
 * `authenticated` EXECUTE on them. These are internal primitives: exposing them
 * to a client would let it forge audit entries, poison the idempotency ledger,
 * or bypass the composed RPCs that own their invariants. RLS still protects the
 * data, but offering these as client affordances would be an anti-pattern.
 */
export const CLIENT_FORBIDDEN_RPCS = [
  'write_audit_log',
  'idempotency_replay',
  'idempotency_store',
  'create_bus_with_driver_row',
  'enroll_child_row',
  'payment_transactions_support_view',
] as const satisfies readonly RpcName[];
export type ClientForbiddenRpc = (typeof CLIENT_FORBIDDEN_RPCS)[number];

export function isClientForbiddenRpc(name: RpcName): name is ClientForbiddenRpc {
  return (CLIENT_FORBIDDEN_RPCS as readonly string[]).includes(name);
}

/** Generates the client-side idempotency key carried by mutating RPCs (§25.6). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for older WebViews in the Capacitor shells.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
