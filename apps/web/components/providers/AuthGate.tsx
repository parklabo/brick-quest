'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { uid, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = pathname === '/';

  useEffect(() => {
    if (!loading && !uid && !isPublic) {
      router.replace('/');
    }
  }, [uid, loading, isPublic, router]);

  // Public page (login) — always render
  if (isPublic) return children;

  // Authenticated — render children
  if (uid) return children;

  // Loading or redirecting — spinner
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
    </main>
  );
}
