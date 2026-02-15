import { useTranslations } from 'next-intl';
import Image from 'next/image';

const STEPS = [1, 2, 3, 4] as const;

export function HowItWorksSection() {
  const t = useTranslations('marketing.howItWorks');

  return (
    <section className="py-32 px-6 bg-slate-950/50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1">
          <span className="text-brand-accent font-mono text-sm tracking-wider uppercase mb-2 block">{t('label')}</span>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">{t('title')}</h2>
          <p className="text-lg text-slate-400 mb-8">{t('description')}</p>

          <ul className="space-y-6">
            {STEPS.map((i) => (
              <li key={i} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 border border-slate-700">
                  {i}
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">{t(`steps.${i}.title`)}</h4>
                  <p className="text-slate-500">{t(`steps.${i}.desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 relative w-full aspect-square">
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-secondary/20 to-brand-primary/20 rounded-full blur-3xl" />
          <div className="relative z-10 w-full h-full glass-card rounded-3xl p-4 rotate-3 hover:rotate-0 transition-transform duration-500">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image src="/images/06_my_box.webp" fill loading="lazy" className="object-cover" alt="My Box Feature" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
