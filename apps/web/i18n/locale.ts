/** Supported locales for the web app */
export const SUPPORTED_LOCALES = ['en', 'ko', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
};

/** Set locale cookie and reload the page */
export function setLocale(locale: Locale) {
  document.cookie = `locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
  window.location.reload();
}
