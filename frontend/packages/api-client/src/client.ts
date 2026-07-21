import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import type { Database } from './types/database.generated';

/** The typed Supabase client for the whole frontend. */
export type MasarClient = SupabaseClient<Database>;

/**
 * The single Supabase client. Every app reaches the backend through this
 * package — no app imports @supabase/supabase-js directly (enforced by the
 * root ESLint no-restricted-imports rule).
 *
 * Typing the client with the generated `Database` is what makes every
 * `.schema(s).from(r).select()` and `.rpc(name, args)` call end-to-end typed
 * without a single hand-written contract.
 */
let instance: MasarClient | null = null;

export function getSupabaseClient(): MasarClient {
  if (instance) return instance;
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  instance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: {
      // One multiplexed socket per app instance (FRONTEND_ARCHITECTURE.md §10).
      params: { eventsPerSecond: 10 },
    },
  });
  return instance;
}

/** Test seam — drops the singleton so a test can inject a fresh client. */
export function resetSupabaseClient(): void {
  instance = null;
}
