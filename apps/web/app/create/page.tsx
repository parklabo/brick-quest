'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Sparkles, Loader2, ExternalLink, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import { CreateUploader } from '../../components/create/CreateUploader';
import { DesignPipeline } from '../../components/create/DesignPipeline';
import { JobHistory } from '../../components/jobs/JobHistory';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useJobsStore, type TrackedJob } from '../../lib/stores/jobs';
import { useStorageUrl } from '../../lib/hooks/useStorageUrl';
import { apiClient } from '../../lib/api/client';

/** Statuses where upload form should be hidden */
const OCCUPIED_STATUSES = ['pending', 'processing', 'generating_views', 'views_ready', 'generating_build'];
/** Statuses where the processing spinner + logs should show */
const PROCESSING_STATUSES = ['pending', 'processing', 'generating_views', 'generating_build'];

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
            const isFallback = msg.startsWith('Switched to fallback');
            const isQuality = msg.startsWith('Quality:');
            const isMissing = msg.startsWith('Missing:');
            const isImproving = msg.startsWith('Improving build');
            const isBuildResult = msg.startsWith('Build generated:');
            const isAgentDetail = isQuality || isMissing || isImproving || isBuildResult;

            const colorClass = isFallback
              ? 'text-amber-400'
              : isQuality
                ? 'text-blue-400'
                : isMissing
                  ? 'text-orange-400'
                  : isImproving
                    ? 'text-violet-400'
                    : isBuildResult
                      ? 'text-emerald-400'
                      : isDone
                        ? 'text-slate-500'
                        : 'text-lego-yellow';

            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${colorClass} ${isAgentDetail ? 'pl-4' : ''}`}
                style={{ animation: 'fadeIn 0.3s ease-out' }}
              >
                {isFallback ? (
                  <span className="text-amber-400">⚠</span>
                ) : isQuality ? (
                  <span>📊</span>
                ) : isMissing ? (
                  <span>🔍</span>
                ) : isImproving ? (
                  <span>🔄</span>
                ) : isBuildResult ? (
                  <span className="text-emerald-400">✓</span>
                ) : isDone ? (
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

function CompositePreview({ job, linkToResult }: { job: TrackedJob; linkToResult?: boolean }) {
  const t = useTranslations('create');
  const compositeUrl = useStorageUrl(job.views?.composite);

  if (!compositeUrl) return null;

  const image = (
    <div className="rounded-xl overflow-hidden border border-lego-yellow/20 bg-slate-900 transition-all group-hover:border-lego-yellow/40">
      <img src={compositeUrl} alt={t('viewsPreview')} className="w-full object-contain" />
    </div>
  );

  if (linkToResult) {
    return (
      <div className="mt-4">
        <Link href={`/create/${job.id}/result`} className="block group">
          {image}
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs font-medium text-lego-yellow/70 group-hover:text-lego-yellow transition-colors">
            <ExternalLink className="w-3 h-3" />
            {t('viewFullResult')}
          </div>
        </Link>
      </div>
    );
  }

  return <div className="mb-5">{image}</div>;
}

function ViewsReviewInline({ job }: { job: TrackedJob }) {
  const t = useTranslations('create');
  const tc = useTranslations('common');
  const removeJob = useJobsStore((s) => s.removeJob);
  const [approving, setApproving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await apiClient.approveDesignViews(job.id);
    } catch {
      setApproving(false);
    }
  }, [job.id]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      await apiClient.regenerateDesignViews(job.id);
    } finally {
      setRegenerating(false);
    }
  }, [job.id]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await apiClient.deleteJob(job.id);
      removeJob(job.id);
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [job.id, removeJob]);

  const busy = approving || regenerating || deleting;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">{t('reviewViewsTitle')}</h3>
        <p className="text-xs text-slate-500">{t('reviewViewsHint')}</p>
      </div>

      {job.views && <CompositePreview job={job} />}

      {/* Action buttons */}
      <div className="space-y-2.5">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="w-full px-4 py-3.5 rounded-xl font-bold text-sm transition-all bg-lego-yellow hover:bg-yellow-400 text-slate-900 shadow-[0_3px_0_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-0.75 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {approving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('approvingBuild')}
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                {t('approveAndBuild')}
              </>
            )}
          </span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleRegenerate}
            disabled={busy}
            className="flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-slate-400 hover:text-slate-200 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-1.5">
              {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {regenerating ? t('regeneratingViews') : t('regenerateViews')}
            </span>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={busy}
            className="px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-slate-500 hover:text-red-400 bg-white/[0.03] hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              {tc('delete')}
            </span>
          </button>
        </div>

      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title={t('deleteDesignTitle')}
          message={t('deleteDesignConfirm')}
          confirmLabel={tc('delete')}
          cancelLabel={tc('cancel')}
          loading={deleting}
          loadingLabel={t('deletingDesign')}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

export default function CreatePage() {
  const t = useTranslations('create');
  const allJobs = useJobsStore((s) => s.jobs);

  const occupiedJob = useMemo(() => {
    return allJobs.find((j) => j.type === 'design' && OCCUPIED_STATUSES.includes(j.status));
  }, [allJobs]);

  const isProcessing = occupiedJob && PROCESSING_STATUSES.includes(occupiedJob.status);
  const isViewsReady = occupiedJob?.status === 'views_ready';

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-lego-yellow/15 ring-1 ring-lego-yellow/25 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-lego-yellow" />
            </div>
            <h1 className="text-xl font-bold">{t('title')}</h1>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <DesignPipeline activeJob={occupiedJob} />
        </div>

        {/* Processing: live logs + composite preview */}
        {isProcessing && occupiedJob && (
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <ProcessingLog job={occupiedJob} />
            {occupiedJob.views && <CompositePreview job={occupiedJob} linkToResult />}
          </div>
        )}

        {/* Views Ready: review UI with approve/regenerate/delete */}
        {isViewsReady && occupiedJob && (
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <ViewsReviewInline job={occupiedJob} />
          </div>
        )}

        {/* Upload Area — only when no occupied job */}
        {!occupiedJob && <CreateUploader />}

        {/* History */}
        <div className="mt-10 pt-6 border-t border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">{t('history')}</h2>
          <JobHistory type="design" />
        </div>
      </div>
    </main>
  );
}
