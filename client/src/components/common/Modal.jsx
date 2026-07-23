import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn.js';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';

/**
 * Accessible modal dialog. Closes on Escape and backdrop click. Renders into <body> via a
 * portal so it escapes any transformed/overflow-hidden ancestor. Mobile-first: slides up
 * from the bottom as a sheet on small screens, centers as a dialog on larger ones.
 */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const glassRef = useLiquidGlass(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size] || 'sm:max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={glassRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'lg-panel relative w-full border border-border',
          'rounded-t-2xl sm:rounded-2xl animate-slide-up',
          'max-h-[92vh] overflow-y-auto',
          width
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 sticky top-0 bg-surface/80 backdrop-blur-sm z-10">
          <h2 className="font-semibold text-content">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-content"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3.5 sticky bottom-0 bg-surface">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
