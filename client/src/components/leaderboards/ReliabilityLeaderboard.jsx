import { ShieldCheck, Medal, Lock, Crown } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { EmptyState } from '@/components/common/States.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { cn } from '@/utils/cn.js';

const RANK_TONE = ['text-warning', 'text-muted', 'text-tertiary']; // gold, silver, bronze

/** Rank #1 row — the approved hero-glass moment. Real refraction, not just tonal color. */
function PodiumFirst({ row, highlightUserId }) {
  const glassRef = useLiquidGlass(true, { scale: -90, chroma: 6, blur: 6, saturate: 1.5, mapBlur: 16, border: 0.1 });
  const mine = row.userId === highlightUserId;
  return (
    <div
      ref={glassRef}
      className={cn(
        'lg-hero sheen relative mb-2 overflow-hidden rounded-xl-increased border p-3.5 animate-pop-in',
        mine ? 'border-brand/60' : 'border-warning/40'
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-warning/20 blur-3xl" aria-hidden />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning animate-float">
          <Crown className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-title-md text-content">
          {row.name}
          {mine && <span className="ml-1.5 text-xs font-medium text-brand-strong">(you)</span>}
        </span>
        {row.lockedUntil && (
          <Badge tone="danger">
            <Lock className="h-3 w-3" />
            Locked
          </Badge>
        )}
        <span className="text-headline-sm text-content tabular-nums">{row.score}</span>
      </div>
    </div>
  );
}

/** Ranks 2–3 — elevated but ambient (tonal medal, no glass). */
function PodiumRow({ row, rank, highlightUserId }) {
  const mine = row.userId === highlightUserId;
  return (
    <li className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-medium ease-emphasized hover:-translate-y-px', mine ? 'bg-brand/10 ring-1 ring-brand/40' : 'bg-bg-elevated hover:bg-surface-2')}>
      <span className="grid h-7 w-7 shrink-0 place-items-center">
        <Medal className={cn('h-[1.125rem] w-[1.125rem] drop-shadow-sm', RANK_TONE[rank])} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-content">
        {row.name}
        {mine && <span className="ml-1 text-xs text-brand-strong">(you)</span>}
      </span>
      {row.lockedUntil && (
        <Badge tone="danger">
          <Lock className="h-3 w-3" />
          Locked
        </Badge>
      )}
      <span className="w-14 text-right font-semibold text-content tabular-nums">{row.score}</span>
    </li>
  );
}

/**
 * One ranked list of reliability scores — shared by the "Most reliable" and "Needs
 * improvement" panels below. `rows`: [{ userId, name, score, lockedUntil }]. `podium` gates
 * the hero/podium treatment onto only the "Most reliable" list — celebrating a top overtime
 * offender would send the wrong signal, so "Needs improvement" always renders as a plain list.
 */
function RankedList({ rows, highlightUserId, emptyLabel, podium = false }) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-faint">{emptyLabel}</p>;
  }

  const top3 = podium ? rows.slice(0, 3) : [];
  const rest = podium ? rows.slice(3) : rows;

  return (
    <div>
      {podium && top3[0] && <PodiumFirst row={top3[0]} highlightUserId={highlightUserId} />}
      {(podium ? [...top3.slice(1), ...rest] : rest).length > 0 && (
        <ol className="space-y-1.5">
          {(podium ? top3.slice(1) : []).map((r, i) => (
            <PodiumRow key={r.userId} row={r} rank={i + 1} highlightUserId={highlightUserId} />
          ))}
          {rest.map((r, i) => {
            const rank = podium ? i + 3 : i;
            const mine = r.userId === highlightUserId;
            return (
              <li
                key={r.userId}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors duration-medium ease-emphasized',
                  mine ? 'bg-brand/10 ring-1 ring-brand/40' : rank % 2 ? 'bg-bg-elevated hover:bg-surface-2' : 'hover:bg-bg-elevated'
                )}
              >
                <span className="w-6 shrink-0 text-center font-semibold text-faint">{rank + 1}</span>
                <span className="min-w-0 flex-1 truncate text-content">
                  {r.name}
                  {mine && <span className="ml-1 text-xs text-brand-strong">(you)</span>}
                </span>
                {r.lockedUntil && (
                  <Badge tone="danger">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
                <span className="w-14 text-right font-semibold text-content tabular-nums">{r.score}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Best/worst reliability performers — rewards fast unplugging + carpool driving, penalizes
 * chronic overtime. Users currently hard-locked out of the queue are flagged, not hidden, so
 * the leaderboard stays an honest picture of who's struggling rather than quietly omitting them.
 * `data` is the payload from reliabilityApi.leaderboard(): { top, bottom }.
 */
export function ReliabilityLeaderboard({ data, highlightUserId }) {
  const top = data?.top || [];
  const bottom = data?.bottom || [];

  if (top.length === 0 && bottom.length === 0) {
    return (
      <Card>
        <CardHeader title="Reliability" subtitle="Fast unplugging, carpool driving, and staying off overtime" icon={ShieldCheck} />
        <EmptyState icon={ShieldCheck} title="Not enough activity yet" description="Reliability scores build up as people charge and carpool." />
      </Card>
    );
  }

  return (
    // Both panels use card-solid, not glass .card: the "Most reliable" panel nests a .lg-hero
    // podium (real refraction) which must not sit under a card's backdrop-blur (stacked filters =
    // muddy + costly). The sibling matches it so the two side-by-side panels read consistently.
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card-solid p-4">
        <CardHeader title="Most reliable" subtitle="Quick unplugs, carpool driving, no overtime" icon={ShieldCheck} />
        <RankedList rows={top} highlightUserId={highlightUserId} emptyLabel="No scores yet." podium />
      </div>
      <div className="card-solid p-4">
        <CardHeader title="Needs improvement" subtitle="Frequent or long overtime" icon={ShieldCheck} />
        <RankedList rows={bottom} highlightUserId={highlightUserId} emptyLabel="No scores yet." />
      </div>
    </div>
  );
}
