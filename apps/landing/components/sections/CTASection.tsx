import { useTranslations } from 'next-intl';
import { Sparkles, ScanLine } from 'lucide-react';
import { APP_URL } from '@/lib/constants';

export function CTASection() {
  const t = useTranslations('marketing.ctaSection');

  return (
    <section className="py-32 px-6 relative overflow-hidden text-center">
      <div className="absolute inset-0 bg-brand-primary/5" />
      <div className="relative z-10 max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-display font-bold mb-8">{t('title')}</h2>
        <p className="text-xl text-slate-400 mb-10">{t('description')}</p>
        <div className="flex flex-col sm:flex-row gap-5 justify-center">
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-linear-to-r from-brand-primary to-brand-secondary text-white font-bold text-xl rounded-2xl hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary transition-all duration-300 transform hover:-translate-y-1"
          >
            <Sparkles className="w-6 h-6" />
            {t('buttonCreate')}
          </a>
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 px-10 py-5 glass-button text-white font-bold text-xl rounded-2xl hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent transition-all duration-300 transform hover:-translate-y-1"
          >
            <ScanLine className="w-6 h-6" />
            {t('buttonScan')}
          </a>
        </div>
      </div>
    </section>
  );
}
