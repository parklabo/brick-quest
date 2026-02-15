'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, ScanLine, Package, Hammer, Box, LayoutDashboard, ChevronDown, Blocks } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useJobsStore, selectUnseenCounts } from '../../lib/stores/jobs';
import { useProfileStore } from '../../lib/stores/profile';

const MY_BRICKS_PATHS = ['/scan', '/builds', '/inventory'];

function StudRow({ count, className }: { count: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stud-sm bg-lego-yellow/20" />
      ))}
    </div>
  );
}

function MyBricksDropdown({ active, badgeCount }: { active: boolean; badgeCount: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const t = useTranslations('nav');

  const items = [
    { href: '/scan', label: t('scanBricks'), icon: ScanLine },
    { href: '/builds', label: t('build'), icon: Hammer },
    { href: '/inventory', label: t('inventory'), icon: Package },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition-all ${
          active
            ? 'bg-lego-yellow/10 text-lego-yellow shadow-[inset_0_-2px_0_0_theme(colors.lego.yellow)]'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Blocks className="w-4 h-4" />
        {t('myBricks')}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-lego-red text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_2px_4px_rgba(220,38,38,0.4)]">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-48 rounded-xl border border-lego-border bg-lego-surface shadow-xl py-1.5 z-50">
          {items.map(({ href, label, icon: Icon }) => {
            const itemActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  itemActive
                    ? 'text-lego-yellow bg-lego-yellow/5'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { scan: unseenScanCount, build: unseenBuildCount, design: unseenDesignCount } = useJobsStore(
    useShallow(selectUnseenCounts),
  );
  const profile = useProfileStore((s) => s.profile);
  const initial = profile?.displayName?.charAt(0).toUpperCase() ?? '?';

  if (pathname === '/' || pathname === '/workspace') return null;

  const isMyBricksActive = MY_BRICKS_PATHS.some((p) => pathname.startsWith(p));
  const myBricksBadge = unseenScanCount + unseenBuildCount;

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden sm:block border-b border-lego-border bg-lego-surface/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-6 bg-lego-red rounded-[4px] shadow-[0_2px_0_0_rgba(0,0,0,0.3)] flex items-center justify-center gap-[3px] transition-transform group-hover:scale-105">
              <div className="stud-sm bg-lego-red" />
              <div className="stud-sm bg-lego-red" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-lego-yellow">
              {t('brandName')}
            </span>
          </Link>
          <div className="flex items-center gap-0.5">
            <Link
              href="/dashboard"
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all ${
                pathname === '/dashboard'
                  ? 'bg-lego-yellow/10 text-lego-yellow shadow-[inset_0_-2px_0_0_theme(colors.lego.yellow)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              {t('home')}
            </Link>

            <Link
              href="/create"
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all ${
                pathname.startsWith('/create')
                  ? 'bg-lego-yellow/10 text-lego-yellow shadow-[inset_0_-2px_0_0_theme(colors.lego.yellow)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {t('create')}
              {unseenDesignCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-lego-red text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_2px_4px_rgba(220,38,38,0.4)]">
                  {unseenDesignCount > 9 ? '9+' : unseenDesignCount}
                </span>
              )}
            </Link>

            <MyBricksDropdown active={isMyBricksActive} badgeCount={myBricksBadge} />

            <Link
              href="/workspace"
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all ${
                pathname.startsWith('/workspace')
                  ? 'bg-lego-yellow/10 text-lego-yellow shadow-[inset_0_-2px_0_0_theme(colors.lego.yellow)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box className="w-4 h-4" />
              {t('workspace')}
            </Link>

            <div className="w-px h-6 bg-lego-border mx-2" />
            <Link
              href="/settings"
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                pathname === '/settings'
                  ? 'bg-lego-yellow/10'
                  : 'hover:bg-white/5'
              }`}
              title={t('settings')}
            >
              <div className="w-7 h-7 rounded-full bg-lego-yellow/15 border border-lego-yellow/30 flex items-center justify-center text-xs font-extrabold text-lego-yellow">
                {initial}
              </div>
            </Link>
          </div>
        </div>
        <div className="flex justify-center pb-1">
          <StudRow count={12} />
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-lego-border bg-lego-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-1 py-1">
          <Link
            href="/dashboard"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-[3.5rem] ${
              pathname === '/dashboard' ? 'text-lego-yellow' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            {t('home')}
          </Link>

          <Link
            href="/create"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-[3.5rem] ${
              pathname.startsWith('/create') ? 'text-lego-yellow' : 'text-slate-500'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            {t('create')}
            {unseenDesignCount > 0 && (
              <span className="absolute top-0 right-0.5 w-4 h-4 bg-lego-red text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {unseenDesignCount > 9 ? '9+' : unseenDesignCount}
              </span>
            )}
          </Link>

          <Link
            href="/scan"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-[3.5rem] ${
              isMyBricksActive ? 'text-lego-yellow' : 'text-slate-500'
            }`}
          >
            <Blocks className="w-5 h-5" />
            {t('myBricks')}
            {myBricksBadge > 0 && (
              <span className="absolute top-0 right-0.5 w-4 h-4 bg-lego-red text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {myBricksBadge > 9 ? '9+' : myBricksBadge}
              </span>
            )}
          </Link>

          <Link
            href="/workspace"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-[3.5rem] ${
              pathname.startsWith('/workspace') ? 'text-lego-yellow' : 'text-slate-500'
            }`}
          >
            <Box className="w-5 h-5" />
            {t('workspace')}
          </Link>

          <Link
            href="/settings"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-[3.5rem] ${
              pathname === '/settings' ? 'text-lego-yellow' : 'text-slate-500'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-lego-yellow/15 flex items-center justify-center text-[9px] font-extrabold text-lego-yellow">
              {initial}
            </div>
            {t('me')}
          </Link>
        </div>
      </nav>
    </>
  );
}
