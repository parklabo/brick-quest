'use client';

import Link from 'next/link';
import { useJobsStore } from '../../lib/stores/jobs';
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
} from 'lucide-react';
import { PackageCheck } from 'lucide-react';
import type { TrackedJob } from '../../lib/stores/jobs';
import type { ScanResult, BuildPlan, DesignResult } from '@brick-quest/shared';

// --- Helpers ---

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function dateLabel(ms: number): string {
  const now = new Date();
  const date = new Date(ms);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function groupByDate(jobs: TrackedJob[]): { label: string; jobs: TrackedJob[] }[] {
  const groups = new Map<string, TrackedJob[]>();
  for (const job of jobs) {
    const key = dateLabel(job.createdAt);
    const existing = groups.get(key);
    if (existing) existing.push(job);
    else groups.set(key, [job]);
  }
  return Array.from(groups, ([label, jobs]) => ({ label, jobs }));
}

// --- Components ---

export function StatusBadge({ status }: { status: TrackedJob['status'] }) {
  switch (status) {
    case 'pending':
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          {status === 'pending' ? 'Queued' : 'Processing'}
        </span>
      );
    case 'generating_views':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating Views
        </span>
      );
    case 'views_ready':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
          <Eye className="w-3 h-3" />
          Views Ready
        </span>
      );
    case 'generating_build':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          Building Plan
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          <CheckCircle className="w-3 h-3" />
          Complete
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      );
  }
}

function getJobMeta(job: TrackedJob) {
  if (job.type === 'scan') return { Icon: ScanLine, label: 'Brick Scan', iconBg: 'bg-lego-blue/15 ring-1 ring-lego-blue/25', iconText: 'text-lego-blue' };
  if (job.type === 'design') return { Icon: Sparkles, label: 'LEGO Design', iconBg: 'bg-lego-yellow/15 ring-1 ring-lego-yellow/25', iconText: 'text-lego-yellow' };
  return { Icon: Hammer, label: 'Build Plan', iconBg: 'bg-lego-orange/15 ring-1 ring-lego-orange/25', iconText: 'text-lego-orange' };
}

function getJobHref(job: TrackedJob): string | undefined {
  if (job.type === 'design' && job.status === 'views_ready') return `/create/${job.id}/result`;
  if (job.status !== 'completed') return undefined;
  if (job.type === 'scan') return `/scan/${job.id}/review`;
  if (job.type === 'design') return `/create/${job.id}/result`;
  return `/builds/${job.id}/view`;
}

export function JobCard({ job }: { job: TrackedJob }) {
  const markSeen = useJobsStore((s) => s.markSeen);
  const { Icon, label, iconBg, iconText } = getJobMeta(job);
  const isFinished = job.status === 'completed' || job.status === 'failed' || job.status === 'views_ready';

  let subtitle = job.type === 'scan' ? 'AI brick detection' : job.type === 'design' ? 'AI LEGO design' : 'AI build instructions';
  if (job.status === 'completed' && job.result) {
    if (job.type === 'scan') {
      const scanResult = job.result as ScanResult;
      const partCount = scanResult.parts?.length ?? 0;
      const totalPcs = scanResult.parts?.reduce((sum, p) => sum + p.count, 0) ?? 0;
      subtitle = `${partCount} types · ${totalPcs} pcs`;
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
      className={`group relative rounded-xl p-[1px] transition-all duration-200 ${
        isUnseen
          ? 'bg-gradient-to-r from-lego-yellow/40 via-lego-red/30 to-lego-yellow/40'
          : 'bg-lego-border hover:bg-slate-600/60'
      }`}
    >
      <div
        className={`relative rounded-xl px-5 py-4 flex items-center gap-4 transition-colors ${
          isUnseen ? 'bg-lego-surface/95' : 'bg-lego-surface'
        }`}
      >
        {isUnseen && (
          <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-lego-yellow shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
        )}

        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-[0_2px_0_0_rgba(0,0,0,0.2)] ${iconBg}`}
        >
          <Icon className={`w-5 h-5 ${iconText}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="font-semibold text-white text-sm">{label}</span>
            <StatusBadge status={job.status} />
            {job.addedToInventory && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <PackageCheck className="w-2.5 h-2.5" />
                Added
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{subtitle}</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {relativeTime(job.createdAt)}
            </span>
          </div>
          {job.status === 'failed' && job.error && (
            <p className="text-xs text-red-400/80 mt-1.5 truncate">{job.error}</p>
          )}
        </div>

        {href && (
          <div className="shrink-0 w-8 h-8 rounded-lg bg-lego-border group-hover:bg-slate-600 flex items-center justify-center transition-colors shadow-[0_2px_0_0_rgba(0,0,0,0.2)]">
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-lego-yellow transition-colors" />
          </div>
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
}
