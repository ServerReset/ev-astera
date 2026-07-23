import { forwardRef, useId } from 'react';
import { cn } from '@/utils/cn.js';

/** Labeled text input with inline error + optional hint. */
export const Input = forwardRef(function Input(
  { label, error, hint, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
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

/** Labeled select. `options` = [{ value, label }]. */
export const Select = forwardRef(function Select({ label, error, options = [], className, id, children, ...props }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={cn('input appearance-none', error && 'border-danger focus:border-danger focus:ring-danger')}
        {...props}
      >
        {children || options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
});
