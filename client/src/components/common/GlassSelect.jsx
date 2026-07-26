import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn.js';

/**
 * Glass dropdown — a fully custom replacement for the native <select>, so the option list is our
 * own themed glass popover instead of the OS's chrome. Drop-in for the old Select: it keeps the
 * exact same API (`options=[{value,label}]` OR <option> children, plus value/onChange/disabled)
 * and fires onChange with a synthetic `{ target: { value } }` so every existing call site —
 * `onChange={(e) => setX(e.target.value)}` — works untouched.
 *
 * The popover renders into <body> via a portal (so it escapes any overflow-hidden/transformed
 * ancestor, e.g. a Modal) and is positioned under the trigger. Fully keyboard-accessible:
 * Up/Down/Home/End move the active option, Enter/Space select, Escape closes, and it follows the
 * listbox ARIA pattern.
 */

// Normalize both supported input shapes into one list of { value, label }.
function useOptions(options, children) {
  if (options && options.length) return options.map((o) => ({ value: String(o.value), label: o.label }));
  // Parse <option> children (value + text). Filter out non-option nodes defensively.
  const out = [];
  const walk = (nodes) => {
    for (const c of Array.isArray(nodes) ? nodes : [nodes]) {
      if (!c || typeof c !== 'object') continue;
      if (c.type === 'option') out.push({ value: String(c.props.value ?? ''), label: c.props.children });
      else if (c.props?.children) walk(c.props.children);
    }
  };
  walk(children);
  return out;
}

export function GlassSelect({ label, error, options, className, id, value, onChange, disabled, children, placeholder, 'aria-label': ariaLabel }) {
  const autoId = useId();
  const selectId = id || autoId;
  const listId = `${selectId}-listbox`;
  const items = useOptions(options, children);
  const selected = items.find((o) => o.value === String(value ?? ''));

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [rect, setRect] = useState(null);

  // Position the popover under the trigger; recompute on open and on scroll/resize while open.
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6, width: r.width, bottom: r.top - 6, spaceBelow: window.innerHeight - r.bottom });
  };
  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // On open, seed the active option to the current selection and focus the list.
  useEffect(() => {
    if (!open) return undefined;
    const cur = items.findIndex((o) => o.value === String(value ?? ''));
    setActiveIdx(cur >= 0 ? cur : 0);
    const t = setTimeout(() => listRef.current?.focus(), 0);
    const onDocClick = (e) => {
      if (!triggerRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (opt) => {
    onChange?.({ target: { value: opt.value } });
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKey = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIdx(0); }
    else if (e.key === 'End') { e.preventDefault(); setActiveIdx(items.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (items[activeIdx]) commit(items[activeIdx]); }
    else if (e.key === 'Tab') { setOpen(false); }
  };

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const node = listRef.current?.children[activeIdx];
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIdx]);

  // Flip above the trigger if there isn't room below.
  const openUp = rect && rect.spaceBelow < 260;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="label">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={Boolean(error)}
        aria-label={!label ? ariaLabel : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        className={cn(
          'input flex items-center justify-between gap-2 text-left',
          !selected && 'text-faint',
          error && 'border-danger focus:border-danger focus:ring-danger'
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder || 'Select…'}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-faint transition-transform duration-medium ease-emphasized', open && 'rotate-180')} />
      </button>

      {open && rect && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined}
          onKeyDown={onListKey}
          className="lg-panel fixed z-[80] max-h-60 overflow-y-auto rounded-2xl border border-border p-1 shadow-elevation-3 animate-scale-in [transform-origin:top] focus:outline-none"
          style={{
            left: rect.left,
            width: rect.width,
            ...(openUp ? { bottom: window.innerHeight - rect.bottom } : { top: rect.top }),
          }}
        >
          {items.map((o, i) => {
            const isSel = o.value === String(value ?? '');
            const isActive = i === activeIdx;
            return (
              <li
                key={o.value + i}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(o)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-brand/15 text-brand-strong' : 'text-content',
                  isSel && !isActive && 'text-brand-strong'
                )}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />}
              </li>
            );
          })}
        </ul>,
        document.body
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
