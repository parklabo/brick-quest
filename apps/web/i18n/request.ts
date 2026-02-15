import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import en from '../messages/en.json';
import ko from '../messages/ko.json';
import ja from '../messages/ja.json';

const SUPPORTED_LOCALES = ['en', 'ko', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const messagesByLocale: Record<Locale, typeof en> = { en, ko, ja };

function isSupported(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('locale')?.value ?? 'en';
  const locale: Locale = isSupported(raw) ? raw : 'en';

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
