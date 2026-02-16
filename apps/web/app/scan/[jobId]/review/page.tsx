'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ref, getDownloadURL, getBlob } from 'firebase/storage';
import { storage } from '../../../../lib/firebase';
import { useJobsStore } from '../../../../lib/stores/jobs';
import { ScanReviewPanel } from '../../../../components/scan/ScanReviewPanel';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ScanResult } from '@brick-quest/shared';

export default function ScanReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const t = useTranslations('scanReview');
  const job = useJobsStore((s) => s.jobs.find((j) => j.id === jobId));
  const markSeen = useJobsStore((s) => s.markSeen);
  const markAddedToInventory = useJobsStore((s) => s.markAddedToInventory);
  const unmarkAddedToInventory = useJobsStore((s) => s.unmarkAddedToInventory);
  const [imageUrl, setImageUrl] = useState<string | undefined>();

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

  // Mark as seen when viewing completed results
  useEffect(() => {
    if (job && job.status === 'completed' && !job.seen) {
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
          <Link href="/scan" className="text-blue-400 hover:text-blue-300 text-sm mt-4 inline-block">
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
