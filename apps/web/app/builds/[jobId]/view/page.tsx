'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useJobsStore } from '../../../../lib/stores/jobs';
import { useWorkspaceStore } from '../../../../lib/stores/workspace';
import { apiClient } from '../../../../lib/api/client';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { BuildPlan } from '@brick-quest/shared';

export default function BuildViewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const t = useTranslations('build');
  const job = useJobsStore((s) => s.jobs.find((j) => j.id === jobId));
  const markSeen = useJobsStore((s) => s.markSeen);
  const removeJob = useJobsStore((s) => s.removeJob);
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const { jobId: newJobId } = await apiClient.retryJob(jobId);
      router.push(`/builds/${newJobId}/view`);
    } catch {
      setRetrying(false);
    }
  }, [jobId, router]);

  const handleDelete = useCallback(async () => {
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try {
      await apiClient.deleteJob(jobId);
      removeJob(jobId);
      router.push('/builds');
    } catch {
      setDeleting(false);
    }
  }, [jobId, t, removeJob, router]);

  // Mark as seen when viewing failed results
  useEffect(() => {
    if (job && job.status === 'failed' && !job.seen) {
      markSeen(job.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to specific field changes
  }, [job?.id, job?.status, job?.seen, markSeen]);

  // Completed plan → load into workspace and redirect
  useEffect(() => {
    if (job?.status === 'completed' && job.result) {
      if (!job.seen) {
        markSeen(job.id);
      }
      const plan = job.result as BuildPlan;
      useWorkspaceStore.getState().loadPlan(plan);
      router.replace('/workspace');
    }
  }, [job?.status, job?.result, job?.id, job?.seen, markSeen, router]);

  if (!job) {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-slate-400">{t('jobNotFound')}</p>
          <Link href="/builds" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
            {t('backToBuilds')}
          </Link>
        </div>
      </main>
    );
  }

  if (job.status === 'pending' || job.status === 'processing') {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-white font-medium">{t('inProgress')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('mayTakeMinutes')}</p>
        </div>
      </main>
    );
  }

  if (job.status === 'failed') {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-red-400 font-medium mb-2">{t('failed')}</p>
          <p className="text-slate-400 text-sm">{job.error || t('unknownError')}</p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={handleRetry}
              disabled={retrying || deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {retrying ? t('retrying') : t('retry')}
            </button>
            <button
              onClick={handleDelete}
              disabled={retrying || deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? t('deleting') : t('delete')}
            </button>
          </div>
          <Link href="/builds" className="text-slate-500 hover:text-slate-300 text-sm mt-4 inline-block">
            {t('backToBuilds')}
          </Link>
        </div>
      </main>
    );
  }

  // Completed state: show loading while redirect happens
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-white font-medium">{t('loadingWorkspace')}</p>
      </div>
    </main>
  );
}
