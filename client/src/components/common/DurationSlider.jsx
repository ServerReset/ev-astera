import { formatDurationMinutes } from '@/utils/time.js';

/** Minutes-based duration slider, snapped to `step`. Shared by StartSessionModal + EtaModal. */
export function DurationSlider({ label, value, onChange, min = 30, max = 240, step = 15, error }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label mb-0">{label}</span>
        <span className="text-sm font-semibold text-brand-strong">{formatDurationMinutes(value)}</span>
      </div>
      <input
        type="range"
        className="slider mt-2"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-xs text-faint">
        <span>{formatDurationMinutes(min)}</span>
        <span>{formatDurationMinutes(max)}</span>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
