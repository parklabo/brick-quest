import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function BeforeAfterSection() {
  const t = useTranslations('marketing.beforeAfter');

  return (
    <section className="py-24 px-6 bg-slate-900/50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">{t('title')}</h2>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-0">
          <div className="relative group w-full max-w-md aspect-square rounded-3xl overflow-hidden border-4 border-slate-800 rotate-[-3deg] z-10 hover:z-30 hover:rotate-0 transition-all duration-500">
            <Image src="/images/06_my_box.webp" alt={t('beforeAlt')} fill loading="lazy" className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
            <div className="absolute bottom-6 left-6 bg-slate-950/80 backdrop-blur-md px-6 py-2 rounded-full border border-slate-700">
              <span className="font-bold text-slate-400">{t('before')}</span>
            </div>
          </div>

          <div className="z-20 -mx-6 bg-brand-primary text-slate-950 rounded-full p-4 font-bold text-xl shadow-xl animate-pulse">
            <ArrowRight className="w-8 h-8" />
          </div>

          <div className="relative group w-full max-w-md aspect-square rounded-3xl overflow-hidden border-4 border-brand-primary shadow-[0_0_50px_rgba(255,215,0,0.2)] rotate-[3deg] z-10 hover:z-30 hover:rotate-0 transition-all duration-500">
            <Image src="/images/07_build.webp" alt={t('afterAlt')} fill loading="lazy" className="object-cover" />
            <div className="absolute bottom-6 right-6 bg-brand-primary/90 backdrop-blur-md px-6 py-2 rounded-full border border-white/20">
              <span className="font-bold text-slate-950">{t('after')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
