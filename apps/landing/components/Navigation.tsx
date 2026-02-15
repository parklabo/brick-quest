'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { APP_URL } from '@/lib/constants';

export function Navigation() {
  const t = useTranslations('nav');

  return (
    <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-slate-950/50 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 overflow-hidden rounded-lg group-hover:scale-110 transition-transform">
            <Image src="/logo.png" fill alt="Logo" className="object-cover" />
          </div>
          <span className="text-xl font-display font-bold text-white tracking-tight group-hover:text-brand-primary transition-colors">
            Brick Quest
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <a href="#features" className="hidden md:block text-sm font-medium text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary rounded transition-colors">
            {t('features')}
          </a>
          <LanguageSwitcher />
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-sm font-bold px-6 py-2.5 bg-white text-slate-950 rounded-xl hover:bg-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary transition-colors"
          >
            {t('getStarted')}
          </a>
        </div>
      </div>
    </nav>
  );
}
