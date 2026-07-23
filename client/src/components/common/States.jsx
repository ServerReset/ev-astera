import { Loader2, Inbox, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn.js';
import { Button } from './Button.jsx';

/** Centered spinner for full-view loads. */
export function Spinner({ className, label }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-10 text-muted', className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
      {label && <p className="text-sm">{label}</p>}
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-12 px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-faint">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-medium text-content">{title}</p>
        {description && <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Error-state placeholder with retry. */
export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 py-10 px-6 text-center">
      <AlertCircle className="h-7 w-7 text-danger" />
      <div>
        <p className="font-medium text-content">Something went wrong</p>
        <p className="mt-1 text-sm text-muted">{error?.message || 'Please try again.'}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
