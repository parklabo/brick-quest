'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Paintbrush, Camera, Hammer, Package, X, Bell, Sparkles, Megaphone, LogOut, Check, Pencil, Globe, Blocks } from 'lucide-react';
import { useInventoryStore } from '../../lib/stores/inventory';
import { useWorkshopStore } from '../../lib/stores/workshop';
import { useProfileStore } from '../../lib/stores/profile';
import { usePlayerStore, PLAYER_MODEL_PRESETS, PLAYER_COLOR_PRESETS } from '../../lib/stores/player';
import { logout } from '../../lib/hooks/useAuth';
import { LOCALE_LABELS, SUPPORTED_LOCALES, setLocale } from '../../i18n/locale';

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
   Demo mode toggle (sample bricks for trial)
   ═══════════════════════════════════════════ */

function DemoToggle() {
  const t = useTranslations('dashboard');
  const demoMode = useInventoryStore((s) => s.demoMode);
  const toggleDemo = useInventoryStore((s) => s.toggleDemo);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Blocks size={14} className="text-white/40" />
        <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t('demoBricks')}</span>
      </div>
      <button
        onClick={toggleDemo}
        className={`relative w-10 h-5.5 rounded-full transition-colors ${
          demoMode ? 'bg-violet-500' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform shadow-sm ${
            demoMode ? 'translate-x-4.5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Profile popup (appears when character clicked)
   ═══════════════════════════════════════════ */

function ProfilePopup() {
  const t = useTranslations('dashboard');
  const ts = useTranslations('settings');
  const currentLocale = useLocale();
  const showProfile = useWorkshopStore((s) => s.showProfile);
  const closeProfile = useWorkshopStore((s) => s.closeProfile);
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const modelUrl = usePlayerStore((s) => s.modelUrl);
  const bodyColor = usePlayerStore((s) => s.bodyColor);
  const updateModel = usePlayerStore((s) => s.updateModel);
  const updateColor = usePlayerStore((s) => s.updateColor);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (!showProfile) return null;

  const displayName = profile?.displayName || 'Builder';
  const initial = displayName.charAt(0).toUpperCase();

  const handleStartEdit = () => {
    setNameInput(displayName);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ displayName: trimmed });
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeProfile} />

      <div className="relative z-10 w-80 max-w-[90vw]">
        {/* Header with avatar */}
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl bg-linear-to-r from-violet-900/40 to-indigo-900/30 border-b-2 border-violet-500/30">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white border-2 border-white/20"
              style={{ background: bodyColor }}
            >
              {initial}
            </div>
            <div className="flex flex-col">
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    maxLength={30}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className="w-32 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-violet-400"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1.5 group text-left"
                >
                  <span className="text-white font-bold text-sm">{displayName}</span>
                  <Pencil size={11} className="text-white/30 group-hover:text-white/70 transition-colors" />
                </button>
              )}
              <span className="text-white/50 text-xs">{t('profileTitle')}</span>
            </div>
          </div>
          <button onClick={closeProfile} className="text-white/60 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="bg-black/70 backdrop-blur-md rounded-b-2xl p-4 flex flex-col gap-4">
          {/* Character selection */}
          <div>
            <span className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">{t('profileCharacter')}</span>
            <div className="flex gap-2">
              {PLAYER_MODEL_PRESETS.map((preset) => {
                const active = modelUrl === preset.modelUrl;
                return (
                  <button
                    key={preset.modelUrl}
                    onClick={() => updateModel(preset.modelUrl)}
                    className={`flex-1 py-2 px-1 rounded-lg text-[11px] font-medium transition-all border ${
                      active
                        ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                    title={preset.label}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color selection */}
          <div>
            <span className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">{t('profileColor')}</span>
            <div className="flex gap-2 flex-wrap">
              {PLAYER_COLOR_PRESETS.map((preset) => {
                const active = bodyColor === preset.hex;
                return (
                  <button
                    key={preset.hex}
                    onClick={() => updateColor(preset.hex)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      active ? 'border-white scale-110 shadow-lg' : 'border-white/20 hover:border-white/50 hover:scale-105'
                    }`}
                    style={{ background: preset.hex }}
                    title={preset.label}
                  />
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-white/40" />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">{ts('language')}</span>
            </div>
            <div className="flex gap-1">
              {SUPPORTED_LOCALES.map((loc) => {
                const active = currentLocale === loc;
                return (
                  <button
                    key={loc}
                    onClick={() => { if (!active) setLocale(loc); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                      active
                        ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {LOCALE_LABELS[loc]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Demo mode toggle */}
          <DemoToggle />

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* Sign out */}
          <button
            onClick={async () => { closeProfile(); await logout(); }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 transition-all text-left"
          >
            <LogOut size={16} className="text-slate-400" />
            <span className="text-sm text-white/80">{t('profileSignOut')}</span>
          </button>
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

      {/* Profile popup */}
      <ProfilePopup />
    </>
  );
}
