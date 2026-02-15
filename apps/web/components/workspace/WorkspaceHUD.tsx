'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useWorkspaceStore } from '../../lib/stores/workspace';

export function WorkspaceHUD() {
  const selectedBrickId = useWorkspaceStore((s) => s.selectedBrickId);
  const placedBricks = useWorkspaceStore((s) => s.placedBricks);
  const currentStep = useWorkspaceStore((s) => s.currentStep);
  const plan = useWorkspaceStore((s) => s.plan);

  const selectedBrick = selectedBrickId ? placedBricks.find((b) => b.instanceId === selectedBrickId) : null;
  const currentStepData = plan && currentStep >= 0 && currentStep < plan.steps.length ? plan.steps[currentStep] : null;

  return (
    <>
      {/* Back to Build — top left */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          href="/build"
          className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Build
        </Link>
      </div>

      {/* Controls hint bar — bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md rounded-xl px-6 py-3 text-xs text-slate-300 flex gap-4 items-center">
          <span><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-white">WASD</kbd> pan</span>
          <span className="text-slate-600">|</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-white">Q</kbd><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-white ml-0.5">E</kbd> orbit</span>
          <span className="text-slate-600">|</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-white">R</kbd><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-white ml-0.5">F</kbd> height</span>
          <span className="text-slate-600">|</span>
          <span>Right-drag orbit</span>
          <span className="text-slate-600">|</span>
          <span>Scroll zoom</span>
          <span className="text-slate-600">|</span>
          <span>Click brick to select</span>
        </div>
      </div>

      {/* Step counter + description — top center */}
      {plan && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md rounded-xl px-6 py-3 text-center">
            <p className="text-sm text-white font-medium">
              {plan.title} — {currentStep + 1} / {plan.steps.length} steps
            </p>
            {currentStepData?.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-sm">{currentStepData.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Selected brick info — bottom right */}
      {selectedBrick && (
        <div className="absolute bottom-20 right-4 z-10">
          <div className="bg-black/70 backdrop-blur-md rounded-xl p-4 text-sm text-white w-64 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg border border-slate-600 shrink-0" style={{ backgroundColor: selectedBrick.hexColor }} />
              <div>
                <p className="font-bold">{selectedBrick.partName}</p>
                <p className="text-xs text-slate-400">{selectedBrick.color}</p>
              </div>
            </div>
            <div className="space-y-1 text-xs text-slate-300">
              <p>Type: <span className="text-white">{selectedBrick.type}</span> · Shape: <span className="text-white">{selectedBrick.shape}</span></p>
              <p>Size: <span className="text-white">{selectedBrick.size.width}×{selectedBrick.size.length}</span> studs</p>
              <p>Position: <span className="text-white">X:{selectedBrick.position.x} Y:{selectedBrick.position.y} Z:{selectedBrick.position.z}</span></p>
              <p className="text-slate-400 italic mt-2">{selectedBrick.description}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
