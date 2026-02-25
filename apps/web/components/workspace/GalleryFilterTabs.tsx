'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, Hammer } from 'lucide-react';

export type GalleryFilter = 'all' | 'design' | 'build';

interface GalleryFilterTabsProps {
  filter: GalleryFilter;
  onFilterChange: (filter: GalleryFilter) => void;
  counts: { all: number; design: number; build: number };
}

export function GalleryFilterTabs({ filter, onFilterChange, counts }: GalleryFilterTabsProps) {
  const t = useTranslations('workspace');

  const tabs: { key: GalleryFilter; label: string; icon?: React.ReactNode; color: string }[] = [
    { key: 'all', label: t('filterAll'), color: 'white' },
    { key: 'design', label: t('filterDesign'), icon: <Sparkles className="w-3 h-3" />, color: 'lego-yellow' },
    { key: 'build', label: t('filterBuild'), icon: <Hammer className="w-3 h-3" />, color: 'lego-orange' },
  ];

  return (
    <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg">
      {tabs.map((tab) => {
        const isActive = filter === tab.key;
        const activeColor =
          tab.key === 'design'
            ? 'bg-lego-yellow/15 text-lego-yellow'
            : tab.key === 'build'
              ? 'bg-lego-orange/15 text-lego-orange'
              : 'bg-white/10 text-white';

        return (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              isActive ? activeColor : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`text-[10px] ${isActive ? 'opacity-70' : 'opacity-40'}`}>{counts[tab.key]}</span>
          </button>
        );
      })}
    </div>
  );
}
