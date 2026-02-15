'use client';

import { useState, useMemo } from 'react';
import { useInventoryStore } from '../../lib/stores/inventory';
import { Button } from '../ui/Button';
import { BrickIcon } from '../ui/BrickIcon';
import { PartDetailModal } from '../scan/PartDetailModal';
import Link from 'next/link';
import { Package, Trash2, Box, ArrowRight, Hammer } from 'lucide-react';
import type { DetectedPart } from '@brick-quest/shared';

export function PartsList() {
  const parts = useInventoryStore((s) => s.parts);
  const clearParts = useInventoryStore((s) => s.clearParts);
  const removePart = useInventoryStore((s) => s.removePart);
  const updatePartCount = useInventoryStore((s) => s.updatePartCount);
  const updatePartTags = useInventoryStore((s) => s.updatePartTags);
  const [inspectedPart, setInspectedPart] = useState<DetectedPart | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of parts) {
      for (const t of p.tags ?? []) tagSet.add(t);
    }
    return [...tagSet].sort();
  }, [parts]);

  const filteredParts = activeTag ? parts.filter((p) => p.tags?.includes(activeTag)) : parts;
  const totalCount = filteredParts.reduce((sum, p) => sum + p.count, 0);

  if (parts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-24 h-24 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-slate-800">
          <Box className="w-12 h-12 text-slate-700" />
        </div>
        <p className="text-2xl font-bold text-white">No bricks yet</p>
        <p className="text-slate-400 mt-2">Scan some bricks to start building.</p>
        <Link href="/scan" className="mt-6">
          <Button>
            <span className="flex items-center gap-2">
              Start Scanning <ArrowRight className="w-4 h-4" />
            </span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-green-500" />
          <p className="text-slate-400">
            <span className="text-white font-bold">{totalCount}</span> bricks ·{' '}
            {filteredParts.length} types
          </p>
        </div>
        <button
          onClick={clearParts}
          className="text-red-400 hover:text-red-300 text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors hover:bg-red-900/20"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear All
        </button>
      </div>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTag === null
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTag === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Parts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {filteredParts.map((part) => (
          <button
            key={part.id}
            type="button"
            onClick={() => setInspectedPart(part)}
            className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col items-center hover:bg-slate-800 transition-colors cursor-pointer group relative overflow-hidden"
          >
            <div className="mb-3 transition-transform duration-200 group-hover:scale-110 pointer-events-none">
              <BrickIcon
                width={part.dimensions.width}
                length={part.dimensions.length}
                hexColor={part.hexColor}
                type={part.type}
                shape={part.shape}
                maxSize={80}
              />
            </div>
            {/* Count Badge */}
            <div className="absolute top-2 right-2 bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded border border-slate-700">
              {part.count}x
            </div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wide text-center line-clamp-1 mt-auto">
              {part.color}
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-1">
              {part.dimensions.width}x{part.dimensions.length}
            </span>
            {part.tags && part.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 justify-center">
                {part.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="bg-blue-500/20 text-blue-400 text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
                {part.tags.length > 2 && (
                  <span className="text-[9px] text-slate-500">+{part.tags.length - 2}</span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Build Button */}
      <div className="pt-2">
        <Link href="/builds" className="block">
          <button className="w-full py-4 px-6 bg-lego-yellow hover:bg-yellow-300 text-slate-900 font-extrabold rounded-lg transition-all flex items-center justify-center gap-3 text-lg shadow-[0_3px_0_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-[3px]">
            <Hammer className="w-6 h-6" />
            Build Something!
          </button>
        </Link>
      </div>

      {/* Part Detail Modal */}
      {inspectedPart && (
        <PartDetailModal
          part={inspectedPart}
          onClose={() => setInspectedPart(null)}
          onDelete={(part) => {
            removePart(part.id);
            setInspectedPart(null);
          }}
          onUpdateCount={(part, newCount) => {
            updatePartCount(part.id, newCount);
          }}
          onUpdateTags={(part, tags) => {
            updatePartTags(part.id, tags);
          }}
        />
      )}
    </div>
  );
}
