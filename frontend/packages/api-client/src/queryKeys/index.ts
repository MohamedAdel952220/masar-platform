/**
 * Canonical TanStack Query key registry (FRONTEND_ARCHITECTURE.md §12).
 *
 * One registry prevents key drift across six portals. Tenant-scoped namespaces
 * embed their scope so switching accounts can never surface another tenant's
 * cached rows; cross-tenant platform namespaces intentionally do not.
 */
export const queryKeys = {
  /** Session / claims derived state. */
  session: () => ['session'] as const,

  // Tenant-scoped domains
  tenancy: { all: (scope: string) => ['tenancy', scope] as const },
  identity: { all: (scope: string) => ['identity', scope] as const },
  academic: { all: (scope: string) => ['academic', scope] as const },
  transport: { all: (scope: string) => ['transport', scope] as const },
  safety: { all: (scope: string) => ['safety', scope] as const },
  comms: { all: (scope: string) => ['comms', scope] as const },
  approvals: { all: (scope: string) => ['approvals', scope] as const },
  billing: { all: (scope: string) => ['billing', scope] as const },
  media: { all: (scope: string) => ['media', scope] as const },
  reports: { all: (scope: string) => ['reports', scope] as const },

  // Cross-tenant / platform-scoped domains
  platform: { all: () => ['platform'] as const },
  jobs: { all: () => ['jobs'] as const },
} as const;

export type QueryKeys = typeof queryKeys;
