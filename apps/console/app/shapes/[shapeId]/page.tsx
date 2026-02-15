'use client';

import { use } from 'react';
import { SHAPE_REGISTRY, type BrickShape } from '@brick-quest/shared';
import { ShapePreview3D } from '../../../components/shapes/ShapePreview3D';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ShapeDetailPage({ params }: { params: Promise<{ shapeId: string }> }) {
  const { shapeId } = use(params);
  const def = SHAPE_REGISTRY.get(shapeId as BrickShape);

  if (!def) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Shape not found: {shapeId}</p>
        <Link href="/shapes" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
          Back to shapes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/shapes" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to shapes
      </Link>

      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{def.label}</h1>
          <p className="text-sm text-slate-500 mt-1">{def.description}</p>
        </div>
      </div>

      {/* 3D Preview */}
      <ShapePreview3D shapeId={def.id} className="h-72" />

      {/* Properties Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Identity</h3>
          <Property label="ID" value={def.id} />
          <Property label="Category" value={def.category} />
          <Property label="Tier" value={String(def.tier)} />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Geometry</h3>
          <Property label="Kind" value={def.geometry.kind} />
          {def.geometry.slopeAngleDeg != null && (
            <Property label="Slope Angle" value={`${def.geometry.slopeAngleDeg}\u00b0`} />
          )}
          {def.geometry.curveSegments != null && (
            <Property label="Curve Segments" value={String(def.geometry.curveSegments)} />
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Studs</h3>
          <Property label="Has Studs" value={def.studs.hasStuds ? 'Yes' : 'No'} />
          <Property label="Layout" value={def.studs.layout} />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Heights</h3>
          <Property label="Brick" value={String(def.heights.brick)} />
          <Property label="Plate" value={String(def.heights.plate)} />
          <Property label="Tile" value={String(def.heights.tile)} />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 sm:col-span-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gemini Aliases</h3>
          <div className="flex flex-wrap gap-2">
            {def.geminiAliases.map((alias) => (
              <span key={alias} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-lg font-mono">
                {alias}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 sm:col-span-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Compatible Types</h3>
          <div className="flex flex-wrap gap-2">
            {def.compatibleTypes.map((t) => (
              <span key={t} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-lg">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-mono text-white">{value}</span>
    </div>
  );
}
