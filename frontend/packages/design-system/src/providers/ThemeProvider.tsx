import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type Direction = 'ltr' | 'rtl';

export interface ThemeContextValue {
  mode: ThemeMode;
  direction: Direction;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** @default "light" */
  mode?: ThemeMode;
  /** Document direction — driven by the active locale (see @masar/i18n). */
  direction?: Direction;
}

/**
 * Applies design-token scope to the document root. Tokens themselves are plain
 * CSS custom properties (tokens/*.css) — this provider only sets the
 * data-theme / dir attributes those tokens and layouts key off of, so no
 * visual behaviour is re-implemented in JS.
 */
export function ThemeProvider({ children, mode = 'light', direction = 'ltr' }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('dir', direction);
  }, [mode, direction]);

  const value = useMemo<ThemeContextValue>(() => ({ mode, direction }), [mode, direction]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
