import type { PlatformAdminTier, Portal, Role, UUID } from '@masar/api-client';

/**
 * Claims carried in auth.users.raw_app_meta_data — server-set and immutable to
 * the client (BACKEND_ARCHITECTURE.md §10.2). The frontend decodes these to
 * decide what to *render*; RLS remains the authority on what data returns.
 */
export interface MasarClaims {
  tenantId: UUID | null;
  role: Role | null;
  platformAdminTier: PlatformAdminTier | null;
  appAccess: Portal[];
}

export const EMPTY_CLAIMS: MasarClaims = {
  tenantId: null,
  role: null,
  platformAdminTier: null,
  appAccess: [],
};

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Reads Masar claims out of a Supabase user's app_metadata. */
export function readClaims(appMetadata: Record<string, unknown> | undefined | null): MasarClaims {
  if (!appMetadata) return EMPTY_CLAIMS;
  const rawAccess = appMetadata['app_access'];
  return {
    tenantId: asStringOrNull(appMetadata['tenant_id']),
    role: asStringOrNull(appMetadata['role']) as Role | null,
    platformAdminTier: asStringOrNull(appMetadata['platform_admin_tier']) as PlatformAdminTier | null,
    appAccess: Array.isArray(rawAccess) ? (rawAccess.filter((v) => typeof v === 'string') as Portal[]) : [],
  };
}

/** Whether the identity may open a given portal (the `app_access` gate). */
export function canOpenPortal(claims: MasarClaims, portal: Portal): boolean {
  return claims.appAccess.includes(portal);
}

/** §12.1 — owner/admin may manage; support is read-only on those actions. */
export function isPlatformAdminManagerTier(claims: MasarClaims): boolean {
  return claims.platformAdminTier === 'owner' || claims.platformAdminTier === 'admin';
}
