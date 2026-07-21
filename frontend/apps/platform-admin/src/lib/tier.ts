import { isPlatformAdminManagerTier, type MasarClaims } from '@masar/auth';
import type { PlatformAdminTier } from '@masar/api-client';

/**
 * Platform Admin tier helpers (BACKEND_ARCHITECTURE.md §12.1).
 *
 * IMPORTANT: these are UX affordances only. RLS — and the internal
 * `is_platform_admin_manager_tier()` check inside the billing RPCs — is the
 * authorization boundary. Every action hidden here still fails correctly
 * server-side if invoked directly. The purpose is to avoid presenting a control
 * that would be rejected, not to enforce anything.
 *
 * §12.1 divergence, as deployed:
 *   Tenants ............... owner/admin: CRUD   · support: read-only
 *   Tenant billing ........ owner/admin: CRUD   · support: read-only
 *   Support tickets ....... no divergence — all tiers may update and assign
 *   Audit log ............. all tiers: read
 *   Service health ........ all tiers: read
 */

export type Tier = PlatformAdminTier;

/** owner | admin — may mutate tenants and tenant billing. */
export function canManageBilling(claims: MasarClaims): boolean {
  return isPlatformAdminManagerTier(claims);
}

/** owner | admin — may suspend/reactivate tenants or change plans. */
export function canManageTenants(claims: MasarClaims): boolean {
  return isPlatformAdminManagerTier(claims);
}

/** All tiers, including support — ticket handling is support's core job. */
export function canManageSupportTickets(claims: MasarClaims): boolean {
  return claims.role === 'platform_admin';
}

/** Human label for the tier chip in the top bar. */
export function tierLabel(tier: Tier | null): string {
  switch (tier) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'support':
      return 'Support';
    default:
      return 'Unknown';
  }
}

/** Tone for the tier chip, reusing the design system's Badge tones. */
export function tierTone(tier: Tier | null): 'teal' | 'info' | 'neutral' {
  switch (tier) {
    case 'owner':
      return 'teal';
    case 'admin':
      return 'info';
    default:
      return 'neutral';
  }
}
