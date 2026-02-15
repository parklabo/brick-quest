import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Outfit, Inter } from 'next/font/google';
import { BASE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import '../globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-display' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ko: 'ko_KR',
  ja: 'ja_JP',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const title = t('title');
  const description = t('description');
  const url = `${BASE_URL}/${locale}`;

  const alternateLanguages = Object.fromEntries(
    routing.locales.map((l) => [l, `${BASE_URL}/${l}`]),
  );

  return {
    title,
    description,
    metadataBase: new URL(BASE_URL),
    icons: {
      icon: '/logo.png',
      apple: '/logo.png',
    },
    alternates: {
      canonical: url,
      languages: alternateLanguages,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Brick Quest',
      type: 'website',
      locale: OG_LOCALE_MAP[locale] ?? 'en_US',
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALE_MAP[l] ?? l),
      images: [
        {
          url: '/images/01_home.webp',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/images/01_home.webp'],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${outfit.variable} ${inter.variable}`}>
      <body
        suppressHydrationWarning
        className="font-body bg-slate-950 text-slate-50 antialiased selection:bg-brand-primary selection:text-brand-darker"
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
