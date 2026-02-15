'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Shapes, Users, ScanLine, BarChart3, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/shapes', label: 'Shapes', icon: Shapes, exact: false },
  { href: '/users', label: 'Users', icon: Users, exact: true },
  { href: '/scans', label: 'Scans', icon: ScanLine, exact: true },
  { href: '/stats', label: 'Stats', icon: BarChart3, exact: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-slate-800">
        <h1 className="text-lg font-bold text-white tracking-tight">
          Brick Quest
        </h1>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
          Admin Console
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        {user && (
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        )}
        <p className="text-[10px] text-slate-600 px-3 mt-2">
          {process.env.NODE_ENV === 'development' ? 'Emulator' : 'Production'}
        </p>
      </div>
    </aside>
  );
}
