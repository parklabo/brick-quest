'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Box } from 'lucide-react';
import { useJobsStore } from '../../lib/stores/jobs';
import { useWorkspaceStore } from '../../lib/stores/workspace';
import { groupByDateI18n } from '../jobs/JobList';
import { GalleryFilterTabs, type GalleryFilter } from './GalleryFilterTabs';
import { GalleryCard } from './GalleryCard';
import type { TrackedJob } from '../../lib/stores/jobs';
import type { BuildPlan, DesignResult } from '@brick-quest/shared';

interface GalleryPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectPlan: (plan: BuildPlan, jobType: 'build' | 'design', jobId: string) => void;
}

function hasValidPlan(job: TrackedJob): boolean {
  if (!job.result) return false;
  if (job.type === 'build') return !!(job.result as BuildPlan).steps;
  if (job.type === 'design') return !!(job.result as DesignResult).buildPlan?.steps;
  return false;
}

export function GalleryPanel({ open, onClose, onSelectPlan }: GalleryPanelProps) {
  const t = useTranslations('workspace');
  const tc = useTranslations('common');
  const allJobs = useJobsStore((s) => s.jobs);
  const sourceJobId = useWorkspaceStore((s) => s.sourceJobId);
  const [filter, setFilter] = useState<GalleryFilter>('all');

  const completedJobs = useMemo(
    () =>
      allJobs.filter(
        (job) => job.status === 'completed' && (job.type === 'build' || job.type === 'design') && hasValidPlan(job)
      ),
    [allJobs]
  );

  const filteredJobs = useMemo(() => {
    if (filter === 'all') return completedJobs;
    return completedJobs.filter((job) => job.type === filter);
  }, [completedJobs, filter]);

  const counts = useMemo(
    () => ({
      all: completedJobs.length,
      design: completedJobs.filter((j) => j.type === 'design').length,
      build: completedJobs.filter((j) => j.type === 'build').length,
    }),
    [completedJobs]
  );

  const groups = groupByDateI18n(filteredJobs, tc);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-20 bg-black/30 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-30 w-full sm:w-96 bg-[#0c0c14]/95 backdrop-blur-xl border-l border-white/[0.06] transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } ${!open ? 'pointer-events-none' : ''}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-bold text-white">{t('galleryTitle')}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="px-4 py-3">
            <GalleryFilterTabs filter={filter} onFilterChange={setFilter} counts={counts} />
          </div>

          {/* Job list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] flex items-center justify-center mb-4">
                  <Box className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400">{t('galleryEmpty')}</p>
                <p className="text-xs text-slate-600 mt-1 max-w-[200px]">{t('galleryEmptyDesc')}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{group.label}</h3>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                      <span className="text-[10px] text-slate-600">{group.jobs.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.jobs.map((job) => (
                        <GalleryCard
                          key={job.id}
                          job={job}
                          isActive={job.id === sourceJobId}
                          onSelect={onSelectPlan}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
