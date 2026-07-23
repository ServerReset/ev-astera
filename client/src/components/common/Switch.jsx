import { cn } from '@/utils/cn.js';

/**
 * M3 switch. The thumb is a real flex child (not absolutely positioned inside the track), so it
 * can never clip or drift out of alignment regardless of the track's surrounding layout — the
 * track's own padding + justify-content does all the positioning, and the thumb grows slightly
 * when checked per the M3 spec instead of relying on a translate offset that has to be kept in
 * sync with track width.
 */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 px-[3px] transition-colors duration-medium ease-standard',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80',
        disabled && 'opacity-50 pointer-events-none',
        checked ? 'justify-end border-brand bg-brand' : 'justify-start border-border-strong bg-surface-2'
      )}
    >
      <span
        className={cn(
          'rounded-full bg-white transition-[width,height] duration-medium ease-emphasized',
          checked ? 'h-6 w-6' : 'h-5 w-5'
        )}
        style={{ boxShadow: 'var(--shadow-elevation-1)' }}
      />
    </button>
  );
}
