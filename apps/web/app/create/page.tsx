'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { CreateUploader } from '../../components/create/CreateUploader';
import { DesignPipeline } from '../../components/create/DesignPipeline';
import { JobHistory } from '../../components/jobs/JobHistory';
import { useJobsStore, type TrackedJob } from '../../lib/stores/jobs';
import { useStorageUrl } from '../../lib/hooks/useStorageUrl';

const ACTIVE_STATUSES = ['pending', 'processing', 'generating_views', 'generating_build'];

function ProcessingLog({ job }: { job: TrackedJob }) {
  const t = useTranslations('create');
  const logs = job.logs;
  const isComplete = logs.length > 0 && logs[logs.length - 1] === 'Complete';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Loader2 className="w-4 h-4 text-lego-yellow animate-spin" />
        {t('jobInProgress')}
      </div>
      <p className="text-xs text-slate-500">{t('jobInProgressHint')}</p>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-lego-yellow transition-all duration-700 ease-out"
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {/* Log entries */}
      {logs.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {logs.map((msg, i) => {
            const isLast = i === logs.length - 1;
            const isDone = !isLast || isComplete;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${
                  isDone ? 'text-slate-500' : 'text-lego-yellow'
                }`}
                style={{ animation: 'fadeIn 0.3s ease-out' }}
              >
                {isDone ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-lego-yellow animate-pulse" />
                )}
                <span className="font-medium">{msg}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompositePreview({ job }: { job: TrackedJob }) {
  const t = useTranslations('create');
  const compositeUrl = useStorageUrl(job.views?.composite);

  if (!compositeUrl) return null;

  return (
    <div className="mt-4">
      <Link href={`/create/${job.id}/result`} className="block group">
        <div className="rounded-xl overflow-hidden border border-lego-yellow/20 bg-slate-900 transition-all group-hover:border-lego-yellow/40">
          <img src={compositeUrl} alt={t('viewsPreview')} className="w-full object-contain" />
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-xs font-medium text-lego-yellow/70 group-hover:text-lego-yellow transition-colors">
          <ExternalLink className="w-3 h-3" />
          {t('viewFullResult')}
        </div>
      </Link>
    </div>
  );
}

export default function CreatePage() {
  const t = useTranslations('create');
  const selectDesignJob = useJobsStore((s) => s.selectDesignJob);
  const allJobs = useJobsStore((s) => s.jobs);

  const activeJob = useMemo(() => {
    return allJobs.find((j) => j.type === 'design' && ACTIVE_STATUSES.includes(j.status));
  }, [allJobs]);

  const hasActiveJob = !!activeJob;

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
          <p className="text-sm text-slate-500 ml-[38px]">{t('description')}</p>
        </div>

        {/* Pipeline Stepper */}
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <DesignPipeline activeJob={activeJob} />
        </div>

        {/* Active Job: Processing logs + Composite Preview */}
        {hasActiveJob ? (
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <ProcessingLog job={activeJob} />
            {activeJob.views && <CompositePreview job={activeJob} />}
          </div>
        ) : (
          /* Upload Area — only when no active job */
          <CreateUploader />
        )}

        {/* History */}
        <div className="mt-10 pt-6 border-t border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">{t('history')}</h2>
          <JobHistory type="design" onJobSelect={selectDesignJob} />
        </div>
      </div>
    </main>
  );
}
