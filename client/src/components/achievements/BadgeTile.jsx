import { Lock } from 'lucide-react';
import { Icon } from '@/components/common/Icon.jsx';
import { TIER_META } from '@/utils/achievements.js';
import { formatDate } from '@/utils/time.js';
import { useTilt } from '@/hooks/useInteractions.js';
import { cn } from '@/utils/cn.js';

/**
 * One badge in the trophy case. Unlocked tiles wear their tier's metallic gradient, a tilt-to-cursor
 * lift, a hover sheen, and a soft tier-colored bloom behind the icon — a small "this is yours" reward.
 * Locked tiles are greyed silhouettes with a Lock glyph and, for count-metric badges, a progress bar
 * toward the target ("3 / 10"); event-metric locks just read "Locked".
 */
export function BadgeTile({ badge, index = 0 }) {
  const tier = TIER_META[badge.tier] || TIER_META.bronze;
  const tiltRef = useTilt(8);
  const progress = badge.progress;
  const pct = progress && progress.target > 0
    ? Math.min(100, Math.round((progress.current / progress.target) * 100))
    : 0;

  const inner = (
    <div
      className={cn(
        'group relative flex h-full flex-col items-center overflow-hidden rounded-xl-increased border p-4 text-center transition-all duration-medium ease-emphasized animate-pop-in',
        badge.unlocked
          ? cn('card-solid hover-sheen shadow-elevation-1 group-hover:shadow-elevation-2', tier.card)
          : 'border-border bg-surface opacity-70'
      )}
      style={{ animationDelay: `${Math.min(index * 45, 500)}ms` }}
    >
      {/* Tier-colored bloom behind an unlocked badge (decorative). */}
      {badge.unlocked && (
        <div
          className={cn(
            'pointer-events-none absolute -top-8 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full opacity-60 blur-2xl transition-opacity duration-medium group-hover:opacity-90',
            tier.badge
          )}
          aria-hidden
        />
      )}

      {/* Medallion */}
      <span
        className={cn(
          'relative grid h-16 w-16 place-items-center rounded-2xl ring-1 transition-transform duration-medium ease-spring',
          badge.unlocked
            ? cn(tier.badge, 'ring-white/10 group-hover:scale-110 group-hover:-rotate-6')
            : 'bg-surface-2 text-faint ring-border'
        )}
      >
        {badge.unlocked ? (
          <Icon name={badge.icon} className="h-8 w-8" strokeWidth={1.75} />
        ) : (
          <Lock className="h-7 w-7" strokeWidth={1.75} />
        )}
      </span>

      {/* Tier chip (unlocked only) */}
      {badge.unlocked && (
        <span className={cn('relative mt-3 rounded-full px-2.5 py-0.5 text-label-sm font-semibold', tier.badge)}>
          {tier.label}
        </span>
      )}

      <p className={cn('relative mt-2 text-title-md', badge.unlocked ? 'text-content' : 'text-muted')}>
        {badge.label}
      </p>
      <p className="relative mt-1 text-body-md text-muted line-clamp-2">{badge.description}</p>

      {/* Footer: unlock date, progress bar, or a plain Locked label */}
      <div className="relative mt-auto w-full pt-3">
        {badge.unlocked ? (
          <p className="text-label-sm text-faint">
            {badge.unlockedAt ? `Unlocked ${formatDate(badge.unlockedAt)}` : 'Unlocked'}
          </p>
        ) : progress ? (
          <div>
            <div className="flex items-center justify-between text-label-sm text-muted">
              <span>Progress</span>
              <span className="tabular-nums">{progress.current} / {progress.target}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full rounded-full bg-brand transition-all duration-long ease-emphasized"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-label-sm text-faint">
            <Lock className="h-3 w-3" />
            Locked
          </span>
        )}
      </div>
    </div>
  );

  // Unlocked tiles get the tilt wrapper; locked tiles stay flat (nothing to reward yet).
  if (badge.unlocked) {
    return <div ref={tiltRef} className="tilt h-full">{inner}</div>;
  }
  return inner;
}
