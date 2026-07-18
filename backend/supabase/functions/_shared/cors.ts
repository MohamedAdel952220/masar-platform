// Shared CORS headers for every Edge Function.
// §31: allowed origins are locked down per environment in production — this
// list is the local/staging default and is expected to be overridden via the
// ALLOWED_ORIGINS env var when deployed.
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((o) => o.trim());

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))
      ? origin ?? '*'
      : allowedOrigins[0] ?? '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    // x-service-account-key: Epic 7's machine-identity auth header (§10.7)
    // — camera-heartbeat's API-key callers never carry an Authorization JWT.
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, x-service-account-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
