'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, ScanLine, Package, Hammer, Box, Home, ChevronDown, Blocks } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useJobsStore, selectUnseenCounts } from '../../lib/stores/jobs';

const MY_BRICKS_PATHS = ['/scan', '/builds', '/inventory'];

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
          active
            ? 'bg-white/10 text-white'
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
  if (pathname === '/' || pathname === '/workspace') return null;

  const isMyBricksActive = MY_BRICKS_PATHS.some((p) => pathname.startsWith(p));
  const myBricksBadge = unseenScanCount + unseenBuildCount;

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden sm:block bg-lego-surface/80 backdrop-blur-md sticky top-0 z-40 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-6 h-14">
          <Link href="/home" className="flex items-center gap-2.5 group">
            <Image
              src="/logo.png"
              alt="Brick Quest"
              width={28}
              height={28}
              className="rounded-md transition-transform group-hover:scale-110"
            />
            <span className="font-extrabold text-base tracking-tight text-white">
              {t('brandName')}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/home"
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                pathname === '/home'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className="w-4 h-4" />
              {t('home')}
            </Link>

            <Link
              href="/create"
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                pathname.startsWith('/create')
                  ? 'bg-lego-yellow/15 text-lego-yellow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {t('create')}
              {unseenDesignCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-lego-red text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_2px_4px_rgba(220,38,38,0.4)]">
                  {unseenDesignCount > 9 ? '9+' : unseenDesignCount}
                </span>
              )}
            </Link>

            <MyBricksDropdown active={isMyBricksActive} badgeCount={myBricksBadge} />

            <Link
              href="/workspace"
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                pathname.startsWith('/workspace')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box className="w-4 h-4" />
              {t('workspace')}
            </Link>

          </div>
        </div>
      </nav>

      {/* Mobile: My Bricks sub-tabs (above bottom bar) */}
      {isMyBricksActive && (
        <div className="sm:hidden fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-39 bg-lego-surface/90 backdrop-blur-sm border-t border-white/[0.06]">
          <div className="flex items-center justify-around px-2 py-1">
            {[
              { href: '/scan', label: t('scanBricks'), icon: ScanLine },
              { href: '/builds', label: t('build'), icon: Hammer },
              { href: '/inventory', label: t('inventory'), icon: Package },
            ].map(({ href, label, icon: Icon }) => {
              const itemActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    itemActive ? 'text-lego-yellow bg-lego-yellow/10' : 'text-slate-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile: bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-lego-border bg-lego-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-1 py-1">
          <Link
            href="/home"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-14 ${
              pathname === '/home' ? 'text-lego-yellow' : 'text-slate-500'
            }`}
          >
            <Home className="w-5 h-5" />
            {t('home')}
          </Link>

          <Link
            href="/create"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-14 ${
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
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-14 ${
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
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors min-w-14 ${
              pathname.startsWith('/workspace') ? 'text-lego-yellow' : 'text-slate-500'
            }`}
          >
            <Box className="w-5 h-5" />
            {t('workspace')}
          </Link>

        </div>
      </nav>
    </>
  );
}
