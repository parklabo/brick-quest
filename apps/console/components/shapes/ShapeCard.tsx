import Link from 'next/link';
import type { ShapeDefinition } from '@brick-quest/shared';

interface ShapeCardProps {
  shape: ShapeDefinition;
}

const CATEGORY_COLORS: Record<string, string> = {
  basic: 'bg-blue-900/30 text-blue-400',
  slope: 'bg-amber-900/30 text-amber-400',
  curved: 'bg-purple-900/30 text-purple-400',
  special: 'bg-green-900/30 text-green-400',
  technic: 'bg-red-900/30 text-red-400',
};

export function ShapeCard({ shape }: ShapeCardProps) {
  return (
    <Link href={`/shapes/${shape.id}`}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 hover:bg-slate-900/80 transition-all group">
        {/* Preview area */}
        <div className="h-28 bg-slate-800 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
          <div
            className="w-14 h-14 bg-blue-500 group-hover:scale-110 transition-transform"
            style={{
              borderRadius: shape.icon2d.borderRadius,
              clipPath: shape.icon2d.clipPath ?? 'none',
              backgroundImage: shape.icon2d.gradient ?? 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.1) 100%)',
            }}
          />
        </div>

        {/* Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white truncate">{shape.label}</h3>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[shape.category] ?? 'bg-slate-800 text-slate-400'}`}>
              {shape.category}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 line-clamp-2">{shape.description}</p>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
              Tier {shape.tier}
            </span>
            <span className="text-[9px] font-bold text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
              {shape.geometry.kind}
            </span>
            {shape.studs.hasStuds && (
              <span className="text-[9px] font-bold text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                studs
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
