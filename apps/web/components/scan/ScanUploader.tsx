'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Loader2,
  Camera,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { apiClient } from '../../lib/api/client';
import { useJobsStore } from '../../lib/stores/jobs';
import { useToastStore } from '../../lib/stores/toasts';

const SAMPLES = [
  { path: '/samples/level1.png', label: 'Level 1', description: 'Few bricks' },
  { path: '/samples/level2.png', label: 'Level 2', description: 'Medium mix' },
  { path: '/samples/level3.png', label: 'Level 3', description: 'Many bricks' },
] as const;

type ScanPhase = 'idle' | 'selected' | 'submitting' | 'error';

export function ScanUploader() {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [image, setImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addJob = useJobsStore((s) => s.addJob);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      setImage(base64);
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

  const handleUseSample = useCallback(async (path: string) => {
    setLoadingSample(true);
    setError(null);
    try {
      const res = await fetch(path);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        const base64 = dataUrl.split(',')[1];
        setImage(base64);
        setPhase('selected');
      };
      reader.readAsDataURL(blob);
    } catch {
      setError('Failed to load sample image');
    } finally {
      setLoadingSample(false);
    }
  }, []);

  const handleScan = async () => {
    if (!image) return;
    setPhase('submitting');
    setError(null);
    try {
      const { jobId } = await apiClient.submitScan(image);
      addJob(jobId, 'scan');
      useToastStore.getState().addToast({
        message: 'Scan queued! We\'ll notify you when it\'s ready.',
        variant: 'info',
        action: { label: 'View scans', href: '/scan' },
      });
      // Reset to idle
      setPhase('idle');
      setPreview(null);
      setImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit scan');
      setPhase('error');
    }
  };

  const handleDiscard = () => {
    setPhase('idle');
    setPreview(null);
    setImage(null);
    setError(null);
  };

  // --- ERROR STATE ---
  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-slate-900 border border-red-900/30 p-8 rounded-3xl max-w-sm w-full">
          <h2 className="text-2xl font-bold text-red-500 mb-3">Scan Failed</h2>
          <p className="text-slate-300 mb-8">{error}</p>
          <button
            onClick={handleDiscard}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --- IDLE / SELECTED STATE ---
  return (
    <div className="space-y-6">
      <Card>
        {preview ? (
          <div className="flex flex-col items-center gap-4 p-4 sm:p-8">
            <img src={preview} alt="Selected" className="max-h-64 rounded-lg" />
            <button
              type="button"
              onClick={handleDiscard}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Choose different image
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-4 sm:p-8">
            <Camera className="w-12 h-12 text-slate-500" />
            <span className="text-slate-400 text-center">
              Take or upload a photo of your bricks
            </span>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="sm:hidden flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:border-blue-500 hover:text-blue-400 transition-colors"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:border-blue-500 hover:text-blue-400 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Upload Photo
              </button>
            </div>

            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500">or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            <div className="flex flex-col items-center gap-2 w-full">
              <span className="text-xs text-slate-500">Try a sample photo</span>
              <div className="flex gap-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.path}
                    type="button"
                    onClick={() => handleUseSample(sample.path)}
                    disabled={loadingSample}
                    className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors disabled:opacity-50"
                  >
                    {loadingSample ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <img
                        src={sample.path}
                        alt={sample.label}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    <span className="text-xs font-medium">{sample.label}</span>
                    <span className="text-[10px] text-slate-500">{sample.description}</span>
                  </button>
                ))}
              </div>
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
        <button
          onClick={handleScan}
          disabled={phase === 'submitting'}
          className="w-full px-4 py-3 rounded-lg font-bold transition-all bg-lego-red hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_0_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-[2px]"
        >
          <span className="flex items-center justify-center gap-2">
            {phase === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Scan Bricks
              </>
            )}
          </span>
        </button>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
