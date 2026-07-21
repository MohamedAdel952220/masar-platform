import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { DEFAULT_LOCALE, directionFor, type Direction, type Locale } from './direction';
import { initI18n } from './i18n';

export interface I18nContextValue {
  locale: Locale;
  direction: Direction;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  /** Overrides detection; otherwise the browser language decides. */
  initialLocale?: Locale;
}

/**
 * Owns the active locale and the document direction derived from it. The
 * ThemeProvider consumes `direction` so `dir` is applied once, at the root.
 */
export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [instance] = useState(() => initI18n(initialLocale));
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? (instance.language as Locale) ?? DEFAULT_LOCALE,
  );

  const setLocale = useCallback(
    (next: Locale) => {
      void instance.changeLanguage(next);
      setLocaleState(next);
    },
    [instance],
  );

  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, direction: directionFor(locale), setLocale }),
    [locale, setLocale],
  );

  return (
    <I18nContext.Provider value={value}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </I18nContext.Provider>
  );
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used within an I18nProvider');
  return ctx;
}
