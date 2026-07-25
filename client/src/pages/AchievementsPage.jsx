import { useMemo } from 'react';
import { Trophy, Lock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Icon } from '@/components/common/Icon.jsx';
import { ErrorState, EmptyState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { achievementApi } from '@/services/endpoints.js';
import { TIER_META } from '@/utils/achievements.js';
import { formatDate } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

/** One badge tile — full-color when unlocked, greyed silhouette + progress hint when locked. */
function BadgeTile({ badge, index }) {
  const tier = TIER_META[badge.tier] || TIER_META.bronze;
  const { unlocked, progress } = badge;
  const pct = progress ? Math.round((progress.current / progress.target) * 100) : 0;

  return (
    <div
      className={cn(
        'group relative flex flex-col items-center gap-2 overflow-hidden rounded-3xl border p-4 text-center',
        'animate-pop-in [animation-fill-mode:backwards]',
        'transition-all duration-medium ease-emphasized press hover:-translate-y-0.5 hover:shadow-elevation-2',
        unlocked ? cn(tier.card, 'shadow-elevation-1') : 'border-border bg-surface opacity-90 hover:opacity-100'
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      {unlocked && (
        <div className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl', tier.badge)} aria-hidden />
      )}
      <span
        className={cn(
          'relative grid h-14 w-14 place-items-center rounded-2xl transition-transform duration-medium ease-spring group-hover:scale-105',
          unlocked ? cn(tier.badge, 'group-hover:rotate-[6deg]') : 'bg-surface-2 text-faint'
        )}
      >
        <Icon name={badge.icon} className={cn('h-7 w-7', !unlocked && 'opacity-40')} strokeWidth={1.75} />
      </span>

      <div className="min-w-0">
        <p className={cn('truncate text-sm font-semibold', unlocked ? 'text-content' : 'text-muted')}>
          {badge.label}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{badge.description}</p>
      </div>

      {unlocked ? (
        <p className="mt-auto text-2xs font-medium uppercase tracking-wide text-faint">
          {badge.unlockedAt ? formatDate(badge.unlockedAt) : tier.label}
        </p>
      ) : progress ? (
        <div className="mt-auto w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand transition-[width] duration-long ease-emphasized" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-2xs tabular-nums text-faint">
            {progress.current} / {progress.target}
          </p>
        </div>
      ) : (
        <p className="mt-auto flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-faint">
          <Lock className="h-3 w-3" /> Locked
        </p>
      )}
    </div>
  );
}

export default function AchievementsPage() {
  const { data, loading, error, refetch } = useApi(() => achievementApi.me(), []);

  // Unlocked first, then in-progress (closest to target first), then untouched locked ones —
  // so the wall reads as "what you've earned → what's within reach → everything else".
  const sorted = useMemo(() => {
    const items = data?.items || [];
    const score = (b) => {
      if (b.unlocked) return 1000;
      if (b.progress) return (b.progress.current / b.progress.target) * 100;
      return -1;
    };
    return [...items].sort((a, b) => score(b) - score(a));
  }, [data]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Achievements"
        description="Badges you earn for charging, carpooling, and helping the site run smoothly."
        icon={Trophy}
        action={
          data ? (
            <span className="shrink-0 rounded-full bg-brand/15 px-3 py-1.5 text-sm font-semibold tabular-nums text-brand-strong ring-1 ring-brand/25 animate-scale-in">
              {data.unlockedCount} / {data.total}
            </span>
          ) : null
        }
      />

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} title="Could not load your achievements" />
      ) : sorted.length === 0 ? (
        <div className="animate-scale-in">
          <EmptyState icon={Trophy} title="Your trophy case is waiting" description="Start a session or hop in a carpool to earn your first badge." />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((b, i) => (
            <BadgeTile key={b.key} badge={b} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
