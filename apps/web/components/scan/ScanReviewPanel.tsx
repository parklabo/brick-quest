'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  Camera,
  Sparkles,
  Plus,
  X,
  Package,
  ScanLine,
  PackageCheck,
  Undo2,
} from 'lucide-react';
import { BrickIcon } from '../ui/BrickIcon';
import { TagInput } from '../ui/TagInput';
import { PartDetailModal } from './PartDetailModal';
import { useInventoryStore } from '../../lib/stores/inventory';
import type { ScanResult, DetectedPart } from '@brick-quest/shared';

interface ScanReviewPanelProps {
  result: ScanResult;
  imageUrl?: string;
  alreadyAdded?: boolean;
  onAdded?: () => void;
  onUnmarked?: () => void;
}

export function ScanReviewPanel({ result, imageUrl, alreadyAdded = false, onAdded, onUnmarked }: ScanReviewPanelProps) {
  const t = useTranslations('scanReview');
  const tc = useTranslations('common');
  const router = useRouter();
  const [phase, setPhase] = useState<'review' | 'added'>('review');
  const [addedCount, setAddedCount] = useState(0);
  const [scannedParts, setScannedParts] = useState<DetectedPart[]>(result.parts);
  const [inspectedPart, setInspectedPart] = useState<DetectedPart | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [scanTags, setScanTags] = useState<string[]>([]);
  const [removedPartIds, setRemovedPartIds] = useState<Set<string>>(new Set());

  const addParts = useInventoryStore((s) => s.addParts);
  const removeParts = useInventoryStore((s) => s.removeParts);

  const handleAddToInventory = () => {
    if (scannedParts.length > 0) {
      const totalPieces = scannedParts.reduce((sum, p) => sum + p.count, 0);
      const partsWithTags = scanTags.length > 0
        ? scannedParts.map((p) => ({ ...p, tags: [...(p.tags ?? []), ...scanTags] }))
        : scannedParts;
      addParts(partsWithTags);
      setAddedCount(totalPieces);
      setPhase('added');
      onAdded?.();
    }
  };

  const handleRemoveFromInventory = (part: DetectedPart) => {
    removeParts([part]);
    setRemovedPartIds((prev) => new Set(prev).add(part.id));
  };

  const allPartsRemoved = alreadyAdded && removedPartIds.size === scannedParts.length;

  const handleDeletePart = (part: DetectedPart) => {
    setScannedParts((prev) => prev.filter((p) => p.id !== part.id));
    setInspectedPart(null);
  };

  const handleUpdateCount = (part: DetectedPart, newCount: number) => {
    setScannedParts((prev) => prev.map((p) => (p.id === part.id ? { ...p, count: newCount } : p)));
  };

  const isAdded = alreadyAdded || phase === 'added';

  // --- ADDED SUCCESS STATE ---
  if (phase === 'added') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-xs w-full">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white text-center">{t('added')}</h2>
          <p className="text-slate-400 text-sm mt-2 text-center">
            {t('bricksAdded', { count: addedCount })}
          </p>
          <div className="flex flex-col gap-3 w-full mt-8">
            <button
              onClick={() => router.push('/inventory')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              {t('viewInventory')}
            </button>
            <button
              onClick={() => router.push('/scan')}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ScanLine className="w-5 h-5" />
              {t('scanMore')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Action button (shared between desktop/mobile)
  const addButton = isAdded ? (
    <button
      disabled
      className="flex-1 py-3 bg-slate-800 text-slate-500 font-bold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
    >
      <PackageCheck className="w-5 h-5" />
      {t('alreadyAdded')}
    </button>
  ) : (
    <button
      onClick={handleAddToInventory}
      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors active:bg-blue-500"
    >
      <Plus className="w-5 h-5" />
      {t('addToInventory')}
    </button>
  );

  // --- REVIEW STATE ---
  return (
    <div className="space-y-0">
      {/* Mobile Image Preview Overlay */}
      {showImagePreview && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setShowImagePreview(false)}
        >
          <img src={imageUrl} alt={t('original')} className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="bg-slate-900 border border-slate-800 rounded-t-xl px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            {t('reviewTitle')}
          </h2>
          <div className="flex items-center gap-2">
            {isAdded && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <PackageCheck className="w-3.5 h-3.5" />
                {t('inInventory')}
              </span>
            )}
            <span className="bg-slate-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg border border-slate-700">
              {t('partsFound', { count: scannedParts.length })}
            </span>
          </div>
        </div>

        <div className="flex border border-t-0 border-slate-800 rounded-b-xl overflow-hidden">
          {/* Left: Image + Insight */}
          <div className="w-1/2 flex flex-col border-r border-slate-800 bg-slate-900/50">
            <div className="flex-1 relative flex items-center justify-center p-6">
              {imageUrl && (
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
                  <img src={imageUrl} alt={t('original')} className="max-w-full max-h-[40vh] object-contain rounded-lg" />
                </div>
              )}
              {imageUrl && (
                <div className="absolute top-6 left-6 bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 flex items-center gap-2">
                  <Camera className="w-3 h-3" /> {t('original')}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-900">
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-white text-sm mb-1">{t('aiInsight')}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed italic">&ldquo;{result.aiInsight}&rdquo;</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Parts Grid */}
          <div className="w-1/2 bg-slate-900/80 flex flex-col">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex-none">
              <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">{t('detectedInventory')}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 max-h-[50vh]">
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                {scannedParts.map((part) => {
                  const isRemoved = removedPartIds.has(part.id);
                  return (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => {
                        if (isAdded && !isRemoved) {
                          handleRemoveFromInventory(part);
                        } else if (!isAdded) {
                          setInspectedPart(part);
                        }
                      }}
                      className={`bg-slate-800 rounded-xl p-3 flex flex-col items-center cursor-pointer border transition-colors relative ${
                        isRemoved
                          ? 'opacity-40 border-slate-700 cursor-default'
                          : isAdded
                            ? 'border-red-500/50 hover:border-red-500 hover:bg-red-900/20'
                            : 'border-slate-700 hover:bg-slate-700 hover:border-blue-500'
                      }`}
                    >
                      {isRemoved && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl">
                          <span className="text-[10px] font-bold text-red-400 uppercase">{t('removed')}</span>
                        </div>
                      )}
                      <BrickIcon
                        width={part.dimensions.width}
                        length={part.dimensions.length}
                        hexColor={part.hexColor}
                        type={part.type}
                        shape={part.shape}
                        maxSize={50}
                        className="mb-2"
                      />
                      <span className="font-bold text-white text-lg">{part.count}x</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide text-center line-clamp-1">
                        {part.color}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Tag Input (before adding) */}
            {!isAdded && (
              <TagInput
                tags={scanTags}
                onTagsChange={setScanTags}
                className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex-none"
              />
            )}
            {/* Removal info */}
            {isAdded && removedPartIds.size > 0 && (
              <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex-none">
                <p className="text-xs text-red-400">{t('partsRemoved', { removed: removedPartIds.size, total: scannedParts.length })}</p>
              </div>
            )}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3 flex-none">
              <button
                onClick={() => router.back()}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
              >
                {tc('back')}
              </button>
              {allPartsRemoved ? (
                <button
                  onClick={() => onUnmarked?.()}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Undo2 className="w-5 h-5" />
                  {t('unmarkAdded')}
                </button>
              ) : addButton}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-0">
        {imageUrl && (
          <div className="bg-slate-900 border border-slate-800 rounded-t-xl overflow-hidden">
            <div
              className="relative aspect-[2/1] bg-slate-950 cursor-pointer active:opacity-90 transition-opacity"
              onClick={() => setShowImagePreview(true)}
            >
              <img src={imageUrl} alt={t('original')} className="w-full h-full object-contain p-4" />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[10px] font-medium border border-white/10 flex items-center gap-1.5">
                <Camera className="w-3 h-3" /> {t('tapToView')}
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-medium">{t('detected')}</span>
                <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded">
                  {scannedParts.length} {tc('types')}
                </span>
                <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-0.5 rounded">
                  {scannedParts.reduce((acc, p) => acc + p.count, 0)} {tc('pcs')}
                </span>
              </div>
              {isAdded && (
                <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                  <PackageCheck className="w-3 h-3" /> {t('added')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Parts Grid */}
        <div className={`border-x border-slate-800 bg-slate-900 p-3 ${!imageUrl ? 'rounded-t-xl border-t' : ''}`}>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
            {t('detectedInventory')}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {scannedParts.map((part) => {
              const isRemoved = removedPartIds.has(part.id);
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => {
                    if (isAdded && !isRemoved) {
                      handleRemoveFromInventory(part);
                    } else if (!isAdded) {
                      setInspectedPart(part);
                    }
                  }}
                  className={`bg-slate-800 rounded-xl p-3 flex flex-col items-center transition-colors cursor-pointer border relative ${
                    isRemoved
                      ? 'opacity-40 border-slate-700 cursor-default'
                      : isAdded
                        ? 'border-red-500/50 active:bg-red-900/20'
                        : 'border-slate-700 active:bg-slate-700'
                  }`}
                >
                  {isRemoved && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] font-bold text-red-400 uppercase">{t('removed')}</span>
                    </div>
                  )}
                  <div className="mb-2">
                    <BrickIcon
                      width={part.dimensions.width}
                      length={part.dimensions.length}
                      hexColor={part.hexColor}
                      type={part.type}
                      shape={part.shape}
                      maxSize={44}
                    />
                  </div>
                  <span className="font-bold text-white text-lg leading-none mb-1">{part.count}x</span>
                  <span className="text-[10px] text-slate-400 font-medium uppercase text-center w-full truncate">
                    {part.color}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tag Input (before adding) - Mobile */}
        {!isAdded && (
          <TagInput
            tags={scanTags}
            onTagsChange={setScanTags}
            className="border-x border-slate-800 bg-slate-900 px-3 pb-3"
          />
        )}

        {/* Removal info - Mobile */}
        {isAdded && removedPartIds.size > 0 && (
          <div className="border-x border-slate-800 bg-slate-900 px-3 pb-2">
            <p className="text-xs text-red-400">{t('partsRemoved', { removed: removedPartIds.size, total: scannedParts.length })}</p>
          </div>
        )}

        {/* AI Insight */}
        <div className="border-x border-slate-800 bg-slate-900 p-3 pt-0">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white text-xs uppercase mb-1 tracking-wide">{t('aiInsight')}</h4>
                <p className="text-slate-300 text-xs leading-relaxed italic">&ldquo;{result.aiInsight}&rdquo;</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border border-t-0 border-slate-800 rounded-b-xl bg-slate-900 p-3">
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl transition-colors active:bg-slate-700"
            >
              {tc('back')}
            </button>
            {allPartsRemoved ? (
              <button
                onClick={() => onUnmarked?.()}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Undo2 className="w-5 h-5" />
                {t('unmarkAdded')}
              </button>
            ) : addButton}
          </div>
        </div>
      </div>

      {/* Part Detail Modal */}
      {inspectedPart && (
        <PartDetailModal
          part={inspectedPart}
          onClose={() => setInspectedPart(null)}
          onDelete={handleDeletePart}
          onUpdateCount={handleUpdateCount}
        />
      )}
    </div>
  );
}
