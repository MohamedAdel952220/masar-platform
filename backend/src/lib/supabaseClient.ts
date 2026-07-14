import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditActorType } from '../types/database.types.js';

// Minimal typed surface repositories depend on — kept generic (not the full
// generated Database type) so Epic 1 doesn't need to hand-write types for
// tables that don't exist yet in later schemas.
export type AnySupabaseClient = SupabaseClient;

export function createServiceRoleClient(env: NodeJS.ProcessEnv = process.env): AnySupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to create a service-role client.');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createAnonClient(env: NodeJS.ProcessEnv = process.env): AnySupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set to create an anon client.');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type { AuditActorType };
