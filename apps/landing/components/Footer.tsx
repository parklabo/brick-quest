import { useTranslations } from 'next-intl';
import Image from 'next/image';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-white/5 bg-slate-950 py-16 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all">
            <Image src="/logo.png" fill alt="Brick Quest Logo" className="object-cover" />
          </div>
          <div>
            <p className="font-display font-bold text-lg text-slate-200">Brick Quest</p>
            <p className="text-sm text-slate-500">{t('tagline')}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          &copy; {new Date().getFullYear()} Brick Quest. {t('rights')}
        </p>
      </div>
    </footer>
  );
}
