import { Loader2, Inbox, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn.js';
import { Button } from './Button.jsx';
import { useRipple } from '@/hooks/useInteractions.js';

/** Centered spinner for full-view loads. */
export function Spinner({ className, label }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10 text-muted animate-fade-in', className)}>
      {/* Spinner sits inside a soft brand halo so full-view loads feel intentional, not blank. */}
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 text-brand-strong animate-glow">
        <Loader2 className="h-6 w-6 animate-spin" />
      </span>
      {label && <p className="text-sm animate-pulse">{label}</p>}
    </div>
  );
}

/** Rectangular skeleton block. */
export function Skeleton({ className }) {
  return <div className={cn('skeleton h-4 w-full', className)} />;
}

/** Empty-state placeholder with optional CTA. */
export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="group flex flex-col items-center justify-center gap-3 rounded-xl-increased border border-dashed border-border py-12 px-6 text-center animate-scale-in">
      {/* Gently floating tonal chip keeps empty states feeling alive rather than dead-ended;
          a soft brand tint blooms in on hover so the surface feels responsive, not inert. */}
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-faint animate-float transition-colors duration-medium ease-emphasized group-hover:bg-brand/10 group-hover:text-brand-strong">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-medium text-content">{title}</p>
        {description && <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>}
      </div>
      {action && <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:120ms]">{action}</div>}
    </div>
  );
}

/** Error-state placeholder with retry. `title` names WHAT failed (callers pass e.g. "Could not load
 *  chargers"); the body shows the normalized, specific cause from the error funnel. */
export function ErrorState({ error, onRetry, title = "This section couldn't load" }) {
  const ripple = useRipple();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 py-10 px-6 text-center animate-scale-in">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger/10 text-danger animate-pop-in">
        <AlertCircle className="h-6 w-6" />
      </span>
      <div>
        <p className="font-medium text-content">{title}</p>
        {/* normalizeError() guarantees a specific, non-empty message; the fallback here only guards
            a caller passing a bare Error without going through the funnel. */}
        <p className="mt-1 text-sm text-muted">
          {error?.message || 'The reason wasn’t reported. Tap Retry, or reload the page if it keeps happening.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" className="ripple" onClick={onRetry} onPointerDown={ripple}>
          Retry
        </Button>
      )}
    </div>
  );
}
