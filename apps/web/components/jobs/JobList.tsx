'use client';

import { memo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useJobsStore } from '../../lib/stores/jobs';
import { apiClient } from '../../lib/api/client';
import {
  ScanLine,
  Hammer,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Eye,
  Ban,
} from 'lucide-react';
import { PackageCheck } from 'lucide-react';
import type { TrackedJob } from '../../lib/stores/jobs';
import type { ScanResult, BuildPlan, DesignResult } from '@brick-quest/shared';

const CANCELLABLE = new Set(['pending', 'processing', 'generating_views', 'generating_build']);

// --- Helpers ---

function relativeTimeI18n(ms: number, tc: (key: string, values?: Record<string, number>) => string): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return tc('justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return tc('minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tc('hoursAgo', { hours });
  const days = Math.floor(hours / 24);
  return tc('daysAgo', { days });
}

function dateLabelI18n(ms: number, tc: (key: string) => string): string {
  const now = new Date();
  const date = new Date(ms);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return tc('today');
  if (diffDays === 1) return tc('yesterday');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function groupByDateI18n(jobs: TrackedJob[], tc: (key: string) => string): { label: string; jobs: TrackedJob[] }[] {
  const groups = new Map<string, TrackedJob[]>();
  for (const job of jobs) {
    const key = dateLabelI18n(job.createdAt, tc);
    const existing = groups.get(key);
    if (existing) existing.push(job);
    else groups.set(key, [job]);
  }
  return Array.from(groups, ([label, jobs]) => ({ label, jobs }));
}

// --- Components ---

export function StatusBadge({ status }: { status: TrackedJob['status'] }) {
  const t = useTranslations('jobs');
  switch (status) {
    case 'pending':
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          {status === 'pending' ? t('queued') : t('processing')}
        </span>
      );
    case 'generating_views':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('generatingViews')}
        </span>
      );
    case 'views_ready':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
          <Eye className="w-3 h-3" />
          {t('viewsReady')}
        </span>
      );
    case 'generating_build':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('buildingPlan')}
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          <CheckCircle className="w-3 h-3" />
          {t('complete')}
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
          <XCircle className="w-3 h-3" />
          {t('failed')}
        </span>
      );
  }
}

function getJobHref(job: TrackedJob): string | undefined {
  if (job.type === 'design' && job.status === 'views_ready') return `/create/${job.id}/result`;
  if (job.status !== 'completed' && job.status !== 'failed') return undefined;
  if (job.type === 'scan') return `/scan/${job.id}/review`;
  if (job.type === 'design') return `/create/${job.id}/result`;
  return `/builds/${job.id}/view`;
}

export const JobCard = memo(function JobCard({ job }: { job: TrackedJob }) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const markSeen = useJobsStore((s) => s.markSeen);
  const [cancelling, setCancelling] = useState(false);

  const isCancellable = CANCELLABLE.has(job.status);

  const handleCancel = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t('cancelConfirm'))) return;
    setCancelling(true);
    try {
      await apiClient.cancelJob(job.id);
    } catch {
      setCancelling(false);
    }
  }, [job.id, t]);

  const jobMeta = {
    scan: { Icon: ScanLine, label: t('scanType'), iconBg: 'bg-lego-blue/15 ring-1 ring-lego-blue/25', iconText: 'text-lego-blue' },
    design: { Icon: Sparkles, label: t('designType'), iconBg: 'bg-lego-yellow/15 ring-1 ring-lego-yellow/25', iconText: 'text-lego-yellow' },
    build: { Icon: Hammer, label: t('buildType'), iconBg: 'bg-lego-orange/15 ring-1 ring-lego-orange/25', iconText: 'text-lego-orange' },
  };
  const { Icon, label, iconBg, iconText } = jobMeta[job.type];
  const isFinished = job.status === 'completed' || job.status === 'failed' || job.status === 'views_ready';

  let subtitle = job.type === 'scan' ? t('scanSubtitle') : job.type === 'design' ? t('designSubtitle') : t('buildSubtitle');
  if (job.status === 'completed' && job.result) {
    if (job.type === 'scan') {
      const scanResult = job.result as ScanResult;
      const partCount = scanResult.parts?.length ?? 0;
      const totalPcs = scanResult.parts?.reduce((sum, p) => sum + p.count, 0) ?? 0;
      subtitle = t('scanResult', { types: partCount, pcs: totalPcs });
    } else if (job.type === 'design') {
      const designResult = job.result as DesignResult;
      if (designResult.buildPlan?.title) {
        subtitle = designResult.buildPlan.title;
      }
    } else {
      const buildPlan = job.result as BuildPlan;
      if (buildPlan.title) {
        subtitle = buildPlan.title;
      }
    }
  }
  const isUnseen = !job.seen && isFinished;

  const href = getJobHref(job);

  const content = (
    <div
      className={`group relative rounded-xl transition-all duration-200 ${
        isUnseen
          ? 'bg-white/[0.04] ring-1 ring-lego-yellow/20'
          : 'bg-white/[0.02] ring-1 ring-white/[0.06] hover:bg-white/[0.04] hover:ring-white/[0.1]'
      }`}
    >
      <div className="relative px-4 py-3.5 flex items-center gap-3.5">
        {isUnseen && (
          <div className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-lego-yellow shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
        )}

        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <Icon className={`w-4 h-4 ${iconText}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white text-sm">{label}</span>
            <StatusBadge status={job.status} />
            {job.addedToInventory && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <PackageCheck className="w-2.5 h-2.5" />
                {t('added')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate">{subtitle}</span>
            <span className="shrink-0">&middot;</span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {relativeTimeI18n(job.createdAt, tc)}
            </span>
          </div>
          {job.status === 'failed' && job.error && (
            <p className="text-xs text-red-400/70 mt-1 truncate">{job.error}</p>
          )}
        </div>

        {isCancellable && (
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancel}
            className="shrink-0 w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors cursor-pointer"
            title={t('cancel')}
          >
            {cancelling ? (
              <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
            ) : (
              <Ban className="w-3.5 h-3.5 text-red-400" />
            )}
          </button>
        )}

        {href && (
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
        )}
      </div>
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
});
