'use client';

import { useTranslations } from 'next-intl';
import { Upload, Images, Eye, Hammer, CheckCircle, Loader2 } from 'lucide-react';
import type { TrackedJob } from '../../lib/stores/jobs';

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

export function DesignPipeline({ activeJob }: { activeJob?: TrackedJob }) {
  const t = useTranslations('create');

  const currentStep = activeJob ? getActiveStep(activeJob.status) : 'upload';
  const currentIdx = getStepIndex(currentStep);
  const isProcessing =
    activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed' && activeJob.status !== 'views_ready';

  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = idx === currentIdx;
        const isDone = idx < currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={`
                  relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-300
                  ${
                    isActive
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
                      isActive ? 'text-lego-yellow' : isDone ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-medium transition-colors truncate max-w-[60px] text-center ${
                  isActive ? 'text-lego-yellow' : isDone ? 'text-emerald-400/70' : 'text-slate-600'
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
                    idx < currentIdx ? 'bg-emerald-500/30' : idx === currentIdx ? 'bg-lego-yellow/20' : 'bg-white/[0.06]'
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
