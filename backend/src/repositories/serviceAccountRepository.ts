import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { ServiceAccountRow } from '../types/database.types.js';
import { serviceAccountFromRow, type ServiceAccount } from '../types/domain.js';
import { toAppError } from '../lib/rpcError.js';

// api_key_hash is never selected by any method here — every query lists its
// columns explicitly, deliberately omitting it, so it is structurally
// impossible for a hash to reach a client response through this repository
// (§10.7 — "hashed, never stored/returned in plaintext after issuance").
const SAFE_COLUMNS = 'id, tenant_id, name, purpose, scopes, status, issued_by, issued_at, revoked_at, last_used_at';

export class ServiceAccountRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listForTenant(tenantId: string): Promise<ServiceAccount[]> {
    const { data, error } = await this.client
      .schema('identity')
      .from('service_accounts')
      .select(SAFE_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as unknown as Omit<ServiceAccountRow, 'api_key_hash'>[]).map(serviceAccountFromRow);
  }

  async findById(id: string, tenantId: string): Promise<ServiceAccount | null> {
    const { data, error } = await this.client
      .schema('identity')
      .from('service_accounts')
      .select(SAFE_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? serviceAccountFromRow(data as unknown as Omit<ServiceAccountRow, 'api_key_hash'>) : null;
  }

  // Fix for EPIC_7_REVIEW.md L1: renamed from `findActiveByKeyHash` — the
  // old name implied a `status='active'` filter this query never actually
  // applied (the caller, CameraHeartbeatService, always re-checks `status`
  // itself). This method filters ON api_key_hash (an exact equality match
  // against the caller's freshly-hashed presented key) but never selects
  // that column back out (§10.7), and returns a matching row regardless of
  // status — callers MUST check `status` themselves, exactly as
  // CameraHeartbeatService already does.
  async findByKeyHash(keyHash: string): Promise<Pick<ServiceAccount, 'id' | 'tenantId' | 'scopes' | 'status'> | null> {
    const { data, error } = await this.client
      .schema('identity')
      .from('service_accounts')
      .select('id, tenant_id, scopes, status')
      .eq('api_key_hash', keyHash)
      .maybeSingle();
    if (error) throw toAppError(error);
    if (!data) return null;
    const row = data as { id: string; tenant_id: string | null; scopes: string[]; status: 'active' | 'revoked' };
    return { id: row.id, tenantId: row.tenant_id, scopes: row.scopes, status: row.status };
  }

  // Fix for EPIC_7_REVIEW.md H2: which camera(s) this service account is
  // explicitly bound to via media.camera_service_account_links. An empty
  // result means the account can never successfully heartbeat any camera —
  // closing the "any active key heartbeats any camera in the tenant"
  // impersonation gap.
  async listLinkedCameraIds(serviceAccountId: string): Promise<string[]> {
    const { data, error } = await this.client
      .schema('media')
      .from('camera_service_account_links')
      .select('camera_id')
      .eq('service_account_id', serviceAccountId);
    if (error) throw toAppError(error);
    return (data as { camera_id: string }[]).map((row) => row.camera_id);
  }

  // Insert requires the already-hashed key (hashing happens one layer up,
  // in the Edge Function / Node-side key-generation utility — this
  // repository never generates or sees the raw key).
  //
  // Fix for EPIC_7_REVIEW.md H2: accepts an optional cameraIds list and
  // binds the newly-created account to each one via media.camera_
  // service_account_links, sequentially after the account row itself is
  // created (non-atomic, matching this codebase's own established
  // convention for lower-criticality auxiliary rows — see
  // EPIC_7_FIX_REPORT.md). A partial failure leaves an active-but-
  // under-linked account, which CameraHeartbeatService's own binding check
  // then safely rejects rather than over-trusting.
  async create(input: {
    tenantId: string;
    name: string;
    purpose: 'camera_agent' | 'integration_other';
    scopes: string[];
    apiKeyHash: string;
    issuedBy: string;
    cameraIds?: string[];
  }): Promise<ServiceAccount> {
    const { data, error } = await this.client
      .schema('identity')
      .from('service_accounts')
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        purpose: input.purpose,
        scopes: input.scopes,
        api_key_hash: input.apiKeyHash,
        status: 'active',
        issued_by: input.issuedBy,
      })
      .select(SAFE_COLUMNS)
      .single();
    if (error) throw toAppError(error);
    const account = serviceAccountFromRow(data as unknown as Omit<ServiceAccountRow, 'api_key_hash'>);

    if (input.cameraIds && input.cameraIds.length > 0) {
      const { error: linkErr } = await this.client
        .schema('media')
        .from('camera_service_account_links')
        .insert(input.cameraIds.map((cameraId) => ({ camera_id: cameraId, service_account_id: account.id, tenant_id: input.tenantId })));
      if (linkErr) throw toAppError(linkErr);
    }

    return account;
  }

  // Atomic guarded UPDATE...WHERE status='active' — the "M1 pattern"
  // (Epic 2 onward): returns null on no match so the caller can disambiguate
  // NOT_FOUND vs. STATE_ALREADY_PROCESSED without a second race-prone query.
  async revoke(id: string, tenantId: string): Promise<ServiceAccount | null> {
    const { data, error } = await this.client
      .schema('identity')
      .from('service_accounts')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .select(SAFE_COLUMNS)
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? serviceAccountFromRow(data as unknown as Omit<ServiceAccountRow, 'api_key_hash'>) : null;
  }

  async touchLastUsed(id: string): Promise<void> {
    const { error } = await this.client.schema('identity').from('service_accounts').update({ last_used_at: new Date().toISOString() }).eq('id', id);
    if (error) throw toAppError(error);
  }
}
