'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useJobsStore } from '../../../../lib/stores/jobs';
import { useWorkspaceStore } from '../../../../lib/stores/workspace';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { BuildPlan } from '@brick-quest/shared';

export default function BuildViewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const t = useTranslations('build');
  const job = useJobsStore((s) => s.jobs.find((j) => j.id === jobId));
  const markSeen = useJobsStore((s) => s.markSeen);
  const router = useRouter();

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
          <Link href="/builds" className="text-blue-400 hover:text-blue-300 text-sm mt-4 inline-block">
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
