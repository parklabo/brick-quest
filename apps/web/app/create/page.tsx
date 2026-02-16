'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { CreateUploader } from '../../components/create/CreateUploader';
import { DesignPipeline } from '../../components/create/DesignPipeline';
import { JobHistory } from '../../components/jobs/JobHistory';

export default function CreatePage() {
  const t = useTranslations('create');

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-lego-yellow/15 ring-1 ring-lego-yellow/25 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-lego-yellow" />
            </div>
            <h1 className="text-xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-sm text-slate-500 ml-[38px]">
            {t('description')}
          </p>
        </div>

        {/* Pipeline Stepper */}
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <DesignPipeline />
        </div>

        {/* Upload Area */}
        <CreateUploader />

        {/* History */}
        <div className="mt-10 pt-6 border-t border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">{t('history')}</h2>
          <JobHistory type="design" />
        </div>
      </div>
    </main>
  );
}
