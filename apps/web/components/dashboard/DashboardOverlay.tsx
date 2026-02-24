'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useInventoryStore } from '../../lib/stores/inventory';

export function DashboardOverlay() {
  const t = useTranslations('dashboard');
  const parts = useInventoryStore((s) => s.parts);
  const totalBricks = parts.reduce((sum, p) => sum + p.count, 0);
  const uniqueTypes = parts.length;
  const hasInventory = totalBricks > 0;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center">
      {/* Title */}
      <div className="mt-4 sm:mt-6 flex items-center gap-2.5">
        <Image
          src="/logo.png"
          alt="Brick Quest"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
          {t('title')}
        </h1>
      </div>

      {/* Stats row — only when inventory has items */}
      {hasInventory && (
        <div className="mt-3 flex gap-3">
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-sm font-bold text-lego-red">{totalBricks}</span>
            <span className="text-[11px] text-slate-400">{t('totalBricks')}</span>
          </div>
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-sm font-bold text-lego-blue">{uniqueTypes}</span>
            <span className="text-[11px] text-slate-400">{t('uniqueParts')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
