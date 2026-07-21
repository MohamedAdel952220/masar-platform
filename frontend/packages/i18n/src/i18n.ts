import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import arCommon from './resources/ar/common.json';
import enCommon from './resources/en/common.json';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from './direction';

export const defaultNS = 'common';

export const resources = {
  en: { common: enCommon },
  ar: { common: arCommon },
} as const;

let initialised = false;

/** Initialises the shared i18next instance exactly once per app. */
export function initI18n(locale?: Locale): I18nInstance {
  if (!initialised) {
    void i18next.use(initReactI18next).init({
      resources,
      lng: locale ?? detectInitialLocale(),
      fallbackLng: 'en',
      defaultNS,
      ns: ['common'],
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    initialised = true;
  }
  return i18next;
}

function detectInitialLocale(): Locale {
  if (typeof navigator !== 'undefined') {
    const candidate = navigator.language.split('-')[0] ?? '';
    if (isSupportedLocale(candidate)) return candidate;
  }
  return DEFAULT_LOCALE;
}

export { i18next };
