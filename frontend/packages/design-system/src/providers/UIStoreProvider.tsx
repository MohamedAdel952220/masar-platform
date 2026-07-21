import { createContext, useContext, useRef, type ReactNode } from 'react';
import { createStore, useStore } from 'zustand';

/**
 * Shell-level UI state only (FRONTEND_ARCHITECTURE.md §4). Domain data lives in
 * TanStack Query, never here. A store *instance* is created per provider rather
 * than as a module singleton so each portal owns isolated state and tests get a
 * clean store per render.
 */
export interface UIState {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  toggleNav: () => void;
}

export type UIStore = ReturnType<typeof createUIStore>;

export function createUIStore() {
  return createStore<UIState>()((set) => ({
    navOpen: false,
    setNavOpen: (open) => set({ navOpen: open }),
    toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
  }));
}

const UIStoreContext = createContext<UIStore | null>(null);

export function UIStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<UIStore>();
  if (!storeRef.current) storeRef.current = createUIStore();
  return <UIStoreContext.Provider value={storeRef.current}>{children}</UIStoreContext.Provider>;
}

export function useUIStore<T>(selector: (state: UIState) => T): T {
  const store = useContext(UIStoreContext);
  if (!store) throw new Error('useUIStore must be used within a UIStoreProvider');
  return useStore(store, selector);
}
