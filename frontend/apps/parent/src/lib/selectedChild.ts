import { type AcademicRow } from '@masar/api-client';
import { createContext, useContext } from 'react';

/**
 * Selected-child context — the context object and its hook.
 *
 * A guardian may have several children enrolled, and almost every screen in
 * this app is scoped to one of them. Rather than thread a child id through
 * every route, the app holds the current selection here.
 *
 * IMPORTANT: this is a *convenience* selector, not an access control. The list
 * it selects from is whatever `academic.children` returns, which RLS has
 * already narrowed to `child_id = ANY(public.current_guardian_child_ids())`.
 * A guardian cannot select a child they cannot see, because such a child never
 * reaches the client.
 *
 * The provider lives in `SelectedChildProvider.tsx`. Keeping the hook and the
 * component in separate files is what lets Fast Refresh work on the provider.
 */

export type Child = AcademicRow<'children'>;

export interface SelectedChildValue {
  /** Every child this guardian may see, as returned by RLS. */
  children: Child[];
  selected: Child | null;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export const SelectedChildContext = createContext<SelectedChildValue | null>(null);

export function useSelectedChild(): SelectedChildValue {
  const ctx = useContext(SelectedChildContext);
  if (!ctx) throw new Error('useSelectedChild must be used within a SelectedChildProvider');
  return ctx;
}
