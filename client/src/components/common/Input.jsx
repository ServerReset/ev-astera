import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn.js';
import { GlassSelect } from './GlassSelect.jsx';
import { DateTimePicker } from './DateTimePicker.jsx';

/**
 * Labeled text input with inline error + optional hint.
 *
 * `type="datetime-local"` and `type="time"` are transparently routed to the custom glass
 * DateTimePicker instead of the browser's native input — so the calendar/clock popup is our own
 * themed glass, never OS chrome. The value contract is identical (same "YYYY-MM-DDTHH:mm" /
 * "HH:mm" strings, same onChange({target:{value}})), so every call site is unchanged.
 *
 * `type="password"` grows a themed show/hide eye toggle on the trailing edge — reveal state is
 * internal, so every password field (login, register, confirm, change-password) gets it for free.
 */
export const Input = forwardRef(function Input(
  { label, error, hint, className, id, type, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const [revealed, setRevealed] = useState(false);

  if (type === 'datetime-local' || type === 'time') {
    return (
      <DateTimePicker
        mode={type}
        label={label}
        error={error}
        id={inputId}
        className={className}
        value={props.value}
        onChange={props.onChange}
        disabled={props.disabled}
      />
    );
  }

  const isPassword = type === 'password';
  const effectiveType = isPassword ? (revealed ? 'text' : 'password') : type;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          className={cn(
            'input',
            isPassword && 'pr-11',
            error && 'border-danger focus:border-danger focus:ring-danger'
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            disabled={props.disabled}
            aria-pressed={revealed}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            title={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-faint transition-colors duration-short ease-standard hover:bg-surface-2 hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80 active:scale-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
});

/** Labeled textarea, same conventions as Input. */
export const Textarea = forwardRef(function Textarea({ label, error, hint, className, id, rows = 3, ...props }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cn('input resize-none', error && 'border-danger focus:border-danger focus:ring-danger')}
        {...props}
      />
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
});

/**
 * Labeled select — now a custom glass dropdown (GlassSelect), NOT the native <select>, so the
 * option list is our own themed popover. Same public API as before (`options=[{value,label}]`
 * or <option> children, plus value/onChange/disabled), so all existing call sites work unchanged.
 * The forwarded ref is accepted for API compatibility but not attached (the trigger is a button).
 */
export const Select = forwardRef(function Select(props, _ref) {
  return <GlassSelect {...props} />;
});
