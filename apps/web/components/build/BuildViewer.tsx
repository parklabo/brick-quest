'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInventoryStore } from '../../lib/stores/inventory';
import { apiClient } from '../../lib/api/client';
import { useJobsStore } from '../../lib/stores/jobs';
import { useToastStore } from '../../lib/stores/toasts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { BuildPlan, Difficulty } from '@brick-quest/shared';

const Lego3DScene = dynamic(() => import('../three/Lego3DScene'), { ssr: false });

interface BuildViewerProps {
  initialPlan?: BuildPlan;
}

export function BuildViewer({ initialPlan }: BuildViewerProps) {
  const t = useTranslations('build');
  const parts = useInventoryStore((s) => s.parts);
  const addJob = useJobsStore((s) => s.addJob);
  const [plan, setPlan] = useState<BuildPlan | null>(initialPlan ?? null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (parts.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const { jobId } = await apiClient.submitBuild(parts, difficulty, prompt);
      addJob(jobId, 'build');
      useToastStore.getState().addToast({
        message: t('queued'),
        variant: 'info',
        action: { label: t('viewBuilds'), href: '/build' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (parts.length === 0 && !plan) {
    return (
      <Card className="text-center">
        <p className="text-slate-400">{t('emptyState')}</p>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">{t('difficulty')}</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
          >
            <option value="beginner">{t('beginner')}</option>
            <option value="normal">{t('normal')}</option>
            <option value="expert">{t('expert')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">{t('whatToBuild')}</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('buildPlaceholder')}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button onClick={handleGenerate} disabled={submitting} className="w-full">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('submitting')}
            </span>
          ) : (
            t('generateButton')
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <h2 className="text-xl font-bold">{plan.title}</h2>
        <p className="text-slate-400 text-sm">{plan.description}</p>
        <p className="text-slate-500 text-xs italic mt-1">{plan.lore}</p>
      </Card>

      <div className="w-full h-[60vh] min-h-[400px]">
        <Lego3DScene plan={plan} currentStepIndex={step} />
      </div>

      <Card className="!p-4 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="font-bold">{t('step')} {step + 1} / {plan.steps.length}</p>
          <p className="text-sm text-slate-400">{plan.steps[step]?.description}</p>
        </div>
        <Button variant="secondary" onClick={() => setStep(Math.min(plan.steps.length - 1, step + 1))} disabled={step >= plan.steps.length - 1}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </Card>

      <Button variant="secondary" onClick={() => setPlan(null)} className="w-full">
        {t('newBuild')}
      </Button>
    </div>
  );
}
