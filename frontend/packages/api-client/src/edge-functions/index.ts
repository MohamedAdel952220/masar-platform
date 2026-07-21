import { getSupabaseClient } from '../client';
import { parseBackendError } from '../errors';
import type { Database } from '../types/database.generated';

/**
 * EDGE FUNCTIONS — external boundaries (FRONTEND_ARCHITECTURE.md §5.3).
 *
 * All 19 deployed functions are enumerated and typed. Unlike RPCs, Edge
 * Function payloads are not part of the database catalogue, so their contracts
 * are declared here — but every payload field that corresponds to a database
 * value is *derived* from the generated types rather than restated, so schema
 * drift still surfaces as a compile error.
 */

type Tenancy = Database['tenancy'];
type Identity = Database['identity'];
type Academic = Database['academic'];
type Billing = Database['billing'];

export const EDGE_FUNCTIONS = [
  // Provisioning
  'provision-tenant',
  'enroll-child',
  'add-staff',
  'add-bus',
  // Account lifecycle
  'suspend-staff-account',
  'reactivate-staff-account',
  'revoke-sessions',
  'regenerate-activation-link',
  // Service accounts
  'issue-service-account-key',
  'revoke-service-account-key',
  // Media
  'camera-heartbeat',
  'camera-stream-token',
  // Billing
  'initiate-payment',
  'payment-webhook',
  'generate-invoice-pdf',
  'resend-invoice',
  // Comms
  'notification-dispatch',
  // AI
  'ai-draft-report',
  'ai-polish-note',
] as const;

export type EdgeFunctionName = (typeof EDGE_FUNCTIONS)[number];

/** Request/response contracts, keyed by function name. */
export interface EdgeFunctionContracts {
  'provision-tenant': {
    request: {
      name: string;
      slug: string;
      planCode: string;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
    };
    response: { tenant: Tenancy['Tables']['tenants']['Row'] };
  };
  'enroll-child': {
    request: { child: Academic['Tables']['children']['Insert']; guardian: { name: string; phone: string } };
    response: { child: Academic['Tables']['children']['Row']; guardianActivationSent: boolean };
  };
  'add-staff': {
    request: { staff: Identity['Tables']['staff_profiles']['Insert']; role: Identity['Enums']['staff_role'] };
    response: { staff: Identity['Tables']['staff_profiles']['Row']; activationSent: boolean };
  };
  'add-bus': {
    request: { plateNumber: string; capacity: number; driver: { name: string; phone: string } };
    response: { busId: string; driverActivationSent: boolean };
  };
  'suspend-staff-account': {
    request: { staffId: string; reason: string };
    response: { staffId: string; sessionsRevoked: number };
  };
  'reactivate-staff-account': {
    request: { staffId: string };
    response: { staffId: string };
  };
  'revoke-sessions': {
    request: { userId: string };
    response: { userId: string; revoked: boolean };
  };
  'regenerate-activation-link': {
    request: { userId: string };
    response: { sent: boolean };
  };
  'issue-service-account-key': {
    request: { tenantId: string; purpose: string; scopes: string[] };
    /** The API key is returned exactly once and never re-displayed (§10.7). */
    response: { serviceAccountId: string; apiKey: string };
  };
  'revoke-service-account-key': {
    request: { serviceAccountId: string };
    response: { serviceAccountId: string; revoked: boolean };
  };
  'camera-heartbeat': {
    /** Machine-identity path (service-account API key), not a human session. */
    request: { cameraId: string };
    response: { ok: boolean };
  };
  'camera-stream-token': {
    request: { cameraId: string };
    /** Short-lived token for the external media relay — not a Supabase URL. */
    response: { token: string; relayUrl: string; expiresAt: string };
  };
  'initiate-payment': {
    request: {
      childId: string;
      method: Billing['Enums']['payment_method'];
      invoiceId?: string;
      ledgerItemIds?: string[];
    };
    response: { paymentIntentId: string; redirectUrl: string | null };
  };
  'payment-webhook': {
    /** Called by the PSP server-side; never invoked from a client. */
    request: Record<string, never>;
    response: { received: boolean };
  };
  'generate-invoice-pdf': {
    request: { invoiceId: string };
    response: { objectPath: string };
  };
  'resend-invoice': {
    request: { invoiceId: string; channel: 'whatsapp' | 'email' | 'sms' };
    response: { sent: boolean };
  };
  'notification-dispatch': {
    /** Scheduled/queue-driven dispatcher; not a client affordance. */
    request: { batchSize?: number };
    response: { dispatched: number };
  };
  'ai-draft-report': {
    request: { scope: 'child' | 'classroom'; scopeId: string; reportType: string; topic?: string };
    response: { batchId: string; queued: number };
  };
  'ai-polish-note': {
    request: { rawText: string };
    response: { polishedText: string };
  };
}

export type EdgeFunctionRequest<K extends EdgeFunctionName> = EdgeFunctionContracts[K]['request'];
export type EdgeFunctionResponse<K extends EdgeFunctionName> = EdgeFunctionContracts[K]['response'];

/**
 * Edge Functions the frontend must never invoke directly.
 *  - payment-webhook: PSP → server only; a client call would be a forged
 *    payment notification attempt.
 *  - camera-heartbeat: authenticated by a service-account API key (§10.7,
 *    §13.7), not by a human session.
 *  - notification-dispatch: queue drainer, invoked by schedule/service role.
 */
export const CLIENT_FORBIDDEN_EDGE_FUNCTIONS = [
  'payment-webhook',
  'camera-heartbeat',
  'notification-dispatch',
] as const satisfies readonly EdgeFunctionName[];
export type ClientForbiddenEdgeFunction = (typeof CLIENT_FORBIDDEN_EDGE_FUNCTIONS)[number];

export function isClientForbiddenEdgeFunction(name: EdgeFunctionName): name is ClientForbiddenEdgeFunction {
  return (CLIENT_FORBIDDEN_EDGE_FUNCTIONS as readonly string[]).includes(name);
}

/** Invokes a deployed Edge Function with a typed request and response. */
export async function invokeEdgeFunction<K extends EdgeFunctionName>(
  name: K,
  body: EdgeFunctionRequest<K>,
): Promise<EdgeFunctionResponse<K>> {
  const { data, error } = await getSupabaseClient().functions.invoke(name, { body });
  if (error) throw parseBackendError(error);
  return data as EdgeFunctionResponse<K>;
}
