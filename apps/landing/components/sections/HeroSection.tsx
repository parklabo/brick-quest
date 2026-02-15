import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { APP_URL } from '@/lib/constants';

export function HeroSection() {
  const t = useTranslations('hero');

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 px-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-primary/20 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-accent/20 rounded-full blur-3xl animate-[float_10s_ease-in-out_infinite_reverse]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">
        <div className="mb-8 relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-glow" />
          <div className="relative bg-slate-900 rounded-3xl p-1">
            <Image src="/logo.png" width={120} height={120} alt="Brick Quest Logo" className="rounded-2xl" />
          </div>
        </div>

        <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tight mb-6">
          <span className="text-white">Brick </span>
          <span className="text-gradient">Quest</span>
        </h1>

        <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mb-10 leading-relaxed font-light">
          {t('subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-5 w-full justify-center">
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative px-8 py-4 bg-white text-slate-950 font-bold rounded-2xl hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary transition-transform duration-300 flex items-center justify-center gap-2"
          >
            <span className="relative z-10">{t('cta')}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <a href="#features" className="px-8 py-4 glass-button rounded-2xl text-white font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary transition-colors">
            {t('secondary')}
          </a>
        </div>

        <div className="mt-20 relative w-full max-w-4xl aspect-video glass-card rounded-2xl overflow-hidden group">
          <Image
            src="/images/01_home.webp"
            alt="App Interface"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
}
