'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Stage } from '@react-three/drei';
import { ZoomIn, X, Trash2, Plus, Minus, Tag } from 'lucide-react';
import type { DetectedPart, BuildStepBlock } from '@brick-quest/shared';
import { getBrickHeight } from '@brick-quest/shared';
import { LegoBrick } from '../three/LegoBrick';

interface PartDetailModalProps {
  part: DetectedPart;
  onClose: () => void;
  onDelete: (part: DetectedPart) => void;
  onUpdateCount?: (part: DetectedPart, newCount: number) => void;
  onUpdateTags?: (part: DetectedPart, tags: string[]) => void;
}

export function PartDetailModal({ part, onClose, onDelete, onUpdateCount, onUpdateTags }: PartDetailModalProps) {
  const t = useTranslations('parts');
  const tc = useTranslations('common');
  const [localCount, setLocalCount] = useState(part.count);
  const [localTags, setLocalTags] = useState<string[]>(part.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  const mockBlock: BuildStepBlock = {
    stepId: 0,
    partName: part.name,
    color: part.color,
    hexColor: part.hexColor,
    type: part.type,
    shape: part.shape,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    size: {
      width: part.dimensions.width,
      height: getBrickHeight(part.shape, part.type),
      length: part.dimensions.length,
    },
    description: '',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center flex-none">
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <ZoomIn className="w-5 h-5 text-blue-500" />
            {t('inspectBrick')}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* 3D Viewport */}
          <div className="h-44 md:h-56 bg-slate-950 relative flex-none border-b border-slate-800">
            <Canvas shadows dpr={[1, 2]} camera={{ position: [4, 4, 4], fov: 45 }}>
              <color attach="background" args={['#020617']} />
              <Environment preset="studio" />
              <Stage environment="city" intensity={0.6} adjustCamera={1.2}>
                <LegoBrick block={mockBlock} />
              </Stage>
              <OrbitControls autoRotate autoRotateSpeed={4} makeDefault />
            </Canvas>
          </div>

          {/* Details */}
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {t('partName')}
                </span>
                <p className="text-xl font-bold text-white leading-tight truncate mt-1">{part.name}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  {t('quantity')}
                </span>
                {onUpdateCount ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const newCount = Math.max(1, localCount - 1);
                        setLocalCount(newCount);
                        onUpdateCount(part, newCount);
                      }}
                      disabled={localCount <= 1}
                      className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-bold text-yellow-400 w-8 text-center">
                      {localCount}
                    </span>
                    <button
                      onClick={() => {
                        const newCount = localCount + 1;
                        setLocalCount(newCount);
                        onUpdateCount(part, newCount);
                      }}
                      className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center text-white transition-colors hover:bg-slate-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-yellow-400">{part.count}x</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 p-3 rounded-xl flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-slate-600 shrink-0"
                  style={{ backgroundColor: part.hexColor }}
                />
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">{t('color')}</span>
                  <p className="font-medium text-xs text-white truncate">{part.color}</p>
                </div>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase">
                  {t('dimensions')}
                </span>
                <span className="font-mono text-sm text-white font-bold">
                  {part.dimensions.width} x {part.dimensions.length}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">{tc('studs')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase">{t('type')}</span>
                <span className="font-bold text-xs text-blue-400 uppercase">{part.type}</span>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase">{t('shape')}</span>
                <span className="font-bold text-xs text-slate-300 uppercase">{part.shape}</span>
              </div>
            </div>

            {/* Tags */}
            {onUpdateTags && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('tags')}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = tagInput.trim().toLowerCase();
                        if (trimmed && !localTags.includes(trimmed)) {
                          const newTags = [...localTags, trimmed];
                          setLocalTags(newTags);
                          onUpdateTags(part, newTags);
                        }
                        setTagInput('');
                      }
                    }}
                    placeholder={t('addTag')}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = tagInput.trim().toLowerCase();
                      if (trimmed && !localTags.includes(trimmed)) {
                        const newTags = [...localTags, trimmed];
                        setLocalTags(newTags);
                        onUpdateTags(part, newTags);
                      }
                      setTagInput('');
                    }}
                    disabled={!tagInput.trim()}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {t('add')}
                  </button>
                </div>
                {localTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {localTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
                        {tag}
                        <button
                          type="button"
                          onClick={() => {
                            const newTags = localTags.filter((t) => t !== tag);
                            setLocalTags(newTags);
                            onUpdateTags(part, newTags);
                          }}
                          className="hover:text-blue-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => onDelete(part)}
                className="flex-1 py-3.5 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wide"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={onClose}
                className="flex-[2] py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-xs uppercase tracking-wide"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
