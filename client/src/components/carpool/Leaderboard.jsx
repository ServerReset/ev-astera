import { Trophy, Medal, Crown } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
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
        'lg-hero relative mb-2 overflow-hidden rounded-xl-increased border p-3.5 animate-pop-in',
        mine ? 'border-brand/60' : 'border-warning/40'
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-warning/20 blur-3xl" aria-hidden />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning">
          <Crown className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-title-md text-content">
          {row.name}
          {mine && <span className="ml-1.5 text-xs font-medium text-brand-strong">(you)</span>}
        </span>
        <span className="text-xs text-muted">{row.trips} trips</span>
        <span className="text-headline-sm text-success tabular-nums">{row.co2Kg} kg</span>
      </div>
    </div>
  );
}

/**
 * CO₂-savings leaderboard (Feature 4). `rows` from carpoolApi.leaderboard:
 * [{ userId, name, trips, co2Kg, credits }], already sorted desc by co2Kg.
 * `highlightUserId` bolds the viewer's row. Rank #1 gets the approved hero-glass treatment.
 */
export function Leaderboard({ rows = [], highlightUserId, window, onWindowChange }) {
  const first = rows[0];
  const rest = rows.slice(1);

  return (
    <Card>
      <CardHeader
        title="Leaderboard"
        subtitle="Most CO₂ saved by carpooling"
        icon={Trophy}
        action={
          <select
            value={window}
            onChange={(e) => onWindowChange?.(e.target.value)}
            className="input h-8 w-auto py-0 text-sm"
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No trips logged yet" description="Complete a carpool to get on the board." />
      ) : (
        <div>
          {first && <PodiumFirst row={first} highlightUserId={highlightUserId} />}
          {rest.length > 0 && (
            <ol className="space-y-1.5">
              {rest.map((r, i) => {
                const rank = i + 1;
                const mine = r.userId === highlightUserId;
                return (
                  <li
                    key={r.userId}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm',
                      mine ? 'bg-brand/10 ring-1 ring-brand/40' : rank % 2 ? 'bg-bg-elevated' : ''
                    )}
                  >
                    <span className="w-6 shrink-0 text-center font-semibold">
                      {rank < 3 ? <Medal className={cn('mx-auto h-4 w-4', RANK_TONE[rank])} /> : <span className="text-faint">{rank + 1}</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-content">
                      {r.name}
                      {mine && <span className="ml-1 text-xs text-brand-strong">(you)</span>}
                    </span>
                    <span className="text-xs text-muted">{r.trips} trips</span>
                    <span className="w-20 text-right font-semibold text-success tabular-nums">{r.co2Kg} kg</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </Card>
  );
}
