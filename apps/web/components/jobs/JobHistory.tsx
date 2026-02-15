'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useJobsStore } from '../../lib/stores/jobs';
import { selectUnseenScanCount, selectUnseenBuildCount, selectUnseenDesignCount } from '../../lib/stores/jobs';
import { Clock, Sparkles } from 'lucide-react';
import { groupByDate, JobCard } from './JobList';
import type { JobType } from '@brick-quest/shared';

interface JobHistoryProps {
  type: JobType;
}

const unseenSelectors = {
  scan: selectUnseenScanCount,
  build: selectUnseenBuildCount,
  design: selectUnseenDesignCount,
};

export function JobHistory({ type }: JobHistoryProps) {
  const t = useTranslations('jobs');
  const allJobs = useJobsStore((s) => s.jobs);
  const jobs = useMemo(() => allJobs.filter((j) => j.type === type), [allJobs, type]);
  const unseenCount = useJobsStore(unseenSelectors[type]);
  const groups = groupByDate(jobs);

  const emptyLabel =
    type === 'scan' ? t('noScans') : type === 'design' ? t('noDesigns') : t('noBuilds');
  const emptyDescription =
    type === 'scan' ? t('noScansDesc') : type === 'design' ? t('noDesignsDesc') : t('noBuildsDesc');

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-xl bg-lego-surface ring-1 ring-lego-border flex items-center justify-center mb-5 shadow-[0_2px_0_0_rgba(0,0,0,0.2)]">
          <Clock className="w-7 h-7 text-slate-600" />
        </div>
        <h3 className="text-base font-bold text-white mb-1.5">{emptyLabel}</h3>
        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {unseenCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-lego-yellow/5 ring-1 ring-lego-yellow/20">
          <Sparkles className="w-4 h-4 text-lego-yellow shrink-0" />
          <p className="text-sm text-lego-yellow font-medium">
            {t('newResults', { count: unseenCount })}
          </p>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-3 mb-3 px-1">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {group.label}
            </h3>
            <div className="flex-1 h-px bg-slate-800/80" />
            <span className="text-xs text-slate-600">{group.jobs.length}</span>
          </div>
          <div className="space-y-4">
            {group.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
