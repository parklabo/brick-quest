'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useInventoryStore } from '../../lib/stores/inventory';
import { apiClient } from '../../lib/api/client';
import { useJobsStore } from '../../lib/stores/jobs';
import { useToastStore } from '../../lib/stores/toasts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { BuildPlan, Difficulty } from '@brick-quest/shared';

const Lego3DScene = dynamic(() => import('../three/Lego3DScene'), { ssr: false });

const DIFFICULTY_OPTIONS: Difficulty[] = ['beginner', 'normal', 'expert'];

function DifficultySelect({
  value,
  onChange,
  t,
}: {
  value: Difficulty;
  onChange: (v: Difficulty) => void;
  t: ReturnType<typeof useTranslations<'build'>>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm text-slate-400 mb-2">{t('difficulty')}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/80 border border-white/8 hover:border-white/15 transition-colors text-left"
      >
        <span className="font-medium">{t(value)}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl bg-slate-800 border border-white/8 shadow-xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {DIFFICULTY_OPTIONS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => { onChange(level); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                value === level
                  ? 'bg-lego-yellow/10 text-lego-yellow'
                  : 'text-slate-300 hover:bg-white/4'
              }`}
            >
              <span className="font-medium">{t(level)}</span>
              {value === level && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
        action: { label: t('viewBuilds'), href: '/builds' },
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
        <DifficultySelect value={difficulty} onChange={setDifficulty} t={t} />
        <div>
          <label className="block text-sm text-slate-400 mb-2">{t('whatToBuild')}</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('buildPlaceholder')}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(['airplane', 'castle', 'car', 'rocket', 'robot', 'animal'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPrompt(t(`sample_${key}`))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  prompt === t(`sample_${key}`)
                    ? 'bg-lego-yellow/20 text-lego-yellow ring-1 ring-lego-yellow/30'
                    : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-300 ring-1 ring-white/[0.06]'
                }`}
              >
                {t(`sampleChip_${key}`)}
              </button>
            ))}
          </div>
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
