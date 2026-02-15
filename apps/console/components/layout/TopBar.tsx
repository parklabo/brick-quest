'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/shapes': 'Shape Browser',
  '/users': 'Users',
  '/scans': 'Scan Logs',
  '/stats': 'Build Statistics',
};

export function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const title = PAGE_TITLES[pathname]
    ?? (pathname.startsWith('/shapes/') ? 'Shape Detail' : 'Console');

  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {user?.email && (
        <span className="text-[11px] text-slate-500">{user.email}</span>
      )}
    </header>
  );
}
