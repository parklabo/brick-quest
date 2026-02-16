'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Upload,
  Images,
  Eye,
  Hammer,
  CheckCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useJobsStore, type TrackedJob } from '../../lib/stores/jobs';
import { StatusBadge } from '../jobs/JobList';

type PipelineStep = 'upload' | 'views' | 'review' | 'build' | 'complete';

const STEPS: { key: PipelineStep; icon: typeof Upload }[] = [
  { key: 'upload', icon: Upload },
  { key: 'views', icon: Images },
  { key: 'review', icon: Eye },
  { key: 'build', icon: Hammer },
  { key: 'complete', icon: CheckCircle },
];

const STEP_LABEL_KEYS: Record<PipelineStep, string> = {
  upload: 'pipelineUpload',
  views: 'pipelineViews',
  review: 'pipelineReview',
  build: 'pipelineBuild',
  complete: 'pipelineComplete',
};

function getActiveStep(status: TrackedJob['status']): PipelineStep {
  switch (status) {
    case 'pending':
    case 'processing':
      return 'upload';
    case 'generating_views':
      return 'views';
    case 'views_ready':
      return 'review';
    case 'generating_build':
      return 'build';
    case 'completed':
      return 'complete';
    default:
      return 'upload';
  }
}

function getStepIndex(step: PipelineStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export function DesignPipeline() {
  const t = useTranslations('create');
  const allJobs = useJobsStore((s) => s.jobs);

  const activeJob = useMemo(() => {
    const active = ['pending', 'processing', 'generating_views', 'views_ready', 'generating_build'];
    return allJobs.find((j) => j.type === 'design' && active.includes(j.status));
  }, [allJobs]);

  const latestCompleted = useMemo(() => {
    return allJobs.find((j) => j.type === 'design' && j.status === 'completed' && !j.seen);
  }, [allJobs]);

  const displayJob = activeJob || latestCompleted;
  const currentStep = displayJob ? getActiveStep(displayJob.status) : 'upload';
  const currentIdx = getStepIndex(currentStep);
  const isProcessing = displayJob && displayJob.status !== 'completed' && displayJob.status !== 'failed';

  return (
    <div className="space-y-4">
      {/* Pipeline Steps */}
      <div className="flex items-center gap-0 w-full">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentIdx;
          const isDone = idx < currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={`
                    relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-300
                    ${isActive
                      ? 'bg-lego-yellow/20 ring-2 ring-lego-yellow/50 shadow-[0_0_12px_rgba(250,204,21,0.15)]'
                      : isDone
                        ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30'
                        : 'bg-white/[0.04] ring-1 ring-white/[0.06]'
                    }
                  `}
                >
                  {isActive && isProcessing ? (
                    <Loader2 className="w-4 h-4 text-lego-yellow animate-spin" />
                  ) : (
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive
                          ? 'text-lego-yellow'
                          : isDone
                            ? 'text-emerald-400'
                            : 'text-slate-600'
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] font-medium transition-colors truncate max-w-[60px] text-center ${
                    isActive
                      ? 'text-lego-yellow'
                      : isDone
                        ? 'text-emerald-400/70'
                        : 'text-slate-600'
                  }`}
                >
                  {t(STEP_LABEL_KEYS[step.key])}
                </span>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1.5 sm:mx-2.5 -mt-5">
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      idx < currentIdx
                        ? 'bg-emerald-500/30'
                        : idx === currentIdx
                          ? 'bg-lego-yellow/20'
                          : 'bg-white/[0.06]'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Job Card */}
      {displayJob && (
        <ActiveJobCard job={displayJob} />
      )}
    </div>
  );
}

function ActiveJobCard({ job }: { job: TrackedJob }) {
  const t = useTranslations('create');
  const markSeen = useJobsStore((s) => s.markSeen);

  const isViewable = job.status === 'views_ready' || job.status === 'completed';
  const href = job.status === 'views_ready' || job.status === 'completed'
    ? `/create/${job.id}/result`
    : undefined;

  const content = (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08] hover:ring-lego-yellow/20 transition-all">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <StatusBadge status={job.status} />
        {job.status === 'failed' && job.error && (
          <span className="text-xs text-red-400/70 truncate">{job.error}</span>
        )}
      </div>
      {isViewable && (
        <span className="flex items-center gap-1 text-xs font-medium text-lego-yellow shrink-0">
          {t('viewResult')}
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={() => markSeen(job.id)} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
