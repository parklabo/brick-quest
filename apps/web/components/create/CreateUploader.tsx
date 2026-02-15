'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, Camera, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '../ui/Card';
import { apiClient } from '../../lib/api/client';
import { useJobsStore } from '../../lib/stores/jobs';
import { useToastStore } from '../../lib/stores/toasts';
type Phase = 'idle' | 'selected' | 'submitting' | 'error';

export function CreateUploader() {
  const t = useTranslations('create');
  const tc = useTranslations('common');
  const [phase, setPhase] = useState<Phase>('idle');
  const [image, setImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addJob = useJobsStore((s) => s.addJob);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImage(dataUrl.split(',')[1]);
      setError(null);
      setPhase('selected');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [processFile],
  );

  const handleSubmit = async () => {
    if (!image) return;
    setPhase('submitting');
    setError(null);
    try {
      const { jobId } = await apiClient.submitDesign(image, 'detailed', userPrompt);
      addJob(jobId, 'design');
      useToastStore.getState().addToast({
        message: t('queued'),
        variant: 'info',
        action: { label: t('viewDesigns'), href: '/create' },
      });
      setPhase('idle');
      setPreview(null);
      setImage(null);
      setUserPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('submitError'));
      setPhase('error');
    }
  };

  const handleDiscard = () => {
    setPhase('idle');
    setPreview(null);
    setImage(null);
    setError(null);
  };

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-slate-900 border border-red-900/30 p-8 rounded-3xl max-w-sm w-full">
          <h2 className="text-2xl font-bold text-red-500 mb-3">{t('failed')}</h2>
          <p className="text-slate-300 mb-8">{error}</p>
          <button
            onClick={handleDiscard}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            {tc('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        {preview ? (
          <div className="flex flex-col items-center gap-4 p-4 sm:p-8">
            <img src={preview} alt={t('selected')} className="max-h-64 rounded-lg" />
            <button
              type="button"
              onClick={handleDiscard}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              {t('chooseDifferent')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-4 sm:p-8">
            <Camera className="w-12 h-12 text-slate-500" />
            <span className="text-slate-400 text-center">
              {t('instruction')}
            </span>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="sm:hidden flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:border-lego-yellow hover:text-lego-yellow transition-colors"
              >
                <Camera className="w-5 h-5" />
                {t('takePhoto')}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:border-lego-yellow hover:text-lego-yellow transition-colors"
              >
                <Upload className="w-5 h-5" />
                {t('uploadPhoto')}
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>
        )}
      </Card>

      {image && (
        <>
          {/* Optional prompt */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">
              {t('notesLabel')}
            </label>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder={t('notesPlaceholder')}
              className="w-full px-4 py-3 rounded-lg bg-lego-surface border border-lego-border text-white placeholder:text-slate-600 focus:outline-none focus:border-lego-yellow/50 transition-colors"
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={phase === 'submitting'}
            className="w-full px-4 py-3 rounded-lg font-bold transition-all bg-lego-yellow hover:bg-yellow-400 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_0_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-[2px]"
          >
            <span className="flex items-center justify-center gap-2">
              {phase === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('designing')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('createButton')}
                </>
              )}
            </span>
          </button>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
