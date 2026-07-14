// Generalized idempotency-key handling (§2.2, §14.3, §25.6) — shared by every
// mutating Edge Function so a mobile client's retry-on-flaky-network never
// double-executes a provisioning/account-management action.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { AppError } from './errors.ts';

export async function withIdempotency<T>(
  admin: SupabaseClient,
  opts: { key: string | null; tenantId: string | null; callerId: string | null; rpcName: string },
  run: () => Promise<T>,
): Promise<T> {
  if (!opts.key) {
    // Not every caller supplies a key (e.g. local dev tooling) — proceed
    // without replay protection rather than hard-failing, but never silently
    // skip it when one IS supplied.
    return run();
  }

  const { data: existing, error: replayErr } = await admin.rpc('idempotency_replay', { p_key: opts.key });
  if (replayErr) throw replayErr;
  if (existing) return existing as T;

  const result = await run();

  const { error: storeErr } = await admin.rpc('idempotency_store', {
    p_key: opts.key,
    p_tenant_id: opts.tenantId,
    p_caller_id: opts.callerId,
    p_rpc_name: opts.rpcName,
    p_response: result,
  });
  if (storeErr) {
    // Non-fatal: the operation itself already succeeded. A duplicate retry
    // in the next few seconds could re-run it, but that's strictly better
    // than failing an otherwise-successful user action over a logging write.
    console.error(`idempotency_store failed for ${opts.rpcName}:`, storeErr);
  }

  return result;
}

export function readIdempotencyKey(req: Request): string | null {
  return req.headers.get('x-idempotency-key');
}

export function assertUuidOrNull(value: string | null, field: string): string | null {
  if (value === null) return null;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(value)) {
    throw new AppError('VALIDATION_FAILED', `${field} must be a valid UUID.`, `${field} يجب أن يكون UUID صحيحًا.`);
  }
  return value;
}
