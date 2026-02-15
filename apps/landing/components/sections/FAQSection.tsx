import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

const FAQ_KEYS = ['1', '2', '3', '4', '5', '6'] as const;

export function FAQSection() {
  const t = useTranslations('marketing.faq');

  return (
    <section className="py-24 px-6 bg-slate-900/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">{t('title')}</h2>
        </div>

        <div className="space-y-4">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="group glass-card rounded-2xl open:bg-slate-800/80 transition-all">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg list-none text-white">
                {t(`${key}.q`)}
                <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-6 pb-6 pt-0 text-slate-400 leading-relaxed">
                {t(`${key}.a`)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
