import { Zap, Clock, Timer, PlugZap } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { useCountdown } from '@/hooks/useCountdown.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { SESSION_STATUS } from '@/utils/constants.js';
import { formatTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

/**
 * The one hero moment on the dashboard: your live charging session, rendered on real liquid glass
 * (useLiquidGlass refraction + .lg-hero dressing) with a light-over-water drift, a live ETA
 * countdown, and extend/end actions. Overtime shifts the whole card to an urgent warning read.
 */
export function ActiveSessionCard({ session, onExtend, onEnd }) {
  const overtime = session.status === SESSION_STATUS.OVERTIME;
  const glassRef = useLiquidGlass(true, { scale: -80, chroma: 5, blur: 6, saturate: 1.5, mapBlur: 16, border: 0.1 });
  const ripple = useRipple();
  const { label: countdownLabel, done } = useCountdown(session.etaAt);

  return (
    <div
      ref={glassRef}
      className={cn(
        'lg-hero relative overflow-hidden rounded-xl-increased border p-5 animate-pop-in',
        overtime ? 'border-warning/50' : 'border-brand/40'
      )}
    >
      {/* Signature flair: a slow light-over-water drift behind the content (never over text). */}
      <div className="glass-drift pointer-events-none absolute inset-0" aria-hidden />
      {/* Corner bloom — warm + urgent when overtime, cool brand otherwise. */}
      <div
        className={cn(
          'pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl',
          overtime ? 'bg-warning/25 animate-pulse' : 'bg-brand/25'
        )}
        aria-hidden
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span
            className={cn(
              'grid h-14 w-14 shrink-0 place-items-center rounded-2xl',
              overtime ? 'bg-warning/15 text-warning' : 'bg-brand/15 text-brand-strong animate-pulse-ring'
            )}
          >
            <Zap className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {overtime ? 'Session overtime' : 'Charging now'}
            </p>
            <p className="text-title-lg font-bold text-content">{session.chargerName || 'Your charger'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <Clock className="h-4 w-4" />
              Est. done {formatTime(session.etaAt)}
            </p>
          </div>
        </div>

        {/* Live countdown ring-ish pill */}
        <div className="text-right">
          <p className={cn('flex items-center justify-end gap-1.5 text-3xl font-black tabular-nums', overtime ? 'text-warning' : 'text-content')}>
            <Timer className="h-6 w-6" />
            {done ? '0:00' : countdownLabel}
          </p>
          <p className="text-xs text-faint">{overtime ? 'over your ETA' : 'remaining'}</p>
        </div>
      </div>

      <div className="relative mt-5 flex gap-2">
        <Button variant="secondary" className="press ripple flex-1" onPointerDown={ripple} onClick={onExtend}>
          <Clock className="h-4 w-4" /> Adjust time
        </Button>
        <Button className="press ripple flex-1" onPointerDown={ripple} onClick={onEnd}>
          <PlugZap className="h-4 w-4" /> End session
        </Button>
      </div>
    </div>
  );
}
