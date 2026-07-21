/**
 * Runtime environment handling. Only PUBLIC-SAFE values belong here: the
 * Supabase URL and anon key are safe for client bundles because the anon key
 * carries no privilege beyond what RLS already grants
 * (BACKEND_ARCHITECTURE.md §28/§34). The service_role key must NEVER appear
 * in any frontend artifact.
 */
export interface MasarEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Deployment target, used for logging/telemetry scoping. */
  environment: 'local' | 'staging' | 'production';
}

/** The build-tool-injected variables this package reads. */
interface ViteEnvShape {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_ENVIRONMENT?: string;
}

/**
 * Read `import.meta.env` without depending on a global `ImportMeta`
 * augmentation. A global augmentation would only be visible inside this
 * package's own tsconfig, so any workspace package consuming this source
 * would fail to typecheck. The local cast keeps the package self-contained.
 */
function readViteEnv(): ViteEnvShape {
  return (import.meta as unknown as { env?: ViteEnvShape }).env ?? {};
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill in the public-safe values.`,
    );
  }
  return value;
}

let cached: MasarEnv | null = null;

export function getEnv(): MasarEnv {
  if (cached) return cached;
  const env = readViteEnv();
  cached = {
    supabaseUrl: required('VITE_SUPABASE_URL', env.VITE_SUPABASE_URL),
    supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY', env.VITE_SUPABASE_ANON_KEY),
    environment: (env.VITE_ENVIRONMENT as MasarEnv['environment']) ?? 'local',
  };
  return cached;
}

/** Test seam — clears the memoised env so a test can swap values. */
export function resetEnvCache(): void {
  cached = null;
}
