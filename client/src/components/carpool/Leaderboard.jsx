import { useRef } from 'react';
import { Crown, Medal, Leaf, Car, Sparkles } from 'lucide-react';
import { Card } from '@/components/common/Card.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { useAuthStore } from '@/stores/authStore.js';
import { carpoolApi } from '@/services/endpoints.js';
import { burstConfetti } from '@/utils/confetti.js';
import { cn } from '@/utils/cn.js';

// Static class maps for the 2nd/3rd medals — never interpolate class names (Tailwind can't see them).
const MEDAL_META = {
  1: { ring: 'ring-yellow-400/40', badge: 'bg-yellow-400/20 text-yellow-500', glow: 'bg-yellow-400/20' },
  2: { ring: 'ring-slate-400/40', badge: 'bg-slate-400/20 text-slate-400', glow: 'bg-slate-400/15' },
  3: { ring: 'ring-amber-500/40', badge: 'bg-amber-500/20 text-amber-500', glow: 'bg-amber-500/15' },
};
const GOLD_CONFETTI = ['#f5c542', '#ffd700', '#fff2b3', '#ff8a3d', '#ffffff'];

/**
 * PodiumFirst — the ONE hero moment of the carpool board: the #1 CO₂ saver rendered on real
 * liquid-glass refraction (useLiquidGlass + .lg-hero), a floating crown, a light-over-water drift
 * behind the content (never over text), and count-up stats. Wrapped by the page in a .card-solid
 * surface so this hero is NOT nested inside a glass .card (no stacked blurs). Clicking the champion
 * pops gold confetti from the crown.
 */
function PodiumFirst({ row, isViewer }) {
  const glassRef = useLiquidGlass(true, { scale: -70, chroma: 5, blur: 6, saturate: 1.5, mapBlur: 16, border: 0.1 });
  const co2 = useCountUp(row.co2Kg, { decimals: 1 });
  const trips = useCountUp(row.trips);
  const crownRef = useRef(null);

  const celebrate = () => {
    const r = crownRef.current?.getBoundingClientRect();
    burstConfetti({
      x: r ? r.left + r.width / 2 : undefined,
      y: r ? r.top + r.height / 2 : undefined,
      colors: GOLD_CONFETTI,
      count: 110,
    });
  };

  return (
    <div
      ref={glassRef}
      role="button"
      tabIndex={0}
      onClick={celebrate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); celebrate(); } }}
      className={cn(
        'lg-hero group relative cursor-pointer overflow-hidden rounded-xl-increased border p-5 animate-pop-in',
        'border-yellow-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80',
        isViewer && 'ring-2 ring-yellow-400/60'
      )}
      title="Tap to celebrate the champion"
    >
      {/* Signature flair: slow light-over-water drift, strictly BEHIND content (aria-hidden). */}
      <div className="glass-drift pointer-events-none absolute inset-0" aria-hidden />
      {/* Warm gold corner bloom. */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-yellow-400/20 blur-3xl" aria-hidden />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span ref={crownRef} className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-yellow-400/20 text-yellow-500 ring-1 ring-yellow-400/40">
            <Crown className="h-8 w-8 animate-float" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-yellow-500">
              <Sparkles className="h-3.5 w-3.5" /> Top CO₂ saver
            </p>
            <p className="truncate text-title-lg font-bold text-content">
              {isViewer ? 'You' : row.name || 'Someone great'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <Car className="h-4 w-4" /> {trips} shared {trips === 1 ? 'trip' : 'trips'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-4xl font-black tabular-nums text-gradient-brand">
            <Leaf className="h-7 w-7 text-success" />
            {co2.toFixed(1)}
          </p>
          <p className="text-xs text-faint">kg CO₂ saved</p>
        </div>
      </div>
    </div>
  );
}

/** A single ranked medal row (positions 2+). Highlights the viewer's own row. */
function MedalRow({ row, rank, isViewer }) {
  const meta = MEDAL_META[rank];
  const co2 = useCountUp(row.co2Kg, { decimals: 1 });
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-bg-elevated p-3 transition-colors',
        isViewer && 'bg-brand/10 ring-1 ring-brand/30'
      )}
    >
      <span
        className={cn(
          'relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ring-1',
          meta ? cn(meta.badge, meta.ring) : 'bg-surface-2 text-muted ring-border'
        )}
      >
        {meta ? <Medal className="h-5 w-5" /> : rank}
        {meta && <span className={cn('pointer-events-none absolute -inset-1 rounded-xl blur-md', meta.glow)} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-title-md text-content">
          {isViewer ? 'You' : row.name || 'Member'}
          {isViewer && <span className="ml-2 align-middle text-xs font-medium text-brand-strong">· that's you</span>}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Car className="h-3.5 w-3.5" /> {row.trips} {row.trips === 1 ? 'trip' : 'trips'}
          {row.credits > 0 && <span className="text-faint">· {row.credits} credits</span>}
        </p>
      </div>
      <div className="text-right">
        <p className="flex items-center justify-end gap-1 text-lg font-bold tabular-nums text-content">
          <Leaf className="h-4 w-4 text-success" />
          {co2.toFixed(1)}
        </p>
        <p className="text-[11px] text-faint">kg CO₂</p>
      </div>
    </li>
  );
}

/**
 * Carpool CO₂ Leaderboard. Rows come from carpoolApi.leaderboard({window}), already sorted desc by
 * co2Kg on the server. #1 gets the PodiumFirst liquid-glass hero (rendered in a .card-solid wrapper
 * so it isn't nested in glass); the rest render as staggered medal rows with the viewer highlighted.
 */
export function Leaderboard({ window: win = 'week' }) {
  const viewerId = useAuthStore((s) => s.user?.id);
  const board = useApi(() => carpoolApi.leaderboard({ window: win }), [win]);

  const rows = board.data || [];
  const [first, ...rest] = rows;

  return (
    <section aria-label="Carpool CO₂ leaderboard" className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-success/15 text-success">
          <Leaf className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-title-md font-semibold text-content">Carpool CO₂ champions</h2>
          <p className="text-sm text-muted">Ranked by kilograms of CO₂ kept out of the air.</p>
        </div>
      </div>

      {board.loading && !rows.length ? (
        <div className="grid place-items-center py-10"><Spinner label="Tallying trips…" /></div>
      ) : board.error ? (
        <ErrorState error={board.error} onRetry={board.refetch} title="Could not load the leaderboard" />
      ) : rows.length === 0 ? (
        <Card className="card-solid">
          <EmptyState
            icon={Leaf}
            title="No shared trips yet"
            description="Complete a carpool this window and you'll be the first name on the board. 🌱"
          />
        </Card>
      ) : (
        <>
          {/* .card-solid page wrapper: the lg-hero refraction lives here so it's NEVER inside a glass .card. */}
          <div className="card-solid rounded-xl-increased p-1.5">
            <PodiumFirst row={first} isViewer={first.userId === viewerId} />
          </div>

          {rest.length > 0 && (
            <ol className="stagger space-y-2">
              {rest.map((row, i) => (
                <MedalRow
                  key={row.userId}
                  row={row}
                  rank={i + 2}
                  isViewer={row.userId === viewerId}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
