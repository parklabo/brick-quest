import type { Metadata } from 'next';
import { NavBar } from '../components/layout/NavBar';
import { AuthProvider } from '../components/providers/AuthProvider';
import { AuthGate } from '../components/providers/AuthGate';
import { ToastContainer } from '../components/ui/ToastContainer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brick Quest - AI LEGO Builder',
  description: 'Scan your LEGO bricks and get AI-powered 3D building instructions',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <AuthProvider>
          <AuthGate>
            <NavBar />
            <ToastContainer />
            <div className="pb-16 sm:pb-0">{children}</div>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
