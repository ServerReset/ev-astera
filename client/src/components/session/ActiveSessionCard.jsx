import { useState } from 'react';
import { Zap, Clock, Timer, ArrowUpRight, Car } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { useCountdown, useElapsed } from '@/hooks/useCountdown.js';
import { formatTime } from '@/utils/time.js';
import { SESSION_STATUS } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

/**
 * Banner for the viewer's own active session: a live countdown to ETA, overtime emphasis,
 * and quick actions (extend ETA, end). Rendered at the top of the dashboard when present.
 *
 * One of the two approved hero-glass moments — real SVG-filter refraction (not a flat blur),
 * tuned bolder (scale/chroma) than the ambient .lg-panel usage on nav/modals/toasts.
 */
export function ActiveSessionCard({ session, onExtend, onEnd, onLinkCarpool }) {
  const overtime = session.status === SESSION_STATUS.OVERTIME;
  const { label: countdownLabel, done } = useCountdown(session.etaAt);
  const { label: elapsedLabel } = useElapsed(session.etaAt);
  const label = overtime ? elapsedLabel : countdownLabel;
  const [busy, setBusy] = useState(false);
  const glassRef = useLiquidGlass(true, { scale: -95, chroma: 6, blur: 7, saturate: 1.5, mapBlur: 18, border: 0.09 });

  const wrap = (fn) => async () => {
    setBusy(true);
    try {
      await fn?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={glassRef}
      className={cn(
        'lg-hero relative overflow-hidden rounded-xl-increased border p-5 animate-pop-in',
        overtime ? 'border-warning/50' : 'border-brand/40'
      )}
    >
      {/* Signature flair: a slow specular sheen sweeping the live hero (calm mode only). */}
      {!overtime && <div className="sheen pointer-events-none absolute inset-0" aria-hidden />}

      <div
        className={cn(
          'pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl',
          overtime ? 'bg-warning/20 animate-pulse' : 'bg-brand/25'
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
            <p className="text-body-sm text-muted">{session.chargerName || 'Your charger'}</p>
            <p className="text-headline-sm text-content">{overtime ? 'Overtime' : 'Charging'}</p>
          </div>
        </div>

        <div className="text-right">
          <div className={cn('flex items-center justify-end gap-1.5 text-display-sm tabular-nums', overtime ? 'text-warning' : 'text-content')}>
            {overtime ? <Timer className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
            {overtime ? `+${label}` : done ? '0:00' : label}
          </div>
          <p className="text-xs text-faint">{overtime ? 'over your estimate' : `est. done ${formatTime(session.etaAt)}`}</p>
        </div>
      </div>

      {overtime && (
        <div className="relative mt-4">
          <Badge tone="warning">Others may be waiting — please wrap up or extend.</Badge>
        </div>
      )}

      <div className="relative mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" loading={busy} onClick={wrap(onExtend)}>
          <ArrowUpRight className="h-4 w-4" />
          Adjust ETA
        </Button>
        {onLinkCarpool && (
          <Button variant="ghost" size="sm" onClick={onLinkCarpool}>
            <Car className="h-4 w-4" />
            Offer a carpool
          </Button>
        )}
        <Button variant="primary" size="sm" className="ml-auto" loading={busy} onClick={wrap(onEnd)}>
          End session
        </Button>
      </div>
    </div>
  );
}
