'use client';

import { useTranslations } from 'next-intl';
import { BuildViewer } from '../../components/build/BuildViewer';
import { JobHistory } from '../../components/jobs/JobHistory';

export default function BuildPage() {
  const t = useTranslations('build');

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1.5">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('description')}</p>
        </div>
        <BuildViewer />

        <div className="mt-10 pt-6 border-t border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">{t('history')}</h2>
          <JobHistory type="build" />
        </div>
      </div>
    </main>
  );
}
