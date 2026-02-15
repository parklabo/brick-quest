'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useWorkspaceStore } from '../../lib/stores/workspace';

export function StepControls() {
  const plan = useWorkspaceStore((s) => s.plan);
  const currentStep = useWorkspaceStore((s) => s.currentStep);
  const setCurrentStep = useWorkspaceStore((s) => s.setCurrentStep);

  if (!plan) return null;

  const total = plan.steps.length;
  const step = currentStep + 1; // 1-indexed for display

  return (
    <div className="absolute bottom-8 sm:bottom-20 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-3 border border-slate-700">
        <button
          onClick={() => setCurrentStep(0)}
          disabled={currentStep <= 0}
          className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep <= 0}
          className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>

        <div className="text-white text-sm font-mono min-w-[80px] text-center">
          {step} / {total}
        </div>

        <button
          onClick={() => setCurrentStep(Math.min(total - 1, currentStep + 1))}
          disabled={currentStep >= total - 1}
          className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => setCurrentStep(total - 1)}
          disabled={currentStep >= total - 1}
          className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
