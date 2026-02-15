'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useProfileStore } from '../../lib/stores/profile';
import { useAuth, logout } from '../../lib/hooks/useAuth';
import { LogOut, Save, User, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SUPPORTED_LOCALES, LOCALE_LABELS, setLocale, type Locale } from '../../i18n/locale';

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations('settings');
  const currentLocale = useLocale();
  const { user } = useAuth();
  const profile = useProfileStore((s) => s.profile);
  const loading = useProfileStore((s) => s.loading);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [displayName, setDisplayName] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync initial value once profile loads
  if (profile && !initialized) {
    setDisplayName(profile.displayName);
    setInitialized(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({ displayName: displayName.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  function handleLocaleChange(locale: Locale) {
    setLocale(locale);
  }

  if (loading) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 flex justify-center">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
      </main>
    );
  }

  const initial = profile?.displayName?.charAt(0).toUpperCase() ?? '?';

  return (
    <main className="max-w-lg mx-auto px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-extrabold mb-8">{t('title')}</h1>

      {/* Avatar + info */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-lego-yellow/15 border-2 border-lego-yellow/30 flex items-center justify-center text-2xl font-extrabold text-lego-yellow">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-lg truncate">{profile?.displayName}</p>
          <p className="text-sm text-slate-400 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-4 mb-10">
        <div>
          <label htmlFor="displayName" className="block text-sm text-slate-400 mb-1">
            {t('displayName')}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="displayName"
              type="text"
              required
              maxLength={30}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-lego-yellow transition-colors"
              placeholder={t('displayNamePlaceholder')}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !displayName.trim() || displayName.trim() === profile?.displayName}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-lego-yellow hover:bg-lego-yellow/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-900 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? t('saving') : saved ? t('saved') : t('saveChanges')}
        </button>
      </form>

      {/* Language selector */}
      <div className="border-t border-slate-800 pt-6 mb-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{t('language')}</h2>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={currentLocale}
            onChange={(e) => handleLocaleChange(e.target.value as Locale)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-lego-yellow transition-colors cursor-pointer"
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Account section */}
      <div className="border-t border-slate-800 pt-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{t('account')}</h2>
        <div className="space-y-3 text-sm text-slate-400">
          <div className="flex justify-between">
            <span>{t('email')}</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('memberSince')}</span>
            <span className="text-white">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString()
                : '—'}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full mt-6 py-2.5 bg-slate-900 border border-slate-700 hover:border-red-500/50 hover:text-red-400 rounded-lg font-medium text-slate-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('signOut')}
        </button>
      </div>
    </main>
  );
}
