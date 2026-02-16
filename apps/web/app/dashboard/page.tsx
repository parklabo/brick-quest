'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ScanLine, Package, Hammer, Box, ArrowRight } from 'lucide-react';
import { useInventoryStore } from '../../lib/stores/inventory';
import { useJobsStore } from '../../lib/stores/jobs';
import { useTranslations } from 'next-intl';

const STAT_STYLES = [
  { bg: 'bg-lego-red/[0.06]', border: 'border-lego-red/10', text: 'text-lego-red' },
  { bg: 'bg-lego-blue/[0.06]', border: 'border-lego-blue/10', text: 'text-lego-blue' },
  { bg: 'bg-lego-green/[0.06]', border: 'border-lego-green/10', text: 'text-lego-green' },
  { bg: 'bg-lego-orange/[0.06]', border: 'border-lego-orange/10', text: 'text-lego-orange' },
] as const;

export default function DashboardPage() {
  const parts = useInventoryStore((s) => s.parts);
  const jobs = useJobsStore((s) => s.jobs);
  const t = useTranslations('dashboard');

  const totalBricks = parts.reduce((sum, p) => sum + p.count, 0);
  const uniqueTypes = parts.length;
  const totalScans = jobs.filter((j) => j.type === 'scan').length;
  const totalDesigns = jobs.filter((j) => j.type === 'design').length;

  const stats = [
    { label: t('totalBricks'), value: totalBricks },
    { label: t('uniqueParts'), value: uniqueTypes },
    { label: t('scans'), value: totalScans },
    { label: t('designs'), value: totalDesigns },
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-1">
        <Image src="/logo.png" alt="Brick Quest" width={36} height={36} className="rounded-lg" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <p className="text-slate-500 text-sm mb-8 ml-12">{t('subtitle')}</p>

      {/* Dual-mode hub */}
      <div className="grid gap-3 sm:grid-cols-2 mb-8">
        {/* Create: photo → LEGO design */}
        <Link
          href="/create"
          className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 transition-all hover:bg-white/[0.04] hover:border-lego-yellow/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-lego-yellow/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-lego-yellow" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-lego-yellow transition-colors ml-auto" />
          </div>
          <h2 className="text-lg font-bold text-white group-hover:text-lego-yellow transition-colors mb-1.5">
            {t('createTitle')}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {t('createDesc')}
          </p>
          <div className="mt-3">
            <span className="text-[11px] font-medium text-lego-yellow/50 bg-lego-yellow/[0.06] px-2 py-0.5 rounded-full">
              {t('createBadge')}
            </span>
          </div>
        </Link>

        {/* My Bricks: scan → inventory → build */}
        <Link
          href="/scan"
          className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 transition-all hover:bg-white/[0.04] hover:border-lego-blue/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-lego-blue/10 flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-lego-blue" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-lego-blue transition-colors ml-auto" />
          </div>
          <h2 className="text-lg font-bold text-white group-hover:text-lego-blue transition-colors mb-1.5">
            {t('myBricksTitle')}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {t('myBricksDesc')}
          </p>
          <div className="mt-3">
            <span className="text-[11px] font-medium text-lego-blue/50 bg-lego-blue/[0.06] px-2 py-0.5 rounded-full">
              {t('myBricksBadge')}
            </span>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-8">
        {stats.map((stat, i) => {
          const style = STAT_STYLES[i];
          return (
            <div key={stat.label} className={`${style.bg} border ${style.border} rounded-xl p-3.5`}>
              <p className={`text-xl font-bold ${style.text}`}>{stat.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <h2 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-3">
        {t('quickActions')}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { href: '/create', icon: <Sparkles className="w-4.5 h-4.5" />, title: t('createFromPhoto'), description: t('createFromPhotoDesc'), iconColor: 'text-lego-yellow', iconBg: 'bg-lego-yellow/10' },
          { href: '/scan', icon: <ScanLine className="w-4.5 h-4.5" />, title: t('scanBricks'), description: t('scanBricksDesc'), iconColor: 'text-lego-blue', iconBg: 'bg-lego-blue/10' },
          { href: '/builds', icon: <Hammer className="w-4.5 h-4.5" />, title: t('build'), description: t('buildDesc'), iconColor: 'text-lego-orange', iconBg: 'bg-lego-orange/10' },
          { href: '/inventory', icon: <Package className="w-4.5 h-4.5" />, title: t('inventory'), description: t('inventoryDesc'), iconColor: 'text-lego-green', iconBg: 'bg-lego-green/10' },
          { href: '/workspace', icon: <Box className="w-4.5 h-4.5" />, title: t('workspace'), description: t('workspaceDesc'), iconColor: 'text-lego-red', iconBg: 'bg-lego-red/10' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 flex items-center gap-3.5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
          >
            <div className={`w-9 h-9 rounded-lg ${action.iconBg} flex items-center justify-center shrink-0`}>
              <div className={action.iconColor}>{action.icon}</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{action.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{action.description}</p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </main>
  );
}
