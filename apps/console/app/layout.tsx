import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth-context';
import { AuthGuard } from '../components/layout/AuthGuard';
import { AppShell } from '../components/layout/AppShell';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Brick Quest Console',
  description: 'Admin console for Brick Quest',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-200 antialiased">
        <AuthProvider>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
