import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: { label: string; href: string };
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>, durationMs?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],

  addToast: (toast, durationMs = 5000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

    if (durationMs > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, durationMs);
    }
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
