import { useRef } from 'react';
import { ShieldCheck, Trophy, Crown, Lock, TrendingDown } from 'lucide-react';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { useAuthStore } from '@/stores/authStore.js';
import { reliabilityApi } from '@/services/endpoints.js';
import { burstConfetti } from '@/utils/confetti.js';
import { cn } from '@/utils/cn.js';

const GOLD_CONFETTI = ['#f5c542', '#ffd700', '#fff2b3', '#4fb477', '#ffffff'];

/**
 * ReliabilityPodium — the #1 most-reliable member on real liquid-glass refraction (useLiquidGlass +
 * .lg-hero), floating crown, light-over-water drift behind content, and a count-up score. Only ever
 * used on the "Most reliable" side. Rendered by the panel inside a .card-solid wrapper so this hero
 * is not nested in a glass .card.
 */
function ReliabilityPodium({ row, isViewer }) {
  const glassRef = useLiquidGlass(true, { scale: -70, chroma: 5, blur: 6, saturate: 1.5, mapBlur: 16, border: 0.1 });
  const score = useCountUp(row.score, { decimals: 1 });
  const crownRef = useRef(null);

  const celebrate = () => {
    const r = crownRef.current?.getBoundingClientRect();
    burstConfetti({
      x: r ? r.left + r.width / 2 : undefined,
      y: r ? r.top + r.height / 2 : undefined,
      colors: GOLD_CONFETTI,
      count: 100,
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
      title="Tap to celebrate"
    >
      <div className="glass-drift pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" aria-hidden />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span ref={crownRef} className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-yellow-400/20 text-yellow-500 ring-1 ring-yellow-400/40">
            <Crown className="h-8 w-8 animate-float" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-yellow-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Most reliable
            </p>
            <p className="truncate text-title-lg font-bold text-content">{isViewer ? 'You' : row.name || 'Member'}</p>
            <p className="mt-0.5 text-sm text-muted">Rock-solid charging etiquette.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black tabular-nums text-gradient-brand">{score.toFixed(0)}</p>
          <p className="text-xs text-faint">reliability</p>
        </div>
      </div>
    </div>
  );
}

/** One row in a RankedList. Shows rank, name, a score bar, and a danger "Locked" badge when locked. */
function RankedRow({ row, rank, isViewer, side }) {
  const locked = Boolean(row.lockedUntil);
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-bg-elevated p-3 transition-colors',
        isViewer && 'bg-brand/10 ring-1 ring-brand/30'
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ring-1',
          side === 'bottom' ? 'bg-warning/12 text-warning ring-warning/25' : 'bg-surface-2 text-muted ring-border'
        )}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-title-md text-content">
          <span className="truncate">{isViewer ? 'You' : row.name || 'Member'}</span>
          {locked && (
            <Badge tone="danger" className="shrink-0">
              <Lock className="h-3 w-3" /> Locked
            </Badge>
          )}
        </p>
        {/* Slim score meter (0–100 range visual). */}
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div
            className={cn('h-full rounded-full', side === 'bottom' ? 'bg-warning/70' : 'bg-success/70')}
            style={{ width: `${Math.max(4, Math.min(100, row.score))}%` }}
          />
        </div>
      </div>
      <p className="shrink-0 text-lg font-bold tabular-nums text-content">{Math.round(row.score)}</p>
    </li>
  );
}

/**
 * RankedList — shared sub-component for both reliability panels. When `podium` is set and there's a
 * leader, the #1 row is promoted to the liquid-glass ReliabilityPodium (inside a .card-solid wrapper)
 * and the remainder render as staggered ranked rows. The "Needs improvement" side passes podium=false
 * so it stays a plain, non-celebratory list.
 */
function RankedList({ rows, podium, side, viewerId, emptyIcon, emptyTitle, emptyDescription }) {
  if (!rows || rows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  if (podium) {
    const [first, ...rest] = rows;
    return (
      <div className="space-y-3">
        <div className="card-solid rounded-xl-increased p-1.5">
          <ReliabilityPodium row={first} isViewer={first.userId === viewerId} />
        </div>
        {rest.length > 0 && (
          <ol className="stagger space-y-2">
            {rest.map((row, i) => (
              <RankedRow key={row.userId} row={row} rank={i + 2} side={side} isViewer={row.userId === viewerId} />
            ))}
          </ol>
        )}
      </div>
    );
  }

  return (
    <ol className="stagger space-y-2">
      {rows.map((row, i) => (
        <RankedRow key={row.userId} row={row} rank={i + 1} side={side} isViewer={row.userId === viewerId} />
      ))}
    </ol>
  );
}

/**
 * ReliabilityLeaderboard — two .card-solid panels side by side: "Most reliable" (podium treatment on
 * #1) and "Needs improvement" (plain). Data from reliabilityApi.leaderboard() → { top, bottom }.
 * Rows: [{ userId, name, score, lockedUntil }]; a danger "Locked" badge shows when lockedUntil is set.
 */
export function ReliabilityLeaderboard() {
  const viewerId = useAuthStore((s) => s.user?.id);
  const board = useApi(() => reliabilityApi.leaderboard(), []);
  const { top = [], bottom = [] } = board.data || {};

  if (board.loading && !board.data) {
    return (
      <div className="card-solid rounded-xl-increased p-4">
        <div className="grid place-items-center py-10"><Spinner label="Reading the standings…" /></div>
      </div>
    );
  }
  if (board.error) {
    return (
      <div className="card-solid rounded-xl-increased p-4">
        <ErrorState error={board.error} onRetry={board.refetch} title="Could not load reliability standings" />
      </div>
    );
  }

  return (
    <section aria-label="Reliability standings" className="grid gap-4 lg:grid-cols-2">
      {/* Most reliable — podium hero on #1. */}
      <div className="card-solid rounded-xl-increased p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-success/15 text-success">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-title-md font-semibold text-content">Most reliable</h3>
            <p className="text-sm text-muted">The people who always wrap up on time.</p>
          </div>
        </div>
        <RankedList
          rows={top}
          podium
          side="top"
          viewerId={viewerId}
          emptyIcon={Trophy}
          emptyTitle="No standings yet"
          emptyDescription="Reliability scores appear once people start charging."
        />
      </div>

      {/* Needs improvement — plain, no podium. */}
      <div className="card-solid rounded-xl-increased p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-warning/15 text-warning">
            <TrendingDown className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-title-md font-semibold text-content">Needs improvement</h3>
            <p className="text-sm text-muted">A nudge to unplug on time and keep chargers flowing.</p>
          </div>
        </div>
        <RankedList
          rows={bottom}
          podium={false}
          side="bottom"
          viewerId={viewerId}
          emptyIcon={ShieldCheck}
          emptyTitle="Everyone's in good standing"
          emptyDescription="No one needs a reminder right now. Nice. ✨"
        />
      </div>
    </section>
  );
}
