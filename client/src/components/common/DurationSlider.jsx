import { formatDurationMinutes } from '@/utils/time.js';

/** Minutes-based duration slider, snapped to `step`. Shared by StartSessionModal + EtaModal. */
export function DurationSlider({ label, value, onChange, min = 30, max = 240, step = 15, error }) {
  // An admin-lowered MAX_SESSION_HOURS can push `max` below the default `min` (e.g. a 15min
  // ceiling vs. the usual 30min floor) — a native range input with min > max is undefined/
  // inverted in every browser, so floor `min` down to whatever `max` actually allows.
  const safeMin = Math.min(min, max);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label mb-0">{label}</span>
        <span className="text-sm font-semibold text-brand-strong">{formatDurationMinutes(value)}</span>
      </div>
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
