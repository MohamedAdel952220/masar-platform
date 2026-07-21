import { useAcademicList } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SelectedChildContext, type SelectedChildValue } from './selectedChild';

/**
 * Mounts the selected-child context for the whole app. See `selectedChild.ts`
 * for why this selection is a convenience, not an access control.
 */
export function SelectedChildProvider({ children: node }: { children: ReactNode }) {
  const { claims } = useAuth();
  const tenantId = claims.tenantId ?? '';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 50 });

  const list = useMemo(() => (query.data?.items ?? []).filter((c) => c.deleted_at === null), [query.data]);

  // Default to the first visible child once the list resolves, and recover if
  // the current selection disappears (e.g. a child is withdrawn).
  useEffect(() => {
    if (list.length === 0) return;
    if (selectedId && list.some((c) => c.id === selectedId)) return;
    setSelectedId(list[0]?.id ?? null);
  }, [list, selectedId]);

  const value = useMemo<SelectedChildValue>(
    () => ({
      children: list,
      selected: list.find((c) => c.id === selectedId) ?? null,
      selectedId,
      setSelectedId,
      isLoading: query.isLoading,
      error: query.error,
      refetch: () => void query.refetch(),
    }),
    [list, selectedId, query],
  );

  return <SelectedChildContext.Provider value={value}>{node}</SelectedChildContext.Provider>;
}
