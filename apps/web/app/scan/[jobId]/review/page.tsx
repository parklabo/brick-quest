'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ref, getDownloadURL, getBlob } from 'firebase/storage';
import { storage } from '../../../../lib/firebase';
import { useJobsStore } from '../../../../lib/stores/jobs';
import { apiClient } from '../../../../lib/api/client';
import { ScanReviewPanel } from '../../../../components/scan/ScanReviewPanel';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { ScanResult } from '@brick-quest/shared';

export default function ScanReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const t = useTranslations('scanReview');
  const job = useJobsStore((s) => s.jobs.find((j) => j.id === jobId));
  const markSeen = useJobsStore((s) => s.markSeen);
  const markAddedToInventory = useJobsStore((s) => s.markAddedToInventory);
  const unmarkAddedToInventory = useJobsStore((s) => s.unmarkAddedToInventory);
  const removeJob = useJobsStore((s) => s.removeJob);
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const { jobId: newJobId } = await apiClient.retryJob(jobId);
      router.push(`/scan/${newJobId}/review`);
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
      router.push('/scan');
    } catch {
      setDeleting(false);
    }
  }, [jobId, t, removeJob, router]);

  // Fetch original scan image from Storage
  useEffect(() => {
    if (!jobId) return;
    let blobUrl: string | undefined;
    const imageRef = ref(storage, `scans/${jobId}/image.jpeg`);
    getDownloadURL(imageRef)
      .then(setImageUrl)
      .catch(() => {
        // Fallback: fetch blob directly (works with emulator)
        getBlob(imageRef)
          .then((blob) => {
            blobUrl = URL.createObjectURL(blob);
            setImageUrl(blobUrl);
          })
          .catch(() => {
            // Image may not exist (e.g. old jobs) — ignore
          });
      });
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [jobId]);

  // Mark as seen when viewing completed/failed results
  useEffect(() => {
    if (job && (job.status === 'completed' || job.status === 'failed') && !job.seen) {
      markSeen(job.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to specific field changes
  }, [job?.id, job?.status, job?.seen, markSeen]);

  if (!job) {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-slate-400">{t('jobNotFound')}</p>
          <Link href="/scan" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
            {t('backToScans')}
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
          <Link href="/scan" className="text-slate-500 hover:text-slate-300 text-sm mt-4 inline-block">
            {t('backToScans')}
          </Link>
        </div>
      </main>
    );
  }

  const result = job.result as ScanResult;

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <ScanReviewPanel
          result={result}
          imageUrl={imageUrl}
          alreadyAdded={job.addedToInventory}
          onAdded={() => markAddedToInventory(job.id)}
          onUnmarked={() => unmarkAddedToInventory(job.id)}
        />
      </div>
    </main>
  );
}
