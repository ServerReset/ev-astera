import { cn } from '@/utils/cn.js';

const TONES = {
  brand: 'bg-brand/15 text-brand',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  muted: 'bg-surface-2 text-muted',
  faint: 'bg-surface-2 text-faint',
};

/** Small status pill. `dot` renders a leading status dot. */
export function Badge({ tone = 'muted', dot = false, className, children }) {
  return (
    <span className={cn('badge', TONES[tone] || TONES.muted, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor(tone))} />}
      {children}
    </span>
  );
}

function dotColor(tone) {
  return (
    {
      brand: 'bg-brand',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger',
      info: 'bg-info',
    }[tone] || 'bg-faint'
  );
}
