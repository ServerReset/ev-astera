import { useMemo } from 'react';
import { Trophy, RefreshCw, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/common/Button.jsx';
import { EmptyState, ErrorState } from '@/components/common/States.jsx';
import { BadgeTile } from '@/components/achievements/BadgeTile.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { achievementApi } from '@/services/endpoints.js';
import { burstConfetti } from '@/utils/confetti.js';
import { cn } from '@/utils/cn.js';

const GOLD_CONFETTI = ['#f5c542', '#ffd700', '#fff2b3', '#ff8a3d', '#ffffff'];

/**
 * Rank each badge for display. Unlocked come first (most-recent unlock first), then in-progress
 * (closest to their target first), then the rest of the locked badges. Event-metric locks (no
 * progress) sort after count-metric locks that have some progress toward a target.
 */
function rankBadges(items) {
  const progressFraction = (b) =>
    b.progress && b.progress.target > 0 ? b.progress.current / b.progress.target : -1;

  return [...items].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.unlocked && b.unlocked) {
      // Most recently earned first.
      return new Date(b.unlockedAt || 0) - new Date(a.unlockedAt || 0);
    }
    // Both locked: closest to target first.
    return progressFraction(b) - progressFraction(a);
  });
}

/** The counter chip that lives in the PageHeader action slot — a live "earned / total" tally. Once
 * every badge is earned it becomes a glowing, tappable trophy that showers gold confetti. */
function CounterChip({ unlockedCount, total }) {
  const shown = useCountUp(unlockedCount);
  const complete = total > 0 && unlockedCount >= total;

  const showerGold = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    burstConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, colors: GOLD_CONFETTI, count: 120 });
  };

  const chipClass = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-title-md tabular-nums transition-colors duration-medium',
    complete
      ? 'animate-glow border-warning/50 bg-warning/15 text-warning'
      : 'border-border bg-surface text-content'
  );

  const contents = (
    <>
      {complete ? <Trophy className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-brand-strong" />}
      <span>{shown}</span>
      <span className="text-muted">/ {total}</span>
    </>
  );

  if (complete) {
    return (
      <button
        type="button"
        onClick={showerGold}
        title="Full house — take a bow"
        aria-label={`All ${total} badges earned — celebrate`}
        className={cn(chipClass, 'press hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80')}
      >
        {contents}
      </button>
    );
  }

  return (
    <span className={chipClass} aria-label={`${unlockedCount} of ${total} badges earned`}>
      {contents}
    </span>
  );
}

export default function AchievementsPage() {
  const wall = useApi(() => achievementApi.me(), []);
  const data = wall.data;

  const ranked = useMemo(() => rankBadges(data?.items || []), [data]);

  return (
    <div>
      <PageHeader
        title="Badges"
        description="Every milestone you've earned — and the next one to chase."
        icon={Trophy}
        action={
          <div className="flex items-center gap-2">
            {data && <CounterChip unlockedCount={data.unlockedCount} total={data.total} />}
            <Button variant="ghost" size="sm" onClick={wall.refetch} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {wall.loading && !data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-xl-increased" />
          ))}
        </div>
      ) : wall.error ? (
        <ErrorState error={wall.error} onRetry={wall.refetch} title="Could not load your badges" />
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Your trophy case is waiting"
          description="Start a charging session, carpool to work, or send a nudge — badges land here the moment you earn them."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {ranked.map((badge, i) => (
            <BadgeTile key={badge.key} badge={badge} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
