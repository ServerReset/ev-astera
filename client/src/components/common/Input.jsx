import { forwardRef, useId } from 'react';
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
 */
export const Input = forwardRef(function Input(
  { label, error, hint, className, id, type, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;

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

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={cn('input', error && 'border-danger focus:border-danger focus:ring-danger')}
        aria-invalid={Boolean(error)}
        {...props}
      />
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
