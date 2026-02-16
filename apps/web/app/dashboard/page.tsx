'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ScanLine, Package, Hammer, Box, ArrowRight } from 'lucide-react';
import { useInventoryStore } from '../../lib/stores/inventory';
import { useJobsStore } from '../../lib/stores/jobs';
import { useTranslations } from 'next-intl';

const STAT_STYLES = [
  { bg: 'bg-lego-red/10', border: 'border-lego-red/20', stud: 'bg-lego-red/40', text: 'text-lego-red' },
  { bg: 'bg-lego-blue/10', border: 'border-lego-blue/20', stud: 'bg-lego-blue/40', text: 'text-lego-blue' },
  { bg: 'bg-lego-green/10', border: 'border-lego-green/20', stud: 'bg-lego-green/40', text: 'text-lego-green' },
  { bg: 'bg-lego-orange/10', border: 'border-lego-orange/20', stud: 'bg-lego-orange/40', text: 'text-lego-orange' },
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
    <main className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
      <div className="flex items-center gap-3 mb-1">
        <Image src="/logo.png" alt="Brick Quest" width={40} height={40} className="rounded-lg" />
        <h1 className="text-3xl font-extrabold">{t('title')}</h1>
      </div>
      <p className="text-slate-400 text-sm mb-10 ml-[52px]">{t('subtitle')}</p>

      {/* Dual-mode hub */}
      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        {/* Create: photo → LEGO design */}
        <Link
          href="/create"
          className="group relative overflow-hidden rounded-2xl border border-lego-yellow/20 bg-linear-to-br from-lego-yellow/5 to-lego-yellow/[0.02] p-6 sm:p-8 transition-all hover:border-lego-yellow/40 hover:shadow-[0_4px_24px_rgba(252,203,21,0.1)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-lego-yellow/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-lego-yellow" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-lego-yellow transition-colors ml-auto" />
          </div>
          <h2 className="text-xl font-extrabold text-white group-hover:text-lego-yellow transition-colors mb-2">
            {t('createTitle')}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {t('createDesc')}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-lego-yellow/60 bg-lego-yellow/10 px-2.5 py-1 rounded-full">
              {t('createBadge')}
            </span>
          </div>
        </Link>

        {/* My Bricks: scan → inventory → build */}
        <Link
          href="/scan"
          className="group relative overflow-hidden rounded-2xl border border-lego-blue/20 bg-linear-to-br from-lego-blue/5 to-lego-blue/[0.02] p-6 sm:p-8 transition-all hover:border-lego-blue/40 hover:shadow-[0_4px_24px_rgba(0,108,183,0.1)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-lego-blue/15 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-lego-blue" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-lego-blue transition-colors ml-auto" />
          </div>
          <h2 className="text-xl font-extrabold text-white group-hover:text-lego-blue transition-colors mb-2">
            {t('myBricksTitle')}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {t('myBricksDesc')}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-lego-blue/60 bg-lego-blue/10 px-2.5 py-1 rounded-full">
              {t('myBricksBadge')}
            </span>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {stats.map((stat, i) => {
          const style = STAT_STYLES[i];
          return (
            <div key={stat.label} className={`${style.bg} border ${style.border} rounded-xl p-4 shadow-[0_2px_0_0_rgba(0,0,0,0.15)]`}>
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`stud-sm ${style.stud}`} />
                <div className={`stud-sm ${style.stud}`} />
              </div>
              <p className={`text-2xl font-extrabold ${style.text}`}>{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
        {t('quickActions')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { href: '/create', icon: <Sparkles className="w-6 h-6" />, title: t('createFromPhoto'), description: t('createFromPhotoDesc'), iconColor: 'text-lego-yellow', stud: 'bg-lego-yellow/40', hover: 'hover:border-lego-yellow/40' },
          { href: '/scan', icon: <ScanLine className="w-6 h-6" />, title: t('scanBricks'), description: t('scanBricksDesc'), iconColor: 'text-lego-blue', stud: 'bg-lego-blue/40', hover: 'hover:border-lego-blue/40' },
          { href: '/builds', icon: <Hammer className="w-6 h-6" />, title: t('build'), description: t('buildDesc'), iconColor: 'text-lego-orange', stud: 'bg-lego-orange/40', hover: 'hover:border-lego-orange/40' },
          { href: '/inventory', icon: <Package className="w-6 h-6" />, title: t('inventory'), description: t('inventoryDesc'), iconColor: 'text-lego-green', stud: 'bg-lego-green/40', hover: 'hover:border-lego-green/40' },
          { href: '/workspace', icon: <Box className="w-6 h-6" />, title: t('workspace'), description: t('workspaceDesc'), iconColor: 'text-lego-red', stud: 'bg-lego-red/40', hover: 'hover:border-lego-red/40' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`group brick-card p-5 flex items-start gap-4 ${action.hover} transition-all hover:shadow-[0_4px_0_0_rgba(0,0,0,0.3)]`}
          >
            <div className="flex flex-col items-center gap-1">
              <div className={`stud-sm ${action.stud}`} />
              <div className={`${action.iconColor} mt-1`}>{action.icon}</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white group-hover:text-lego-yellow transition-colors">{action.title}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{action.description}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-lego-yellow transition-colors shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </main>
  );
}
