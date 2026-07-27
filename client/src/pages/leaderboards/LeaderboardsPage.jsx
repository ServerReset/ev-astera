import { useState } from 'react';
import { Trophy, Leaf, Car, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Select } from '@/components/common/Input.jsx';
import { Leaderboard } from '@/components/carpool/Leaderboard.jsx';
import { ReliabilityLeaderboard } from '@/components/leaderboards/ReliabilityLeaderboard.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { carpoolApi } from '@/services/endpoints.js';

const WINDOW_OPTIONS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

/** A single site-wide savings tile: an icon, a big count-up number, and a caption. Opaque
 * (bg-bg-elevated) so it never stacks a second blur on the glass hero it sits inside; a spring
 * lift on hover makes it feel tappable-alive without any looping motion. */
function SavingsTile({ icon: Icon, value, decimals = 0, unit, label, tone }) {
  const display = useCountUp(value, { decimals });
  return (
    <div className="group/tile animate-slide-up relative flex items-center gap-4 overflow-hidden rounded-2xl bg-bg-elevated p-4 shadow-elevation-1 transition-[transform,box-shadow] duration-medium ease-spring hover:-translate-y-0.5 hover:shadow-elevation-2">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-medium group-hover/tile:opacity-90 ${tone.glow}`} aria-hidden />
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-transform duration-medium ease-spring group-hover/tile:scale-110 group-hover/tile:-rotate-6 ${tone.chip}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-1 text-3xl font-black tabular-nums text-content">
          {decimals ? display.toFixed(decimals) : display}
          {unit && <span className="text-base font-semibold text-muted">{unit}</span>}
        </p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}

/**
 * SavingsHero — the collective headline, promoted to the page's ONE liquid-glass hero moment.
 * The outer .card-solid keeps this refraction from nesting inside a glass surface (no stacked
 * blurs); the inner .lg-hero carries the actual refraction via useLiquidGlass, with a slow
 * light-over-water drift strictly BEHIND the content and a gently floating headline mark.
 */
function SavingsHero({ totals, windowLabel }) {
  const glassRef = useLiquidGlass(true, { scale: -50, chroma: 3, blur: 6, saturate: 1.5, mapBlur: 20, border: 0.14 });
  return (
    <section aria-label="Site-wide savings" className="card-solid rounded-xl-increased p-1.5">
      <div ref={glassRef} className="lg-hero relative overflow-hidden rounded-xl-increased border border-brand/25 p-4 animate-pop-in">
        {/* Signature flair: slow drift + a soft brand corner bloom, both strictly behind content. */}
        <div className="glass-drift pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" aria-hidden />

        <div className="relative mb-3 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand/15 text-brand-strong ring-1 ring-brand/25">
            <Sparkles className="h-5 w-5 animate-float" />
          </span>
          <div>
            <h2 className="text-title-md font-semibold text-content">Site-wide savings</h2>
            <p className="text-sm text-muted">Everything this whole crew saved together, {windowLabel}.</p>
          </div>
        </div>
        <div className="relative grid gap-3 sm:grid-cols-2">
          <SavingsTile icon={Leaf} value={totals.co2Kg} decimals={1} unit="kg" label="CO₂ kept out of the air" tone={TILE_TONES.success} />
          <SavingsTile icon={Car} value={totals.trips} label="Shared trips completed" tone={TILE_TONES.brand} />
        </div>
      </div>
    </section>
  );
}

// Static tone maps — never interpolate token class names.
const TILE_TONES = {
  success: { chip: 'bg-success/15 text-success', glow: 'bg-success/20' },
  brand: { chip: 'bg-brand/15 text-brand-strong', glow: 'bg-brand/20' },
};

/**
 * LeaderboardsPage — the site's friendly competition hub. A window switcher (week/month/all) scopes
 * every board at once; a site-wide savings banner leads with two count-up tiles (total CO₂ + trips)
 * pulled from carpoolApi.leaderboardTotals; below sit the carpool CO₂ leaderboard (podium hero) and
 * the reliability standings. Sections stagger in. Realtime keeps everything live as trips complete
 * and reliability scores shift.
 */
export default function LeaderboardsPage() {
  const [win, setWin] = useState('week');
  const totals = useApi(() => carpoolApi.leaderboardTotals({ window: win }), [win]);

  // No background poll: leaderboard totals are site-wide aggregates that change only when a trip
  // completes or a reliability event fires (human-rare), and re-tallying them is one of the more
  // expensive queries. They refetch when the window selector changes (the [win] dep above), and on
  // remount — which is plenty fresh for a competition board and saves a costly aggregate every tick.

  const t = totals.data || { co2Kg: 0, trips: 0 };

  return (
    <div>
      <PageHeader
        title="Leaderboards"
        description="Friendly competition for cleaner commutes and courteous charging."
        icon={Trophy}
        action={
          <Select
            aria-label="Leaderboard window"
            value={win}
            onChange={(e) => setWin(e.target.value)}
            options={WINDOW_OPTIONS}
            className="w-40"
          />
        }
      />

      <div className="stagger space-y-6">
        {/* Site-wide savings — the collective headline, on the page's one liquid-glass hero. */}
        <SavingsHero totals={t} windowLabel={WINDOW_OPTIONS.find((o) => o.value === win)?.label.toLowerCase()} />

        {/* Carpool CO₂ leaderboard — owns its own podium hero + medal rows. */}
        <Leaderboard window={win} />

        {/* Reliability standings — most reliable (podium) + needs improvement (plain). */}
        <ReliabilityLeaderboard />
      </div>
    </div>
  );
}
