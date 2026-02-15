'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, getDownloadURL, getBlob } from 'firebase/storage';
import { Loader2, ExternalLink, Box, Download, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';
import { storage } from '../../../../lib/firebase';
import { useJobsStore } from '../../../../lib/stores/jobs';
import { useWorkspaceStore } from '../../../../lib/stores/workspace';
import { apiClient } from '../../../../lib/api/client';
import type { DesignResult, RequiredPart, DesignViews } from '@brick-quest/shared';
import { resolveBrickLinkInfo, generateWantedListXml } from '@brick-quest/shared';
import { BrickIcon } from '../../../../components/ui/BrickIcon';

function PartCard({ part }: { part: RequiredPart }) {
  const info = resolveBrickLinkInfo(
    part.shape,
    part.type,
    part.dimensions.width,
    part.dimensions.length,
    part.color,
  );

  return (
    <div className="brick-card p-3 flex items-center gap-3">
      <div className="shrink-0">
        <BrickIcon
          shape={part.shape}
          type={part.type}
          hexColor={part.hexColor}
          width={part.dimensions.width}
          length={part.dimensions.length}
          maxSize={28}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{part.name}</p>
        <p className="text-[11px] text-slate-500">
          {part.dimensions.width}x{part.dimensions.length} {part.type} · {part.color}
          {info.partId && <span className="ml-1 text-slate-600">#{info.partId}</span>}
        </p>
      </div>
      <a
        href={info.catalogUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-lego-blue transition-colors"
        title={info.isFallback ? 'Search on BrickLink' : `View #${info.partId} on BrickLink`}
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
      <span className="shrink-0 w-7 h-7 rounded-lg bg-lego-yellow/10 text-lego-yellow text-xs font-bold flex items-center justify-center">
        {part.quantity}
      </span>
    </div>
  );
}

// --- Step Indicator ---

type DesignStep = 1 | 2;

function DesignStepIndicator({ activeStep, completedSteps }: { activeStep: DesignStep; completedSteps: Set<DesignStep> }) {
  const t = useTranslations('createResult');
  const steps = [
    { step: 1 as DesignStep, label: t('stepViews') },
    { step: 2 as DesignStep, label: t('stepBuild') },
  ];

  return (
    <div className="flex items-center gap-3 mb-8">
      {steps.map(({ step, label }, i) => {
        const isCompleted = completedSteps.has(step);
        const isActive = activeStep === step && !isCompleted;

        return (
          <div key={step} className="flex items-center gap-3">
            {i > 0 && (
              <div className={`w-8 h-0.5 ${isCompleted || completedSteps.has(steps[i - 1].step) ? 'bg-lego-yellow' : 'bg-slate-700'}`} />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCompleted
                    ? 'bg-lego-yellow text-slate-900'
                    : isActive
                      ? 'bg-lego-yellow/20 text-lego-yellow ring-2 ring-lego-yellow/40'
                      : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700'
                }`}
              >
                {isCompleted ? <CheckCircle className="w-4 h-4" /> : step}
              </div>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  isCompleted ? 'text-lego-yellow' : isActive ? 'text-white' : 'text-slate-500'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Views Review ---

function useStorageUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!path) { setUrl(undefined); return; }
    let blobUrl: string | undefined;
    const imageRef = ref(storage, path);
    getDownloadURL(imageRef)
      .then(setUrl)
      .catch(() => {
        getBlob(imageRef)
          .then((blob) => {
            blobUrl = URL.createObjectURL(blob);
            setUrl(blobUrl);
          })
          .catch(() => {/* non-critical */});
      });
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [path]);

  return url;
}

function ViewsReview({
  views,
  jobId,
  referenceUrl,
}: {
  views: DesignViews;
  jobId: string;
  referenceUrl?: string;
}) {
  const t = useTranslations('createResult');
  const [approving, setApproving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const compositeUrl = useStorageUrl(views.composite);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await apiClient.approveDesignViews(jobId);
    } catch {
      setApproving(false);
    }
  }, [jobId]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      await apiClient.regenerateDesignViews(jobId);
    } finally {
      setRegenerating(false);
    }
  }, [jobId]);

  return (
    <div>
      {/* Photo → LEGO Views comparison */}
      <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-4 items-start mb-8">
        {/* Original photo */}
        {referenceUrl ? (
          <div className="sticky top-4">
            <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
              <img src={referenceUrl} alt={t('yourPhoto')} className="w-full aspect-square object-cover" />
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-1.5 font-medium">{t('original')}</p>
          </div>
        ) : (
          <div />
        )}

        {/* Generated composite views */}
        <div>
          <div className="rounded-xl overflow-hidden border border-lego-yellow/20 bg-slate-900">
            {compositeUrl ? (
              <img src={compositeUrl} alt={t('generatedViews')} className="w-full object-contain" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
              </div>
            )}
          </div>
          <p className="text-[10px] text-lego-yellow/60 text-center mt-1.5 font-medium">{t('aiViews')}</p>
        </div>
      </div>

      {/* Action buttons — stacked with clear hierarchy */}
      <div className="space-y-3">
        <button
          onClick={handleApprove}
          disabled={approving || regenerating}
          className="w-full px-4 py-4 rounded-xl font-bold text-base transition-all bg-lego-yellow hover:bg-yellow-400 text-slate-900 shadow-[0_3px_0_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {approving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('generatingBuild')}
              </>
            ) : (
              <>
                <ArrowRight className="w-5 h-5" />
                {t('approveButton')}
              </>
            )}
          </span>
        </button>
        <button
          onClick={handleRegenerate}
          disabled={approving || regenerating}
          className="w-full px-4 py-3 rounded-xl font-medium text-sm transition-all text-slate-500 hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {regenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('regenerating')}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {t('regenerateButton')}
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function DesignResultPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const t = useTranslations('createResult');
  const tc = useTranslations('common');
  const job = useJobsStore((s) => s.jobs.find((j) => j.id === jobId));
  const markSeen = useJobsStore((s) => s.markSeen);
  const router = useRouter();

  const referenceUrl = useStorageUrl(`designs/${jobId}/reference.jpeg`);
  const compositeUrl = useStorageUrl(job?.views?.composite);

  useEffect(() => {
    if (job && (job.status === 'completed' || job.status === 'views_ready') && !job.seen) {
      markSeen(job.id);
    }
  }, [job?.status, job?.seen, job?.id, markSeen]);

  const designResult = useMemo(() => {
    if (job?.status === 'completed' && job.result) {
      return job.result as DesignResult;
    }
    return null;
  }, [job?.status, job?.result]);

  const totalParts = useMemo(() => {
    if (!designResult) return 0;
    return designResult.requiredParts.reduce((sum, p) => sum + p.quantity, 0);
  }, [designResult]);

  const mappedCount = useMemo(() => {
    if (!designResult) return 0;
    return designResult.requiredParts.filter(
      (p) => !resolveBrickLinkInfo(p.shape, p.type, p.dimensions.width, p.dimensions.length, p.color).isFallback,
    ).length;
  }, [designResult]);

  const handleDownloadWantedList = () => {
    if (!designResult) return;
    const xml = generateWantedListXml(designResult.requiredParts);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${designResult.buildPlan.title.replace(/[^a-z0-9]/gi, '_')}_wanted_list.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenWorkspace = () => {
    if (!designResult) return;
    useWorkspaceStore.getState().loadPlan(designResult.buildPlan);
    router.push('/workspace');
  };

  // Determine step indicator state
  const getStepState = () => {
    const status = job?.status;
    if (!status) return { activeStep: 1 as DesignStep, completedSteps: new Set<DesignStep>() };

    switch (status) {
      case 'pending':
      case 'processing':
      case 'generating_views':
        return { activeStep: 1 as DesignStep, completedSteps: new Set<DesignStep>() };
      case 'views_ready':
        return { activeStep: 1 as DesignStep, completedSteps: new Set<DesignStep>([1]) };
      case 'generating_build':
        return { activeStep: 2 as DesignStep, completedSteps: new Set<DesignStep>([1]) };
      case 'completed':
        return { activeStep: 2 as DesignStep, completedSteps: new Set<DesignStep>([1, 2]) };
      default:
        return { activeStep: 1 as DesignStep, completedSteps: new Set<DesignStep>() };
    }
  };

  // Determine if this is a new-pipeline job (has views field)
  const isNewPipeline = !!job?.views;

  if (!job) {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-slate-400">{t('jobNotFound')}</p>
          <Link href="/create" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
            {t('backToCreate')}
          </Link>
        </div>
      </main>
    );
  }

  if (job.status === 'failed') {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          {isNewPipeline && <DesignStepIndicator {...getStepState()} />}
          <p className="text-red-400 font-medium mb-2">{t('failed')}</p>
          <p className="text-slate-400 text-sm">{job.error || t('unknownError')}</p>
          <Link href="/create" className="text-blue-400 hover:text-blue-300 text-sm mt-4 inline-block">
            {t('backToCreate')}
          </Link>
        </div>
      </main>
    );
  }

  // Step 1 in-progress: generating views
  if (job.status === 'pending' || job.status === 'processing' || job.status === 'generating_views') {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/create" className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6 inline-block">
            &larr; {t('backToCreate')}
          </Link>
          {isNewPipeline && <DesignStepIndicator {...getStepState()} />}
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-lego-yellow animate-spin mb-4" />
            <p className="text-white font-medium">
              {job.status === 'generating_views' ? t('generatingViews') : t('designing')}
            </p>
            <p className="text-slate-400 text-sm mt-1">{t('mayTakeMinutes')}</p>
          </div>
        </div>
      </main>
    );
  }

  // Views ready — show review UI
  if (job.status === 'views_ready' && job.views) {
    return (
      <main className="min-h-screen p-4 sm:p-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <Link href="/create" className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6 inline-block">
            &larr; {t('backToCreate')}
          </Link>
          <DesignStepIndicator {...getStepState()} />
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-white">{t('reviewTitle')}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {t('reviewDescription')}
            </p>
          </div>
          <ViewsReview views={job.views} jobId={jobId} referenceUrl={referenceUrl} />
        </div>
      </main>
    );
  }

  // Step 2 in-progress: generating build
  if (job.status === 'generating_build') {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/create" className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6 inline-block">
            &larr; {t('backToCreate')}
          </Link>
          <DesignStepIndicator {...getStepState()} />

          {/* Show composite views in mini preview */}
          {job.views && (
            <div className="mb-6 opacity-60">
              <MiniViewCard label="Views" path={job.views.composite} />
            </div>
          )}

          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-lego-yellow animate-spin mb-4" />
            <p className="text-white font-medium">{t('generatingBuild')}</p>
            <p className="text-slate-400 text-sm mt-1">{t('mayTakeMinutes')}</p>
          </div>
        </div>
      </main>
    );
  }

  // Completed — but loading result
  if (!designResult) {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-lego-yellow animate-spin mb-4" />
          <p className="text-white font-medium">{t('loadingResult')}</p>
        </div>
      </main>
    );
  }

  // Completed — full result
  return (
    <main className="min-h-screen p-4 sm:p-8 pb-32">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/create" className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-3 inline-block">
            &larr; {t('backToCreate')}
          </Link>
          {isNewPipeline && <DesignStepIndicator {...getStepState()} />}
          <h1 className="text-3xl font-extrabold text-white">{designResult.buildPlan.title}</h1>
          <p className="text-slate-400 mt-1">{designResult.referenceDescription}</p>
        </div>

        {/* Photo → LEGO Views Hero */}
        {(referenceUrl || compositeUrl) && (
          <div className="mb-8">
            <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-4 items-start">
              {referenceUrl && (
                <div>
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                    <img src={referenceUrl} alt={t('yourPhoto')} className="w-full aspect-square object-cover" />
                  </div>
                  <p className="text-[10px] text-slate-500 text-center mt-1.5 font-medium">{t('original')}</p>
                </div>
              )}
              {compositeUrl && (
                <div>
                  <div className="rounded-xl overflow-hidden border border-lego-yellow/20 bg-slate-900">
                    <img src={compositeUrl} alt={t('designViews')} className="w-full object-contain" />
                  </div>
                  <p className="text-[10px] text-lego-yellow/60 text-center mt-1.5 font-medium">{t('aiViews')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="brick-card p-4 text-center">
            <p className="text-2xl font-extrabold text-lego-yellow">{designResult.buildPlan.steps.length}</p>
            <p className="text-xs text-slate-500 mt-1">{t('steps')}</p>
          </div>
          <div className="brick-card p-4 text-center">
            <p className="text-2xl font-extrabold text-lego-blue">{designResult.requiredParts.length}</p>
            <p className="text-xs text-slate-500 mt-1">{t('uniqueParts')}</p>
          </div>
          <div className="brick-card p-4 text-center">
            <p className="text-2xl font-extrabold text-lego-green">{totalParts}</p>
            <p className="text-xs text-slate-500 mt-1">{t('totalPieces')}</p>
          </div>
        </div>

        {/* Description & Lore */}
        <div className="brick-card p-5 mb-8">
          <p className="text-sm text-slate-300 leading-relaxed">{designResult.buildPlan.description}</p>
          <p className="text-xs text-slate-500 mt-3 italic">{designResult.buildPlan.lore}</p>
        </div>

        {/* Required Parts */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {t('requiredParts')}
            </h2>
            <span className="text-xs text-slate-600">
              {mappedCount}/{designResult.requiredParts.length} {t('onBrickLink')} · {totalParts} {tc('total')}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {designResult.requiredParts.map((part, i) => (
              <PartCard key={i} part={part} />
            ))}
          </div>

          {/* Buy parts actions */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleDownloadWantedList}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-lego-border text-slate-400 hover:border-lego-blue hover:text-lego-blue transition-colors text-sm font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              {t('brickLinkXml')}
            </button>
            <a
              href="https://www.lego.com/pick-and-build/pick-a-brick"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-lego-border text-slate-400 hover:border-lego-red hover:text-lego-red transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('pickABrick')}
            </a>
          </div>
        </div>

        {/* Open in Workspace button */}
        <button
          onClick={handleOpenWorkspace}
          className="w-full px-4 py-3 rounded-lg font-bold transition-all bg-lego-yellow hover:bg-yellow-400 text-slate-900 shadow-[0_2px_0_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-[2px]"
        >
          <span className="flex items-center justify-center gap-2">
            <Box className="w-4 h-4" />
            {t('open3D')}
          </span>
        </button>
      </div>
    </main>
  );
}

// Mini view card for the generating_build state
function MiniViewCard({ label, path }: { label: string; path: string }) {
  const url = useStorageUrl(path);
  return (
    <div>
      <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
        {url ? (
          <img src={url} alt={`${label}`} className="w-full object-contain" />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
