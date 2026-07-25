import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper, Sparkles, X } from 'lucide-react';
import { Icon } from '@/components/common/Icon.jsx';
import { useCelebrationWatcher } from '@/hooks/useCelebrationWatcher.js';
import { burstConfetti } from '@/utils/confetti.js';
import { TIER_META } from '@/utils/achievements.js';
import { cn } from '@/utils/cn.js';

const AUTO_DISMISS_MS = 5000;

/**
 * The one deliberately-loud moment in the app: a transient top-of-screen reveal card + a
 * hand-rolled confetti burst, fired when a genuinely-new achievement unlock or carpool match
 * notification lands (see useCelebrationWatcher). This is a THIRD, separate visual language from
 * the two approved hero-glass surfaces — motion + confetti, not glass — so it doesn't dilute them.
 * Mounted once, globally, by AppLayout. Auto-dismisses; also tap/✕/Esc to close.
 */
export function CelebrationOverlay() {
  const { celebration, dismiss } = useCelebrationWatcher();
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const kind = celebration?.kind;
  const meta = celebration?.notification?.metadata || {};
  const tier = kind === 'achievement' ? TIER_META[meta.tier] || TIER_META.bronze : null;

  useEffect(() => {
    if (!celebration) return undefined;
    // Fire confetti themed to the tier (achievement) or a brand set (match), from top-center.
    burstConfetti({ colors: tier?.confetti });
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    const onKey = (e) => e.key === 'Escape' && dismiss();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebration?.id]);

  if (!celebration) return null;

  const isAchievement = kind === 'achievement';
  const title = isAchievement ? (meta.label || 'Achievement unlocked') : "It's a match!";
  const subtitle = isAchievement
    ? celebration.notification.body
    : 'A carpool matches your plans. Tap to see the ride.';
  const score = !isAchievement ? meta.score : null;

  const go = () => {
    const url = celebration.notification.actionUrl || (isAchievement ? '/achievements' : '/carpool');
    dismiss();
    navigate(url);
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto relative w-full max-w-md overflow-hidden rounded-3xl border p-4 shadow-elevation-3',
          'animate-pop-in cursor-pointer',
          isAchievement ? tier.card : 'border-brand/40 bg-gradient-to-br from-brand/20 via-surface to-surface'
        )}
        role="button"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go())}
      >
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-content"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-4">
          <span
            className={cn(
              'grid h-16 w-16 shrink-0 place-items-center rounded-2xl',
              isAchievement ? tier.badge : 'bg-brand/20 text-brand-strong'
            )}
          >
            {isAchievement ? (
              <Icon name={meta.icon || 'Trophy'} className="h-8 w-8" strokeWidth={1.75} />
            ) : (
              <PartyPopper className="h-8 w-8" strokeWidth={1.75} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Sparkles className="h-3.5 w-3.5" />
              {isAchievement ? `${meta.tier || 'bronze'} unlocked` : 'Carpool matched'}
            </p>
            <p className="mt-0.5 truncate text-lg font-bold text-content">{title}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{subtitle}</p>
          </div>

          {score != null && (
            <div className="shrink-0 text-right">
              <p className="text-2xl font-black tabular-nums text-brand-strong">{Math.round(score)}%</p>
              <p className="text-[10px] uppercase tracking-wide text-faint">match</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
