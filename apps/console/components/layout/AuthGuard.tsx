'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!isPublic && (!user || !isAdmin)) {
      router.replace('/login');
    }
    if (isPublic && user && isAdmin) {
      router.replace('/');
    }
  }, [loading, user, isAdmin, isPublic, router]);

  if (isPublic) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
