export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'ar';

/**
 * Arabic is a first-class RTL locale, not a translation afterthought
 * (FRONTEND_ARCHITECTURE.md §20). Layout uses logical CSS properties so a
 * single stylesheet serves both directions.
 */
export function directionFor(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
