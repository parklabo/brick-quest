'use client';

import { useState } from 'react';
import { SHAPE_REGISTRY, ALL_BRICK_SHAPES, type ShapeCategory } from '@brick-quest/shared';
import { ShapeCard } from '../../components/shapes/ShapeCard';

const CATEGORIES: (ShapeCategory | 'all')[] = ['all', 'basic', 'slope', 'curved', 'special', 'technic'];
const TIERS: ('all' | 1 | 2)[] = ['all', 1, 2];

export default function ShapesPage() {
  const [category, setCategory] = useState<ShapeCategory | 'all'>('all');
  const [tier, setTier] = useState<'all' | 1 | 2>('all');

  const shapes = ALL_BRICK_SHAPES
    .map((id) => SHAPE_REGISTRY.get(id)!)
    .filter((d) => category === 'all' || d.category === category)
    .filter((d) => tier === 'all' || d.tier === tier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Shape Browser</h1>
        <p className="text-sm text-slate-500 mt-1">{shapes.length} shapes in registry</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Category</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Tier</span>
          {TIERS.map((t) => (
            <button
              key={String(t)}
              onClick={() => setTier(t)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                tier === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'all' : `tier ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {shapes.map((shape) => (
          <ShapeCard key={shape.id} shape={shape} />
        ))}
      </div>

      {shapes.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          No shapes match the current filters.
        </div>
      )}
    </div>
  );
}
