import { formatDurationMinutes } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

/** Minutes-based duration slider, snapped to `step`. Shared by StartSessionModal + EtaModal. */
export function DurationSlider({ label, value, onChange, min = 30, max = 240, step = 15, error }) {
  // An admin-lowered MAX_SESSION_HOURS can push `max` below the default `min` (e.g. a 15min
  // ceiling vs. the usual 30min floor) — a native range input with min > max is undefined/
  // inverted in every browser, so floor `min` down to whatever `max` actually allows.
  const safeMin = Math.min(min, max);

  // Notched tick row: one dot per step, filling brand up to the current value. Gives the
  // slider a tactile, "which notch am I on" feel that a bare track can't. Capped so an
  // unusually wide range can't render hundreds of dots.
  const rawSteps = Math.round((max - safeMin) / step);
  const showTicks = rawSteps >= 1 && rawSteps <= 24;
  const activeIdx = Math.round((value - safeMin) / step);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label mb-0">{label}</span>
        <span
          key={value}
          className="animate-pop-in rounded-full bg-brand/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-brand-strong shadow-elevation-1"
        >
          {formatDurationMinutes(value)}
        </span>
      </div>

      {showTicks && (
        <div className="mt-3 flex items-center justify-between px-0.5" aria-hidden="true">
          {Array.from({ length: rawSteps + 1 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 w-1 rounded-full transition-all duration-medium ease-spring',
                i <= activeIdx ? 'scale-110 bg-brand/70' : 'bg-border'
              )}
            />
          ))}
        </div>
      )}

      <input
        type="range"
        className="slider mt-2"
        min={safeMin}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-xs text-faint">
        <span>{formatDurationMinutes(safeMin)}</span>
        <span>{formatDurationMinutes(max)}</span>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
