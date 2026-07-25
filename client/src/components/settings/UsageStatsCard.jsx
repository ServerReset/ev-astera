import { Flame, Zap, Route, Leaf } from 'lucide-react';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { cn } from '@/utils/cn.js';

/** One animated stat, count-up on mount. */
function Stat({ icon: Icon, value, label, decimals = 0, suffix = '' }) {
  const shown = useCountUp(value || 0, { decimals });
  return (
    <div className="relative flex flex-col gap-1 rounded-2xl bg-surface/40 p-3 backdrop-blur-sm">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-2xl font-black tabular-nums text-content">
        {decimals ? shown.toFixed(decimals) : shown}
        {suffix}
      </span>
    </div>
  );
}

/**
 * The Profile section's hero moment: this week's usage + lifetime totals + carpool impact, on real
 * liquid glass. A Flame streak chip floats in when the user has an active day-streak.
 */
export function UsageStatsCard({ stats }) {
  const glassRef = useLiquidGlass(true, { scale: -70, chroma: 5, blur: 6, saturate: 1.4, mapBlur: 14, border: 0.1 });
  const used = stats?.weeklySessionsUsed ?? 0;
  const max = stats?.weeklySessionsMax ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const streak = stats?.streakDays ?? 0;
  const carpool = stats?.carpool || {};

  return (
    <div
      ref={glassRef}
      className="lg-hero relative overflow-hidden rounded-xl-increased border border-brand/40 p-5 animate-pop-in"
    >
      <div className="glass-drift pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/25 blur-3xl" aria-hidden />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">This week</p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-4xl font-black tabular-nums text-gradient-brand">{used}</span>
            <span className="text-lg font-semibold text-muted">/ {max || '∞'} sessions</span>
          </p>
        </div>
        {streak > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1.5 text-sm font-semibold text-warning animate-float">
            <Flame className="h-4 w-4" />
            {streak}-day streak
          </span>
        )}
      </div>

      {/* Weekly usage meter */}
      {max > 0 && (
        <div className="relative mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-surface/60">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r from-brand to-brand-strong transition-[width] duration-long ease-emphasized',
                pct >= 100 && 'from-warning to-warning'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-faint">
            {used >= max ? "You've used your sessions for this week." : `${max - used} left this week.`}
          </p>
        </div>
      )}

      <div className="relative mt-4 grid grid-cols-3 gap-2.5">
        <Stat icon={Zap} value={stats?.totalSessions ?? 0} label="Lifetime" />
        <Stat icon={Route} value={carpool.trips ?? 0} label="Carpools" />
        <Stat icon={Leaf} value={carpool.co2Kg ?? 0} label="CO₂ kg" decimals={1} />
      </div>
    </div>
  );
}
