import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';
import { NavBar } from '../components/layout/NavBar';
import { AuthProvider } from '../components/providers/AuthProvider';
import { AuthGate } from '../components/providers/AuthGate';
import { ToastContainer } from '../components/ui/ToastContainer';
import en from '../messages/en.json';
import ko from '../messages/ko.json';
import ja from '../messages/ja.json';
import './globals.css';

export const dynamic = 'force-dynamic';

const SUPPORTED_LOCALES = ['en', 'ko', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const messagesByLocale: Record<Locale, typeof en> = { en, ko, ja };

export const metadata: Metadata = {
  title: 'Brick Quest - AI LEGO Builder',
  description: 'Scan your LEGO bricks and get AI-powered 3D building instructions',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('locale')?.value ?? 'en';
  const locale: Locale = SUPPORTED_LOCALES.includes(raw as Locale) ? (raw as Locale) : 'en';
  const messages = messagesByLocale[locale];

  return (
    <html lang={locale}>
      <body className="bg-slate-950 text-white antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <AuthGate>
              <NavBar />
              <ToastContainer />
              <div className="pb-16 sm:pb-0">{children}</div>
            </AuthGate>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
