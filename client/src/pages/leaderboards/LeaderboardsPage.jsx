import { useState } from 'react';
import { Trophy, Leaf, Car, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Select } from '@/components/common/Input.jsx';
import { Leaderboard } from '@/components/carpool/Leaderboard.jsx';
import { ReliabilityLeaderboard } from '@/components/leaderboards/ReliabilityLeaderboard.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { carpoolApi } from '@/services/endpoints.js';

const WINDOW_OPTIONS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

/** A single site-wide savings tile: an icon, a big count-up number, and a caption. */
function SavingsTile({ icon: Icon, value, decimals = 0, unit, label, tone }) {
  const display = useCountUp(value, { decimals });
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-bg-elevated p-4">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${tone.glow}`} aria-hidden />
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone.chip}`}>
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

  // Re-tally totals live; the child boards run their own realtime-independent refetch on `win`.
  useRealtime('leaderboards', ['carpool_trip_logs', 'reliability_events'], () => totals.refetch());

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
        {/* Site-wide savings — the collective headline, in a .card-solid so its inner tiles never
            create nested glass. */}
        <section aria-label="Site-wide savings" className="card-solid rounded-xl-increased p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-title-md font-semibold text-content">Site-wide savings</h2>
              <p className="text-sm text-muted">What everyone here saved together, {WINDOW_OPTIONS.find((o) => o.value === win)?.label.toLowerCase()}.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SavingsTile icon={Leaf} value={t.co2Kg} decimals={1} unit="kg" label="CO₂ kept out of the air" tone={TILE_TONES.success} />
            <SavingsTile icon={Car} value={t.trips} label="Shared trips completed" tone={TILE_TONES.brand} />
          </div>
        </section>

        {/* Carpool CO₂ leaderboard — owns its own podium hero + medal rows. */}
        <Leaderboard window={win} />

        {/* Reliability standings — most reliable (podium) + needs improvement (plain). */}
        <ReliabilityLeaderboard />
      </div>
    </div>
  );
}
