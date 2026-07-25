import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassSelect } from './GlassSelect.jsx';
import { cn } from '@/utils/cn.js';

/**
 * Glass date/time picker — a fully custom replacement for the native datetime-local / time inputs,
 * so the calendar & clock are our own themed glass popover, never the OS chrome.
 *
 * Value contract is IDENTICAL to the native inputs it replaces, so call sites are untouched:
 *   - mode "datetime-local": value/onChange use "YYYY-MM-DDT HH:mm" (no space — shown here for
 *     readability) strings; onChange fires `{ target: { value } }`.
 *   - mode "time": "HH:mm" strings.
 * All timezone handling stays in the parent (utils/time.js) exactly as before — this only edits
 * the wall-clock string the parent already passes in and reads back out.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n) => String(n).padStart(2, '0');

// Parse the literal string into {y,mo,d,h,mi} without any Date/timezone involvement.
function parse(value, mode) {
  if (mode === 'time') {
    const [h = '9', mi = '0'] = (value || '').split(':');
    return { y: null, mo: null, d: null, h: Number(h), mi: Number(mi) };
  }
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const now = new Date();
  return {
    y: y || now.getFullYear(),
    mo: mo ? mo - 1 : now.getMonth(),
    d: d || now.getDate(),
    h: Number.isFinite(h) ? h : 9,
    mi: Number.isFinite(mi) ? mi : 0,
  };
}

function serialize({ y, mo, d, h, mi }, mode) {
  if (mode === 'time') return `${pad(h)}:${pad(mi)}`;
  return `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
}

function displayLabel(value, mode) {
  if (!value) return mode === 'time' ? 'Pick a time' : 'Pick a date & time';
  const p = parse(value, mode);
  const hh = ((p.h + 11) % 12) + 1;
  const ampm = p.h < 12 ? 'AM' : 'PM';
  const time = `${hh}:${pad(p.mi)} ${ampm}`;
  if (mode === 'time') return time;
  return `${MONTHS[p.mo].slice(0, 3)} ${p.d}, ${p.y} · ${time}`;
}

function daysInMonth(y, mo) {
  return new Date(y, mo + 1, 0).getDate();
}

export function DateTimePicker({ mode = 'datetime-local', label, error, value, onChange, id, className, disabled }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const parsed = useMemo(() => parse(value, mode), [value, mode]);
  const [open, setOpen] = useState(false);
  // Which month the calendar is viewing (independent of the selected day until they pick).
  const [viewY, setViewY] = useState(parsed.y);
  const [viewMo, setViewMo] = useState(parsed.mo);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const [rect, setRect] = useState(null);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6, bottom: window.innerHeight - r.top + 6, width: r.width, spaceBelow: window.innerHeight - r.bottom });
  };
  useLayoutEffect(() => {
    if (!open) return undefined;
    setViewY(parsed.y); setViewMo(parsed.mo);
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

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!triggerRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && (setOpen(false), triggerRef.current?.focus());
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const emit = (next) => onChange?.({ target: { value: serialize({ ...parsed, ...next }, mode) } });

  const pickDay = (d) => emit({ y: viewY, mo: viewMo, d });
  const setTime = (h, mi) => emit({ h, mi });

  // Calendar grid for the viewed month.
  const grid = useMemo(() => {
    const first = new Date(viewY, viewMo, 1).getDay();
    const total = daysInMonth(viewY, viewMo);
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    return cells;
  }, [viewY, viewMo]);

  const openUp = rect && rect.spaceBelow < 380;
  const isDatetime = mode !== 'time';

  return (
    <div className={className}>
      {label && <label htmlFor={fieldId} className="label">{label}</label>}
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn('input flex items-center justify-between gap-2 text-left', !value && 'text-faint', error && 'border-danger')}
      >
        <span className="truncate">{displayLabel(value, mode)}</span>
        {isDatetime ? <Calendar className="h-4 w-4 shrink-0 text-faint" /> : <Clock className="h-4 w-4 shrink-0 text-faint" />}
      </button>

      {open && rect && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={label || (isDatetime ? 'Choose date and time' : 'Choose time')}
          className="lg-panel fixed z-[80] rounded-2xl border border-border p-3 shadow-elevation-3 animate-scale-in [transform-origin:top]"
          style={{
            left: Math.max(8, Math.min(rect.left, window.innerWidth - (isDatetime ? 300 : 200) - 8)),
            width: isDatetime ? 296 : 188,
            ...(openUp ? { bottom: rect.bottom } : { top: rect.top }),
          }}
        >
          {isDatetime && (
            <>
              {/* Month header */}
              <div className="mb-2 flex items-center justify-between">
                <button type="button" aria-label="Previous month" onClick={() => { const m = viewMo - 1; if (m < 0) { setViewMo(11); setViewY(viewY - 1); } else setViewMo(m); }} className="press grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-content">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-content">{MONTHS[viewMo]} {viewY}</span>
                <button type="button" aria-label="Next month" onClick={() => { const m = viewMo + 1; if (m > 11) { setViewMo(0); setViewY(viewY + 1); } else setViewMo(m); }} className="press grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-content">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {DOW.map((d, i) => <span key={i} className="py-1 text-2xs font-medium uppercase text-faint">{d}</span>)}
                {grid.map((d, i) => {
                  if (d == null) return <span key={`e${i}`} />;
                  const isSel = d === parsed.d && viewMo === parsed.mo && viewY === parsed.y;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pickDay(d)}
                      aria-pressed={isSel}
                      className={cn(
                        'press mx-auto grid h-8 w-8 place-items-center rounded-full text-sm transition-colors',
                        isSel ? 'bg-brand text-brand-content font-semibold shadow-elevation-1' : 'text-content hover:bg-surface-2'
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="my-3 h-px bg-border" />
            </>
          )}

          {/* Time row: hour + minute steppers as scrollable pill columns. */}
          <TimeColumns h={parsed.h} mi={parsed.mi} onChange={setTime} />

          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="btn-primary btn-sm">
              Done
            </button>
          </div>
        </div>,
        document.body
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** Hour (12h + AM/PM) and minute (5-min steps) selectors, glass pills. */
function TimeColumns({ h, mi, onChange }) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour12 = ((h + 11) % 12) + 1;
  const setHour12 = (val, ap) => {
    let h24 = val % 12;
    if (ap === 'PM') h24 += 12;
    onChange(h24, mi);
  };
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const nearestMin = minutes.reduce((a, b) => (Math.abs(b - mi) < Math.abs(a - mi) ? b : a), 0);
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 shrink-0 text-faint" />
      <GlassSelect
        className="flex-1"
        aria-label="Hour"
        value={String(hour12)}
        onChange={(e) => setHour12(Number(e.target.value), ampm)}
        options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
      />
      <span className="text-muted">:</span>
      <GlassSelect
        className="flex-1"
        aria-label="Minute"
        value={String(nearestMin)}
        onChange={(e) => onChange(h, Number(e.target.value))}
        options={minutes.map((n) => ({ value: String(n), label: pad(n) }))}
      />
      <div className="flex overflow-hidden rounded-full border border-border">
        {['AM', 'PM'].map((ap) => (
          <button
            key={ap}
            type="button"
            onClick={() => setHour12(hour12, ap)}
            className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', ampm === ap ? 'bg-brand text-brand-content' : 'text-muted hover:bg-surface-2')}
          >
            {ap}
          </button>
        ))}
      </div>
    </div>
  );
}
