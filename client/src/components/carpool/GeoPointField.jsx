import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Loader2, Search } from 'lucide-react';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { cn } from '@/utils/cn.js';

/**
 * Address autocomplete backed by OpenStreetMap's Nominatim geocoder. The value is a
 * `{ label }` GeoPoint (the shape shared/validation.js's geoPointSchema expects); onChange is
 * called with the full merged value so a parent can spread extra fields — onChange({ ...v, ...patch }).
 *
 * Typing (min 3 chars, 350ms debounce) queries Nominatim and drops a glassy suggestion list
 * (its own liquid-glass refraction) beneath the field, portaled to <body> so it escapes a Modal's
 * overflow clip. Picking a suggestion sets `skipNextSearch` so the value-change it triggers
 * doesn't immediately reopen the dropdown.
 */
export function GeoPointField({ label, error, value, onChange, placeholder = 'Search an address…', hint, id }) {
  const autoId = useId();
  const inputId = id || autoId;
  const listId = `${inputId}-geo-list`;
  const text = value?.label || '';

  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [rect, setRect] = useState(null);

  const inputRef = useRef(null);
  const skipNextSearch = useRef(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  // The dropdown <ul> is both the liquid-glass surface and the click-outside anchor, so this one
  // ref serves both purposes.
  const listRef = useLiquidGlass(open && results.length > 0, { scale: -30, chroma: 1.5, blur: 4, border: 0.16, mapBlur: 16 });

  // Debounced Nominatim query whenever the typed label changes.
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return undefined;
    }
    const q = text.trim();
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal, headers: { Accept: 'application/json' } }
        );
        const data = await res.json();
        const items = Array.isArray(data) ? data.map((d) => ({ label: d.display_name })) : [];
        setResults(items);
        setActiveIdx(items.length ? 0 : -1);
        setOpen(items.length > 0);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setResults([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Position the popover under the input; recompute while open on scroll/resize.
  const place = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6, width: r.width });
  };
  useEffect(() => {
    if (!open) return undefined;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const onDocClick = (e) => {
      if (!inputRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDocClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (item) => {
    skipNextSearch.current = true;
    onChange?.({ ...(value || {}), label: item.label });
    setOpen(false);
    setResults([]);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[activeIdx]) pick(results[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && results[activeIdx] ? `${listId}-opt-${activeIdx}` : undefined}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          value={text}
          placeholder={placeholder}
          onChange={(e) => onChange?.({ ...(value || {}), label: e.target.value })}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn('input pl-9', error && 'border-danger focus:border-danger focus:ring-danger')}
        />
      </div>

      {open && rect && results.length > 0 && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="lg-panel fixed z-[80] max-h-64 overflow-y-auto rounded-2xl border border-border p-1 shadow-elevation-3 animate-scale-in [transform-origin:top]"
          style={{ left: rect.left, top: rect.top, width: rect.width }}
        >
          {results.map((item, i) => (
            <li
              key={item.label + i}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => pick(item)}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                i === activeIdx ? 'bg-brand/15 text-brand-strong' : 'text-content'
              )}
            >
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
              <span className="leading-snug">{item.label}</span>
            </li>
          ))}
        </ul>,
        document.body
      )}

      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}
