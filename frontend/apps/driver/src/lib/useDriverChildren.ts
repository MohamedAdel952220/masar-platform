import { STALE_TIMES, academic, parseBackendError, queryKeys, type Database } from '@masar/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * The driver's readable child records, via the server-gated
 * `academic.children_driver_safe()` function.
 *
 * This is the ONLY child read in this app. `academic.children` is never
 * queried. See `lib/driver.ts` for why the distinction matters: the gated
 * function returns exactly the driver-safe columns, so allergies, blood type,
 * parent identities and contact details never leave the server. Redacting in
 * the client would put a privacy boundary somewhere a future edit can widen.
 *
 * The function takes no arguments — scope comes from the caller's JWT, so there
 * is no bus id or tenant id to pass and nothing for a client to tamper with.
 *
 * ══ WHY `academic.raw()` AND NOT `callRpc` ══
 *
 * `callRpc` is typed `keyof Database['public']['Functions']`, and this function
 * lives in the `academic` schema rather than `public`. It is therefore not
 * reachable through the public RPC wrapper — not an oversight, just a different
 * namespace.
 *
 * `academic.raw()` is the api-client's own documented escape hatch for exactly
 * this ("schema-scoped client for bespoke queries"). It is still the shared
 * client, still fully typed by the generated `Database`, and still routed
 * through `parseBackendError` so the bilingual error contract is preserved. No
 * Supabase import appears in this app, and no shared package was modified.
 *
 * Staleness: `profile`, matching the roster tier in §13. A manifest changes
 * when the office edits `bus_riders`, not second to second.
 */

export type DriverChild = Database['academic']['Functions']['children_driver_safe']['Returns'][number];

async function fetchDriverChildren(): Promise<DriverChild[]> {
  const { data, error } = await academic.raw().rpc('children_driver_safe');
  if (error) throw parseBackendError(error);
  return data ?? [];
}

export function useDriverChildren(tenantId: string): UseQueryResult<DriverChild[]> {
  return useQuery({
    queryKey: [...queryKeys.academic.all(tenantId), 'children_driver_safe'],
    queryFn: fetchDriverChildren,
    staleTime: STALE_TIMES.profile,
  });
}

/** Name/address lookup keyed by child id, for joining onto manifests and stops. */
export function useDriverChildIndex(tenantId: string): {
  byId: Map<string, DriverChild>;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
} {
  const query = useDriverChildren(tenantId);
  const byId = useMemo(() => {
    const map = new Map<string, DriverChild>();
    for (const child of query.data ?? []) map.set(child.id, child);
    return map;
  }, [query.data]);

  return {
    byId,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
