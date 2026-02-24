'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Paintbrush, Camera, Hammer, Package, X, Bell, Sparkles, Megaphone } from 'lucide-react';
import { useInventoryStore } from '../../lib/stores/inventory';
import { useWorkshopStore } from '../../lib/stores/workshop';

function useIsMobile() {
  return useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, []);
}

/* ═══════════════════════════════════════════
   Zone menu config
   ═══════════════════════════════════════════ */

function useZoneMenuItems(t: ReturnType<typeof useTranslations<'dashboard'>>) {
  return useMemo(
    () => ({
      design: {
        label: t('designZone'),
        color: '#fbbf24',
        items: [
          { href: '/create', label: t('designStation'), desc: t('stationDesignDesc'), icon: Paintbrush, color: '#fbbf24' },
        ],
      },
      mybrick: {
        label: t('myBrickZone'),
        color: '#a78bfa',
        items: [
          { href: '/scan', label: t('scanStation'), desc: t('stationScanDesc'), icon: Camera, color: '#60a5fa' },
          { href: '/builds', label: t('buildStation'), desc: t('stationBuildDesc'), icon: Hammer, color: '#4ade80' },
          { href: '/inventory', label: t('inventoryStation'), desc: t('stationInventoryDesc'), icon: Package, color: '#a78bfa' },
        ],
      },
    }),
    [t],
  );
}

/* ═══════════════════════════════════════════
   Zone menu panel (appears when portal clicked)
   ═══════════════════════════════════════════ */

function ZoneMenu() {
  const t = useTranslations('dashboard');
  const activeZone = useWorkshopStore((s) => s.activeZone);
  const closeZone = useWorkshopStore((s) => s.closeZone);
  const zones = useZoneMenuItems(t);

  if (!activeZone) return null;

  const zone = zones[activeZone];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeZone} />

      {/* Menu panel */}
      <div className="relative z-10 w-80 max-w-[90vw]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 rounded-t-2xl"
          style={{ background: `linear-gradient(135deg, ${zone.color}22, ${zone.color}44)`, borderBottom: `2px solid ${zone.color}55` }}
        >
          <h2 className="text-white font-bold text-base tracking-wide">{zone.label}</h2>
          <button
            onClick={closeZone}
            className="text-white/60 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="bg-black/70 backdrop-blur-md rounded-b-2xl p-3 flex flex-col gap-2">
          {zone.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeZone}
              className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/15
                border border-white/10 hover:border-white/25 transition-all group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${item.color}20`, border: `1px solid ${item.color}40` }}
              >
                <item.icon size={20} style={{ color: item.color }} />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-semibold text-sm group-hover:translate-x-0.5 transition-transform">
                  {item.label}
                </span>
                <span className="text-slate-400 text-xs">{item.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Notice modal (appears when notice board clicked)
   ═══════════════════════════════════════════ */

const NOTICE_ICONS = [Sparkles, Megaphone, Bell] as const;
const NOTICE_COLORS = ['#FBBF24', '#4285F4', '#10B981'] as const;

function NoticeModal() {
  const t = useTranslations('dashboard');
  const showNotice = useWorkshopStore((s) => s.showNotice);
  const closeNotice = useWorkshopStore((s) => s.closeNotice);

  if (!showNotice) return null;

  const notices = [
    { title: t('noticeItem1Title'), desc: t('noticeItem1Desc'), icon: NOTICE_ICONS[0], color: NOTICE_COLORS[0] },
    { title: t('noticeItem2Title'), desc: t('noticeItem2Desc'), icon: NOTICE_ICONS[1], color: NOTICE_COLORS[1] },
    { title: t('noticeItem3Title'), desc: t('noticeItem3Desc'), icon: NOTICE_ICONS[2], color: NOTICE_COLORS[2] },
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeNotice} />

      <div className="relative z-10 w-96 max-w-[90vw]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 rounded-t-2xl bg-linear-to-r from-amber-900/40 to-amber-800/30 border-b-2 border-amber-600/30">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-400" />
            <h2 className="text-white font-bold text-base tracking-wide">{t('noticeTitle')}</h2>
          </div>
          <button onClick={closeNotice} className="text-white/60 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Notice items */}
        <div className="bg-black/70 backdrop-blur-md rounded-b-2xl p-3 flex flex-col gap-2">
          {notices.map((notice, i) => {
            const Icon = notice.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${notice.color}15`, border: `1px solid ${notice.color}30` }}
                >
                  <Icon size={18} style={{ color: notice.color }} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-white font-semibold text-sm">{notice.title}</span>
                  <span className="text-slate-400 text-xs leading-relaxed">{notice.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main overlay
   ═══════════════════════════════════════════ */

export function WorkshopOverlay() {
  const t = useTranslations('dashboard');
  const isMobile = useIsMobile();
  const parts = useInventoryStore((s) => s.parts);
  const totalBricks = parts.reduce((sum, p) => sum + p.count, 0);
  const uniqueTypes = parts.length;
  const hasInventory = totalBricks > 0;

  const nearStation = useWorkshopStore((s) => s.nearStation);
  const showStationPrompt = useWorkshopStore((s) => s.showStationPrompt);
  const openZone = useWorkshopStore((s) => s.openZone);

  const stationLabels: Record<string, string> = {
    design: t('designZone'),
    mybrick: t('myBrickZone'),
  };

  // Enter key handler for portal interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && nearStation) {
        openZone(nearStation as 'design' | 'mybrick');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearStation, openZone]);

  return (
    <>
      <div className="fixed inset-0 top-14 z-50 pointer-events-none flex flex-col items-center">
        {/* Stats row */}
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

        {/* Control hints (bottom-center, always visible) */}
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-xl px-5 py-2.5">
            {isMobile ? (
              <div className="flex items-center gap-4 text-xs text-white/70">
                <span>{t('controlMobileMove')}</span>
                <div className="w-px h-4 bg-white/20" />
                <span>{t('controlMobileLook')}</span>
                <div className="w-px h-4 bg-white/20" />
                <span>{t('controlMobileZoom')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-xs text-white/80">
                {/* WASD */}
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {['W', 'A', 'S', 'D'].map((key) => (
                      <kbd key={key} className="bg-white/15 border border-white/25 rounded px-1.5 py-0.5 font-mono text-[11px] text-white/90">
                        {key}
                      </kbd>
                    ))}
                  </div>
                  <span>{t('controlMove')}</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                {/* Left mouse = Rotate */}
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-white/15 border border-white/25 rounded px-1.5 py-0.5 font-mono text-[11px] text-white/90">
                    LMB
                  </kbd>
                  <span>{t('controlRotate')}</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                {/* Right mouse = Pan */}
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-white/15 border border-white/25 rounded px-1.5 py-0.5 font-mono text-[11px] text-white/90">
                    RMB
                  </kbd>
                  <span>{t('controlPan')}</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                {/* Scroll = Zoom */}
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-white/15 border border-white/25 rounded px-1.5 py-0.5 font-mono text-[11px] text-white/90">
                    Scroll
                  </kbd>
                  <span>{t('controlZoom')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Station proximity prompt */}
        {showStationPrompt && nearStation && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-xl px-5 py-2.5 flex items-center gap-2">
              <kbd className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs font-mono text-white/80">
                Enter
              </kbd>
              <span className="text-sm text-white/90">
                {t('pressEnter')} &mdash; {stationLabels[nearStation] ?? nearStation}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Zone menu modal */}
      <ZoneMenu />

      {/* Notice modal */}
      <NoticeModal />
    </>
  );
}
