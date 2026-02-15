'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { motion } from 'framer-motion';

const screenshots = [
  { src: '/images/04_scan-review.webp', alt: 'Scan review' },
  { src: '/images/05_inspect-brick.webp', alt: 'Inspect brick' },
  { src: '/images/06_my_box.webp', alt: 'My box inventory' },
  { src: '/images/07_build.webp', alt: 'Build instructions' },
];

const STEPS = [1, 2, 3, 4] as const;

export function MyBricksModeSection() {
  const t = useTranslations('myBricksMode');

  return (
    <section className="py-32 px-6 bg-slate-950/50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl -translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          {/* Right: Text */}
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase bg-brand-accent/15 text-brand-accent border border-brand-accent/30 mb-6">
              {t('label')}
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              {t('title')}
            </h2>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              {t('description')}
            </p>
            <ul className="space-y-5">
              {STEPS.map((i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-accent/15 flex items-center justify-center text-sm font-bold text-brand-accent border border-brand-accent/30">
                    {i}
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{t(`step${i}title`)}</h4>
                    <p className="text-slate-500 text-sm">{t(`step${i}desc`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Left: Screenshot grid */}
          <motion.div
            className="flex-1 w-full"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="grid grid-cols-2 gap-3">
              {screenshots.map(({ src, alt }, index) => (
                <div
                  key={src}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-800 hover:border-brand-accent/40 transition-colors"
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
