import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore.js';
import { cn } from '@/utils/cn.js';

const ICONS = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: Info };
const TONE = {
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  danger: 'border-danger/40 text-danger',
  info: 'border-info/40 text-info',
};

/** Global toast viewport. Mount once near the app root. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone] || Info;
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-card animate-slide-up',
              TONE[t.tone] || TONE.info
            )}
            role="status"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm text-content">
              {t.title && <p className="font-medium">{t.title}</p>}
              <p className={cn(t.title && 'text-muted')}>{t.message}</p>
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-faint hover:text-content"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
