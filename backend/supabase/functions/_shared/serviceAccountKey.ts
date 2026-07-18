// Service-account API-key generation/hashing (§10.7, §3.9.1). Shared by
// issue-service-account-key (generates + hashes) and camera-heartbeat
// (re-hashes the presented key to compare against the stored hash) so the
// two Edge Functions can never drift on the key format or hash algorithm.
//
// The raw key is generated once, returned to the caller exactly once
// (issue-service-account-key's own response), and never stored — only its
// SHA-256 hash is persisted (identity.service_accounts.api_key_hash),
// mirroring the "hashed, never stored/returned in plaintext after issuance"
// contract §3.9.1 states explicitly.
const KEY_PREFIX = 'sak_';

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64url = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${KEY_PREFIX}${b64url}`;
}

export async function hashApiKey(rawKey: string): Promise<string> {
  const data = new TextEncoder().encode(rawKey);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
