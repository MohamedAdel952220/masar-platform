// Node-side mirror of supabase/functions/_shared/serviceAccountKey.ts — same
// algorithm (raw key generation, SHA-256 hex hash), kept as a separate file
// for the same reason every other Node/Deno pair in this codebase is split
// (Edge Functions and this Node package cannot share a module without a
// bundler step neither runtime currently has configured). Both sides must
// stay byte-for-byte compatible: a key generated in one runtime must hash
// identically in the other, since production key generation happens in the
// deployed Edge Function while this module exists for Node-side testability
// of the surrounding authorization logic (§10.7).
import { randomBytes, createHash } from 'node:crypto';

const KEY_PREFIX = 'sak_';

export function generateApiKey(): string {
  const b64url = randomBytes(32).toString('base64url');
  return `${KEY_PREFIX}${b64url}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}
