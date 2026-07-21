/**
 * Typed wrappers for every deployed RPC.
 *
 * Coverage of the 63 functions in the generated `public` catalogue:
 *   42 client-facing mutating RPCs  → the domain modules below
 *   15 session/RLS helper RPCs      → ./session
 *    6 internal primitives          → deliberately NOT wrapped, see
 *                                     CLIENT_FORBIDDEN_RPCS in ./core
 *
 * `callRpc` remains generic over the full catalogue, so anything not given a
 * named wrapper is still reachable and still fully typed.
 */
export {
  callRpc,
  callRpcWithArgs,
  newIdempotencyKey,
  isNonIdempotentRpc,
  isClientForbiddenRpc,
  NON_IDEMPOTENT_RPCS,
  CLIENT_FORBIDDEN_RPCS,
  type NonIdempotentRpc,
  type ClientForbiddenRpc,
} from './core';

export * as provisioningRpc from './provisioning';
export * as academicRpc from './academic';
export * as transportRpc from './transport';
export * as safetyRpc from './safety';
export * as commsRpc from './comms';
export * as approvalsRpc from './approvals';
export * as billingRpc from './billing';
export * as mediaRpc from './media';
export * as reportsRpc from './reports';
export * as platformRpc from './platform';
export * as sessionRpc from './session';
