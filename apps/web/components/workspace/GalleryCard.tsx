'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Hammer, Clock } from 'lucide-react';
import { relativeTimeI18n } from '../jobs/JobList';
import type { TrackedJob } from '../../lib/stores/jobs';
import type { BuildPlan, DesignResult } from '@brick-quest/shared';

interface GalleryCardProps {
  job: TrackedJob;
  isActive: boolean;
  onSelect: (plan: BuildPlan, jobType: 'build' | 'design', jobId: string) => void;
}

function extractPlan(job: TrackedJob): BuildPlan | null {
  if (!job.result) return null;
  if (job.type === 'build') return job.result as BuildPlan;
  if (job.type === 'design') return (job.result as DesignResult).buildPlan ?? null;
  return null;
}

export const GalleryCard = memo(function GalleryCard({ job, isActive, onSelect }: GalleryCardProps) {
  const t = useTranslations('workspace');
  const tc = useTranslations('common');

  const plan = extractPlan(job);
  if (!plan) return null;

  const isDesign = job.type === 'design';
  const Icon = isDesign ? Sparkles : Hammer;
  const borderColor = isDesign ? 'border-l-lego-yellow' : 'border-l-lego-orange';
  const iconBg = isDesign ? 'bg-lego-yellow/15 ring-1 ring-lego-yellow/25' : 'bg-lego-orange/15 ring-1 ring-lego-orange/25';
  const iconText = isDesign ? 'text-lego-yellow' : 'text-lego-orange';

  return (
    <button
      type="button"
      onClick={() => onSelect(plan, job.type as 'build' | 'design', job.id)}
      className={`w-full text-left rounded-xl border-l-2 transition-all duration-200 cursor-pointer ${borderColor} ${
        isActive
          ? 'bg-white/[0.08] ring-1 ring-white/[0.15]'
          : 'bg-white/[0.02] ring-1 ring-white/[0.06] hover:bg-white/[0.05] hover:ring-white/[0.1]'
      }`}
    >
      <div className="px-3.5 py-3 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${iconText}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-white text-sm truncate">{plan.title || (isDesign ? t('filterDesign') : t('filterBuild'))}</span>
            {isActive && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20">
                {t('currentlyViewing')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>{t('stepsCount', { count: plan.steps.length })}</span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {relativeTimeI18n(job.createdAt, tc)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
});
