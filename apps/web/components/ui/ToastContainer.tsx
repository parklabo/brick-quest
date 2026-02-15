'use client';

import Link from 'next/link';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToastStore, type ToastVariant } from '../../lib/stores/toasts';

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: typeof CheckCircle }> = {
  success: { bg: 'bg-green-900/90 border-green-700/50', icon: CheckCircle },
  error: { bg: 'bg-red-900/90 border-red-700/50', icon: AlertCircle },
  info: { bg: 'bg-slate-800/90 border-slate-700/50', icon: Info },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-sm:left-4 max-sm:right-4 sm:w-80">
      {toasts.map((toast) => {
        const { bg, icon: Icon } = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            className={`${bg} border rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm animate-toast-in flex items-start gap-3`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{toast.message}</p>
              {toast.action && (
                <Link
                  href={toast.action.href}
                  onClick={() => removeToast(toast.id)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium mt-1 inline-block"
                >
                  {toast.action.label}
                </Link>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
