'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, loginWithEmail, signUpWithEmail } from '../lib/hooks/useAuth';
import { FirebaseError } from 'firebase/app';
import { useTranslations } from 'next-intl';

type Tab = 'signin' | 'signup';

function getErrorMessageKey(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'invalidEmail';
      case 'auth/user-disabled':
        return 'accountDisabled';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'invalidCredentials';
      case 'auth/email-already-in-use':
        return 'emailExists';
      case 'auth/weak-password':
        return 'weakPassword';
      case 'auth/too-many-requests':
        return 'tooManyAttempts';
      default:
        return 'unexpectedError';
    }
  }
  return 'unexpectedError';
}

export default function HomePage() {
  const router = useRouter();
  const { uid, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('auth');

  useEffect(() => {
    if (uid) {
      router.replace('/dashboard');
    }
  }, [uid, router]);

  if (loading || uid) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'signin') {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err) {
      setError(getErrorMessageKey(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-2 bg-linear-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
        Brick Quest
      </h1>
      <p className="text-slate-400 text-sm mb-8">
        {t('subtitle')}
      </p>

      <div className="w-full max-w-sm">
        {/* Tabs */}
        <div className="flex mb-6 bg-slate-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'signin'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('signIn')}
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'signup'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('signUp')}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-slate-400 mb-1">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder={t('emailPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-slate-400 mb-1">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder={t('passwordPlaceholder')}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{t(error)}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {submitting
              ? t('loading')
              : tab === 'signin'
                ? t('signIn')
                : t('createAccount')}
          </button>
        </form>
      </div>
    </main>
  );
}
