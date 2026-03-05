'use client';

import { useTranslations } from 'next-intl';
import { ScanLine } from 'lucide-react';
import { ScanUploader } from '../../components/scan/ScanUploader';
import { JobHistory } from '../../components/jobs/JobHistory';

export default function ScanPage() {
  const t = useTranslations('scan');

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-slate-400" />
            {t('title')}
          </h1>
        </div>
        <ScanUploader />

        <div className="mt-10 pt-6 border-t border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">{t('history')}</h2>
          <JobHistory type="scan" />
        </div>
      </div>
    </main>
  );
}
