import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Camera, Wand2, Box } from 'lucide-react';

const features = [
  { icon: Camera, key: 'scan', image: '/images/04_scan-review.webp' },
  { icon: Wand2, key: 'build', image: '/images/03_analzing.webp' },
  { icon: Box, key: 'view', image: '/images/07_build.webp' },
] as const;

export function FeaturesSection() {
  const t = useTranslations('features');

  return (
    <section id="features" className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <span className="text-brand-primary font-mono text-sm tracking-wider uppercase mb-2 block">AI-Powered Magic</span>
          <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">{t('title')}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, key, image }, index) => (
            <div
              key={key}
              className="group relative glass-card rounded-3xl overflow-hidden hover:translate-y-[-10px] transition-all duration-500"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="p-8 relative z-10">
                <div className="w-14 h-14 bg-slate-800/80 rounded-2xl flex items-center justify-center mb-6 text-brand-primary border border-slate-700 group-hover:border-brand-primary/50 transition-colors">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold mb-3 font-display">{t(`${key}.title`)}</h3>
                <p className="text-slate-400 leading-relaxed mb-6">{t(`${key}.description`)}</p>

                <div className="relative aspect-[4/5] w-full rounded-xl overflow-hidden border border-slate-800">
                  <Image src={image} alt={t(`${key}.title`)} fill loading="lazy" className="object-cover" />
                </div>
              </div>

              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
