import { ShieldCheck, Medal, Lock } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { EmptyState } from '@/components/common/States.jsx';
import { cn } from '@/utils/cn.js';

const RANK_TONE = ['text-warning', 'text-muted', 'text-tertiary']; // gold, silver, bronze

/**
 * One ranked list of reliability scores — shared by the "Most reliable" and "Needs
 * improvement" panels below. `rows`: [{ userId, name, score, lockedUntil }].
 */
function RankedList({ rows, highlightUserId, emptyLabel }) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-faint">{emptyLabel}</p>;
  }
  return (
    <ol className="space-y-1.5">
      {rows.map((r, i) => {
        const mine = r.userId === highlightUserId;
        return (
          <li
            key={r.userId}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
              mine ? 'bg-brand/10 ring-1 ring-brand/40' : i % 2 ? 'bg-bg-elevated' : ''
            )}
          >
            <span className="w-6 shrink-0 text-center font-semibold">
              {i < 3 ? <Medal className={cn('mx-auto h-4 w-4', RANK_TONE[i])} /> : <span className="text-faint">{i + 1}</span>}
            </span>
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
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader title="Most reliable" subtitle="Quick unplugs, carpool driving, no overtime" icon={ShieldCheck} />
        <RankedList rows={top} highlightUserId={highlightUserId} emptyLabel="No scores yet." />
      </Card>
      <Card>
        <CardHeader title="Needs improvement" subtitle="Frequent or long overtime" icon={ShieldCheck} />
        <RankedList rows={bottom} highlightUserId={highlightUserId} emptyLabel="No scores yet." />
      </Card>
    </div>
  );
}
