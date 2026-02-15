'use client';

import { useTranslations } from 'next-intl';
import { ImagePlus, Wand2, Box, ChevronRight, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  { icon: ImagePlus, key: 'step1' },
  { icon: Wand2, key: 'step2' },
  { icon: Box, key: 'step3' },
] as const;

const bullets = ['bullet1', 'bullet2', 'bullet3'] as const;

export function CreateModeSection() {
  const t = useTranslations('createMode');

  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left: Text */}
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase bg-brand-primary/15 text-brand-primary border border-brand-primary/30 mb-6">
              {t('label')}
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              {t('title')}
            </h2>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              {t('description')}
            </p>
            <ul className="space-y-4">
              {bullets.map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center mt-0.5">
                    <Check className="w-3.5 h-3.5 text-brand-primary" />
                  </div>
                  <span className="text-slate-300">{t(key)}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right: 3-step process flow */}
          <motion.div
            className="flex-1 w-full"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-3">
              {steps.map(({ icon: Icon, key }, index) => (
                <div key={key} className="flex items-center gap-3 sm:gap-3 w-full sm:w-auto">
                  <div className="flex-1 sm:flex-initial glass-card rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center min-w-0 sm:min-w-[160px] border border-brand-primary/20 hover:border-brand-primary/40 transition-colors group">
                    <div className="w-14 h-14 rounded-2xl bg-brand-primary/15 flex items-center justify-center mb-4 group-hover:bg-brand-primary/25 transition-colors">
                      <Icon className="w-7 h-7 text-brand-primary" />
                    </div>
                    <span className="text-sm font-bold text-white leading-tight">
                      {t(key)}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className="hidden sm:block w-5 h-5 text-brand-primary/50 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
