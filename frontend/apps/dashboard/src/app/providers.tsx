import { QueryProvider } from '@masar/api-client';
import { AuthProvider } from '@masar/auth';
import { ThemeProvider, UIStoreProvider } from '@masar/design-system';
import { I18nProvider, useLocale } from '@masar/i18n';
import { type ReactNode } from 'react';

/**
 * Theme is nested inside I18n so it can derive `dir` from the active locale —
 * direction is applied once, at the document root
 * (FRONTEND_ARCHITECTURE.md §20).
 */
function ThemedShell({ children }: { children: ReactNode }) {
  const { direction } = useLocale();
  return (
    <ThemeProvider direction={direction} mode="light">
      {children}
    </ThemeProvider>
  );
}

/**
 * Provider composition, outermost first:
 *   I18n → Theme → Query → Auth → UIStore
 * Auth sits inside Query because signing out must be able to clear the cache.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemedShell>
        <QueryProvider>
          <AuthProvider>
            <UIStoreProvider>{children}</UIStoreProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemedShell>
    </I18nProvider>
  );
}
