'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

const STEPS = [1, 2, 3, 4] as const;

type Tab = 'create' | 'myBricks';

const TAB_CONFIG = {
  create: { image: '/images/09_play.webp', alt: 'Create mode workspace' },
  myBricks: { image: '/images/06_my_box.webp', alt: 'My Bricks inventory' },
} as const;

export function HowItWorksSection() {
  const t = useTranslations('marketing.howItWorks');
  const [activeTab, setActiveTab] = useState<Tab>('create');

  const config = TAB_CONFIG[activeTab];

  return (
    <section className="py-32 px-6 bg-slate-950/50">
      <div className="max-w-7xl mx-auto">
        {/* Header + Tabs */}
        <div className="text-center mb-16">
          <span className="text-brand-accent font-mono text-sm tracking-wider uppercase mb-2 block">{t('label')}</span>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">{t('title')}</h2>

          <div className="inline-flex rounded-2xl bg-slate-800/60 p-1.5 border border-slate-700">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'create'
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {t('tabCreate')}
            </button>
            <button
              onClick={() => setActiveTab('myBricks')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'myBricks'
                  ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/40'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {t('tabMyBricks')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <p className="text-lg text-slate-400 mb-8">{t(`${activeTab}.description`)}</p>

            <ul className="space-y-6">
              {STEPS.map((i) => (
                <li key={`${activeTab}-${i}`} className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                    activeTab === 'create'
                      ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30'
                      : 'bg-brand-accent/10 text-brand-accent border-brand-accent/30'
                  }`}>
                    {i}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{t(`${activeTab}.steps.${i}.title`)}</h4>
                    <p className="text-slate-500">{t(`${activeTab}.steps.${i}.desc`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 relative w-full aspect-square">
            <div className={`absolute inset-0 rounded-full blur-3xl ${
              activeTab === 'create'
                ? 'bg-gradient-to-tr from-brand-primary/20 to-brand-secondary/20'
                : 'bg-gradient-to-tr from-brand-accent/20 to-brand-secondary/20'
            }`} />
            <div className="relative z-10 w-full h-full glass-card rounded-3xl p-4 rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="relative w-full h-full rounded-2xl overflow-hidden">
                <Image src={config.image} fill loading="lazy" className="object-cover" alt={config.alt} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
