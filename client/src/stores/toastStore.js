/** Lightweight toast store. `toast.success('...')` etc. from anywhere. */
import { create } from 'zustand';

let seq = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = ++seq;
    const t = { id, tone: 'info', duration: 4000, ...toast };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (t.duration > 0) {
      setTimeout(() => get().dismiss(id), t.duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper so non-component code (services) can raise toasts. */
export const toast = {
  success: (message, opts) => useToastStore.getState().push({ tone: 'success', message, ...opts }),
  error: (message, opts) => useToastStore.getState().push({ tone: 'danger', message, ...opts }),
  info: (message, opts) => useToastStore.getState().push({ tone: 'info', message, ...opts }),
  warning: (message, opts) => useToastStore.getState().push({ tone: 'warning', message, ...opts }),
};
